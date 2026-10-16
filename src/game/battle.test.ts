import { describe, expect, it } from 'vitest';
import { createPlayers, heartsFor, resolveRound, type BattlePlayer, type RoundAnswer } from './battle';

const make = (n: number, questionCount = 10) =>
  createPlayers(
    Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, avatar: '🙂', isBot: i > 0 })),
    questionCount,
  );

const ans = (playerId: string, correct: boolean, timeMs = 1000, timedOut = false): RoundAnswer => ({
  playerId,
  correct,
  timeMs,
  timedOut,
  points: correct ? 100 : 0,
});

const hearts = (ps: BattlePlayer[]) => Object.fromEntries(ps.map((p) => [p.id, p.hearts]));
const ranks = (ps: BattlePlayer[]) => Object.fromEntries(ps.map((p) => [p.id, p.rank]));

describe('heartsFor', () => {
  it('ปัดขึ้นจาก 25% และอย่างน้อย 1 ดวง', () => {
    expect(heartsFor(10)).toBe(3);
    expect(heartsFor(5)).toBe(2);
    expect(heartsFor(20)).toBe(5);
    expect(heartsFor(12)).toBe(3);
    expect(heartsFor(1)).toBe(1);
  });
});

describe('ข้อปกติ', () => {
  it('คนตอบผิดและหมดเวลาเสียคนละ 1 ดวง คนถูกไม่เสีย', () => {
    const { players, outcome } = resolveRound(
      make(3),
      [ans('p1', true, 2000), ans('p2', false, 1000), ans('p3', false, 15000, true)],
      0,
      10,
    );
    expect(hearts(players)).toEqual({ p1: 3, p2: 2, p3: 2 });
    expect(outcome.damages).toEqual([
      { playerId: 'p2', reason: 'wrong', heartsLost: 1 },
      { playerId: 'p3', reason: 'timeout', heartsLost: 1 },
    ]);
  });

  it('ทุกคนตอบถูก คนช้าที่สุดโดนยิง', () => {
    const { players, outcome } = resolveRound(
      make(3),
      [ans('p1', true, 3000), ans('p2', true, 5000), ans('p3', true, 1000)],
      0,
      10,
    );
    expect(hearts(players)).toEqual({ p1: 3, p2: 2, p3: 3 });
    expect(outcome.damages[0]).toMatchObject({ playerId: 'p2', reason: 'slowest' });
  });

  it('คนที่ไม่ได้ส่งคำตอบถือว่าหมดเวลา', () => {
    const { players } = resolveRound(make(2), [ans('p1', true)], 0, 10);
    expect(hearts(players)).toEqual({ p1: 3, p2: 2 });
  });

  it('หัวใจหมด = ตกรอบ ได้อันดับตามจำนวนคนที่ยังเหลือ', () => {
    let ps = make(3, 4); // 1 ดวง
    const r = resolveRound(ps, [ans('p1', true), ans('p2', true), ans('p3', false)], 0, 4);
    ps = r.players;
    expect(r.outcome.eliminated).toEqual(['p3']);
    expect(ranks(ps)).toEqual({ p1: null, p2: null, p3: 3 });
    expect(r.outcome.gameOver).toBe(false);
  });

  it('คนที่ตกรอบแล้วไม่ถูกนับในข้อถัดไป', () => {
    let ps = make(3, 4);
    ps = resolveRound(ps, [ans('p1', true), ans('p2', true), ans('p3', false)], 0, 4).players;
    // p3 ตกแล้ว ทุกคนที่เหลือตอบถูก -> คนช้าสุดระหว่าง p1, p2 โดน
    const r = resolveRound(ps, [ans('p1', true, 1000), ans('p2', true, 2000), ans('p3', false)], 1, 4);
    expect(r.outcome.damages.map((d) => d.playerId)).toEqual(['p2']);
    expect(r.players.find((p) => p.id === 'p3')!.rank).toBe(3);
  });

  it('เหลือคนเดียว = เกมจบ คนนั้นอันดับ 1', () => {
    const r = resolveRound(make(2, 4), [ans('p1', true), ans('p2', false)], 0, 4);
    expect(r.outcome.gameOver).toBe(true);
    expect(ranks(r.players)).toEqual({ p1: 1, p2: 2 });
  });

  it('ตกรอบพร้อมกันหลายคนได้อันดับร่วม', () => {
    const r = resolveRound(make(4, 4), [ans('p1', true), ans('p2', true), ans('p3', false), ans('p4', false)], 0, 4);
    expect(ranks(r.players)).toEqual({ p1: null, p2: null, p3: 3, p4: 3 });
  });

  it('ทุกคนที่เหลือหัวใจหมดพร้อมกัน = เสมอ อันดับ 1 ร่วม', () => {
    const r = resolveRound(make(2, 4), [ans('p1', false), ans('p2', false)], 0, 4);
    expect(r.outcome.gameOver).toBe(true);
    expect(ranks(r.players)).toEqual({ p1: 1, p2: 1 });
  });

  it('สะสมคะแนนให้คนที่ยังอยู่', () => {
    const r = resolveRound(make(2), [ans('p1', true), ans('p2', false)], 0, 10);
    expect(r.players.map((p) => p.score)).toEqual([100, 0]);
  });
});

describe('การ์ดพลัง', () => {
  const withCards = (ps: BattlePlayer[], id: string, shield: number, fifty = 0) =>
    ps.map((p) => (p.id === id ? { ...p, cards: { shield, fifty } } : p));

  it('โล่กันการตอบผิดได้ 1 ครั้ง แล้วโล่หายไป', () => {
    const ps = withCards(make(2), 'p2', 1);
    const r = resolveRound(ps, [ans('p1', true), ans('p2', false)], 0, 10);
    expect(hearts(r.players)).toEqual({ p1: 3, p2: 3 });
    expect(r.outcome.damages).toEqual([{ playerId: 'p2', reason: 'wrong', heartsLost: 0, blocked: true }]);
    expect(r.players.find((p) => p.id === 'p2')!.cards).toEqual({ shield: 0, fifty: 0 });
    // ครั้งที่สองไม่มีโล่แล้ว
    const r2 = resolveRound(r.players, [ans('p1', true), ans('p2', false)], 1, 10);
    expect(hearts(r2.players).p2).toBe(2);
  });

  it('โล่กันการโดนยิงเพราะช้าสุดได้', () => {
    const ps = withCards(make(2), 'p1', 1);
    const r = resolveRound(ps, [ans('p1', true, 5000), ans('p2', true, 1000)], 0, 10);
    expect(r.outcome.damages[0]).toMatchObject({ playerId: 'p1', reason: 'slowest', blocked: true });
    expect(hearts(r.players)).toEqual({ p1: 3, p2: 3 });
  });

  it('โล่ช่วยให้รอดใน Sudden Death 1 ครั้ง', () => {
    const ps = withCards(make(2, 10), 'p2', 2);
    const r = resolveRound(ps, [ans('p1', true), ans('p2', false)], 10, 10);
    expect(r.outcome.eliminated).toEqual([]);
    expect(r.players.find((p) => p.id === 'p2')!.cards!.shield).toBe(1);
  });

  it('ข้ามข้อ: ไม่เสียหัวใจ และไม่นับตอนหาคนช้าสุด', () => {
    const skip = { ...ans('p3', false, 99999), skipped: true };
    const r = resolveRound(make(3), [ans('p1', true, 1000), ans('p2', true, 3000), skip], 0, 10);
    expect(hearts(r.players)).toEqual({ p1: 3, p2: 2, p3: 3 });
  });

  it('ข้ามข้อจนเหลือคนตอบคนเดียวที่ตอบถูก -> ไม่มีใครโดนยิง', () => {
    const skip = { ...ans('p2', false), skipped: true };
    const r = resolveRound(make(2), [ans('p1', true), skip], 0, 10);
    expect(r.outcome.damages).toEqual([]);
  });
});

describe('Sudden Death', () => {
  it('ผิด = ตกรอบทันทีแม้ยังมีหัวใจหลายดวง', () => {
    const r = resolveRound(make(3, 10), [ans('p1', true), ans('p2', false), ans('p3', true)], 10, 10);
    expect(r.outcome.suddenDeath).toBe(true);
    expect(hearts(r.players)).toEqual({ p1: 3, p2: 0, p3: 3 });
    expect(r.outcome.damages[0]).toMatchObject({ playerId: 'p2', heartsLost: 3 });
    expect(ranks(r.players).p2).toBe(3);
  });

  it('ทุกคนตอบถูก คนช้าสุดตกรอบ', () => {
    const r = resolveRound(make(2, 10), [ans('p1', true, 4000), ans('p2', true, 2000)], 12, 10);
    expect(r.outcome.gameOver).toBe(true);
    expect(ranks(r.players)).toEqual({ p1: 2, p2: 1 });
  });
});
