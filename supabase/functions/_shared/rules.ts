/**
 * กติกาที่หน้าเว็บกับเซิร์ฟเวอร์ (Edge Functions) ใช้ร่วมกัน: ตรวจคำตอบ, เวลาต่อข้อ, คะแนน
 * ต้องเป็นโค้ดล้วน ไม่ import อะไรเลย (Deno ต้องการนามสกุลไฟล์ใน import)
 */

export type Subject = 'math' | 'physics' | 'chemistry' | 'biology' | 'english';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'fill';

export type FillAnswer =
  | { kind: 'number'; value: number; tolerance?: number; unit?: string }
  | { kind: 'text'; accepted: string[] };

// ---------- ตรวจคำตอบแบบเติม ----------

/** แปลงข้อความที่ผู้เล่นพิมพ์เป็นตัวเลข รองรับ "2.5", "-3", "1,000", "1/4" และมีหน่วยต่อท้ายได้ เช่น "25 m" */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/,/g, '').replace(/\s+/g, '').replace('−', '-');
  const m = s.match(/^(-?\d*\.?\d+)(?:\/(\d*\.?\d+))?/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (m[2] !== undefined) {
    const den = parseFloat(m[2]);
    return den === 0 ? null : num / den;
  }
  return num;
}

export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?。]+$/, '');
}

export function checkFillAnswer(answer: FillAnswer, input: string): boolean {
  if (answer.kind === 'number') {
    const n = parseNumber(input);
    if (n === null) return false;
    const tol = answer.tolerance ?? Math.max(1e-9, Math.abs(answer.value) * 1e-3);
    return Math.abs(n - answer.value) <= tol;
  }
  const given = normalizeText(input).replace(/\s/g, '');
  return answer.accepted.some((a) => normalizeText(a).replace(/\s/g, '') === given);
}

export function formatFillAnswer(answer: FillAnswer): string {
  if (answer.kind === 'number') return answer.unit ? `${answer.value} ${answer.unit}` : String(answer.value);
  return answer.accepted[0];
}

// ---------- เวลาต่อข้อ ----------

/** เวลาพื้นฐาน (วินาที) ตามรูปแบบโจทย์และความยาก */
const BASE_SECONDS: Record<QuestionType, Record<Difficulty, number>> = {
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

export function getTimeLimitSec(q: {
  type: QuestionType;
  difficulty: Difficulty;
  subject: Subject;
  timeLimitSec?: number | null;
}): number {
  if (q.timeLimitSec) return q.timeLimitSec;
  const raw = BASE_SECONDS[q.type][q.difficulty] * SUBJECT_MULTIPLIER[q.subject];
  // ปัดเป็นทีละ 5 วินาทีให้ตัวเลขดูง่าย
  return Math.round(raw / 5) * 5;
}

// ---------- คะแนน ----------

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 100;

/** ตอบถูกได้ 100 + โบนัสความเร็วสูงสุด 100 (ตามสัดส่วนเวลาที่เหลือ) */
export function calcPoints(correct: boolean, remainingMs: number, limitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.max(0, Math.min(1, remainingMs / limitMs));
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * ratio);
}
