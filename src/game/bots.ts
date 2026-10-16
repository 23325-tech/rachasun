import type { Difficulty } from '../types';
import { shuffle } from '../lib/shuffle';

export type BotLevel = 'chill' | 'normal' | 'pro';

export const BOT_LEVELS: { value: BotLevel; label: string; icon: string }[] = [
  { value: 'chill', label: 'ชิลๆ', icon: '😴' },
  { value: 'normal', label: 'ปกติ', icon: '🙂' },
  { value: 'pro', label: 'โหด', icon: '😈' },
];

const BOT_ROSTER = [
  { name: 'หมีพูห์', avatar: '🐻' },
  { name: 'แมวส้ม', avatar: '🐱' },
  { name: 'หมาชิบะ', avatar: '🐶' },
  { name: 'จิ้งจอก', avatar: '🦊' },
  { name: 'แพนด้า', avatar: '🐼' },
  { name: 'กบน้อย', avatar: '🐸' },
  { name: 'ไดโน', avatar: '🦖' },
  { name: 'หุ่นยนต์', avatar: '🤖' },
  { name: 'ยูนิคอร์น', avatar: '🦄' },
  { name: 'นกฮูก', avatar: '🦉' },
];

/** ความแม่นพื้นฐาน (โอกาสตอบถูก) ตามระดับบอท และความยากของข้อ */
const ACCURACY: Record<BotLevel, Record<Difficulty, number>> = {
  chill: { easy: 0.7, medium: 0.55, hard: 0.4, challenge: 0.25 },
  normal: { easy: 0.85, medium: 0.72, hard: 0.58, challenge: 0.42 },
  pro: { easy: 0.95, medium: 0.88, hard: 0.78, challenge: 0.65 },
};

/** ช่วงเวลาที่ใช้ตอบ เป็นสัดส่วนของเวลาเต็ม */
const SPEED: Record<BotLevel, [number, number]> = {
  chill: [0.4, 0.95],
  normal: [0.25, 0.8],
  pro: [0.12, 0.55],
};

export interface Bot {
  id: string;
  name: string;
  avatar: string;
  level: BotLevel;
  /** นิสัยประจำตัว: บวก = เก่ง/ไวกว่าค่าเฉลี่ยของระดับ ลบ = ด้อยกว่า */
  skill: number;
}

export function createBots(count: number, level: BotLevel): Bot[] {
  return shuffle(BOT_ROSTER)
    .slice(0, count)
    .map((b, i) => ({ id: `bot-${i}`, ...b, level, skill: Math.random() * 0.2 - 0.1 }));
}

export interface BotAnswer {
  correct: boolean;
  /** เวลาที่บอทกดตอบ (ms) มากกว่าหรือเท่ากับ limitMs = หมดเวลา */
  timeMs: number;
}

/** สุ่มว่าบอทจะตอบถูกไหมและตอบตอนกี่ ms */
export function botAnswer(bot: Bot, difficulty: Difficulty, limitMs: number, rand = Math.random): BotAnswer {
  const accuracy = Math.min(0.98, Math.max(0.05, ACCURACY[bot.level][difficulty] + bot.skill));
  const [lo, hi] = SPEED[bot.level];
  // บอทที่เก่งกว่าตอบไวขึ้นเล็กน้อย / มีโอกาส 5% ที่จะคิดนานจนหมดเวลา
  const ratio = rand() < 0.05 ? 1 : lo + (hi - lo) * rand() - bot.skill * 0.3;
  const timeMs = Math.round(Math.min(1, Math.max(0.08, ratio)) * limitMs);
  const timedOut = timeMs >= limitMs;
  return { correct: !timedOut && rand() < accuracy, timeMs };
}
