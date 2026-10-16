// Edge Function: ส่งสรุปรายสัปดาห์ถึงผู้ปกครองทาง LINE (deploy แบบ --no-verify-jwt)
//   pg_cron อาทิตย์ 19:00 เวลาไทย (header x-cron-secret = LINE_CRON_SECRET) -> ส่งทุกการเชื่อมที่ยังไม่ได้ส่งสัปดาห์นี้
//   นักเรียน (JWT) action "preview" -> ข้อความสรุปของตัวเอง (ไม่ส่งจริง)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { lineConfigured, push, summaryText, type WeeklySummary } from '../_shared/line.ts';

const APP_URL = 'https://brain-gym-psi.vercel.app';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const thisWeek = () => {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  const dow = (bkk.getUTCDay() + 6) % 7;
  return new Date(bkk.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
};

async function sendAll() {
  if (!lineConfigured()) return { error: 'not_configured' };
  const week = thisWeek();
  const { data: links } = await admin.from('parent_links').select('id,user_id,line_user_id');
  const { data: done } = await admin.from('parent_summary_log').select('link_id').eq('week', week);
  const sent = new Set((done ?? []).map((d) => d.link_id));
  const cache = new Map<string, string>();
  let ok = 0;
  for (const l of links ?? []) {
    if (sent.has(l.id)) continue;
    if (!cache.has(l.user_id)) {
      const { data } = await admin.rpc('weekly_summary', { p_user: l.user_id, p_week: week });
      cache.set(l.user_id, summaryText(data as WeeklySummary, week, APP_URL));
    }
    // จองก่อนส่ง กันส่งซ้ำ
    const { error } = await admin.from('parent_summary_log').insert({ week, link_id: l.id });
    if (error) continue;
    const status = await push(l.line_user_id, cache.get(l.user_id)!);
    if (status === 200) ok++;
    else {
      await admin.from('parent_summary_log').delete().eq('week', week).eq('link_id', l.id);
      // โควตาข้อความเดือนนี้หมด: หยุด
      if (status === 429) return { sent: ok, stopped: 'quota' };
    }
  }
  return { sent: ok };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const secret = Deno.env.get('LINE_CRON_SECRET');
    if (secret && req.headers.get('x-cron-secret') === secret) return json(await sendAll());

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (!uid) return json({ error: 'not_signed_in' }, 401);
    const week = thisWeek();
    const { data } = await admin.rpc('weekly_summary', { p_user: uid, p_week: week });
    return json({ text: summaryText(data as WeeklySummary, week, APP_URL) });
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'error');
    return json({ error: 'failed' }, 500);
  }
});
