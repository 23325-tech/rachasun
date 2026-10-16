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

export async function fetchTutorQuota(kind: 'chat' | 'photo' = 'chat'): Promise<TutorQuota> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('tutor_quota');
  if (error) throw new Error(error.message);
  return kind === 'photo' ? { used: data.photoUsed, limit: data.photoLimit } : { used: data.chatUsed, limit: data.chatLimit };
}

/** ย่อรูปในเครื่องก่อนส่ง (ด้านยาวสุด 1280px, JPEG) ประหยัดเน็ต */
export async function shrinkImage(file: File, max = 1280): Promise<{ base64: string; url: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.82);
  return { base64: url.slice(url.indexOf(',') + 1), url };
}

/** ส่งรูปโจทย์ให้ AI อ่าน ได้โจทย์ที่ถอดแล้ว + คำใบ้แรก (รูปไม่ถูกเก็บ) */
export async function photoTutor(base64: string): Promise<{ question: TutorQuestion; reply: string; quota: TutorQuota }> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke('ai-tutor', {
    body: { action: 'photo', image: base64, mime: 'image/jpeg', lang: getLang() },
  });
  let body = data as { question?: TutorQuestion; reply?: string; error?: string; reason?: string; used?: number; limit?: number } | null;
  const ctx = (error as { context?: Response } | null)?.context;
  if (error && ctx) body = await ctx.json().catch(() => null);
  if (!body?.question || !body.reply) {
    const code = body?.error ?? 'ai_failed';
    if (code === 'photo_quota') {
      const quota = { used: body?.used ?? 0, limit: body?.limit ?? 0 };
      throw new TutorError(code, t(`วันนี้ส่งรูปครบ ${quota.limit} รูปแล้ว พรุ่งนี้มาใหม่นะ`, `You've sent all ${quota.limit} photos today. Come back tomorrow!`), quota);
    }
    if (code === 'not_a_problem')
      throw new TutorError(code, t('อ่านโจทย์จากรูปไม่ได้ ลองถ่ายให้ชัด ตรง และเห็นโจทย์ทั้งข้อ (ไม่นับโควตา)', "Couldn't read a problem in this photo. Try a clearer, straight shot of the whole question (not counted)."));
    if (code === 'bad_image') throw new TutorError(code, t('ไฟล์รูปนี้ใช้ไม่ได้ ลองรูปอื่น', "This image file can't be used, try another"));
    throw new TutorError(code, t('AI อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง (ไม่นับโควตา)', "The AI couldn't process the photo, please try again (not counted)"));
  }
  return { question: body.question, reply: body.reply, quota: { used: body.used ?? 0, limit: body.limit ?? 0 } };
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
