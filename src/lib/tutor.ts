import type { Question } from '../types';
import { ensureSession } from './supabase';
import { getLang, t } from './i18n';
import { formatFillAnswer } from './checkAnswer';

export type TutorAction = 'hint' | 'solution' | 'ask';
export interface TutorTurn {
  role: 'user' | 'tutor';
  kind: TutorAction;
  text: string;
}

/** ข้อมูลโจทย์ที่ส่งให้ติวเตอร์ (โจทย์จากคลังเซิร์ฟเวอร์อ่านเฉลยเองจาก questionId) */
export interface TutorQuestion {
  questionId?: string;
  ctx: {
    level?: string;
    subject: string;
    chapter?: string | null;
    prompt: string;
    choices?: string[];
    statements?: string[];
    answer: string;
    explanation: string;
    given?: string;
  };
}

export interface TutorQuota {
  used: number;
  limit: number;
}

/** ต้องได้คำใบ้กี่ข้อก่อนดูวิธีทำเต็ม (ตรงกับเซิร์ฟเวอร์) */
export const HINTS_FOR_SOLUTION = 2;

/** แปลงโจทย์ในเกม + คำตอบของผู้เล่น เป็นข้อมูลสำหรับติวเตอร์ */
export function tutorFromQuestion(q: Question, given: number | string | null, level?: string): TutorQuestion {
  const givenText =
    given === null || given === '' ? '' : q.type === 'mcq' && typeof given === 'number' ? `${given + 1}. ${q.choices[given]}` : String(given);
  return {
    questionId: q.source === 'bank' ? q.id : undefined,
    ctx: {
      level,
      subject: q.subject,
      chapter: q.chapter,
      prompt: q.prompt,
      choices: q.type === 'mcq' ? [...q.choices] : undefined,
      answer: q.type === 'mcq' ? `${q.answerIndex + 1}. ${q.choices[q.answerIndex]}` : formatFillAnswer(q.answer),
      explanation: q.explanation,
      given: givenText,
    },
  };
}

export async function fetchTutorQuota(): Promise<TutorQuota> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('tutor_quota');
  if (error) throw new Error(error.message);
  return { used: data.chatUsed, limit: data.chatLimit };
}

export class TutorError extends Error {
  constructor(public code: string, message: string, public quota?: TutorQuota) {
    super(message);
  }
}

export async function askTutor(
  q: TutorQuestion,
  history: TutorTurn[],
  action: TutorAction,
  message = '',
): Promise<{ reply: string; quota: TutorQuota }> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke('ai-tutor', {
    body: { ...q, history, action, message, lang: getLang() },
  });
  let body = data as { reply?: string; error?: string; used?: number; limit?: number } | null;
  // functions.invoke เก็บ body ของ error ไว้ใน context
  const ctx = (error as { context?: Response } | null)?.context;
  if (error && ctx) body = await ctx.json().catch(() => null);
  if (!body?.reply) {
    const code = body?.error ?? 'ai_failed';
    if (code === 'quota') {
      const quota = { used: body?.used ?? 0, limit: body?.limit ?? 0 };
      throw new TutorError(code, t(`วันนี้ถามครบ ${quota.limit} ครั้งแล้ว พรุ่งนี้มาใหม่นะ`, `You've used all ${quota.limit} questions today. Come back tomorrow!`), quota);
    }
    if (code === 'locked') throw new TutorError(code, t('ขอคำใบ้อีกนิดก่อนนะ แล้วจะดูวิธีทำเต็มได้', 'Get a couple of hints first, then the full solution unlocks'));
    throw new TutorError(code, t('ติวเตอร์ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง', "The tutor couldn't answer right now, please try again"));
  }
  return { reply: body.reply, quota: { used: body.used ?? 0, limit: body.limit ?? 0 } };
}
