/**
 * แต้มแรงค์ (RP) + ยศ: ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์
 * - นับเฉพาะห้องสุ่มจับคู่
 * - ได้/เสียตามอันดับ: ที่ 1 +40, ที่สุดท้าย -25, คนกลางไล่ระดับเป็นเส้นตรง
 * - RP ต่ำสุด 0, ตกยศได้, ยังไม่มีซีซัน
 */

export const RP_FIRST = 40;
export const RP_LAST = -25;

export interface Tier {
  key: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';
  name: string;
  icon: string;
  min: number;
}

export const TIERS: Tier[] = [
  { key: 'bronze', name: 'ทองแดง', icon: '🥉', min: 0 },
  { key: 'silver', name: 'เงิน', icon: '🥈', min: 200 },
  { key: 'gold', name: 'ทอง', icon: '🥇', min: 500 },
  { key: 'platinum', name: 'แพลทินัม', icon: '💠', min: 900 },
  { key: 'diamond', name: 'เพชร', icon: '💎', min: 1400 },
  { key: 'legend', name: 'ตำนาน', icon: '👑', min: 2000 },
];

/** แต้มที่ได้/เสียจากอันดับ (อันดับร่วมใช้เลขอันดับเดียวกัน) */
export function rpDelta(rank: number, players: number): number {
  if (players < 2) return 0;
  const r = Math.min(Math.max(rank, 1), players);
  return Math.round(RP_FIRST + ((RP_LAST - RP_FIRST) * (r - 1)) / (players - 1));
}

export function tierOf(rp: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) if (rp >= tier.min) t = tier;
  return t;
}

/** ความคืบหน้าไปยศถัดไป (ยศสูงสุด = null) */
export function nextTier(rp: number): { tier: Tier; needed: number } | null {
  const next = TIERS.find((t) => t.min > rp);
  return next ? { tier: next, needed: next.min - rp } : null;
}
