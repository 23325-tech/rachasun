import { describe, expect, it } from 'vitest';
import { BLUEPRINTS, indicesOf, isCorrect, MOCK_EXAMS, slotsOf } from '../../supabase/functions/_shared/mock';
import { chapterName } from '../data/chapters';

describe('พิมพ์เขียวจำลองสอบ A-Level', () => {
  it.each(MOCK_EXAMS)('%s: จำนวนข้อ/แบบ ตรงพิมพ์เขียว และทุกบทมีจริง', (exam) => {
    const bp = BLUEPRINTS[exam];
    const slots = slotsOf(exam);
    expect(slots).toHaveLength(bp.mcq5 + bp.fill + bp.multi);
    expect(slots.filter((s) => s.type === 'mcq5')).toHaveLength(bp.mcq5);
    expect(slots.filter((s) => s.type === 'fill')).toHaveLength(bp.fill);
    expect(slots.filter((s) => s.type === 'multi')).toHaveLength(bp.multi);
    // ตอนที่ 2 (เติมตัวเลข/เชิงซ้อน) อยู่ท้ายชุด
    expect(slots.slice(bp.mcq5).every((s) => s.type !== 'mcq5')).toBe(true);
    expect(slots.every((s) => chapterName(s.chapter))).toBe(true);
    // คะแนนเต็มดิบ
    const max = slots.reduce((n, s) => n + bp.points[s.type], 0);
    expect(max).toBeGreaterThan(0);
  });

  it('อังกฤษ: บทสนทนา 20 / อ่าน 40', () => {
    const slots = slotsOf('english');
    expect(slots.filter((s) => s.chapter === 'upper.english.12')).toHaveLength(20);
    expect(slots.filter((s) => s.chapter === 'upper.english.13')).toHaveLength(40);
  });

  it('ครึ่งชุด = ข้อคู่ ครึ่งหนึ่งของทั้งชุด', () => {
    expect(indicesOf(30, true)).toHaveLength(15);
    expect(indicesOf(35, false)).toHaveLength(35);
  });

  it('ตรวจคำตอบทุกแบบ', () => {
    const base = { chapter: 'upper.math.1', difficulty: 'hard' as const, prompt: '', explanation: '' };
    expect(isCorrect({ ...base, type: 'mcq5', answer_index: 4 }, 4)).toBe(true);
    expect(isCorrect({ ...base, type: 'mcq5', answer_index: 4 }, null)).toBe(false);
    expect(isCorrect({ ...base, type: 'fill', answer: { kind: 'number', value: 2.5 } }, '2.5')).toBe(true);
    expect(isCorrect({ ...base, type: 'multi', truths: [true, false, true] }, [true, false, true])).toBe(true);
    expect(isCorrect({ ...base, type: 'multi', truths: [true, false, true] }, [true, true, true])).toBe(false);
  });
});
