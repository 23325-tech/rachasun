import type { Difficulty, Subject, Level, Track } from '../types';
import { ensureSession, PUBLIC_URL } from './supabase';
import { noteServerTime } from './roomGame';

/** โจทย์ที่เซิร์ฟเวอร์ส่งมา (ไม่มีเฉลย) */
export interface AsyncQuestion {
  index: number;
  total: number;
  question: {
    type: 'mcq' | 'fill';
    subject: Subject;
    difficulty: Difficulty;
    prompt: string;
    choices?: string[];
    answerKind?: 'number' | 'text';
    unit?: string;
  };
  limitMs: number;
  /** เวลาเซิร์ฟเวอร์ที่ข้อนี้หมดเวลา */
  deadline: number;
  score: number;
}

export interface AsyncAnswerResult {
  correct: boolean;
  timedOut: boolean;
  points: number;
  score: number;
  done: boolean;
  xp?: { gained: number; total: number };
  answerIndex?: number;
  answerText?: string;
  explanation: string;
}

export interface ChallengeSettings {
  subject: Subject | 'all';
  difficulty: Difficulty;
  track: Track;
  /** ไม่มี = ม.ปลาย (คำท้าที่สร้างก่อนมีระดับชั้น) */
  level?: Level;
  count: number;
}

export interface ChallengeBoard {
  code: string;
  settings: ChallengeSettings;
  count: number;
  expiresAt: string;
  expired: boolean;
  creator: { nickname: string; tag: number; avatar: string } | null;
  me: { started: boolean; finished: boolean; score: number } | null;
  rows: {
    nickname: string;
    tag: number;
    avatar: string;
    score: number;
    correct: number;
    finished: boolean;
    isMe: boolean;
    isCreator: boolean;
  }[];
}

const ERRORS: Record<string, string> = {
  challenge_not_found: 'ไม่พบคำท้านี้ ตรวจลิงก์อีกครั้งนะ',
  challenge_expired: 'คำท้านี้หมดเวลาแล้ว (24 ชั่วโมง)',
  already_played: 'คุณเล่นชุดนี้ไปแล้ว',
  question_closed: 'ข้อนี้ปิดไปแล้ว',
  no_questions: 'เตรียมโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง',
  invalid_settings: 'ค่าที่เลือกไม่ถูกต้อง',
  profile_required: 'ตั้งชื่อเล่นก่อนนะ',
  not_member: 'คุณไม่ได้อยู่ในกลุ่มนี้',
};

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const sb = await ensureSession();
  const sentAt = Date.now();
  const { data, error } = await sb.functions.invoke<T & { error?: string; serverNow?: number }>('async-play', {
    body: { action, ...body },
  });
  const receivedAt = Date.now();
  let payload = data;
  if (error) {
    const ctx = (error as { context?: Response }).context;
    payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
  }
  if (payload?.serverNow) noteServerTime(payload.serverNow, sentAt, receivedAt);
  if (payload?.error) throw new Error(ERRORS[payload.error] ?? payload.error);
  if (!payload) throw new Error(error?.message ?? 'ไม่ได้รับข้อมูลจากเซิร์ฟเวอร์');
  return payload;
}

export const createChallenge = (settings: ChallengeSettings) => call<{ code: string }>('create_challenge', { settings });
/** โจทย์ประจำวันของกลุ่ม (เล่นได้วันละครั้ง) */
export const startDaily = (groupId: string) => call<{ playId: string; total: number }>('start_daily', { groupId });
export const startChallenge = (code: string) => call<{ playId: string; total: number }>('start', { code });
export const nextQuestion = (playId: string) => call<AsyncQuestion | { done: true; score: number }>('next', { playId });
export const answerQuestion = (playId: string, index: number, given: number | string | null) =>
  call<AsyncAnswerResult>('answer', { playId, index, given });

export async function fetchChallengeBoard(code: string): Promise<ChallengeBoard | null> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('challenge_board', { p_code: code });
  if (error) throw new Error(error.message);
  return data as ChallengeBoard | null;
}

/** ลิงก์ท้าเพื่อน เช่น https://.../?challenge=ABC123 */
export const challengeLink = (code: string) => `${PUBLIC_URL}/?challenge=${code}`;
