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
}

type Listener = (shots: Shot[], flightMs: number) => void;
let listener: Listener | null = null;

export const fxBus = {
  /** ยิงพร้อมกันหลายนัด กระสุนถึงเป้าหลัง flightMs */
  shots(shots: Shot[], flightMs: number) {
    if (shots.length) listener?.(shots, flightMs);
  },
  subscribe(l: Listener) {
    listener = l;
    return () => {
      if (listener === l) listener = null;
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
): Shot[] {
  const shooters = answers.filter((a) => a.correct).sort((a, b) => a.timeMs - b.timeMs);
  const shooterFor = (target: string) => shooters.find((a) => a.playerId !== target)?.playerId ?? null;
  const shots: Shot[] = [];
  for (const d of damages) {
    if (d.from) continue; // ส่วนที่เด้งต่อ แสดงรวมกับนัดยิงสวน
    if (d.redirectedTo) {
      shots.push({ from: shooterFor(d.playerId), to: d.playerId, kind: 'counter', counterTo: d.redirectedTo, lethal: eliminated.includes(d.redirectedTo) });
    } else {
      shots.push({ from: shooterFor(d.playerId), to: d.playerId, kind: d.blocked ? 'blocked' : 'hit', lethal: eliminated.includes(d.playerId) });
    }
  }
  return shots;
}
