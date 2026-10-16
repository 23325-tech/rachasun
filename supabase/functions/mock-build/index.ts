// Edge Function: สร้างชุดข้อสอบจำลอง A-Level ทีละช่วง (เรียกได้เฉพาะ service role เช่น cron / สคริปต์ผู้ดูแล)
// action "create": เปิดชุดใหม่ของวิชาที่ระบุ / action "step": เติมชุดที่ยังสร้างไม่เสร็จอีก 1 ช่วง
// โจทย์ทุกข้อ AI แต่งใหม่ตามแนวข้อสอบ ไม่คัดลอกข้อสอบจริง
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chapterName } from '../_shared/chapters.ts';
import { repairLatex, wrapBareLatex } from '../_shared/latex.ts';
import { BLUEPRINTS, MOCK_EXAMS, slotsOf, type MockExam, type MockQuestion, type Slot } from '../_shared/mock.ts';

const BATCH = 8;
const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const DIFF_TH = {
  medium: 'กลาง (ระดับข้อสอบทั่วไป)',
  hard: 'ยาก (ต้องคิดหลายขั้น มีตัวลวงที่คนพลาดบ่อย)',
  challenge: 'ยากมาก (ข้อแยกคนได้คะแนนสูง เชื่อมหลายแนวคิด)',
};

const TYPE_RULE = {
  mcq5: 'ปรนัย 5 ตัวเลือก: choices 5 ตัวพอดี ไม่ซ้ำกัน ตัวลวงสมเหตุสมผล answer_index 0-4 (กระจายตำแหน่ง)',
  fill: 'ระบายคำตอบเป็นตัวเลข: คำตอบเป็นจำนวนเดียวที่ระบายได้ (จำนวนเต็มหรือทศนิยมไม่เกิน 2 ตำแหน่ง) ใส่ answer_number (และ answer_unit ถ้ามีหน่วย)',
  multi: 'เลือกตอบเชิงซ้อน: statements 3 ข้อความเกี่ยวกับสถานการณ์ในโจทย์ ให้ truths เป็น true/false ของแต่ละข้อความ (ต้องมีทั้งจริงและเท็จ)',
};

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          slot: { type: 'INTEGER' },
          prompt: { type: 'STRING' },
          choices: { type: 'ARRAY', items: { type: 'STRING' } },
          statements: { type: 'ARRAY', items: { type: 'STRING' } },
          explanation: { type: 'STRING' },
          answer_index: { type: 'INTEGER' },
          answer_number: { type: 'NUMBER' },
          answer_unit: { type: 'STRING' },
          truths: { type: 'ARRAY', items: { type: 'BOOLEAN' } },
        },
        required: ['slot', 'prompt', 'explanation'],
        propertyOrdering: ['slot', 'prompt', 'choices', 'statements', 'explanation', 'answer_index', 'answer_number', 'answer_unit', 'truths'],
      },
    },
  },
  required: ['items'],
};

function buildPrompt(exam: MockExam, slots: { i: number; s: Slot }[]) {
  const bp = BLUEPRINTS[exam];
  const english = exam === 'english';
  return `คุณคือผู้เชี่ยวชาญออกข้อสอบ A-Level วิชา${bp.title} ของไทย (ระดับ ม.6 เตรียมสอบเข้ามหาวิทยาลัย)
แต่งโจทย์ใหม่ตามแนวและระดับของข้อสอบจริง ห้ามคัดลอกข้อสอบเก่า
สร้างโจทย์ตามช่องต่อไปนี้ ช่องละ 1 ข้อ ใส่หมายเลขช่องในฟิลด์ slot:
${slots.map(({ i, s }) => `- ช่อง ${i}: บท "${chapterName(s.chapter)}" · ${TYPE_RULE[s.type]} · ความยาก ${DIFF_TH[s.difficulty]}`).join('\n')}

กติกา:
1. ${english ? 'โจทย์ ตัวเลือก และข้อความเป็นภาษาอังกฤษ ส่วน explanation เป็นภาษาไทย บท Conversation ให้เป็นบทสนทนาสั้นแล้วเลือกประโยคที่เหมาะสม บท Reading Comprehension ให้มีบทอ่านสั้น 80-150 คำอยู่ในโจทย์ข้อนั้นเลย' : 'โจทย์และคำอธิบายเป็นภาษาไทย'}
2. เขียนสูตรด้วย LaTeX ใน $...$ และสูตรเคมีด้วย $\\ce{...}$ ใน JSON ต้อง escape backslash เป็นสองตัวเสมอ เช่น "\\\\frac{1}{2}"
3. ห้ามอ้างถึงรูปภาพหรือกราฟ (ไม่มีรูปประกอบ) ถ้าจำเป็นให้บรรยายข้อมูลเป็นข้อความหรือตาราง และห้ามใช้อีโมจิ
4. explanation อธิบายวิธีคิดทีละขั้นกระชับ (2-5 ประโยค) คำนวณให้ถูกต้องก่อนกำหนดเฉลย และเฉลยต้องตรงกับคำอธิบาย
5. แต่ละข้อทำได้ภายใน 1-4 นาทีสำหรับนักเรียนที่เตรียมตัวมาดี`;
}

interface Raw {
  slot?: number;
  prompt?: string;
  choices?: string[];
  statements?: string[];
  explanation?: string;
  answer_index?: number;
  answer_number?: number;
  answer_unit?: string;
  truths?: boolean[];
}

function toQuestion(raw: Raw, s: Slot): MockQuestion | null {
  const prompt = raw.prompt && repairLatex(raw.prompt).trim();
  const explanation = raw.explanation && repairLatex(raw.explanation).trim();
  if (!prompt || !explanation) return null;
  const base = { ...s, prompt, explanation };
  if (s.type === 'mcq5') {
    const choices = raw.choices?.map((c) => wrapBareLatex(repairLatex(String(c)).trim()));
    const idx = raw.answer_index;
    if (!choices || choices.length !== 5 || choices.some((c) => !c) || new Set(choices).size !== 5) return null;
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 4) return null;
    return { ...base, choices, answer_index: idx };
  }
  if (s.type === 'fill') {
    if (typeof raw.answer_number !== 'number' || !Number.isFinite(raw.answer_number)) return null;
    return {
      ...base,
      answer: { kind: 'number', value: raw.answer_number, ...(raw.answer_unit?.trim() ? { unit: raw.answer_unit.trim() } : {}) },
    };
  }
  const statements = raw.statements?.map((t) => repairLatex(String(t)).trim());
  if (!statements || statements.length !== 3 || statements.some((t) => !t)) return null;
  if (!Array.isArray(raw.truths) || raw.truths.length !== 3 || raw.truths.every((t) => t === raw.truths![0])) return null;
  return { ...base, statements, truths: raw.truths.map(Boolean) };
}

async function callGemini(prompt: string, apiKey: string): Promise<Raw[]> {
  let lastError = '';
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.8 },
      }),
    });
    if (!res.ok) {
      lastError = `${model}: HTTP ${res.status}`;
      if ([404, 429, 500, 503].includes(res.status)) continue;
      throw new Error(lastError);
    }
    const body = await res.json();
    const parts: { text?: string; thought?: boolean }[] = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
    if (text) return JSON.parse(text).items ?? [];
    lastError = `${model}: empty response`;
  }
  throw new Error(`Gemini failed: ${lastError}`);
}

/** รับเฉพาะคีย์ระดับ service role (ทั้งแบบ JWT เดิมและ sb_secret ใหม่): ลองเรียก API ที่ต้องใช้สิทธิ์ผู้ดูแล */
async function isServiceKey(token: string, envKey: string): Promise<boolean> {
  if (!token) return false;
  if (token === envKey) return true;
  const probe = createClient(Deno.env.get('SUPABASE_URL')!, token, { auth: { persistSession: false } });
  const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}

Deno.serve(async (req) => {
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!(await isServiceKey(token, serviceKey))) return json({ error: 'forbidden' }, 403);
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 500);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'create') {
      const exams = (Array.isArray(body.exams) ? body.exams : MOCK_EXAMS).filter((e: string) => MOCK_EXAMS.includes(e as MockExam));
      const created = [];
      for (const exam of exams as MockExam[]) {
        const { data: last } = await admin.from('mock_papers').select('no').eq('exam', exam).order('no', { ascending: false }).limit(1);
        const no = (last?.[0]?.no ?? 0) + 1;
        const { data } = await admin
          .from('mock_papers')
          .insert({ exam, no, target: slotsOf(exam).length })
          .select('id,exam,no')
          .single();
        created.push(data);
      }
      return json({ created });
    }

    // step: เติมชุดที่สร้างค้างไว้เก่าสุดอีก 1 ช่วง
    const { data: paper } = await admin
      .from('mock_papers')
      .select('*')
      .eq('status', 'building')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (!paper) return json({ idle: true });

    const exam = paper.exam as MockExam;
    const slots = slotsOf(exam);
    const have = (paper.questions as MockQuestion[]).length;
    const batch = slots.slice(have, have + BATCH).map((s, k) => ({ i: have + k, s }));
    const raws = await callGemini(buildPrompt(exam, batch), apiKey);

    // เก็บเฉพาะข้อที่ใช้ได้ต่อเนื่องจากต้นช่วง (ข้อที่เสียจะสร้างใหม่รอบหน้า ลำดับข้อไม่เพี้ยน)
    const added: MockQuestion[] = [];
    for (const { i, s } of batch) {
      const raw = raws.find((r) => r.slot === i);
      const q = raw && toQuestion(raw, s);
      if (!q) break;
      added.push(q);
    }
    const questions = [...paper.questions, ...added];
    const done = questions.length >= slots.length;
    await admin
      .from('mock_papers')
      .update({ questions, status: done ? 'ready' : 'building' })
      .eq('id', paper.id);
    return json({ exam, no: paper.no, have: questions.length, target: slots.length, added: added.length, ready: done });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
