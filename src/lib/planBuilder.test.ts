import { describe, expect, it } from 'vitest';
import { bangkokWeek, buildPlan, PLAN_DAYS } from './planBuilder';
import type { ChapterStat } from './analysis';

const stat = (chapter: string, recent: number, ok: number, lastAt = '2026-10-01T00:00:00Z'): ChapterStat => ({
  chapter,
  subject: chapter.split('.')[1],
  total: recent,
  recent,
  recentCorrect: ok,
  avgTimeMs: 20000,
  lastAt,
});

describe('buildPlan', () => {
  it('ได้จำนวนรอบ = วัน x รอบต่อวัน และอยู่ในวันที่เลือก', () => {
    const plan = buildPlan('upper', { sessionsPerDay: 2, daysPerWeek: 3, subjects: ['math'] }, []);
    expect(plan).toHaveLength(6);
    expect(new Set(plan.map((p) => p.day))).toEqual(new Set(PLAN_DAYS[3]));
    expect(plan.every((p) => p.chapter.startsWith('upper.math.') && !p.done)).toBe(true);
  });

  it('ยังไม่มีสถิติ: เป็นบทใหม่ทั้งหมด เริ่มจากบทแรกๆ ระดับง่าย', () => {
    const plan = buildPlan('upper', { sessionsPerDay: 1, daysPerWeek: 3, subjects: ['math'] }, []);
    expect(plan.map((p) => p.chapter)).toEqual(['upper.math.1', 'upper.math.2', 'upper.math.3']);
    expect(plan.every((p) => p.reason === 'new' && p.difficulty === 'easy')).toBe(true);
  });

  it('เน้นบทอ่อนราวครึ่งหนึ่ง และบทที่อ่อนที่สุดมาก่อน', () => {
    const stats = [
      stat('upper.math.5', 10, 5), // 50% อ่อน
      stat('upper.math.6', 10, 2), // 20% อ่อนสุด -> ง่าย
      stat('upper.math.7', 10, 7), // 70% พอใช้
      stat('upper.math.8', 10, 9), // 90% ถนัด
    ];
    const plan = buildPlan('upper', { sessionsPerDay: 2, daysPerWeek: 5, subjects: ['math'] }, stats);
    expect(plan).toHaveLength(10);
    expect(plan[0]).toMatchObject({ chapter: 'upper.math.6', reason: 'weak', difficulty: 'easy' });
    expect(plan.filter((p) => p.reason === 'weak')).toHaveLength(5);
    expect(plan.some((p) => p.reason === 'review' && p.difficulty === 'challenge')).toBe(true);
    expect(plan.some((p) => p.reason === 'ok' && p.difficulty === 'hard')).toBe(true);
  });

  it('หลายวิชา: บทใหม่สลับวิชากัน', () => {
    const plan = buildPlan('upper', { sessionsPerDay: 1, daysPerWeek: 4, subjects: ['math', 'physics'] }, []);
    expect(plan.map((p) => p.chapter.split('.')[1])).toEqual(['math', 'physics', 'math', 'physics']);
  });
});

describe('bangkokWeek', () => {
  it('วันอาทิตย์ 23:30 เวลาไทย ยังเป็นสัปดาห์เดิม / วันจันทร์ 00:30 เริ่มสัปดาห์ใหม่', () => {
    // 2026-10-18 เป็นวันอาทิตย์
    expect(bangkokWeek(Date.parse('2026-10-18T16:30:00Z'))).toEqual({ weekStart: '2026-10-12', today: 6 });
    expect(bangkokWeek(Date.parse('2026-10-18T17:30:00Z'))).toEqual({ weekStart: '2026-10-19', today: 0 });
  });
});

describe('buildPlan with dream focus', () => {
  it('splitSessions: largest remainder, at least 1 each', async () => {
    const { splitSessions } = await import('./planBuilder');
    expect(splitSessions({ math: 60, physics: 30, english: 10 }, 10)).toEqual([['math', 6], ['physics', 3], ['english', 1]]);
    expect(splitSessions({ math: 90, english: 10 }, 5)).toEqual([['math', 4], ['english', 1]]);
    expect(splitSessions({ math: 1, physics: 1, english: 1 }, 2).reduce((n, [, k]) => n + k, 0)).toBe(2);
  });

  it('gives each subject its share and spreads them through the week', () => {
    const plan = buildPlan('upper', { sessionsPerDay: 2, daysPerWeek: 5, subjects: ['biology'] }, [], { math: 60, physics: 40 });
    const count = (s: string) => plan.filter((p) => p.chapter.startsWith(`upper.${s}.`)).length;
    expect(plan).toHaveLength(10);
    expect([count('math'), count('physics'), count('biology')]).toEqual([6, 4, 0]);
    // วันแรกมีทั้งสองวิชา ไม่กองวิชาเดียวไว้ต้นสัปดาห์
    expect(new Set(plan.filter((p) => p.day === 0).map((p) => p.chapter.split('.')[1]))).toEqual(new Set(['math', 'physics']));
  });
});
