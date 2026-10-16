import { ChartBar, Dna, Flask, Lightning, MathOperations, Translate, type Icon } from '@phosphor-icons/react';
import { ensureSession } from './supabase';
import { t } from './i18n';

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
  get paper_not_found() { return t('ไม่พบชุดข้อสอบนี้', 'Paper not found'); },
  get attempt_not_found() { return t('ไม่พบการสอบนี้', 'Attempt not found'); },
  get time_up() { return t('หมดเวลาแล้ว', 'Time\'s up'); },
  get invalid_answer() { return t('คำตอบไม่ถูกรูปแบบ', 'Invalid answer format'); },
  get not_submitted() { return t('ยังไม่ได้ส่งข้อสอบ', 'Exam not submitted yet'); },
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
    throw new Error(ERRORS[code] ?? t('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง', 'Couldn\'t reach the server, try again'));
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

export const MOCK_ICON: Record<MockExam, Icon> = {
  math1: MathOperations,
  math2: ChartBar,
  physics: Lightning,
  chemistry: Flask,
  biology: Dna,
  english: Translate,
};

export const CHOICE5 = ['ก', 'ข', 'ค', 'ง', 'จ'];

/** ตอบข้อนี้แล้วหรือยัง */
export function isAnswered(given: MockGiven | undefined): boolean {
  if (given === null || given === undefined || given === '') return false;
  if (Array.isArray(given)) return given.every((g) => g !== null);
  return true;
}

// ชื่อชุดข้อสอบมาจากเซิร์ฟเวอร์เป็นภาษาไทย: แปลงชื่อที่รู้จักเป็นภาษาอังกฤษ
const TITLE_EN: Record<string, string> = {
  'คณิตศาสตร์ประยุกต์ 1': 'Applied Math 1',
  'คณิตศาสตร์ประยุกต์ 2': 'Applied Math 2',
  ฟิสิกส์: 'Physics',
  เคมี: 'Chemistry',
  ชีววิทยา: 'Biology',
  ภาษาอังกฤษ: 'English',
};
export const paperTitle = (title: string) => t(title, TITLE_EN[title] ?? title);
