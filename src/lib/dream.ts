import { ensureSession } from './supabase';
import { t } from './i18n';
import { TCAS_BY_KEY } from '../data/tcas';

export interface DreamGoal {
  university: string;
  faculty: string;
  /** คะแนนรวมที่ต้องการ (เต็ม 100) */
  target: number;
  /** ค่าน้ำหนักรายวิชา % (รวม 100) */
  weights: Record<string, number>;
}

export interface DreamPlan {
  goals: DreamGoal[];
  /** คะแนนรายวิชาที่นักเรียนกรอกเอง (เต็ม 100) */
  scores: Record<string, number>;
  /** วันสอบของตัวเอง YYYY-MM-DD */
  examOverrides: Record<string, string>;
}

export const MAX_GOALS = 5;
export const EMPTY_PLAN: DreamPlan = { goals: [], scores: {}, examOverrides: {} };

export async function fetchDream(): Promise<DreamPlan> {
  const sb = await ensureSession();
  const { data, error } = await sb.from('dream_plans').select('goals, scores, exam_overrides').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_PLAN;
  return { goals: data.goals ?? [], scores: data.scores ?? {}, examOverrides: data.exam_overrides ?? {} };
}

const SAVE_ERRORS: Record<string, () => string> = {
  weights_not_100: () => t('ค่าน้ำหนักทุกวิชารวมกันต้องได้ 100%', 'Weights must add up to 100%'),
  bad_goal: () => t('กรอกชื่อคณะและคะแนนเป้าหมาย (0-100) ให้ครบ', 'Fill in the faculty and a target score (0-100)'),
  bad_score: () => t('คะแนนต้องอยู่ระหว่าง 0-100', 'Scores must be between 0 and 100'),
  bad_goals: () => t(`ตั้งเป้าได้สูงสุด ${MAX_GOALS} อันดับ`, `Up to ${MAX_GOALS} goals`),
};

export async function saveDream(plan: DreamPlan): Promise<void> {
  const sb = await ensureSession();
  const { error } = await sb.rpc('save_dream', { p_goals: plan.goals, p_scores: plan.scores, p_overrides: plan.examOverrides });
  if (error) {
    const code = Object.keys(SAVE_ERRORS).find((k) => error.message.includes(k));
    throw new Error(code ? SAVE_ERRORS[code]() : t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'Could not save, please try again'));
  }
}

/** คะแนนรวมถ่วงน้ำหนัก (เต็ม 100) จากวิชาที่มีคะแนน + วิชาที่ยังไม่มีคะแนน */
export function composite(goal: DreamGoal, scores: Record<string, number>) {
  let total = 0;
  const missing: string[] = [];
  for (const [key, w] of Object.entries(goal.weights)) {
    const s = scores[key];
    if (s === undefined || s === null) missing.push(key);
    else total += (w * s) / 100;
  }
  return { total: Math.round(total * 100) / 100, missing };
}

/** วันสอบของวิชา (ใช้วันของตัวเองถ้าตั้งไว้) */
export function examDate(key: string, overrides: Record<string, string>): Date | null {
  if (overrides[key]) return new Date(`${overrides[key]}T08:30:00+07:00`);
  const s = TCAS_BY_KEY[key];
  return s ? new Date(s.examAt) : null;
}

const bangkokDay = (d: Date) => Math.floor((d.getTime() + 7 * 3_600_000) / 86_400_000);
/** อีกกี่วัน (นับตามวันที่เวลาไทย) */
export const daysUntil = (d: Date, now = new Date()) => bangkokDay(d) - bangkokDay(now);

/** วิชาที่สอบเร็วที่สุดที่ยังไม่ถึงวันสอบ ในเป้านี้ */
export function nextExam(goal: DreamGoal, overrides: Record<string, string>, now = new Date()) {
  let best: { key: string; at: Date; days: number } | null = null;
  for (const key of Object.keys(goal.weights)) {
    const at = examDate(key, overrides);
    if (!at) continue;
    const days = daysUntil(at, now);
    if (days < 0) continue;
    if (!best || at < best.at) best = { key, at, days };
  }
  return best;
}

export interface MockScore {
  /** เฉลี่ย 3 ครั้งล่าสุด (เต็ม 100) */
  avg: number;
  n: number;
  last: number;
  lastAt: string;
}

export async function fetchMockScores(): Promise<Record<string, MockScore>> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('my_mock_scores');
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, MockScore>;
}

export interface SubjectScore {
  score: number;
  source: 'manual' | 'mock';
  /** จำนวนครั้งจำลองสอบที่ใช้เฉลี่ย */
  n?: number;
}

/** คะแนนที่ใช้คิด: กรอกเองมาก่อน (เช่น คะแนนสอบจริง) ถ้าไม่ได้กรอกใช้ค่าเฉลี่ยจำลองสอบ */
export function effectiveScores(manual: Record<string, number>, mock: Record<string, MockScore>, keys: string[]) {
  const out: Record<string, SubjectScore> = {};
  for (const key of keys) {
    if (manual[key] !== undefined && manual[key] !== null) out[key] = { score: manual[key], source: 'manual' };
    else {
      const m = TCAS_BY_KEY[key]?.mock && mock[TCAS_BY_KEY[key].mock!];
      if (m) out[key] = { score: Number(m.avg), source: 'mock', n: m.n };
    }
  }
  return out;
}

export const scoreValues = (s: Record<string, SubjectScore>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.score]));

export interface SubjectGap {
  key: string;
  weight: number;
  score: number | null;
  /** คะแนนรวมที่วิชานี้ให้ตอนนี้ */
  earned: number;
  /** คะแนนรวมที่ยังเพิ่มได้ถ้าวิชานี้ได้เต็ม */
  room: number;
  /** ต้องเพิ่มคะแนนวิชานี้อีกเท่าไหร่ ถ้าเพิ่มวิชาเดียวให้ถึงเป้า (null = วิชาเดียวไม่พอ) */
  needAlone: number | null;
}

/** ส่วนที่ขาดรายวิชา เรียงจากวิชาที่เพิ่มคะแนนรวมได้มากที่สุด */
export function subjectGaps(goal: DreamGoal, scores: Record<string, number>): SubjectGap[] {
  const gap = goal.target - composite(goal, scores).total;
  return Object.entries(goal.weights)
    .map(([key, weight]) => {
      const score = scores[key] ?? null;
      const s = score ?? 0;
      const room = (weight * (100 - s)) / 100;
      const need = gap > 0 ? (gap * 100) / weight : 0;
      return {
        key,
        weight,
        score,
        earned: Math.round(((weight * s) / 100) * 100) / 100,
        room: Math.round(room * 100) / 100,
        needAlone: score === null ? null : s + need <= 100 ? Math.ceil(need * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.room - a.room);
}
