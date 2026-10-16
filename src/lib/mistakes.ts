import type { Question } from '../types';
import { ensureSession } from './supabase';
import { fromRow, type QuestionRow } from './questionBank';

export interface MistakeState {
  /** ครบกำหนดทบทวนตอนนี้ */
  due: number;
  /** ยังไม่จำได้ทั้งหมด */
  active: number;
  /** จำได้แล้ว (ผ่านครบ 4 รอบ) */
  graduated: number;
  nextDueAt: string | null;
  /** จำนวนข้อในแต่ละรอบ (1 = 1 วัน, 2 = 3 วัน, 3 = 7 วัน, 4 = 14 วัน) */
  boxes: Record<string, number>;
  bySubject: { subject: string; active: number; due: number }[];
  byChapter: { chapter: string; subject: string; active: number }[];
}

export const REVIEW_SIZE = 10;

export async function fetchMistakes(): Promise<MistakeState> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('mistake_state');
  if (error) throw new Error(error.message);
  return data as MistakeState;
}

/** โจทย์ทบทวน (all = ทบทวนล่วงหน้า รวมข้อที่ยังไม่ครบกำหนด) */
export async function fetchReviewQuestions(all: boolean): Promise<Question[]> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('mistake_questions', { p_limit: REVIEW_SIZE, p_all: all });
  if (error) throw new Error(error.message);
  return (data as QuestionRow[]).map(fromRow);
}
