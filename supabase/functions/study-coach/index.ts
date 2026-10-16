// Edge Function: ให้ Gemini เขียนคำแนะนำการฝึกจากสถิติรายบท (วันละ 1 ครั้งต่อผู้เล่นต่อระดับ)
// ใช้ secret GEMINI_API_KEY เดียวกับ generate-questions
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chapterName } from '../_shared/chapters.ts';

const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const LEVEL_TH: Record<string, string> = {
  primary: 'ประถมศึกษา',
  lower: 'มัธยมต้น',
  upper: 'มัธยมปลาย',
  uni: 'มหาวิทยาลัยปีต้น',
};
const SUBJECT_TH: Record<string, string> = {
  math: 'คณิตศาสตร์',
  science: 'วิทยาศาสตร์',
  physics: 'ฟิสิกส์',
  chemistry: 'เคมี',
  biology: 'ชีววิทยา',
  english: 'ภาษาอังกฤษ',
};
const REASON_TH: Record<string, string> = { weak: 'เก็บจุดอ่อน', new: 'บทใหม่', ok: 'ดันให้ถนัด', review: 'ทวนกันลืม' };

/** วันที่แบบไทย YYYY-MM-DD */
const bangkokDate = (t: number) => new Date(t + 7 * 3600_000).toISOString().slice(0, 10);

interface Stat {
  chapter: string;
  subject: string;
  recent: number;
  recent_correct: number;
  avg_time_ms: number;
}

function buildPrompt(level: string, subjects: string[], stats: Stat[], items: { chapter: string; reason: string }[]) {
  const lines = stats
    .filter((s) => chapterName(s.chapter))
    .sort((a, b) => a.recent_correct / a.recent - b.recent_correct / b.recent)
    .slice(0, 25)
    .map(
      (s) =>
        `- ${SUBJECT_TH[s.subject] ?? s.subject} / ${chapterName(s.chapter)}: ถูก ${s.recent_correct}/${s.recent} ข้อ (${Math.round(
          (100 * s.recent_correct) / s.recent,
        )}%) เวลาเฉลี่ย ${Math.round(s.avg_time_ms / 1000)} วินาที/ข้อ${
          s.recent < 5 ? ' (ข้อมูลยังน้อย อย่าเพิ่งสรุปว่าเก่งหรืออ่อน)' : ''
        }`,
    );
  const plan = [...new Set(items.map((i) => `- ${chapterName(i.chapter)} (${REASON_TH[i.reason] ?? i.reason})`))].slice(0, 12);

  return `คุณคือโค้ชติวที่ใจดีและเก่ง กำลังให้คำแนะนำนักเรียนไทยระดับ${LEVEL_TH[level] ?? level}
วิชาที่นักเรียนโฟกัส: ${subjects.map((s) => SUBJECT_TH[s] ?? s).join(', ')}

สถิติล่าสุดรายบท (เรียงจากบทที่อ่อนที่สุด):
${lines.length ? lines.join('\n') : '- ยังไม่มีข้อมูล (เพิ่งเริ่มฝึก)'}

แผนฝึกสัปดาห์นี้มีบทต่อไปนี้:
${plan.join('\n') || '- ยังไม่มีแผน'}

เขียนคำแนะนำเป็นภาษาไทย 4-6 ข้อ ข้อละ 1-2 ประโยค ขึ้นต้นแต่ละข้อด้วยอีโมจิ 1 ตัว
- ข้อแรกสรุปภาพรวมสั้นๆ แบบให้กำลังใจ
- ระบุบทที่ควรเน้น 1-2 บท พร้อมเทคนิคการทบทวนที่เจาะจงกับเนื้อหาของบทนั้นจริงๆ (เช่น แนวคิดหลักที่มักพลาด)
- ถ้าบทไหนตอบถูกแต่ใช้เวลานาน แนะนำวิธีทำให้เร็วขึ้น
- ห้ามแต่งตัวเลขหรือบทที่ไม่มีในข้อมูล ห้ามใช้หัวข้อหรือตัวหนา markdown
- ใช้ภาษาที่เป็นกันเอง เหมาะกับวัยของนักเรียน`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  let lastError = '';
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
      }),
    });
    if (!res.ok) {
      lastError = `${model}: HTTP ${res.status}`;
      if ([404, 429, 500, 503].includes(res.status)) continue;
      throw new Error(lastError);
    }
    const body = await res.json();
    const parts: { text?: string; thought?: boolean }[] = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .replace(/\*\*/g, '')
      .trim();
    if (text) return text;
    lastError = `${model}: empty response`;
  }
  throw new Error(`Gemini failed: ${lastError}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 500);

    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (!uid) return json({ error: 'not_signed_in' }, 401);

    const body = await req.json().catch(() => ({}));
    const level = String(body.level ?? '');
    const { data: plan } = await admin.from('study_plans').select('*').eq('user_id', uid).eq('level', level).maybeSingle();
    if (!plan) return json({ error: 'no_plan' }, 400);

    // วันละครั้ง: วันนี้ขอไปแล้วคืนคำแนะนำเดิม
    if (plan.advice && plan.advice_at && bangkokDate(Date.parse(plan.advice_at)) === bangkokDate(Date.now())) {
      return json({ advice: plan.advice, adviceAt: plan.advice_at, cached: true });
    }

    // อ่านสถิติในนามผู้เล่นเอง (my_chapter_stats ใช้ auth.uid())
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: stats, error } = await asUser.rpc('my_chapter_stats', { p_level: level });
    if (error) throw error;
    const mine = ((stats ?? []) as Stat[]).filter((s) => s.recent > 0 && plan.subjects.includes(s.subject));

    const advice = (await callGemini(buildPrompt(level, plan.subjects, mine, plan.items ?? []), apiKey)).slice(0, 2000);
    const adviceAt = new Date().toISOString();
    await admin.from('study_plans').update({ advice, advice_at: adviceAt }).eq('user_id', uid).eq('level', level);
    return json({ advice, adviceAt, cached: false });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
