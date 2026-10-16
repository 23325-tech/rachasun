// Edge Function: ส่งแจ้งเตือน Web Push
//   pg_cron เรียกทุกชั่วโมง (header x-cron-secret = PUSH_CRON_SECRET) -> คิดรายการที่ควรแจ้งแล้วส่ง
//   ผู้ใช้เรียกเอง (JWT) action "test" -> ส่งข้อความทดสอบไปทุกเครื่องของตัวเอง
//   secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_CRON_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { TCAS_EXAM_AT, TCAS_NAME } from '../_shared/tcasDates.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DAILY_CAP = 2;
const COUNTDOWN_DAYS = [100, 30, 7, 1];
const TIER = [
  { th: 'บรอนซ์', en: 'Bronze' },
  { th: 'ซิลเวอร์', en: 'Silver' },
  { th: 'โกลด์', en: 'Gold' },
  { th: 'แพลทินัม', en: 'Platinum' },
  { th: 'เพชร', en: 'Diamond' },
];

type Lang = 'th' | 'en';
interface Candidate {
  user_id: string;
  kind: 'homework' | 'countdown' | 'mistakes' | 'league' | 'cheers';
  ref: string;
  priority: number;
  data: Record<string, unknown>;
}
interface Sub {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  lang: Lang;
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:support@brain-gym.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const bkkHour = () => new Date(Date.now() + 7 * 3600_000).getUTCHours();
const bkkDay = (t: number) => Math.floor((t + 7 * 3600_000) / 86_400_000);

/** ข้อความแจ้งเตือนตามภาษา */
function message(c: Candidate, lang: Lang): { title: string; body: string; url: string } {
  const th = lang === 'th';
  const d = c.data;
  switch (c.kind) {
    case 'homework': {
      const h = Math.max(1, Math.round((Date.parse(String(d.dueAt)) - Date.now()) / 3_600_000));
      return {
        title: th ? 'การบ้านใกล้ครบกำหนด' : 'Homework due soon',
        body: th ? `"${d.title}" (${d.class}) เหลืออีก ${h} ชม.` : `"${d.title}" (${d.class}) is due in ${h}h`,
        url: '/?go=classroom',
      };
    }
    case 'countdown': {
      const name = TCAS_NAME[String(d.key)]?.[lang] ?? String(d.key);
      return {
        title: th ? `อีก ${d.days} วันสอบ ${name}` : `${d.days} days to ${name}`,
        body: th ? `เป้าหมาย: ${d.faculty} สู้ต่อไปนะ!` : `Goal: ${d.faculty}. Keep going!`,
        url: '/?go=dream',
      };
    }
    case 'mistakes':
      return {
        title: th ? 'ถึงรอบทบทวนข้อผิดแล้ว' : 'Time to review your mistakes',
        body: th ? `มี ${d.due} ข้อรอทบทวน ใช้เวลาแค่ไม่กี่นาที` : `${d.due} questions are due. It only takes a few minutes.`,
        url: '/?go=mistakes',
      };
    case 'league': {
      const tier = TIER[Number(d.tier) - 1]?.[lang] ?? '';
      const move = Number(d.move) === 1 ? (th ? ' เลื่อนชั้น!' : ' Promoted!') : Number(d.move) === -1 ? (th ? ' ตกชั้น' : ' Relegated') : '';
      return {
        title: th ? 'ผลลีกแคลนสัปดาห์ที่แล้ว' : "Last week's clan league",
        body:
          (th ? `${tier} อันดับ ${d.rank}${move}` : `${tier} rank #${d.rank}${move}`) +
          (d.coins ? (th ? ` ได้ ${d.coins} เหรียญ` : ` +${d.coins} coins`) : ''),
        url: '/?go=clan',
      };
    }
    case 'cheers':
      return {
        title: th ? 'เพื่อนในแคลนส่งกำลังใจ' : 'Your clan cheered',
        body: th ? `มี ${d.count} ข้อความเชียร์วันนี้ ไปฝึกด้วยกัน!` : `${d.count} cheers today. Come practise together!`,
        url: '/?go=clan',
      };
  }
}

/** นับถอยหลังวันสอบตามเป้าอันดับ 1 (ส่งเมื่อเหลือ 100/30/7/1 วัน ตั้งแต่ 09:00) */
async function countdownCandidates(userIds: string[]): Promise<Candidate[]> {
  if (bkkHour() < 9 || !userIds.length) return [];
  const { data: prefs } = await admin.from('notif_prefs').select('user_id,countdown').in('user_id', userIds);
  const off = new Set((prefs ?? []).filter((p) => p.countdown === false).map((p) => p.user_id));
  const { data: plans } = await admin.from('dream_plans').select('user_id,goals,exam_overrides').in('user_id', userIds);
  const today = bkkDay(Date.now());
  const out: Candidate[] = [];
  for (const p of plans ?? []) {
    const goal = (p.goals ?? [])[0];
    if (!goal || off.has(p.user_id)) continue;
    let best: { key: string; days: number; at: number } | null = null;
    for (const key of Object.keys(goal.weights ?? {})) {
      const iso = p.exam_overrides?.[key] ? `${p.exam_overrides[key]}T08:30:00+07:00` : TCAS_EXAM_AT[key];
      if (!iso) continue;
      const at = Date.parse(iso);
      const days = bkkDay(at) - today;
      if (days < 0) continue;
      if (!best || at < best.at) best = { key, days, at };
    }
    if (best && COUNTDOWN_DAYS.includes(best.days)) {
      out.push({ user_id: p.user_id, kind: 'countdown', ref: `${best.key}:${best.days}`, priority: 2, data: { key: best.key, days: best.days, faculty: goal.faculty } });
    }
  }
  return out;
}

/** ส่งไปทุกเครื่องของผู้ใช้ ลบ subscription ที่หมดอายุ คืนจำนวนที่ส่งสำเร็จ */
async function sendTo(subs: Sub[], payload: (lang: Lang) => object): Promise<number> {
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload(s.lang)), {
        TTL: 6 * 3600,
        urgency: 'normal',
      });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      else console.error('push failed', code ?? (e instanceof Error ? e.message : 'error'));
    }
  }
  return ok;
}

async function runBatch() {
  const hour = bkkHour();
  if (hour < 7 || hour >= 21) return { sent: 0, quiet: true };
  const { data: due, error } = await admin.rpc('push_due');
  if (error) throw error;
  const { data: subRows } = await admin.from('push_subscriptions').select('endpoint,user_id,p256dh,auth,lang');
  const subs = (subRows ?? []) as Sub[];
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const candidates = [...((due ?? []) as Candidate[]), ...(await countdownCandidates(userIds))];
  if (!candidates.length) return { sent: 0 };

  // ตัดที่เคยส่งแล้ว + เพดานรายวัน
  const ids = [...new Set(candidates.map((c) => c.user_id))];
  const { data: logs } = await admin.from('notif_log').select('user_id,kind,ref').in('user_id', ids);
  const done = new Set((logs ?? []).map((l) => `${l.user_id}|${l.kind}|${l.ref}`));
  const { data: today } = await admin.rpc('push_sent_today', { p_users: ids });
  const used = new Map(((today ?? []) as { user_id: string; n: number }[]).map((r) => [r.user_id, r.n]));

  let sent = 0;
  for (const uid of ids) {
    const left = DAILY_CAP - (used.get(uid) ?? 0);
    if (left <= 0) continue;
    const mine = candidates
      .filter((c) => c.user_id === uid && !done.has(`${c.user_id}|${c.kind}|${c.ref}`))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, left);
    const userSubs = subs.filter((s) => s.user_id === uid);
    for (const c of mine) {
      // จองก่อนส่ง กันส่งซ้ำถ้า cron ซ้อนกัน
      const { error: e2 } = await admin.from('notif_log').insert({ user_id: uid, kind: c.kind, ref: c.ref });
      if (e2) continue;
      const n = await sendTo(userSubs, (lang) => ({ ...message(c, lang), tag: `${c.kind}:${c.ref}` }));
      if (n > 0) sent++;
    }
  }
  return { sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const secret = Deno.env.get('PUSH_CRON_SECRET');
    if (secret && req.headers.get('x-cron-secret') === secret) return json(await runBatch());

    // ผู้ใช้ส่งข้อความทดสอบหาตัวเอง (นาทีละครั้ง)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (!uid) return json({ error: 'not_signed_in' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'test') return json({ error: 'unknown_action' }, 400);
    const minute = new Date().toISOString().slice(0, 16);
    const { error: e1 } = await admin.from('notif_log').insert({ user_id: uid, kind: 'test', ref: minute });
    if (e1) return json({ error: 'too_fast' }, 429);
    const { data: subRows } = await admin.from('push_subscriptions').select('endpoint,user_id,p256dh,auth,lang').eq('user_id', uid);
    const n = await sendTo((subRows ?? []) as Sub[], (lang) => ({
      title: lang === 'th' ? 'ทดสอบแจ้งเตือน' : 'Test notification',
      body: lang === 'th' ? 'แจ้งเตือนของ Brain Gym ใช้งานได้แล้ว!' : 'Brain Gym notifications are working!',
      url: '/',
      tag: 'test',
    }));
    return json({ sent: n });
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'error');
    return json({ error: 'push_failed' }, 500);
  }
});
