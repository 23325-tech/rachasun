import { describe, expect, it } from 'vitest';
import { nextTier, rpDelta, tierOf } from './rank';

describe('rpDelta', () => {
  it('ที่ 1 +40 ที่สุดท้าย -25', () => {
    expect(rpDelta(1, 2)).toBe(40);
    expect(rpDelta(2, 2)).toBe(-25);
    expect(rpDelta(1, 8)).toBe(40);
    expect(rpDelta(8, 8)).toBe(-25);
  });

  it('คนกลางไล่ระดับเป็นเส้นตรง', () => {
    expect([1, 2, 3, 4, 5].map((r) => rpDelta(r, 5))).toEqual([40, 24, 8, -9, -25]);
  });

  it('อันดับร่วมที่ 1 ได้ +40 ทุกคน / อยู่คนเดียวไม่ได้ไม่เสีย', () => {
    expect(rpDelta(1, 4)).toBe(40);
    expect(rpDelta(1, 1)).toBe(0);
  });
});

describe('tier', () => {
  it('ยศตามเกณฑ์', () => {
    expect([0, 199, 200, 499, 500, 900, 1400, 1999, 2000, 9999].map((rp) => tierOf(rp).key)).toEqual([
      'bronze', 'bronze', 'silver', 'silver', 'gold', 'platinum', 'diamond', 'diamond', 'legend', 'legend',
    ]);
  });

  it('ยศถัดไป', () => {
    expect(nextTier(150)).toMatchObject({ tier: { key: 'silver' }, needed: 50 });
    expect(nextTier(2500)).toBeNull();
  });
});
