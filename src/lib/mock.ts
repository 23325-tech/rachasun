import { ensureSession } from './supabase';

export type MockExam = 'math1' | 'math2' | 'physics' | 'chemistry' | 'biology' | 'english';
export type MockQType = 'mcq5' | 'fill' | 'multi';
/** คำตอบ: เลขตัวเลือก / ข้อความตัวเลข / ถูก-ผิดของ 3 ข้อความ */
export type MockGiven = number | string | (boolean | null)[] | null;

export interface MockPaper {
  id: string;
  exam: MockExam;
  no: number;
  title: string;
  count: number;
  minutes: number;
}

export interface MockAttemptSummary {
  id: string;
  paperId: string;
  half: boolean;
  deadlineAt: string;
  submitted: boolean;
  score: number | null;
}

export interface MockPublicQuestion {
  i: number;
  type: MockQType;
  chapter: string;
  prompt: string;
  choices?: string[];
  statements?: string[];
  unit?: string;
}

export interface MockSession {
  attemptId: string;
  submitted: false;
  exam: MockExam;
  no: number;
  title: string;
  half: boolean;
  deadlineAt: string;
  serverNow: number;
  questions: MockPublicQuestion[];
  answers: Record<string, MockGiven>;
}

export interface MockReviewQuestion extends MockPublicQuestion {
  correct: boolean;
  given: MockGiven;
  answerIndex?: number;
  answerText?: string;
  truths?: boolean[];
  explanation: string;
}

export interface MockReview {
  attemptId: string;
  exam: MockExam;
  no: number;
  title: string;
  half: boolean;
  score: number;
  correct: number;
  total: number;
  byChapter: Record<string, { n: number; ok: number }>;
  stats: { takers: number; avg: number; top: number; percentile: number | null };
  questions: MockReviewQuestion[];
}

const ERRORS: Record<string, string> = {
  paper_not_found: 'ไม่พบชุดข้อสอบนี้',
  attempt_not_found: 'ไม่พบการสอบนี้',
  time_up: 'หมดเวลาแล้ว',
  invalid_answer: 'คำตอบไม่ถูกรูปแบบ',
  not_submitted: 'ยังไม่ได้ส่งข้อสอบ',
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke<T>('mock-exam', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let code = '';
    try {
      code = (await ctx?.json())?.error ?? '';
    } catch {
      /* ไม่ใช่ JSON */
    }
    throw new Error(ERRORS[code] ?? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
  return data as T;
}

export const listMocks = () => call<{ papers: MockPaper[]; attempts: MockAttemptSummary[] }>({ action: 'list' });
export const startMock = (paperId: string, half: boolean) =>
  call<MockSession | { attemptId: string; submitted: true }>({ action: 'start', paperId, half });
export const saveMockAnswer = (attemptId: string, index: number, given: MockGiven) =>
  call<{ ok: true }>({ action: 'save', attemptId, index, given });
export const submitMock = (attemptId: string) => call<MockReview>({ action: 'submit', attemptId });
export const reviewMock = (attemptId: string) => call<MockReview>({ action: 'review', attemptId });

export const MOCK_ICON: Record<MockExam, string> = {
  math1: '📐',
  math2: '📊',
  physics: '⚡',
  chemistry: '🧪',
  biology: '🧬',
  english: '🔤',
};

export const CHOICE5 = ['ก', 'ข', 'ค', 'ง', 'จ'];

/** ตอบข้อนี้แล้วหรือยัง */
export function isAnswered(given: MockGiven | undefined): boolean {
  if (given === null || given === undefined || given === '') return false;
  if (Array.isArray(given)) return given.every((g) => g !== null);
  return true;
}
