import type { BattlePlayer, RoundOutcome } from '../game/battle';
import type { Difficulty, Subject } from '../types';
import { ensureSession } from './supabase';

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
    results: Record<string, { correct: boolean; timedOut: boolean; timeMs: number }>;
    disconnected: string[];
  };
  nextAt?: number;
  xp?: Record<string, { gained: number; total: number }>;
}

// ---------- นาฬิกาเซิร์ฟเวอร์ ----------
// เวลาในเกมทั้งหมดเป็นเวลาของเซิร์ฟเวอร์ ต้องชดเชยส่วนต่างกับนาฬิกาเครื่องผู้เล่น

let clockOffset = 0;
let offsetSamples = 0;

function updateOffset(serverNow: number, sentAt: number, receivedAt: number) {
  const sample = serverNow - (sentAt + receivedAt) / 2;
  // ค่าเฉลี่ยสะสม ให้ค่าแรกๆ มีน้ำหนักมาก แล้วค่อยๆ นิ่ง
  offsetSamples = Math.min(offsetSamples + 1, 10);
  clockOffset += (sample - clockOffset) / offsetSamples;
}

export const serverNow = () => Date.now() + clockOffset;

const GAME_ERRORS: Record<string, string> = {
  need_two_players: 'ต้องมีผู้เล่นอย่างน้อย 2 คน',
  not_host: 'เฉพาะเจ้าของห้องเท่านั้น',
  no_questions: 'เตรียมโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง',
  too_late: 'หมดเวลาแล้ว ⏰',
  round_closed: 'ข้อนี้ปิดไปแล้ว',
  not_alive: 'คุณตกรอบแล้ว',
  not_in_room: 'คุณไม่ได้อยู่ในห้องนี้',
  already_playing: 'เกมเริ่มไปแล้ว',
};

export async function callGame(action: 'start' | 'auto_start' | 'answer' | 'tick' | 'rematch' | 'ping', body: Record<string, unknown> = {}) {
  const sb = await ensureSession();
  const sentAt = Date.now();
  const { data, error } = await sb.functions.invoke<{ ok?: boolean; error?: string; serverNow: number }>('room-game', {
    body: { action, ...body },
  });
  const receivedAt = Date.now();
  let payload = data;
  if (error) {
    // FunctionsHttpError: อ่านข้อความจาก body
    const ctx = (error as { context?: Response }).context;
    payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
  }
  if (payload?.serverNow) updateOffset(payload.serverNow, sentAt, receivedAt);
  if (payload?.error) throw new Error(GAME_ERRORS[payload.error] ?? payload.error);
  if (error && !payload) throw new Error(error.message);
}

/** วัดส่วนต่างนาฬิกาตอนเข้าห้อง (เรียกแล้วได้ error unknown_action ไม่เป็นไร) */
export async function syncClock(roomId: string) {
  for (let i = 0; i < 2; i++) await callGame('ping', { roomId }).catch(() => {});
}

export async function heartbeat(roomId: string) {
  const sb = await ensureSession();
  await sb.rpc('room_heartbeat', { p_room: roomId });
}
