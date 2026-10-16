// จำลองสอบ A-Level: พิมพ์เขียวแต่ละวิชา + ตรวจคะแนน (ใช้ร่วมกันระหว่าง mock-build กับ mock-exam)
// อ้างอิงรูปแบบที่เผยแพร่ช่วงปี 2568-2569 (ทุกวิชา 90 นาที คะแนนเต็ม 100) ตัวเลขอาจต่างจากปีจริงเล็กน้อย
import { checkFillAnswer, type FillAnswer } from './rules.ts';

export type MockExam = 'math1' | 'math2' | 'physics' | 'chemistry' | 'biology' | 'english';
export type MockType = 'mcq5' | 'fill' | 'multi';

export interface Blueprint {
  title: string;
  subject: string;
  /** จำนวนข้อแต่ละแบบ (fill / multi อยู่ตอนท้ายเหมือนตอนที่ 2 ของข้อสอบจริง) */
  mcq5: number;
  fill: number;
  multi: number;
  /** น้ำหนักบท (เลขบทของ upper.<subject>) ใช้แบ่งจำนวนข้อ */
  weights: Record<number, number>;
  /** คะแนนต่อข้อ ก่อนแปลงเป็นเต็ม 100 */
  points: Record<MockType, number>;
}

export const FULL_MINUTES = 90;
export const MOCK_EXAMS: MockExam[] = ['math1', 'math2', 'physics', 'chemistry', 'biology', 'english'];

export const BLUEPRINTS: Record<MockExam, Blueprint> = {
  math1: {
    title: 'คณิตศาสตร์ประยุกต์ 1',
    subject: 'math',
    mcq5: 25,
    fill: 5,
    multi: 0,
    weights: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 3, 15: 2, 16: 1 },
    points: { mcq5: 3, fill: 5, multi: 3 },
  },
  math2: {
    title: 'คณิตศาสตร์ประยุกต์ 2',
    subject: 'math',
    mcq5: 25,
    fill: 5,
    multi: 0,
    weights: { 1: 2, 2: 2, 4: 3, 5: 3, 13: 4, 17: 3, 11: 4, 12: 4, 15: 4, 16: 1 },
    points: { mcq5: 3, fill: 5, multi: 3 },
  },
  physics: {
    title: 'ฟิสิกส์',
    subject: 'physics',
    mcq5: 25,
    fill: 5,
    multi: 0,
    weights: { 1: 1, 2: 3, 3: 3, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 2, 14: 2, 15: 2, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1 },
    points: { mcq5: 3, fill: 5, multi: 3 },
  },
  chemistry: {
    title: 'เคมี',
    subject: 'chemistry',
    mcq5: 30,
    fill: 5,
    multi: 0,
    weights: { 1: 1, 2: 3, 3: 4, 4: 3, 5: 3, 6: 4, 7: 3, 8: 3, 9: 3, 10: 4, 11: 2, 12: 3, 13: 1 },
    points: { mcq5: 3, fill: 5, multi: 3 },
  },
  biology: {
    title: 'ชีววิทยา',
    subject: 'biology',
    mcq5: 35,
    fill: 0,
    multi: 5,
    weights: { 1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 2, 7: 2, 8: 2, 9: 1, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 1, 18: 2, 19: 2, 20: 1, 21: 1, 22: 3 },
    points: { mcq5: 2.5, fill: 5, multi: 2.5 },
  },
  english: {
    title: 'ภาษาอังกฤษ',
    subject: 'english',
    mcq5: 80,
    fill: 0,
    multi: 0,
    // บทสนทนา 20 (แทนส่วนฟัง-พูด) / อ่าน 40 / เขียน 20
    weights: { 12: 20, 13: 40, 1: 2, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 14: 1 },
    points: { mcq5: 1.25, fill: 5, multi: 3 },
  },
};

export interface Slot {
  type: MockType;
  chapter: string;
  difficulty: 'medium' | 'hard' | 'challenge';
}

/** ระดับความยากของข้อสอบเข้ามหาลัย: กลาง 30% / ยาก 50% / ท้าทาย 20% */
const DIFF_CYCLE: Slot['difficulty'][] = ['medium', 'hard', 'hard', 'challenge', 'hard', 'medium', 'hard', 'hard', 'challenge', 'medium'];

/** แบ่งจำนวนข้อตามน้ำหนัก (เศษเหลือมากได้ก่อน) */
function allocate(weights: Record<number, number>, total: number): [number, number][] {
  const entries = Object.entries(weights).map(([k, w]) => [Number(k), w] as const);
  const sum = entries.reduce((n, [, w]) => n + w, 0);
  const raw = entries.map(([k, w]) => ({ k, exact: (total * w) / sum }));
  const out = raw.map((r) => ({ k: r.k, n: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let left = total - out.reduce((n, r) => n + r.n, 0);
  for (const r of [...out].sort((a, b) => b.rem - a.rem)) {
    if (left-- <= 0) break;
    r.n++;
  }
  return out.filter((r) => r.n > 0).map((r) => [r.k, r.n]);
}

/** ช่องข้อสอบทั้งชุด (คงที่ทุกครั้งที่เรียก) */
export function slotsOf(exam: MockExam): Slot[] {
  const bp = BLUEPRINTS[exam];
  const total = bp.mcq5 + bp.fill + bp.multi;
  const chapters = allocate(bp.weights, total).flatMap(([k, n]) => Array.from({ length: n }, () => `upper.${bp.subject}.${k}`));
  chapters.sort((a, b) => Number(a.split('.')[2]) - Number(b.split('.')[2]));
  // ข้อแบบพิเศษ (เติมตัวเลข / เชิงซ้อน) กระจายเลือกจากหลายบท แล้วย้ายไปไว้ตอนท้าย
  const special = bp.fill + bp.multi;
  const pickIdx = new Set(Array.from({ length: special }, (_, i) => Math.floor(((i + 0.5) * total) / special)));
  const part1 = chapters.filter((_, i) => !pickIdx.has(i));
  const part2 = chapters.filter((_, i) => pickIdx.has(i));
  const kind2: MockType = bp.fill ? 'fill' : 'multi';
  return [
    ...part1.map((chapter) => ({ type: 'mcq5' as const, chapter })),
    ...part2.map((chapter) => ({ type: kind2, chapter })),
  ].map((s, i) => ({ ...s, difficulty: DIFF_CYCLE[i % DIFF_CYCLE.length] }));
}

/** ข้อที่อยู่ในครึ่งชุด (ข้อคู่ เก็บสัดส่วนบทและตอนไว้ใกล้เคียงเดิม) */
export const indicesOf = (count: number, half: boolean) =>
  Array.from({ length: count }, (_, i) => i).filter((i) => !half || i % 2 === 0);

export interface MockQuestion extends Slot {
  prompt: string;
  choices?: string[];
  answer_index?: number;
  answer?: FillAnswer;
  /** ข้อเชิงซ้อน: ข้อความ 3 ข้อ ให้ตอบว่าถูก/ผิดแต่ละข้อ */
  statements?: string[];
  truths?: boolean[];
  explanation: string;
}

export function isCorrect(q: MockQuestion, given: unknown): boolean {
  if (given === null || given === undefined || given === '') return false;
  if (q.type === 'mcq5') return Number(given) === q.answer_index;
  if (q.type === 'fill') return q.answer ? checkFillAnswer(q.answer, String(given)) : false;
  return Array.isArray(given) && Array.isArray(q.truths) && q.truths.every((t, i) => given[i] === t);
}

/** โจทย์ที่ส่งให้ผู้สอบ (ไม่มีเฉลย) */
export function toPublicMock(q: MockQuestion) {
  return {
    type: q.type,
    chapter: q.chapter,
    prompt: q.prompt,
    choices: q.choices,
    statements: q.statements,
    unit: q.answer?.kind === 'number' ? q.answer.unit : undefined,
  };
}
