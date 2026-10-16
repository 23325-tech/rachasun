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

export interface SeasonHistoryRow {
  season: number;
  tier: Tier['key'];
  peakRp: number;
  coins: number;
}

/** รางวัลทุกฤดูกาลที่เคยได้ (ใหม่สุดก่อน) */
export async function fetchSeasonHistory(): Promise<SeasonHistoryRow[]> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('my_season_history');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { season_no: number; tier: Tier['key']; peak_rp: number; coins: number }[]).map((r) => ({
    season: r.season_no,
    tier: r.tier,
    peakRp: r.peak_rp,
    coins: r.coins,
  }));
}

/** ปิดป๊อปอัปผลฤดูกาล */
export async function markSeasonRewardsSeen(): Promise<void> {
  const sb = await ensureSession();
  await sb.rpc('mark_season_rewards_seen');
}

/** ใส่กรอบของฤดูกาลนั้น (null = ถอดกรอบ) คืนรหัสหน้าตาใหม่ */
export async function setFrame(season: number | null): Promise<string> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('set_frame', { p_season: season });
  if (error) throw new Error(error.message.includes('frame_not_owned') ? t('ยังไม่มีกรอบนี้', "You don't own this frame") : error.message);
  return data as string;
}
