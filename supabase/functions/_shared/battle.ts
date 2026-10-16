/**
 * เอนจินกติกาหัวใจ: เป็นฟังก์ชันล้วน ไม่ผูกกับหน้าจอหรือเครือข่าย
 * ใช้ได้ทั้งโหมดบอทในเครื่อง และโหมดออนไลน์ (ฝั่งเซิร์ฟเวอร์) ในสเต็ปถัดไป
 *
 * กติกา
 * - หัวใจต่อคน = ceil(25% ของจำนวนข้อ) อย่างน้อย 1 ดวง
 * - ข้อปกติ: ตอบผิด/หมดเวลา เสียหัวใจ 1 ดวง ถ้าทุกคนตอบถูก คนตอบช้าสุดโดนยิง เสีย 1 ดวง
 * - Sudden Death (หลังโจทย์หมดแต่ยังเหลือหลายคน): ผิด/หมดเวลา = ตกรอบทันที
 *   ถ้าทุกคนตอบถูก คนตอบช้าสุดตกรอบ
 * - คนที่ตกรอบในข้อเดียวกันได้อันดับร่วมกัน (รวมกรณีทุกคนที่เหลือตกพร้อมกัน = เสมออันดับ 1)
 *
 * การ์ดพลัง (โหมด items)
 * - 🛡️ โล่ (ติดตัว): กันการโดนยิงครั้งแรกให้อัตโนมัติ รวมถึง Sudden Death แล้วโล่หายไป 1 อัน
 * - ✂️ 50/50 บนข้อเติมคำตอบ = ข้ามข้อ: ไม่เสียหัวใจ ไม่ได้คะแนน และไม่นับในการหาคนช้าสุด
 * - ⏳ ลดเวลาเพื่อน / ⌛ เพิ่มเวลาตัวเอง: เซิร์ฟเวอร์ปรับเส้นตายรายคน (ไม่เกี่ยวกับเอนจินนี้)
 * - 🔫 ยิงสวน (redirects): ถ้าคนที่ใช้การ์ดโดนยิงในข้อนั้น ดาเมจไปตกที่เป้าแทน แรงเท่าเดิม
 *   (Sudden Death = เป้าตกรอบ) โล่ของเป้ากันได้ ไม่เด้งต่อ และทำงานก่อนโล่ของคนใช้
 */

export type CardKind = 'shield' | 'fifty' | 'slow' | 'extra' | 'counter';
export type CardCounts = Partial<Record<CardKind, number>>;

export interface BattlePlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  hearts: number;
  /** คะแนนสะสม (ถูก + โบนัสความเร็ว) ใช้แสดงผล ไม่ได้ใช้ตัดสินการตกรอบ */
  score: number;
  /** อันดับสุดท้าย (1 = ชนะ) มีค่าเมื่อตกรอบแล้วหรือเกมจบ */
  rank: number | null;
  /** การ์ดในมือ (มีเฉพาะโหมดการ์ดพลัง) */
  cards?: CardCounts;
}

export interface RoundAnswer {
  playerId: string;
  correct: boolean;
  /** เวลาที่ใช้ตอบ (ms) ถ้าหมดเวลาให้ใส่เวลาเต็มของข้อ */
  timeMs: number;
  timedOut: boolean;
  points: number;
  /** ใช้การ์ดข้ามข้อ */
  skipped?: boolean;
}

export type DamageReason = 'wrong' | 'timeout' | 'slowest' | 'counter';

export interface Damage {
  playerId: string;
  reason: DamageReason;
  heartsLost: number;
  /** โล่กันไว้ได้ (heartsLost = 0) */
  blocked?: boolean;
  /** ยิงสวน: ดาเมจนี้ถูกส่งต่อไปที่ผู้เล่นคนนี้ (heartsLost = 0) */
  redirectedTo?: string;
  /** ยิงสวน: ดาเมจนี้มาจากผู้เล่นคนนี้ */
  from?: string;
}

export interface RoundOutcome {
  damages: Damage[];
  /** id ของคนที่ตกรอบในข้อนี้ */
  eliminated: string[];
  suddenDeath: boolean;
  gameOver: boolean;
}

export function heartsFor(questionCount: number): number {
  return Math.max(1, Math.ceil(questionCount * 0.25));
}

export function isAlive(p: BattlePlayer): boolean {
  return p.hearts > 0 && p.rank === null;
}

export function alivePlayers(players: BattlePlayer[]): BattlePlayer[] {
  return players.filter(isAlive);
}

/** ข้อที่ index นี้ (เริ่ม 0) เป็น Sudden Death หรือไม่ */
export function isSuddenDeath(roundIndex: number, questionCount: number): boolean {
  return roundIndex >= questionCount;
}

export function createPlayers(
  entries: { id: string; name: string; avatar: string; isBot: boolean }[],
  questionCount: number,
): BattlePlayer[] {
  const hearts = heartsFor(questionCount);
  return entries.map((e) => ({ ...e, hearts, score: 0, rank: null }));
}

/**
 * คำนวณผลของข้อหนึ่ง คืน players ชุดใหม่ (ไม่แก้ของเดิม) และสรุปว่าใครโดนอะไร
 * answers ต้องมีของผู้เล่นที่ยังไม่ตกรอบทุกคน (คนที่ไม่ได้ตอบให้ส่งเป็น timedOut)
 */
export function resolveRound(
  players: BattlePlayer[],
  answers: RoundAnswer[],
  roundIndex: number,
  questionCount: number,
  /** ยิงสวน: ผู้ใช้การ์ด -> เป้าหมาย */
  redirects: Record<string, string> = {},
): { players: BattlePlayer[]; outcome: RoundOutcome } {
  const suddenDeath = isSuddenDeath(roundIndex, questionCount);
  const alive = alivePlayers(players);
  const byId = new Map(answers.map((a) => [a.playerId, a]));
  const answerOf = (id: string): RoundAnswer =>
    byId.get(id) ?? { playerId: id, correct: false, timeMs: Infinity, timedOut: true, points: 0 };

  const damages: Damage[] = [];
  const aliveById = new Map(alive.map((p) => [p.id, p]));
  const shieldsLeft = new Map(alive.map((p) => [p.id, p.cards?.shield ?? 0]));
  const hit = (p: BattlePlayer, reason: DamageReason, from?: string) => {
    // ยิงสวน (ไม่เด้งต่อถ้าดาเมจนี้มาจากการยิงสวนอยู่แล้ว)
    const target = from ? undefined : aliveById.get(redirects[p.id]);
    if (target && target.id !== p.id) {
      damages.push({ playerId: p.id, reason, heartsLost: 0, redirectedTo: target.id });
      hit(target, 'counter', p.id);
      return;
    }
    if ((shieldsLeft.get(p.id) ?? 0) > 0) {
      shieldsLeft.set(p.id, shieldsLeft.get(p.id)! - 1);
      damages.push({ playerId: p.id, reason, heartsLost: 0, blocked: true, ...(from ? { from } : {}) });
    } else {
      damages.push({ playerId: p.id, reason, heartsLost: suddenDeath ? p.hearts : 1, ...(from ? { from } : {}) });
    }
  };

  // คนที่ข้ามข้อไม่นับทั้งตอนหาคนผิดและคนช้าสุด
  const playing = alive.filter((p) => !answerOf(p.id).skipped);
  const wrong = playing.filter((p) => !answerOf(p.id).correct);
  if (wrong.length > 0) {
    for (const p of wrong) hit(p, answerOf(p.id).timedOut ? 'timeout' : 'wrong');
  } else if (playing.length > 1) {
    // ทุกคนตอบถูก -> คนช้าที่สุดโดนยิง (ถ้าช้าเท่ากันโดนทุกคนที่เท่ากัน)
    const slowest = Math.max(...playing.map((p) => answerOf(p.id).timeMs));
    for (const p of playing) if (answerOf(p.id).timeMs === slowest) hit(p, 'slowest');
  }

  // คนเดียวโดนได้หลายครั้งในข้อเดียว (ตัวเอง + โดนยิงสวน) -> รวมกัน
  const lost = new Map<string, number>();
  for (const d of damages) lost.set(d.playerId, (lost.get(d.playerId) ?? 0) + d.heartsLost);
  let next = players.map((p) => {
    if (!isAlive(p)) return p;
    const shieldNow = shieldsLeft.get(p.id) ?? 0;
    const usedShield = p.cards && shieldNow !== (p.cards.shield ?? 0);
    return {
      ...p,
      hearts: Math.max(0, p.hearts - (lost.get(p.id) ?? 0)),
      score: p.score + answerOf(p.id).points,
      ...(usedShield ? { cards: { ...p.cards!, shield: shieldNow } } : {}),
    };
  });

  const eliminated = next.filter((p) => p.rank === null && p.hearts === 0).map((p) => p.id);
  const stillAlive = next.filter(isAlive).length;
  // อันดับร่วม: คนที่ตกพร้อมกันได้อันดับถัดจากจำนวนคนที่ยังเหลือ
  const sharedRank = stillAlive + 1;
  next = next.map((p) => (eliminated.includes(p.id) ? { ...p, rank: sharedRank } : p));

  const gameOver = stillAlive <= 1;
  if (gameOver) next = next.map((p) => (isAlive(p) ? { ...p, rank: 1 } : p));

  return { players: next, outcome: { damages, eliminated, suddenDeath, gameOver } };
}
