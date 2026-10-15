export type Subject = 'math' | 'physics' | 'chemistry' | 'biology' | 'english';
export type Difficulty = 'easy' | 'medium' | 'hard';
/** entrance = แนวเตรียมสอบเข้า, school = แนวสอบปกติในโรงเรียน */
export type Track = 'entrance' | 'school';

interface QuestionBase {
  id: string;
  subject: Subject;
  difficulty: Difficulty;
  track: Track;
  /** ข้อความโจทย์ ใส่ LaTeX ได้ด้วย $...$ (ในบรรทัด) หรือ $$...$$ (บรรทัดแยก) */
  prompt: string;
  /** path รูปภาพ/ไดอะแกรม เช่น /img/right-triangle.svg */
  image?: string;
  imageAlt?: string;
  /** คำอธิบายเฉลย ใส่ LaTeX ได้ */
  explanation: string;
  /** กำหนดเวลาเฉพาะข้อนี้ (วินาที) ถ้าไม่ใส่จะคำนวณจากวิชา+ความยาก */
  timeLimitSec?: number;
  /** sample = โจทย์ตัวอย่างในเครื่อง, bank = คลังโจทย์บน Supabase (รายงานข้อผิดได้) */
  source?: 'sample' | 'bank';
}

export interface McqQuestion extends QuestionBase {
  type: 'mcq';
  /** ตัวเลือก ก ข ค ง ตามลำดับ */
  choices: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
}

export type FillAnswer =
  | { kind: 'number'; value: number; tolerance?: number; unit?: string }
  | { kind: 'text'; accepted: string[] };

export interface FillQuestion extends QuestionBase {
  type: 'fill';
  answer: FillAnswer;
}

export type Question = McqQuestion | FillQuestion;

export interface AnswerResult {
  questionId: string;
  correct: boolean;
  timedOut: boolean;
  timeUsedMs: number;
  points: number;
  /** สิ่งที่ผู้เล่นตอบ (index ของตัวเลือก หรือข้อความที่พิมพ์) */
  given: number | string | null;
}
