import { describe, expect, it } from 'vitest';
import { checkNickname, normalizeNickname } from './nameFilter';
import { levelFromXp, xpForLevel } from './level';

describe('nameFilter', () => {
  it('ทำชื่อให้เป็นรูปมาตรฐานเหมือนฝั่งฐานข้อมูล', () => {
    expect(normalizeNickname('Pr0Gamer')).toBe('progamer');
    expect(normalizeNickname('f.u.c.k')).toBe('fuck');
    expect(normalizeNickname('Somchai 99')).toBe('somchai');
    expect(normalizeNickname('ฟ้า ใส!')).toBe('ฟ้าใส');
  });

  it('ชื่อปกติผ่าน', () => {
    for (const n of ['ฟ้าใส', 'Pr0Gamer', 'น้องหมี', 'classic', 'Somchai 99']) expect(checkNickname(n)).toBeNull();
  });

  it('ชื่อไม่เหมาะสมไม่ผ่าน แม้จะเลี่ยงด้วยจุด/ตัวเลข/ช่องว่าง', () => {
    for (const n of ['ไอ้สัส', 'f.u.c.k', 'sh1t man', 'B i t c h', 'admin01']) expect(checkNickname(n)).toBe('inappropriate');
  });

  it('ตรวจความยาว', () => {
    expect(checkNickname('ก')).toBe('too_short');
    expect(checkNickname('a'.repeat(17))).toBe('too_long');
    expect(checkNickname('2222')).toBe('no_letters');
  });
});

describe('level', () => {
  it('XP ที่ต้องใช้แต่ละเลเวล', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it('คำนวณเลเวลและความคืบหน้า', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, current: 0, needed: 100 });
    expect(levelFromXp(99)).toEqual({ level: 1, current: 99, needed: 100 });
    expect(levelFromXp(100)).toEqual({ level: 2, current: 0, needed: 200 });
    expect(levelFromXp(450)).toEqual({ level: 3, current: 150, needed: 300 });
  });
});
