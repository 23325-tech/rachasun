// Edge Function: webhook ของ LINE OA (deploy แบบ --no-verify-jwt ตรวจลายเซ็นของ LINE แทน)
//   ผู้ปกครองพิมพ์รหัส P123456 -> เชื่อมกับนักเรียน / "สรุป" -> ดูสรุปสัปดาห์นี้ / "ยกเลิก" -> หยุดรับ
//   แอดเพื่อน -> ข้อความต้อนรับ / บล็อก -> ลบการเชื่อม
import { createClient } from 'npm:@supabase/supabase-js@2';
import { displayName, lineConfigured, reply, summaryText, verifySignature, type WeeklySummary } from '../_shared/line.ts';

const APP_URL = 'https://brain-gym-psi.vercel.app';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const WELCOME = [
  'สวัสดีจาก Brain Gym',
  'บัญชีนี้ส่งสรุปการฝึกของลูกหลานทุกวันอาทิตย์ 19:00 น.',
  '',
  'วิธีเชื่อม: ให้นักเรียนเปิดแอป > บัญชี > "เชื่อม LINE ผู้ปกครอง" แล้วนำรหัส (เช่น P7K2M9Q) มาพิมพ์ส่งที่นี่',
].join('\n');
const HELP = 'พิมพ์รหัสเชื่อมจากแอป (ขึ้นต้นด้วย P) เพื่อเชื่อมกับนักเรียน\nพิมพ์ "สรุป" เพื่อดูสรุปสัปดาห์นี้\nพิมพ์ "ยกเลิก" เพื่อหยุดรับสรุป';

const thisWeek = () => {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  const dow = (bkk.getUTCDay() + 6) % 7;
  return new Date(bkk.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
};

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
}

async function handle(ev: LineEvent) {
  const uid = ev.source?.userId;
  if (!uid || !/^U[0-9a-f]{32}$/.test(uid)) return;
  if (ev.type === 'unfollow') {
    await admin.from('parent_links').delete().eq('line_user_id', uid);
    return;
  }
  if (!ev.replyToken) return;
  if (ev.type === 'follow') return reply(ev.replyToken, [WELCOME]);
  if (ev.type !== 'message' || ev.message?.type !== 'text') return reply(ev.replyToken, [HELP]);

  const msg = (ev.message.text ?? '').trim();
  const code = msg.toUpperCase().replace(/\s/g, '');
  if (/^P[A-Z2-9]{6}$/.test(code)) {
    const name = await displayName(uid);
    const { data: nick } = await admin.rpc('claim_parent_code', { p_code: code, p_line_user: uid, p_name: name });
    return reply(ev.replyToken, [
      nick
        ? `เชื่อมกับ ${nick} เรียบร้อยแล้ว\nจะได้รับสรุปการฝึกทุกวันอาทิตย์ 19:00 น.\nพิมพ์ "สรุป" เพื่อดูสรุปสัปดาห์นี้ได้เลย`
        : 'รหัสนี้ใช้ไม่ได้ (ผิด หมดอายุ หรือเชื่อมครบ 3 คนแล้ว)\nให้นักเรียนสร้างรหัสใหม่ในแอปแล้วส่งมาอีกครั้งนะ',
    ]);
  }
  if (/^(ยกเลิก|stop|unsubscribe)$/i.test(msg)) {
    const { data } = await admin.from('parent_links').delete().eq('line_user_id', uid).select('id');
    return reply(ev.replyToken, [data?.length ? 'หยุดส่งสรุปแล้ว ถ้าต้องการรับอีก ให้นักเรียนสร้างรหัสเชื่อมใหม่' : 'บัญชีนี้ยังไม่ได้เชื่อมกับนักเรียนคนใด']);
  }
  if (/^(สรุป|summary)$/i.test(msg)) {
    const { data: links } = await admin.from('parent_links').select('user_id').eq('line_user_id', uid);
    if (!links?.length) return reply(ev.replyToken, ['บัญชีนี้ยังไม่ได้เชื่อมกับนักเรียน\n\n' + HELP]);
    const week = thisWeek();
    const texts: string[] = [];
    for (const l of links.slice(0, 3)) {
      const { data } = await admin.rpc('weekly_summary', { p_user: l.user_id, p_week: week });
      if (data) texts.push(summaryText(data as WeeklySummary, week, APP_URL));
    }
    return reply(ev.replyToken, texts.length ? texts : [HELP]);
  }
  return reply(ev.replyToken, [HELP]);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  if (!lineConfigured()) return new Response(JSON.stringify({ error: 'not_configured' }), { status: 500 });
  const body = await req.text();
  if (!(await verifySignature(body, req.headers.get('x-line-signature')))) return new Response('bad signature', { status: 401 });
  try {
    const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };
    for (const ev of events.slice(0, 20)) await handle(ev);
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'error');
  }
  // ตอบ 200 เสมอ (LINE ส่งซ้ำถ้าไม่ได้ 200)
  return new Response('ok');
});
