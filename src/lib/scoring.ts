export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 100;

/** ตอบถูกได้ 100 + โบนัสความเร็วสูงสุด 100 (ตามสัดส่วนเวลาที่เหลือ) */
export function calcPoints(correct: boolean, remainingMs: number, limitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.max(0, Math.min(1, remainingMs / limitMs));
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * ratio);
}
