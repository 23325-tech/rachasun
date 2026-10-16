// Edge Function: AI ติวเตอร์ อธิบายโจทย์ทีละขั้น (คำใบ้ก่อน ครบ 2 คำใบ้จึงขอวิธีทำเต็มได้)
// โควตาต่อวันนับฝั่งเซิร์ฟเวอร์ผ่าน tutor_consume ใช้ secret GEMINI_API_KEY
// action "photo": อ่านโจทย์จากรูป แล้วเริ่มด้วยคำใบ้ขั้นแรก (รูปส่งต่อให้ Gemini เท่านั้น ไม่บันทึกและไม่ log)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chapterName } from '../_shared/chapters.ts';
import { formatFillAnswer, type FillAnswer } from '../_shared/rules.ts';

const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
const HINTS_FOR_SOLUTION = 2;

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

type Lang = 'th' | 'en';
type Action = 'hint' | 'solution' | 'ask';
interface Turn {
  role: 'user' | 'tutor';
  kind: Action;
  text: string;
}
interface Ctx {
  level?: string;
  subject: string;
  chapter?: string | null;
  prompt: string;
  choices?: string[];
  statements?: string[];
  answer: string;
  explanation: string;
  given?: string;
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** โจทย์จากคลัง: อ่านจากฐานข้อมูลเอง (ไม่เชื่อเฉลยจากหน้าเว็บ) / โจทย์อื่น (จำลองสอบ ตัวอย่าง): ใช้ข้อมูลที่ส่งมา */
async function loadCtx(admin: ReturnType<typeof createClient>, body: Record<string, unknown>): Promise<Ctx | null> {
  const raw = (body.ctx ?? {}) as Record<string, unknown>;
  const given = clip(raw.given, 300);
  const id = String(body.questionId ?? '');
  if (UUID.test(id)) {
    const { data: q } = await admin.from('questions').select('*').eq('id', id).maybeSingle();
    if (q) {
      return {
        level: q.level,
        subject: q.subject,
        chapter: q.chapter,
        prompt: q.prompt,
        choices: q.type === 'mcq' ? q.choices : undefined,
        answer: q.type === 'mcq' ? `${q.answer_index + 1}. ${q.choices[q.answer_index]}` : formatFillAnswer(q.answer as FillAnswer),
        explanation: q.explanation,
        given,
      };
    }
  }
  const prompt = clip(raw.prompt, 3000);
  if (!prompt) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 6).map((x) => clip(x, 600)) : undefined);
  return {
    level: clip(raw.level, 20) || undefined,
    subject: clip(raw.subject, 20),
    chapter: clip(raw.chapter, 40) || null,
    prompt,
    choices: list(raw.choices),
    statements: list(raw.statements),
    answer: clip(raw.answer, 600),
    explanation: clip(raw.explanation, 3000),
    given,
  };
}

function buildPrompt(c: Ctx, history: Turn[], action: Action, message: string, lang: Lang) {
  const hints = history.filter((h) => h.role === 'tutor' && h.kind === 'hint').length;
  const unlocked = hints >= HINTS_FOR_SOLUTION || history.some((h) => h.role === 'tutor' && h.kind === 'solution');
  const q = [
    `วิชา: ${SUBJECT_TH[c.subject] ?? c.subject}${c.chapter && chapterName(c.chapter) ? ` / บท ${chapterName(c.chapter)}` : ''}`,
    `ระดับ: ${LEVEL_TH[c.level ?? ''] ?? 'นักเรียนไทย'}`,
    `โจทย์: ${c.prompt}`,
    c.statements?.length ? `ข้อความ:\n${c.statements.map((s, i) => `${i + 1}) ${s}`).join('\n')}` : '',
    c.choices?.length ? `ตัวเลือก:\n${c.choices.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
    `เฉลยที่ถูก (ห้ามบอกตรงๆ จนกว่าจะได้รับอนุญาต): ${c.answer}`,
    c.explanation ? `คำอธิบายเฉลยสั้นๆ ของระบบ: ${c.explanation}` : '',
    c.given ? `นักเรียนตอบไปว่า: ${c.given}` : 'นักเรียนยังไม่ได้ตอบ หรือหมดเวลา',
  ]
    .filter(Boolean)
    .join('\n');
  const talk = history
    .slice(-12)
    .map((h) => `${h.role === 'user' ? 'นักเรียน' : 'ติวเตอร์'}: ${h.text}`)
    .join('\n');

  let task: string;
  if (action === 'hint') {
    task = `ให้คำใบ้ขั้นที่ ${hints + 1} เท่านั้น ยาว 1-3 ประโยค ต่อยอดจากคำใบ้ก่อนหน้า (ถ้ามี) ไม่ซ้ำของเดิม
ชี้แนวคิดหรือขั้นตอนถัดไปที่ควรทำ ถ้านักเรียนตอบผิด ให้ชี้จุดที่น่าจะพลาดอย่างอ่อนโยน
ห้ามบอกคำตอบสุดท้าย ห้ามคำนวณจนจบ ปิดท้ายด้วยคำถามชวนคิดสั้นๆ 1 ประโยค`;
  } else if (action === 'solution') {
    task = `อธิบายวิธีทำเต็มแบบทีละขั้น เป็นข้อๆ ขึ้นต้นแต่ละขั้นด้วย "1) " "2) " ... ขั้นละ 1-2 ประโยค ไม่เกิน 7 ขั้น
ปิดท้ายด้วยบรรทัด "คำตอบ: ..." และ 1 ประโยคเตือนจุดที่คนมักพลาดในโจทย์แบบนี้`;
  } else {
    task = `ตอบคำถามล่าสุดของนักเรียน: "${message}"
ตอบตรงประเด็น สั้น กระชับ ไม่เกิน 5 ประโยค${
      unlocked ? '' : '\nยังไม่อนุญาตให้บอกคำตอบสุดท้ายหรือทำให้จบ ให้ช่วยด้วยการชี้แนวคิดแทน ถ้านักเรียนขอคำตอบ ให้บอกว่ากด "ขอคำใบ้" อีกนิดแล้วจะดูวิธีทำเต็มได้'
    }
ถ้าคำถามไม่เกี่ยวกับโจทย์หรือการเรียน ให้ชวนกลับมาที่โจทย์อย่างสุภาพ`;
  }

  return `คุณคือติวเตอร์ที่ใจดี อดทน และเก่ง กำลังช่วยนักเรียนไทยเข้าใจโจทย์ข้อหนึ่ง

${q}

${talk ? `บทสนทนาที่ผ่านมา:\n${talk}\n` : ''}
งานของคุณตอนนี้:
${task}

กติกาการเขียน:
- เขียนเป็น${lang === 'en' ? 'ภาษาอังกฤษ (English) ทั้งหมด' : 'ภาษาไทยที่เป็นกันเอง เหมาะกับวัยนักเรียน'}
- สูตรหรือสมการให้เขียนเป็น LaTeX ใน $...$ สูตรเคมีใช้ \ce{...} ได้
- ไม่ต้องทักทายหรือขึ้นต้นด้วยคำปลอบใจซ้ำๆ เข้าเรื่องเลย ใช้สรรพนามเรียกนักเรียนว่า "เธอ" หรือไม่ใช้สรรพนาม
- ห้ามใช้อีโมจิ ห้ามใช้ markdown ตัวหนา หัวข้อ หรือตาราง${lang === 'en' ? '\n\nIMPORTANT: Reply in English only.' : ''}`;
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(prompt: string | Part[], apiKey: string, asJson = false): Promise<string> {
  let lastError = '';
  const parts = typeof prompt === 'string' ? [{ text: prompt }] : prompt;
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, ...(asJson ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    if (!res.ok) {
      lastError = `${model}: HTTP ${res.status}`;
      if ([404, 429, 500, 503].includes(res.status)) continue;
      throw new Error(lastError);
    }
    const body = await res.json();
    if (body?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      lastError = `${model}: cut off (MAX_TOKENS)`;
      continue;
    }
    const out: { text?: string; thought?: boolean }[] = body?.candidates?.[0]?.content?.parts ?? [];
    const text = out
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .replace(asJson ? /$^/ : /\*\*/g, '')
      .replace(/\p{Extended_Pictographic}️?/gu, '')
      .trim();
    if (text) return text;
    lastError = `${model}: empty response`;
  }
  throw new Error(`Gemini failed: ${lastError}`);
}

const SUBJECTS = ['math', 'science', 'physics', 'chemistry', 'biology', 'english'];

function photoPrompt(lang: Lang) {
  return `รูปนี้คือโจทย์ที่นักเรียนไทยถ่ายมาขอให้ช่วยอธิบาย
ตอบเป็น JSON อย่างเดียว รูปแบบ:
{"ok": true, "subject": "math|science|physics|chemistry|biology|english", "prompt": "...", "choices": ["..."], "answer": "...", "explanation": "...", "hint": "..."}
- prompt: ถอดข้อความโจทย์ให้ครบถ้วนตามรูป (ถ้ามีหลายข้อ เลือกข้อที่เด่นหรืออยู่บนสุด 1 ข้อ) สูตรเขียนเป็น LaTeX ใน $...$ สูตรเคมีใช้ \\ce{...} ได้
- choices: ตัวเลือกถ้ามี (ไม่มีให้เป็น [])
- answer: คำตอบที่ถูกต้องที่คุณคำนวณเอง (ตรวจให้ดี)
- explanation: วิธีทำย่อ 1-3 ประโยค
- hint: คำใบ้ขั้นที่ 1 ยาว 1-3 ประโยค ชี้แนวคิดหรือขั้นแรกที่ควรทำ ห้ามบอกคำตอบ ปิดท้ายด้วยคำถามชวนคิดสั้นๆ ไม่ต้องทักทาย
- ถ้ารูปไม่ใช่โจทย์การเรียน อ่านไม่ออก หรือไม่เหมาะสม ให้ตอบ {"ok": false, "reason": "..."}
- ภาษาของ hint, explanation และ reason: ${lang === 'en' ? 'English' : 'ภาษาไทยที่เป็นกันเอง'} (prompt และ choices คงภาษาตามรูป)
- ห้ามใช้อีโมจิ ห้ามใช้ markdown`;
}

async function handlePhoto(
  admin: ReturnType<typeof createClient>,
  user: { id: string },
  guest: boolean,
  body: Record<string, unknown>,
  lang: Lang,
  apiKey: string,
) {
  const mime = String(body.mime ?? '');
  const data = String(body.image ?? '');
  if (!/^image\/(jpeg|png|webp)$/.test(mime) || !data || data.length > 2_800_000 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
    return json({ error: 'bad_image' }, 400);
  }
  const { data: quota, error: qErr } = await admin.rpc('tutor_consume', { p_user: user.id, p_kind: 'photo', p_guest: guest });
  if (qErr) throw qErr;
  if (!quota.ok) return json({ error: 'photo_quota', used: quota.used, limit: quota.limit }, 429);
  const refund = () => admin.rpc('tutor_consume', { p_user: user.id, p_kind: 'photo', p_guest: guest, p_delta: -1 });

  let parsed: Record<string, unknown>;
  try {
    const raw = await callGemini([{ inline_data: { mime_type: mime, data } }, { text: photoPrompt(lang) }], apiKey, true);
    parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, '').trim());
  } catch (e) {
    await refund();
    throw e;
  }
  if (!parsed.ok || !parsed.prompt || !parsed.hint) {
    // อ่านโจทย์ไม่ได้ ไม่นับโควตา
    await refund();
    return json({ error: 'not_a_problem', reason: clip(parsed.reason, 300) }, 422);
  }
  const subject = SUBJECTS.includes(String(parsed.subject)) ? String(parsed.subject) : 'math';
  return json({
    question: {
      ctx: {
        subject,
        prompt: clip(parsed.prompt, 3000),
        choices: Array.isArray(parsed.choices) && parsed.choices.length ? parsed.choices.slice(0, 6).map((c) => clip(c, 600)) : undefined,
        answer: clip(parsed.answer, 600),
        explanation: clip(parsed.explanation, 3000),
      },
    },
    reply: clip(parsed.hint, 3000).replace(/\p{Extended_Pictographic}️?/gu, ''),
    used: quota.used,
    limit: quota.limit,
  });
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
    const guest = user.is_anonymous === true;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === 'photo') return await handlePhoto(admin, user, guest, body, body.lang === 'en' ? 'en' : 'th', apiKey);
    const action: Action = body.action === 'solution' ? 'solution' : body.action === 'ask' ? 'ask' : 'hint';
    const lang: Lang = body.lang === 'en' ? 'en' : 'th';
    const message = clip(body.message, 500).trim();
    if (action === 'ask' && !message) return json({ error: 'empty_message' }, 400);
    const history: Turn[] = (Array.isArray(body.history) ? body.history : []).slice(-16).map((h: Record<string, unknown>) => ({
      role: h.role === 'tutor' ? 'tutor' : 'user',
      kind: h.kind === 'solution' ? 'solution' : h.kind === 'ask' ? 'ask' : 'hint',
      text: clip(h.text, 1500),
    }));
    const hints = history.filter((h) => h.role === 'tutor' && h.kind === 'hint').length;
    if (action === 'solution' && hints < HINTS_FOR_SOLUTION) return json({ error: 'locked' }, 400);

    const ctx = await loadCtx(admin, body);
    if (!ctx) return json({ error: 'no_question' }, 400);

    const { data: quota, error: qErr } = await admin.rpc('tutor_consume', { p_user: user.id, p_kind: 'chat', p_guest: guest });
    if (qErr) throw qErr;
    if (!quota.ok) return json({ error: 'quota', used: quota.used, limit: quota.limit }, 429);

    try {
      const reply = (await callGemini(buildPrompt(ctx, history, action, message, lang), apiKey)).slice(0, 3000);
      return json({ reply, kind: action, used: quota.used, limit: quota.limit });
    } catch (e) {
      // AI ตอบไม่ได้ คืนโควตา
      await admin.rpc('tutor_consume', { p_user: user.id, p_kind: 'chat', p_guest: guest, p_delta: -1 });
      throw e;
    }
  } catch (e) {
    // log แค่ข้อความ error (ไม่มีรูปหรือข้อมูลผู้ใช้)
    console.error(e instanceof Error ? e.message : 'error');
    return json({ error: 'ai_failed' }, 500);
  }
});
