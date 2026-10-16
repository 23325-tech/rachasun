import type { Difficulty, FillAnswer, Level, Subject } from '../types';
import { ensureSession } from './supabase';
import { t } from './i18n';

/** โจทย์ในคลังของครู (รูปแบบที่หน้าเว็บใช้แก้ไข) */
export interface TeacherQuestion {
  id?: string;
  level: Level;
  subject: Subject;
  chapter: string | null;
  difficulty: Difficulty;
  type: 'mcq' | 'fill';
  prompt: string;
  choices: string[];
  answerIndex: number;
  answer: FillAnswer;
  explanation: string;
  source?: 'manual' | 'ai';
  createdAt?: string;
}

interface Row {
  id: string;
  level: Level;
  subject: Subject;
  chapter: string | null;
  difficulty: Difficulty;
  type: 'mcq' | 'fill';
  prompt: string;
  choices: string[] | null;
  answer_index: number | null;
  answer: FillAnswer | null;
  explanation: string;
  source: 'manual' | 'ai';
  created_at: string;
}

export const blankQuestion = (level: Level, subject: Subject): TeacherQuestion => ({
  level,
  subject,
  chapter: null,
  difficulty: 'medium',
  type: 'mcq',
  prompt: '',
  choices: ['', '', '', ''],
  answerIndex: 0,
  answer: { kind: 'number', value: 0 },
  explanation: '',
});

const fromRow = (r: Row): TeacherQuestion => ({
  id: r.id,
  level: r.level,
  subject: r.subject,
  chapter: r.chapter,
  difficulty: r.difficulty,
  type: r.type,
  prompt: r.prompt,
  choices: r.choices ?? ['', '', '', ''],
  answerIndex: r.answer_index ?? 0,
  answer: r.answer ?? { kind: 'number', value: 0 },
  explanation: r.explanation,
  source: r.source,
  createdAt: r.created_at,
});

const ERRORS: Record<string, () => string> = {
  members_only: () => t('ต้องสมัครสมาชิกก่อนถึงจะสร้างโจทย์ได้', 'Sign up first to create questions'),
  bank_full: () => t('คลังเต็มแล้ว (2,000 ข้อ) ลบข้อเก่าก่อนนะ', 'Your bank is full (2,000). Delete some first.'),
  bad_text: () => t('โจทย์มีคำไม่เหมาะสม', 'The question contains inappropriate words'),
  bad_choices: () => t('ตัวเลือกต้องมีครบ 4 ข้อ ข้อละไม่เกิน 500 ตัวอักษร', 'All 4 choices are required (max 500 characters each)'),
  teacher_q_shape: () => t('ข้อมูลโจทย์ไม่ครบ ตรวจเฉลยอีกครั้ง', 'The question is incomplete. Check the answer.'),
  not_allowed: () => t('แก้ไขข้อนี้ไม่ได้', "You can't edit this question"),
};
const errorText = (msg: string) => {
  const code = Object.keys(ERRORS).find((k) => msg.includes(k));
  return code ? ERRORS[code]() : t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'Could not save, please try again');
};

export async function fetchMyQuestions(): Promise<TeacherQuestion[]> {
  const sb = await ensureSession();
  const { data, error } = await sb.from('teacher_questions').select('*').order('created_at', { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  return (data as Row[]).map(fromRow);
}

/** ตรวจในเครื่องก่อนส่ง คืนข้อความผิด (ว่าง = ใช้ได้) */
export function checkQuestion(q: TeacherQuestion): string {
  if (q.prompt.trim().length < 3) return t('พิมพ์โจทย์ก่อนนะ', 'Write the question first');
  if (q.type === 'mcq' && q.choices.some((c) => !c.trim())) return t('ใส่ตัวเลือกให้ครบ 4 ข้อ', 'Fill in all 4 choices');
  if (q.type === 'fill') {
    if (q.answer.kind === 'number' && !Number.isFinite(q.answer.value)) return t('เฉลยต้องเป็นตัวเลข', 'The answer must be a number');
    if (q.answer.kind === 'text' && !q.answer.accepted.some((a) => a.trim())) return t('ใส่คำตอบที่ถูกอย่างน้อย 1 แบบ', 'Add at least one accepted answer');
  }
  return '';
}

export async function saveQuestion(q: TeacherQuestion): Promise<string> {
  const bad = checkQuestion(q);
  if (bad) throw new Error(bad);
  const sb = await ensureSession();
  const payload = {
    level: q.level,
    subject: q.subject,
    chapter: q.chapter ?? '',
    difficulty: q.difficulty,
    type: q.type,
    prompt: q.prompt,
    choices: q.choices.map((c) => c.trim()),
    answerIndex: q.answerIndex,
    answer: q.answer.kind === 'text' ? { kind: 'text', accepted: q.answer.accepted.map((a) => a.trim()).filter(Boolean) } : q.answer,
    explanation: q.explanation,
    source: q.source ?? 'manual',
  };
  const { data, error } = await sb.rpc('save_teacher_question', { p_id: q.id ?? null, p_q: payload });
  if (error) throw new Error(errorText(error.message));
  return data as string;
}

export async function deleteQuestion(id: string): Promise<void> {
  const sb = await ensureSession();
  await sb.rpc('delete_teacher_question', { p_id: id });
}

export async function fetchAiQuota(): Promise<{ used: number; limit: number }> {
  const sb = await ensureSession();
  const { data } = await sb.rpc('teacher_ai_quota');
  return (data as { used: number; limit: number }) ?? { used: 0, limit: 10 };
}

/** ให้ AI ร่างโจทย์ (ยังไม่บันทึก) */
export async function generateDrafts(opts: {
  level: Level;
  subject: Subject;
  request: string;
  count: number;
  type: 'mix' | 'mcq' | 'fill';
}): Promise<{ drafts: TeacherQuestion[]; used: number; limit: number }> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke('teacher-ai', { body: opts });
  let body = data as { drafts?: Record<string, unknown>[]; error?: string; reason?: string; used?: number; limit?: number } | null;
  const ctx = (error as { context?: Response } | null)?.context;
  if (error && ctx) body = await ctx.json().catch(() => null);
  if (!body?.drafts) {
    const code = body?.error ?? 'ai_failed';
    if (code === 'quota') throw new Error(t(`วันนี้ใช้ AI ครบ ${body?.limit ?? 10} ครั้งแล้ว`, `You've used all ${body?.limit ?? 10} AI requests today`));
    if (code === 'members_only') throw new Error(ERRORS.members_only());
    if (code === 'no_drafts') throw new Error(t('AI สร้างโจทย์ตามคำสั่งนี้ไม่ได้ ลองเขียนให้ชัดขึ้น (ไม่นับโควตา)', "The AI couldn't make questions from that. Try being more specific (not counted)."));
    throw new Error(t('AI ทำงานไม่สำเร็จ ลองใหม่อีกครั้ง (ไม่นับโควตา)', 'The AI failed, please try again (not counted)'));
  }
  const drafts = body.drafts.map((d) => ({
    ...blankQuestion(opts.level, opts.subject),
    difficulty: d.difficulty as Difficulty,
    chapter: (d.chapter as string | null) ?? null,
    type: d.type as 'mcq' | 'fill',
    prompt: String(d.prompt),
    choices: (d.choices as string[] | undefined) ?? ['', '', '', ''],
    answerIndex: (d.answerIndex as number | undefined) ?? 0,
    answer: (d.answer as FillAnswer | undefined) ?? { kind: 'number', value: 0 },
    explanation: String(d.explanation ?? ''),
    source: 'ai' as const,
  }));
  return { drafts, used: body.used ?? 0, limit: body.limit ?? 10 };
}
