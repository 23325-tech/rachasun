/**
 * เลเวลจาก XP: XP สะสมที่ต้องใช้เพื่อถึงเลเวล n = 50 × n × (n − 1)
 * Lv2 = 100, Lv3 = 300, Lv4 = 600, Lv5 = 1,000 ... (แต่ละเลเวลต้องใช้มากขึ้นทีละ 100)
 * ระบบยศจะเพิ่มในสเต็ป 9
 */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  /** XP ที่สะสมได้ในเลเวลปัจจุบัน */
  current: number;
  /** XP ที่ต้องใช้จากต้นเลเวลนี้ถึงเลเวลถัดไป */
  needed: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  return { level, current: xp - base, needed: xpForLevel(level + 1) - base };
}
