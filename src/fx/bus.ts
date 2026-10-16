// ช่องทางสั่งเอฟเฟกต์ 3D ในเกม (ไฟล์นี้ไม่โหลด three.js หน้าจอเกมเรียกได้เลย)
// ถ้าไม่ได้เปิดฉากเอฟเฟกต์ (เครื่องสเปกต่ำ/ปิด 3D) คำสั่งจะถูกเพิกเฉย ใช้เอฟเฟกต์ CSS เดิมแทน

export interface Shot {
  /** คนยิง (null = ฟ้าผ่าลงมาจากด้านบน) */
  from: string | null;
  to: string;
  kind: 'hit' | 'blocked' | 'counter';
  /** ยิงสวน: กระสุนเด้งต่อไปหาคนนี้ */
  counterTo?: string;
  /** โดนแล้วตกรอบ (ระเบิดใหญ่กว่า) */
  lethal: boolean;
  /** เอฟเฟกต์ยิงของคนยิง */
  skin?: import('./engine').ShotSkin;
}

/** เอฟเฟกต์การ์ด */
export type CardFx =
  | { type: 'fifty'; choices: number[] }
  | { type: 'skip' }
  | { type: 'extra'; who: string }
  | { type: 'slow'; from: string; to: string; frostMe: boolean }
  | { type: 'counter'; who: string }
  | { type: 'cast'; who: string }
  | { type: 'dealt'; who: string };

type Listener = (shots: Shot[], flightMs: number) => void;
type CardListener = (fx: CardFx) => void;
let listener: Listener | null = null;
let cardListener: CardListener | null = null;

export const fxBus = {
  /** ยิงพร้อมกันหลายนัด กระสุนถึงเป้าหลัง flightMs */
  shots(shots: Shot[], flightMs: number) {
    if (shots.length) listener?.(shots, flightMs);
  },
  card(fx: CardFx) {
    cardListener?.(fx);
  },
  subscribe(l: Listener, c?: CardListener) {
    listener = l;
    if (c) cardListener = c;
    return () => {
      if (listener === l) listener = null;
      if (c && cardListener === c) cardListener = null;
    };
  },
};

interface DamageLike {
  playerId: string;
  blocked?: boolean;
  redirectedTo?: string;
  from?: string;
}

/** แปลงผลข้อเป็นกระสุน: คนยิง = คนที่ตอบถูกเร็วสุด (ไม่มีใครถูก = ฟ้าผ่า) */
export function buildShots(
  damages: DamageLike[],
  eliminated: string[],
  answers: { playerId: string; correct: boolean; timeMs: number }[],
  skinOf: (playerId: string) => import('./engine').ShotSkin = () => 'default',
): Shot[] {
  const shooters = answers.filter((a) => a.correct).sort((a, b) => a.timeMs - b.timeMs);
  const shooterFor = (target: string) => shooters.find((a) => a.playerId !== target)?.playerId ?? null;
  const shots: Shot[] = [];
  for (const d of damages) {
    if (d.from) continue; // ส่วนที่เด้งต่อ แสดงรวมกับนัดยิงสวน
    if (d.redirectedTo) {
      shots.push({ from: shooterFor(d.playerId), to: d.playerId, kind: 'counter', counterTo: d.redirectedTo, lethal: eliminated.includes(d.redirectedTo) });
    } else {
      const from = shooterFor(d.playerId);
      shots.push({ from, to: d.playerId, kind: d.blocked ? 'blocked' : 'hit', lethal: eliminated.includes(d.playerId), skin: from ? skinOf(from) : 'default' });
    }
  }
  return shots;
}
