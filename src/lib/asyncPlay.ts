import type { Difficulty, Subject, Level, Track } from '../types';
import { ensureSession, PUBLIC_URL } from './supabase';
import { noteServerTime } from './roomGame';
import { t } from './i18n';

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
  get challenge_not_found() { return t('ไม่พบคำท้านี้ ตรวจลิงก์อีกครั้งนะ', 'Challenge not found, check the link'); },
  get challenge_expired() { return t('คำท้านี้หมดเวลาแล้ว (24 ชั่วโมง)', 'This challenge has expired (24 h)'); },
  get already_played() { return t('คุณเล่นชุดนี้ไปแล้ว', 'You\'ve already played this set'); },
  get question_closed() { return t('ข้อนี้ปิดไปแล้ว', 'This question is closed'); },
  get no_questions() { return t('เตรียมโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง', 'Couldn\'t prepare questions, try again'); },
  get invalid_settings() { return t('ค่าที่เลือกไม่ถูกต้อง', 'Invalid settings'); },
  get profile_required() { return t('ตั้งชื่อเล่นก่อนนะ', 'Set a nickname first'); },
  get not_member() { return t('คุณไม่ได้อยู่ในกลุ่มนี้', 'You\'re not in this group'); },
  get homework_closed() { return t('เลยกำหนดส่งการบ้านนี้แล้ว', 'This homework is past its due date'); },
  get homework_not_found() { return t('ไม่พบการบ้านนี้', 'Homework not found'); },
  get not_allowed() { return t('คุณไม่มีสิทธิ์ทำแบบนี้', 'You\'re not allowed to do that'); },
  get bad_title() { return t('ชื่อการบ้านใช้ไม่ได้ (1-60 ตัวอักษร และต้องเหมาะสม)', 'Invalid homework title (1-60 characters, appropriate)'); },
  get bad_due() { return t('กำหนดส่งต้องอยู่ระหว่าง 30 นาทีถึง 30 วันจากนี้', 'Due date must be between 30 minutes and 30 days from now'); },
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
  if (!payload) throw new Error(error?.message ?? t('ไม่ได้รับข้อมูลจากเซิร์ฟเวอร์', 'No data from the server'));
  return payload;
}

export const createChallenge = (settings: ChallengeSettings) => call<{ code: string }>('create_challenge', { settings });
/** โจทย์ประจำวันของกลุ่ม (เล่นได้วันละครั้ง) */
export const startDaily = (groupId: string) => call<{ playId: string; total: number }>('start_daily', { groupId });
export const createHomework = (classroomId: string, title: string, settings: ChallengeSettings, dueAt: string) =>
  call<{ homeworkId: string }>('create_homework', { classroomId, title, settings, dueAt });
export const startHomework = (homeworkId: string) => call<{ playId: string; total: number }>('start_homework', { homeworkId });
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
