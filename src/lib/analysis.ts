import { Hourglass, Minus, Target, ThumbsUp, Trophy, type Icon } from '@phosphor-icons/react';
import type { Level, Question } from '../types';
import { ensureSession, supabase } from './supabase';

export interface AnswerItem {
  questionId: string;
  correct: boolean;
  timeMs: number;
}

/**
 * บันทึกคำตอบฝึกเดี่ยว/ดวลบอทลงประวัติ (เฉพาะโจทย์จากคลัง)
 * ทำเงียบๆ ถ้าไม่สำเร็จไม่ต้องรบกวนผู้เล่น
 */
export async function logAnswers(mode: 'solo' | 'bots', runId: number, questions: Question[], items: AnswerItem[]) {
  if (!supabase) return;
  const bank = new Set(questions.filter((q) => q.source === 'bank').map((q) => q.id));
  const rows = items.filter((i) => bank.has(i.questionId));
  if (!rows.length) return;
  try {
    const sb = await ensureSession();
    await sb.rpc('log_answers', {
      p_mode: mode,
      p_run: String(runId),
      p_items: rows.map((r) => ({ question_id: r.questionId, correct: r.correct, time_ms: Math.round(r.timeMs) })),
    });
  } catch {
    /* ไม่เป็นไร */
  }
}

export interface ChapterStat {
  chapter: string;
  subject: string;
  total: number;
  recent: number;
  recentCorrect: number;
  avgTimeMs: number;
  lastAt: string;
}

export async function fetchChapterStats(level: Level): Promise<ChapterStat[]> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('my_chapter_stats', { p_level: level });
  if (error) throw new Error(`โหลดสถิติไม่สำเร็จ: ${error.message}`);
  return (data as Record<string, unknown>[]).map((r) => ({
    chapter: r.chapter as string,
    subject: r.subject as string,
    total: r.total as number,
    recent: r.recent as number,
    recentCorrect: r.recent_correct as number,
    avgTimeMs: r.avg_time_ms as number,
    lastAt: r.last_at as string,
  }));
}

/** ต้องทำอย่างน้อยกี่ข้อถึงจะตัดสินได้ */
export const MIN_ANSWERS = 5;

export type ChapterStatus = 'strong' | 'ok' | 'weak' | 'few' | 'none';

/** จาก 20 ข้อล่าสุด: ≥80% ถนัด, 60-79% พอใช้, <60% ควรฝึก, <5 ข้อ ข้อมูลยังไม่พอ */
export function statusOf(stat: ChapterStat | undefined): ChapterStatus {
  if (!stat || stat.recent === 0) return 'none';
  if (stat.recent < MIN_ANSWERS) return 'few';
  const acc = stat.recentCorrect / stat.recent;
  return acc >= 0.8 ? 'strong' : acc >= 0.6 ? 'ok' : 'weak';
}

export const accuracyOf = (stat: ChapterStat) => (stat.recent ? stat.recentCorrect / stat.recent : 0);

export const STATUS_TEXT: Record<ChapterStatus, string> = {
  strong: 'ถนัด',
  ok: 'พอใช้',
  weak: 'ควรฝึก',
  few: 'ข้อมูลยังไม่พอ',
  none: 'ยังไม่เคยทำ',
};

export const STATUS_ICON: Record<ChapterStatus, Icon> = { strong: Trophy, ok: ThumbsUp, weak: Target, few: Hourglass, none: Minus };
