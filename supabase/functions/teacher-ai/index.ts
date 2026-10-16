// Edge Function: ครูพิมพ์สั่ง AI ร่างโจทย์ (ยังไม่บันทึก ครูตรวจ/แก้ในหน้าเว็บก่อนกดบันทึกเข้าคลังของตัวเอง)
// โควตา: วันละ 10 ครั้ง ครั้งละไม่เกิน 10 ข้อ เฉพาะสมาชิก / ใช้ secret GEMINI_API_KEY
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chaptersOf } from '../_shared/chapters.ts';
import { repairLatex, wrapBareLatex } from '../_shared/latex.ts';

/** JSON จาก AI: ถ้า LaTeX ไม่ได้ escape backslash (เช่น \circ) ให้ escape ตัวที่ผิดกติกา JSON แล้ว parse ใหม่ */
function parseLoose(text: string): unknown {
  const s = text.replace(/^```(json)?|```$/g, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    // จับ backslash เป็นคู่: escape ที่ถูกต้องคงไว้ ตัวที่เหลือ (เช่น \c \s) เติมเป็น \\
    return JSON.parse(s.replace(/\\(["\\/bfnrtu])|\\/g, (m, ok) => (ok ? m : '\\\\')));
  }
}

const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
const MAX_COUNT = 10;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const LEVEL_TH: Record<string, string> = { primary: 'ประถมศึกษา', lower: 'มัธยมต้น', upper: 'มัธยมปลาย', uni: 'มหาวิทยาลัยปีต้น' };
const SUBJECT_TH: Record<string, string> = {
  math: 'คณิตศาสตร์',
  science: 'วิทยาศาสตร์',
  physics: 'ฟิสิกส์',
  chemistry: 'เคมี',
  biology: 'ชีววิทยา',
  english: 'ภาษาอังกฤษ',
};
const DIFFS = ['easy', 'medium', 'hard', 'challenge'];

interface Draft {
  type: 'mcq' | 'fill';
  difficulty: string;
  chapter: string | null;
  prompt: string;
  choices?: string[];
  answerIndex?: number;
  answer?: { kind: 'number'; value: number; unit?: string; tolerance?: number } | { kind: 'text'; accepted: string[] };
  explanation: string;
}

function buildPrompt(level: string, subject: string, request: string, count: number, type: string) {
  const chapters = chaptersOf(level, subject).map((c) => `${c.id} = ${c.name}`).join('\n');
  return `คุณคือครูผู้เชี่ยวชาญออกข้อสอบ${SUBJECT_TH[subject] ?? subject} ระดับ${LEVEL_TH[level] ?? level} ของไทย
คำสั่งจากครู: "${request}"

ร่างโจทย์ ${count} ข้อ ตามคำสั่งของครู ตอบเป็น JSON อย่างเดียว:
{"questions":[{"type":"mcq","difficulty":"easy|medium|hard|challenge","chapter":"<รหัสบท>","prompt":"...","choices":["...","...","...","..."],"answerIndex":0,"explanation":"..."},
 {"type":"fill","difficulty":"...","chapter":"...","prompt":"...","answer":{"kind":"number","value":12.5,"unit":"m"},"explanation":"..."},
 {"type":"fill","difficulty":"...","chapter":"...","prompt":"...","answer":{"kind":"text","accepted":["คำตอบ","คำตอบอีกแบบ"]},"explanation":"..."}]}

กติกา:
- ชนิดโจทย์: ${type === 'mcq' ? 'ปรนัย 4 ตัวเลือก (mcq) ทั้งหมด' : type === 'fill' ? 'เติมคำตอบ (fill) ทั้งหมด' : 'ผสม ส่วนใหญ่เป็นปรนัย'}
- ปรนัย: ตัวเลือก 4 ข้อ ถูกเพียงข้อเดียว ตัวลวงสมเหตุสมผล สุ่มตำแหน่งคำตอบที่ถูก
- เติมคำ: ถ้าคำตอบเป็นตัวเลข ใช้ kind number (ใส่หน่วยใน unit ถ้ามี) ถ้าเป็นคำ ใช้ kind text พร้อมคำตอบที่ยอมรับได้หลายแบบ
- คำนวณคำตอบให้ถูกต้องแน่นอน ตรวจซ้ำก่อนตอบ
- chapter เลือกรหัสจากรายการนี้เท่านั้น (ไม่แน่ใจใส่ null):
${chapters || '(ไม่มีรายการบท ใส่ null)'}
- สูตรเขียนเป็น LaTeX ใน $...$ สูตรเคมีใช้ \\ce{...} ได้ ใน JSON ต้อง escape backslash เป็นสองตัวเสมอ เช่น "\\\\frac{1}{2}", "45^\\\\circ"
- explanation: วิธีทำสั้นๆ 1-3 ประโยค
- ภาษา: ภาษาไทย (ถ้าเป็นวิชาภาษาอังกฤษ โจทย์และตัวเลือกเป็นภาษาอังกฤษได้ แต่ explanation เป็นภาษาไทย)
- ห้ามใช้อีโมจิ ห้ามใช้ markdown
- ถ้าคำสั่งของครูไม่เกี่ยวกับการออกข้อสอบ หรือไม่เหมาะสม ให้ตอบ {"questions":[],"reason":"..."}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const errors: string[] = [];
  for (const model of MODELS) {
    // โมเดลคนใช้เยอะ (429/5xx): รอสั้นๆ แล้วลองซ้ำ 1 ครั้ง ก่อนไปโมเดลถัดไป
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 8192, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        errors.push(`${model}: HTTP ${res.status}`);
        if ([429, 500, 503].includes(res.status)) continue;
        break;
      }
      const body = await res.json();
      if (body?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        errors.push(`${model}: MAX_TOKENS`);
        break;
      }
      const parts: { text?: string; thought?: boolean }[] = body?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
      if (text) return text;
      errors.push(`${model}: empty`);
      break;
    }
  }
  throw new Error(`Gemini failed: ${errors.join(', ')}`);
}

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\p{Extended_Pictographic}️?/gu, '').trim().slice(0, n);

/** ตรวจ/ทำความสะอาดโจทย์ที่ AI ร่าง ทิ้งข้อที่รูปแบบผิด */
function clean(raw: unknown, level: string, subject: string): Draft[] {
  const valid = new Set(chaptersOf(level, subject).map((c) => c.id));
  // AI ส่งมาได้ทั้ง {"questions":[...]} และ [...] ตรงๆ
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { questions?: unknown })?.questions)
      ? (raw as { questions: unknown[] }).questions
      : [];
  const out: Draft[] = [];
  for (const q of list.slice(0, MAX_COUNT) as Record<string, unknown>[]) {
    const prompt = repairLatex(clip(q.prompt, 2000));
    if (prompt.length < 3) continue;
    const base = {
      difficulty: DIFFS.includes(String(q.difficulty)) ? String(q.difficulty) : 'medium',
      chapter: valid.has(String(q.chapter)) ? String(q.chapter) : null,
      prompt,
      explanation: repairLatex(clip(q.explanation, 2000)),
    };
    if (q.type === 'mcq') {
      const choices = Array.isArray(q.choices) ? q.choices.map((c) => wrapBareLatex(repairLatex(clip(c, 500)))) : [];
      const idx = Number(q.answerIndex);
      if (choices.length !== 4 || choices.some((c) => !c) || !Number.isInteger(idx) || idx < 0 || idx > 3) continue;
      out.push({ type: 'mcq', ...base, choices, answerIndex: idx });
    } else {
      const a = (q.answer ?? {}) as Record<string, unknown>;
      if (a.kind === 'number' && Number.isFinite(Number(a.value))) {
        out.push({ type: 'fill', ...base, answer: { kind: 'number', value: Number(a.value), ...(a.unit ? { unit: clip(a.unit, 20) } : {}) } });
      } else if (a.kind === 'text' && Array.isArray(a.accepted)) {
        const accepted = a.accepted.map((x) => clip(x, 100)).filter(Boolean).slice(0, 10);
        if (accepted.length) out.push({ type: 'fill', ...base, answer: { kind: 'text', accepted } });
      }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'not_configured' }, 500);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const user = auth.user;
    if (!user) return json({ error: 'not_signed_in' }, 401);
    if (user.is_anonymous) return json({ error: 'members_only' }, 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const level = String(body.level ?? 'upper');
    const subject = String(body.subject ?? 'math');
    const request = clip(body.request, 500);
    const count = Math.min(MAX_COUNT, Math.max(1, Number(body.count) || 5));
    const type = ['mcq', 'fill'].includes(String(body.type)) ? String(body.type) : 'mix';
    if (!LEVEL_TH[level] || !SUBJECT_TH[subject]) return json({ error: 'bad_settings' }, 400);
    if (request.length < 3) return json({ error: 'empty_request' }, 400);

    const { data: quota, error: qErr } = await admin.rpc('teacher_ai_consume', { p_user: user.id });
    if (qErr) throw qErr;
    if (!quota.ok) return json({ error: 'quota', used: quota.used, limit: quota.limit }, 429);

    let drafts: Draft[] = [];
    let reason = '';
    try {
      const raw = parseLoose(await callGemini(buildPrompt(level, subject, request, count, type), apiKey)) as { reason?: unknown };
      drafts = clean(raw, level, subject);
      reason = clip(raw?.reason, 200);
    } catch (e) {
      await admin.rpc('teacher_ai_consume', { p_user: user.id, p_delta: -1 });
      throw e;
    }
    if (!drafts.length) {
      // ไม่ได้โจทย์ที่ใช้ได้: คืนโควตา
      await admin.rpc('teacher_ai_consume', { p_user: user.id, p_delta: -1 });
      return json({ error: 'no_drafts', reason }, 422);
    }
    return json({ drafts, used: quota.used, limit: quota.limit });
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'error');
    return json({ error: 'ai_failed', detail: e instanceof Error ? e.message.slice(0, 200) : '' }, 500);
  }
});
