import type { Difficulty, Question, Subject } from '../types';

/** เวลาพื้นฐาน (วินาที) ตามรูปแบบโจทย์และความยาก */
const BASE_SECONDS: Record<Question['type'], Record<Difficulty, number>> = {
  mcq: { easy: 20, medium: 30, hard: 45 },
  fill: { easy: 30, medium: 45, hard: 75 },
};

/** ตัวคูณตามวิชา วิชาที่ต้องคำนวณได้เวลามากกว่า */
const SUBJECT_MULTIPLIER: Record<Subject, number> = {
  math: 1.2,
  physics: 1.3,
  chemistry: 1.2,
  biology: 1.0,
  english: 0.9,
};

export function getTimeLimitSec(q: Question): number {
  if (q.timeLimitSec) return q.timeLimitSec;
  const raw = BASE_SECONDS[q.type][q.difficulty] * SUBJECT_MULTIPLIER[q.subject];
  // ปัดเป็นทีละ 5 วินาทีให้ตัวเลขดูง่าย
  return Math.round(raw / 5) * 5;
}
