import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ ensureSession: vi.fn() }));

import { composite, daysUntil, effectiveScores, examDate, nextExam, subjectGaps, type DreamGoal } from './dream';

const goal: DreamGoal = { university: 'U', faculty: 'F', target: 70, weights: { tgat: 20, tpat3: 30, a_math1: 50 } };

describe('composite', () => {
  it('weights scores out of 100 and lists missing subjects', () => {
    expect(composite(goal, { tgat: 80, a_math1: 60 })).toEqual({ total: 46, missing: ['tpat3'] });
    expect(composite(goal, { tgat: 80, tpat3: 50, a_math1: 60 }).total).toBe(61);
  });
});

describe('countdown', () => {
  it('counts Bangkok calendar days', () => {
    // 23:30 ไทยวันที่ 29 ม.ค. -> สอบ 30 ม.ค. = อีก 1 วัน
    expect(daysUntil(new Date('2027-01-30T13:00:00+07:00'), new Date('2027-01-29T23:30:00+07:00'))).toBe(1);
    expect(daysUntil(new Date('2027-01-30T13:00:00+07:00'), new Date('2027-01-30T00:10:00+07:00'))).toBe(0);
  });

  it('picks the earliest upcoming exam and honours overrides', () => {
    const now = new Date('2026-10-17T10:00:00+07:00');
    expect(nextExam(goal, {}, now)?.key).toBe('tpat3'); // TPAT3 สอบเช้า 30 ม.ค. ก่อน TGAT บ่าย
    expect(nextExam(goal, { tpat3: '2027-02-05', tgat: '2027-02-04' }, now)?.key).toBe('tgat');
    expect(examDate('a_math1', {})?.toISOString()).toBe('2027-03-14T01:30:00.000Z');
  });

  it('skips exams that already happened', () => {
    expect(nextExam(goal, {}, new Date('2027-02-01T09:00:00+07:00'))?.key).toBe('a_math1');
    expect(nextExam(goal, {}, new Date('2027-04-01T09:00:00+07:00'))).toBeNull();
  });
});

describe('mock scores and gaps', () => {
  const g: DreamGoal = { university: '', faculty: 'F', target: 70, weights: { tgat: 20, a_phy: 30, a_math1: 50 } };
  const mock = { physics: { avg: 60, n: 3, last: 70, lastAt: '' }, math1: { avg: 50, n: 1, last: 50, lastAt: '' } };

  it('prefers typed scores over the mock average', () => {
    const eff = effectiveScores({ tgat: 80, a_math1: 90 }, mock, Object.keys(g.weights));
    expect(eff).toEqual({ tgat: { score: 80, source: 'manual' }, a_phy: { score: 60, source: 'mock', n: 3 }, a_math1: { score: 90, source: 'manual' } });
  });

  it('ranks subjects by upside and computes the raise needed alone', () => {
    // 16 + 18 + 25 = 59 -> ขาด 11
    const gaps = subjectGaps(g, { tgat: 80, a_phy: 60, a_math1: 50 });
    expect(gaps.map((x) => x.key)).toEqual(['a_math1', 'a_phy', 'tgat']);
    expect(gaps[0]).toMatchObject({ earned: 25, room: 25, needAlone: 22 });
    expect(gaps[1].needAlone).toBe(36.7);
    expect(gaps[2].needAlone).toBeNull(); // 80 + 55 > 100
  });
});
