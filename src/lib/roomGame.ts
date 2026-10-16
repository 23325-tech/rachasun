import type { BattlePlayer, CardKind, RoundOutcome } from '../game/battle';
import type { Difficulty, Subject } from '../types';
import { ensureSession } from './supabase';
import { t } from './i18n';

/** สถานะเกมที่เซิร์ฟเวอร์เปิดเผย (rooms.state) ต้องตรงกับ supabase/functions/room-game */
export interface OnlineGameState {
  seq: number;
  phase: 'preparing' | 'question' | 'reveal' | 'finished';
  round: number;
  questionCount: number;
  totalQuestions: number;
  players: BattlePlayer[];
  question?: {
    type: 'mcq' | 'fill';
    subject: Subject;
    difficulty: Difficulty;
    prompt: string;
    choices?: string[];
    answerKind?: 'number' | 'text';
    unit?: string;
  };
  startsAt?: number;
  deadline?: number;
  limitMs?: number;
  answered: string[];
  reveal?: {
    round: number;
    answerIndex?: number;
    answerText?: string;
    explanation: string;
    outcome: RoundOutcome;
    results: Record<string, { correct: boolean; timedOut: boolean; timeMs: number; skipped?: boolean }>;
    disconnected: string[];
  };
  nextAt?: number;
  xp?: Record<string, { gained: number; total: number; rpDelta?: number; rp?: number }>;
  /** โหมดการ์ดพลัง */
  items?: boolean;
  dealt?: { round: number; cards: Record<string, CardKind> };
  cardUsed?: Record<string, CardKind>;
  /** เส้นตายรายคนจากการ์ดเวลา */
  deadlines?: Record<string, number>;
  /** ใครโดนลดเวลาโดยใคร */
  slowed?: Record<string, string>;
}

export interface GameCallResult {
  ok?: boolean;
  /** 50/50 บนข้อปรนัย: ตัวเลือกที่ถูกตัด */
  removed?: number[];
  /** 50/50 บนข้อเติมคำตอบ: ข้ามข้อ */
  skipped?: boolean;
}

// ---------- นาฬิกาเซิร์ฟเวอร์ ----------
// เวลาในเกมทั้งหมดเป็นเวลาของเซิร์ฟเวอร์ ต้องชดเชยส่วนต่างกับนาฬิกาเครื่องผู้เล่น

let clockOffset = 0;
let offsetSamples = 0;

/** บันทึกเวลาเซิร์ฟเวอร์จากคำตอบของ Edge Function (ใช้ร่วมกับ async-play) */
export function noteServerTime(serverNow: number, sentAt: number, receivedAt: number) {
  const sample = serverNow - (sentAt + receivedAt) / 2;
  // ค่าเฉลี่ยสะสม ให้ค่าแรกๆ มีน้ำหนักมาก แล้วค่อยๆ นิ่ง
  offsetSamples = Math.min(offsetSamples + 1, 10);
  clockOffset += (sample - clockOffset) / offsetSamples;
}

export const serverNow = () => Date.now() + clockOffset;

const GAME_ERRORS: Record<string, string> = {
  get need_two_players() { return t('ต้องมีผู้เล่นอย่างน้อย 2 คน', 'Need at least 2 players'); },
  get not_host() { return t('เฉพาะเจ้าของห้องเท่านั้น', 'Host only'); },
  get no_questions() { return t('เตรียมโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง', 'Couldn\'t prepare questions, try again'); },
  get too_late() { return t('หมดเวลาแล้ว', 'Too late'); },
  get round_closed() { return t('ข้อนี้ปิดไปแล้ว', 'This question is closed'); },
  get not_alive() { return t('คุณตกรอบแล้ว', 'You\'re out'); },
  get not_in_room() { return t('คุณไม่ได้อยู่ในห้องนี้', 'You\'re not in this room'); },
  get already_playing() { return t('เกมเริ่มไปแล้ว', 'Game already started'); },
  get no_card() { return t('ไม่มีการ์ดใบนี้แล้ว', 'You don\'t have this card'); },
  get already_answered() { return t('ตอบไปแล้ว ใช้การ์ดไม่ได้', 'Already answered, card unavailable'); },
  get bad_target() { return t('เลือกเป้าหมายไม่ได้', 'Invalid target'); },
  get target_answered() { return t('เพื่อนคนนี้ตอบไปแล้ว', 'They already answered'); },
  get target_low_time() { return t('เวลาเพื่อนเหลือน้อยเกินไปแล้ว', 'Their time is too low'); },
};

export async function callGame(
  action: 'start' | 'auto_start' | 'answer' | 'tick' | 'rematch' | 'ping' | 'use_card',
  body: Record<string, unknown> = {},
): Promise<GameCallResult> {
  const sb = await ensureSession();
  const sentAt = Date.now();
  const { data, error } = await sb.functions.invoke<GameCallResult & { error?: string; serverNow: number }>('room-game', {
    body: { action, ...body },
  });
  const receivedAt = Date.now();
  let payload = data;
  if (error) {
    // FunctionsHttpError: อ่านข้อความจาก body
    const ctx = (error as { context?: Response }).context;
    payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
  }
  if (payload?.serverNow) noteServerTime(payload.serverNow, sentAt, receivedAt);
  if (payload?.error) throw new Error(GAME_ERRORS[payload.error] ?? payload.error);
  if (error && !payload) throw new Error(error.message);
  return payload ?? {};
}

/** วัดส่วนต่างนาฬิกาตอนเข้าห้อง (เรียกแล้วได้ error unknown_action ไม่เป็นไร) */
export async function syncClock(roomId: string) {
  for (let i = 0; i < 2; i++) await callGame('ping', { roomId }).catch(() => {});
}

export async function heartbeat(roomId: string) {
  const sb = await ensureSession();
  await sb.rpc('room_heartbeat', { p_room: roomId });
}
