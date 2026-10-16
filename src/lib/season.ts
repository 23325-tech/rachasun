import { ensureSession } from './supabase';
import { t } from './i18n';
import type { Tier } from './rank';

export interface SeasonRow {
  id: string;
  nickname: string;
  tag: string;
  avatar: string;
  rp: number;
  peak: number;
}

export interface SeasonReward {
  season: number;
  tier: Tier['key'];
  peakRp: number;
  coins: number;
}

export interface SeasonState {
  no: number;
  startsAt: string;
  endsAt: string;
  me: { rp: number; peakRp: number; games: number; rank: number | null };
  top: SeasonRow[];
  /** รางวัลฤดูกาลที่จบแล้วแต่ยังไม่ได้เปิดดู */
  unseen: SeasonReward[];
}

/** เกมขั้นต่ำในฤดูกาลถึงจะได้รางวัล (ตรงกับ close_due_seasons) */
export const SEASON_MIN_GAMES = 5;

/** เหรียญรางวัลตามยศสูงสุดในฤดูกาล (ตรงกับ season_coins) */
export const SEASON_COINS: Record<Tier['key'], number> = {
  bronze: 100,
  silver: 200,
  gold: 400,
  platinum: 700,
  diamond: 1000,
  legend: 1500,
};

export async function fetchSeason(): Promise<SeasonState> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('season_state');
  if (error) throw new Error(t(`โหลดข้อมูลฤดูกาลไม่สำเร็จ: ${error.message}`, `Couldn't load the season: ${error.message}`));
  return data as SeasonState;
}

/** เวลาที่เหลือของฤดูกาลแบบสั้น เช่น "61 วัน" / "5 ชม." */
export function seasonLeft(endsAt: string, now = Date.now()): string {
  const ms = Math.max(0, Date.parse(endsAt) - now);
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return t(`${d} วัน`, `${d}d`);
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return t(`${h} ชม.`, `${h}h`);
  return t(`${Math.max(1, Math.ceil(ms / 60_000))} นาที`, `${Math.max(1, Math.ceil(ms / 60_000))}m`);
}
