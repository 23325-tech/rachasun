import type { Difficulty, FillAnswer, Question, Subject, Track } from '../types';
import { SAMPLE_QUESTIONS } from '../data/sampleQuestions';
import { ensureSession, supabase } from './supabase';
import { shuffle } from './shuffle';

/** Edge Function สร้างได้ครั้งละไม่เกินเท่านี้ */
const GENERATE_BATCH = 10;

export interface QuizRequest {
  subjects: Subject[];
  difficulty: Difficulty;
  track: Track;
  count: number;
}

export interface QuizLoadResult {
  questions: Question[];
  /** จำนวนข้อที่ AI สร้างใหม่ในรอบนี้ */
  generated: number;
}

interface QuestionRow {
  id: string;
  subject: Subject;
  difficulty: Difficulty;
  track: Track;
  type: 'mcq' | 'fill';
  prompt: string;
  choices: string[] | null;
  answer_index: number | null;
  answer: FillAnswer | null;
  explanation: string;
  time_limit_sec: number | null;
}

function fromRow(r: QuestionRow): Question {
  const base = {
    id: r.id,
    subject: r.subject,
    difficulty: r.difficulty,
    track: r.track,
    prompt: r.prompt,
    explanation: r.explanation,
    timeLimitSec: r.time_limit_sec ?? undefined,
    source: 'bank' as const,
  };
  if (r.type === 'mcq') {
    return {
      ...base,
      type: 'mcq',
      choices: r.choices as [string, string, string, string],
      answerIndex: r.answer_index as 0 | 1 | 2 | 3,
    };
  }
  return { ...base, type: 'fill', answer: r.answer as FillAnswer };
}

/**
 * ดึงโจทย์จากคลังก่อน ถ้าไม่พอให้ AI สร้างเพิ่ม (บันทึกลงคลังให้คนอื่นใช้ต่อด้วย)
 * onStatus ใช้แสดงข้อความระหว่างโหลด
 */
export async function loadQuiz(req: QuizRequest, onStatus?: (msg: string) => void): Promise<QuizLoadResult> {
  if (!supabase) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  // ต้องมี session (แขกก็ได้) เพราะการให้ AI สร้างโจทย์จำกัดจำนวนต่อผู้เล่น
  const sb = await ensureSession();

  onStatus?.('กำลังหยิบโจทย์จากคลัง...');
  const { data, error } = await sb.rpc('get_random_questions', {
    p_subjects: req.subjects,
    p_difficulty: req.difficulty,
    p_track: req.track,
    p_limit: req.count,
  });
  if (error) throw new Error(`ดึงโจทย์จากคลังไม่สำเร็จ: ${error.message}`);
  const fromBank = (data as QuestionRow[]).map(fromRow);

  const missing = req.count - fromBank.length;
  if (missing <= 0) return { questions: fromBank, generated: 0 };

  onStatus?.(`AI กำลังสร้างโจทย์ใหม่ ${missing} ข้อ... (อาจใช้เวลา 10-40 วินาที)`);
  const batches: number[] = [];
  for (let left = missing; left > 0; left -= GENERATE_BATCH) batches.push(Math.min(left, GENERATE_BATCH));

  const results = await Promise.allSettled(
    batches.map((count) =>
      sb.functions.invoke<{ questions: QuestionRow[] }>('generate-questions', {
        body: { subjects: req.subjects, difficulty: req.difficulty, track: req.track, count },
      }),
    ),
  );

  const generated: Question[] = [];
  let firstError = '';
  for (const r of results) {
    if (r.status === 'rejected') firstError ||= String(r.reason);
    else if (r.value.error) firstError ||= await describeFunctionError(r.value.error);
    else generated.push(...(r.value.data?.questions ?? []).map(fromRow));
  }

  const questions = shuffle([...fromBank, ...generated]);
  if (!questions.length) throw new Error(firstError || 'ไม่มีโจทย์ให้เล่น');
  return { questions, generated: generated.length };
}

async function describeFunctionError(err: unknown): Promise<string> {
  // FunctionsHttpError เก็บ Response ไว้ใน context
  const ctx = (err as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error === 'rate_limited')
        return `ให้ AI สร้างโจทย์ใหม่ครบโควตาชั่วโมงนี้แล้ว (${body.limit} ข้อ/ชม.) ลองลดจำนวนข้อ เปลี่ยนวิชา หรือรอสักพักนะ`;
      if (body?.error) return `สร้างโจทย์ไม่สำเร็จ: ${body.error}`;
    } catch {
      /* ignore */
    }
  }
  return `สร้างโจทย์ไม่สำเร็จ: ${(err as Error)?.message ?? String(err)}`;
}

/** โจทย์ตัวอย่างในเครื่อง ใช้ตอนออฟไลน์หรือยังไม่ได้ตั้งค่า Supabase */
export function sampleQuiz(subjects: Subject[], count: number): Question[] {
  const pool = SAMPLE_QUESTIONS.filter((q) => subjects.includes(q.subject));
  return shuffle(pool)
    .slice(0, count)
    .map((q) => ({ ...q, source: 'sample' as const }));
}

export type ReportReason = 'wrong_answer' | 'unclear' | 'display' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'wrong_answer', label: 'เฉลยผิด' },
  { value: 'unclear', label: 'โจทย์ไม่ชัด / ตัวเลือกซ้ำ' },
  { value: 'display', label: 'สูตร/ตัวอักษรแสดงผลเพี้ยน' },
  { value: 'other', label: 'อื่นๆ' },
];

export type ReportOutcome = 'ok' | 'duplicate';

export async function reportQuestion(questionId: string, reason: ReportReason, note: string): Promise<ReportOutcome> {
  const sb = await ensureSession();
  const { error } = await sb
    .from('question_reports')
    .insert({ question_id: questionId, reason, note: note.trim() || null });
  if (!error) return 'ok';
  if (error.code === '23505') return 'duplicate';
  throw new Error(error.message);
}
