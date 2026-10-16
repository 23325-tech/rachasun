// Edge Function: ให้ Gemini สร้างโจทย์ แล้วบันทึกลงคลัง public.questions
// ต้องตั้ง secret GEMINI_API_KEY ใน Supabase (Edge Functions > Secrets)
// ตั้ง GEMINI_MODEL เพิ่มได้ถ้าอยากเปลี่ยนโมเดลหลัก
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'english'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const TRACKS = ['entrance', 'school'] as const;
const MAX_COUNT = 10;
/** ผู้เล่นหนึ่งคนให้ AI สร้างได้ไม่เกินกี่ข้อต่อชั่วโมง (เรียกจาก Edge Function อื่นไม่จำกัด) */
const HOURLY_LIMIT = 40;

type Subject = (typeof SUBJECTS)[number];
type Difficulty = (typeof DIFFICULTIES)[number];
type Track = (typeof TRACKS)[number];

const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SUBJECT_TH: Record<Subject, string> = {
  math: 'คณิตศาสตร์',
  physics: 'ฟิสิกส์',
  chemistry: 'เคมี',
  biology: 'ชีววิทยา',
  english: 'ภาษาอังกฤษ',
};
const DIFFICULTY_TH: Record<Difficulty, string> = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
const TRACK_TH: Record<Track, string> = {
  school: 'แนวข้อสอบในโรงเรียน ระดับมัธยมปลาย ตามหลักสูตรแกนกลางของไทย',
  entrance: 'แนวข้อสอบเข้ามหาวิทยาลัยของไทย (เช่น TGAT/TPAT/A-Level)',
};

// ลำดับ property: ให้เขียน explanation ก่อนเฉลย เพื่อให้โมเดลคิดก่อนตอบ
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          subject: { type: 'STRING', enum: [...SUBJECTS] },
          type: { type: 'STRING', enum: ['mcq', 'fill'] },
          prompt: { type: 'STRING' },
          choices: { type: 'ARRAY', items: { type: 'STRING' } },
          explanation: { type: 'STRING' },
          answer_index: { type: 'INTEGER' },
          answer_kind: { type: 'STRING', enum: ['number', 'text'] },
          answer_number: { type: 'NUMBER' },
          answer_tolerance: { type: 'NUMBER' },
          answer_unit: { type: 'STRING' },
          answer_accepted: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['subject', 'type', 'prompt', 'explanation'],
        propertyOrdering: [
          'subject',
          'type',
          'prompt',
          'choices',
          'explanation',
          'answer_index',
          'answer_kind',
          'answer_number',
          'answer_tolerance',
          'answer_unit',
          'answer_accepted',
        ],
      },
    },
  },
  required: ['questions'],
};

function buildPrompt(subjects: Subject[], difficulty: Difficulty, track: Track, count: number) {
  return `คุณคือครูผู้เชี่ยวชาญที่ออกข้อสอบสำหรับนักเรียนไทย
สร้างโจทย์ ${count} ข้อ
- วิชา: ${subjects.map((s) => `${SUBJECT_TH[s]} (${s})`).join(', ')}${subjects.length > 1 ? ' — กระจายวิชาให้ใกล้เคียงกัน' : ''}
- ความยาก: ${DIFFICULTY_TH[difficulty]}
- แนว: ${TRACK_TH[track]}

กติกา:
1. ผสมรูปแบบ: ประมาณ 70% เป็นปรนัย (type "mcq") อีก 30% เป็นเติมคำตอบ (type "fill")
2. mcq: มี choices 4 ตัวเลือกพอดี ตัวเลือกผิดต้องดูสมเหตุสมผล ไม่ซ้ำกัน ตำแหน่งข้อถูกสุ่มกระจาย ให้ answer_index เป็น 0-3
3. fill: คำตอบต้องสั้นและตรวจได้แน่นอน
   - ถ้าคำตอบเป็นตัวเลข ใช้ answer_kind "number" ใส่ answer_number (ใส่ answer_unit ถ้ามีหน่วย และ answer_tolerance ถ้าคำตอบเป็นทศนิยมที่ต้องปัด)
   - ถ้าเป็นคำ ใช้ answer_kind "text" ใส่ answer_accepted เป็นคำตอบที่ยอมรับได้ทุกแบบ (เช่น มี/ไม่มีคำนำหน้า, ภาษาไทยและอังกฤษ)
4. เขียนสูตรคณิตด้วย LaTeX ใน $...$ (หรือ $$...$$ สำหรับสูตรยาว) และสูตร/สมการเคมีด้วย \\ce{...} ใน $...$ เช่น $\\ce{2H2 + O2 -> 2H2O}$
   ใน JSON ต้อง escape backslash เป็นสองตัวเสมอ เช่น "\\\\frac{1}{2}", "\\\\ce{CO2}", "\\\\text{m/s}"
5. ห้ามอ้างถึงรูปภาพหรือกราฟ เพราะไม่มีรูปประกอบ
6. โจทย์และคำอธิบายเป็นภาษาไทย ยกเว้นวิชาภาษาอังกฤษให้โจทย์เป็นภาษาอังกฤษ แต่คำอธิบายเป็นภาษาไทย
7. explanation: อธิบายวิธีคิดทีละขั้นสั้นๆ (2-4 ประโยค) และคำนวณให้ถูกต้องก่อนเลือกเฉลย เฉลยต้องตรงกับคำอธิบาย
8. โจทย์ต้องทำได้ภายใน 20-90 วินาที`;
}

// โมเดลบางครั้งเขียน "\text" ใน JSON โดยไม่ escape -> JSON แปลง "\t" เป็นอักขระ Tab
// ซ่อมกลับเป็นคำสั่ง LaTeX: \t \f \b \r \v ไม่ควรมีในโจทย์อยู่แล้ว ส่วน \n ซ่อมเฉพาะในวงเล็บ $...$
const CONTROL_TO_LETTER: Record<string, string> = { '\t': 't', '\f': 'f', '\b': 'b', '\r': 'r', '\v': 'v' };

export function repairLatex(s: string): string {
  const fixed = s.replace(/[\t\f\b\v]|\r(?=[a-zA-Z])/g, (c) => '\\' + CONTROL_TO_LETTER[c]);
  return fixed.replace(/\$\$[\s\S]+?\$\$|\$[^$]+?\$/g, (m) => m.replace(/\n(?=[a-zA-Z])/g, '\\n'));
}

/** ตัวเลือกที่มีคำสั่ง LaTeX แต่ลืมครอบ $...$ เช่น "\text{50 J}" */
function wrapBareLatex(s: string): string {
  return !s.includes('$') && /\\[a-zA-Z]+|[\^_]\{/.test(s) ? `$${s}$` : s;
}

interface RawQuestion {
  subject?: string;
  type?: string;
  prompt?: string;
  choices?: string[];
  explanation?: string;
  answer_index?: number;
  answer_kind?: string;
  answer_number?: number;
  answer_tolerance?: number;
  answer_unit?: string;
  answer_accepted?: string[];
}

/** แปลงผลจาก AI เป็นแถวในตาราง ถ้ารูปแบบไม่ถูกต้องคืน null (ข้อนั้นจะถูกทิ้ง) */
function toRow(q: RawQuestion, allowed: Subject[], difficulty: Difficulty, track: Track, model: string) {
  const subject = q.subject as Subject;
  if (!allowed.includes(subject)) return null;
  const prompt = q.prompt && repairLatex(q.prompt).trim();
  const explanation = q.explanation && repairLatex(q.explanation).trim();
  if (!prompt || !explanation) return null;
  const base = { subject, difficulty, track, prompt, explanation, model };

  if (q.type === 'mcq') {
    const choices = q.choices?.map((c) => wrapBareLatex(repairLatex(String(c)).trim()));
    const idx = q.answer_index;
    if (!choices || choices.length !== 4 || choices.some((c) => !c)) return null;
    if (new Set(choices).size !== 4) return null;
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 3) return null;
    return { ...base, type: 'mcq', choices, answer_index: idx, answer: null };
  }

  if (q.type === 'fill') {
    if (q.answer_kind === 'number') {
      if (typeof q.answer_number !== 'number' || !Number.isFinite(q.answer_number)) return null;
      const answer: Record<string, unknown> = { kind: 'number', value: q.answer_number };
      if (typeof q.answer_tolerance === 'number' && q.answer_tolerance > 0) answer.tolerance = q.answer_tolerance;
      if (q.answer_unit?.trim()) answer.unit = q.answer_unit.trim();
      return { ...base, type: 'fill', choices: null, answer_index: null, answer };
    }
    if (q.answer_kind === 'text') {
      const accepted = (q.answer_accepted ?? []).map((a) => String(a).trim()).filter(Boolean);
      if (!accepted.length) return null;
      return { ...base, type: 'fill', choices: null, answer_index: null, answer: { kind: 'text', accepted } };
    }
  }
  return null;
}

async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<{ data: { questions?: RawQuestion[] }; model: string; fallbacks: string[] }> {
  let lastError = '';
  const fallbacks: string[] = [];
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.9,
        },
      }),
    });
    if (!res.ok) {
      lastError = `${model}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`;
      // โควตาเต็ม / ไม่มีโมเดลนี้ / เซิร์ฟเวอร์ล่ม -> ลองโมเดลถัดไป
      if ([404, 429, 500, 503].includes(res.status)) {
        console.warn(`fallback from ${lastError}`);
        fallbacks.push(`${model}: HTTP ${res.status}`);
        continue;
      }
      throw new Error(lastError);
    }
    const body = await res.json();
    const parts: { text?: string; thought?: boolean }[] = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');
    if (!text) {
      lastError = `${model}: empty response (${body?.candidates?.[0]?.finishReason ?? 'unknown'})`;
      continue;
    }
    return { data: JSON.parse(text), model, fallbacks };
  }
  throw new Error(`Gemini failed: ${lastError}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 500);

    // ใครเรียก: Edge Function ของเราเอง (service role) ไม่จำกัด / ผู้เล่นต้องล็อกอิน (แขกก็ได้) และโดนจำกัดต่อชั่วโมง
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const internal = token !== '' && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let userId: string | null = null;
    if (!internal) {
      const { data: auth } = await admin.auth.getUser(token);
      userId = auth.user?.id ?? null;
      if (!userId) return json({ error: 'not_signed_in' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const subjects: Subject[] = Array.isArray(body.subjects)
      ? body.subjects.filter((s: string) => (SUBJECTS as readonly string[]).includes(s))
      : [];
    const difficulty = body.difficulty as Difficulty;
    const track = body.track as Track;
    const count = Math.floor(Number(body.count));

    if (!subjects.length) return json({ error: 'invalid subjects' }, 400);
    if (!DIFFICULTIES.includes(difficulty)) return json({ error: 'invalid difficulty' }, 400);
    if (!TRACKS.includes(track)) return json({ error: 'invalid track' }, 400);
    if (!(count >= 1 && count <= MAX_COUNT)) return json({ error: `count must be 1-${MAX_COUNT}` }, 400);

    if (userId) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from('ai_generation_log')
        .select('questions')
        .eq('user_id', userId)
        .gte('created_at', since);
      const used = (recent ?? []).reduce((sum, r) => sum + (r.questions as number), 0);
      if (used + count > HOURLY_LIMIT) return json({ error: 'rate_limited', used, limit: HOURLY_LIMIT }, 429);
    }

    const { data, model, fallbacks } = await callGemini(buildPrompt(subjects, difficulty, track, count), apiKey);
    const rows = (data.questions ?? [])
      .map((q) => toRow(q, subjects, difficulty, track, model))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, count);

    if (!rows.length) return json({ error: 'AI returned no valid questions' }, 502);

    const { data: inserted, error } = await admin.from('questions').insert(rows).select();
    if (error) throw error;
    if (userId) await admin.from('ai_generation_log').insert({ user_id: userId, questions: rows.length });

    return json({ questions: inserted, model, fallbacks, dropped: (data.questions?.length ?? 0) - rows.length });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
