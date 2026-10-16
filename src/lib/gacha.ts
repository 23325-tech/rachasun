import { ensureSession } from './supabase';
import { t } from './i18n';
import type { Rarity } from '../../supabase/functions/_shared/wardrobe';

export type GachaResult =
  | { type: 'food'; id: 'biscuit' | 'fish' | 'cake'; qty: number; rarity: 'common' }
  | { type: 'item'; id: string; rarity: Rarity; duplicate: boolean; shards: number };

export interface GachaState {
  coins: number;
  shards: number;
  pity: number;
  owned: string[];
}

export const GACHA_COST = { 1: 300, 10: 2700 } as const;
export const PITY_AT = 60;

/** อัตราออก (ตรงกับ gacha_tier ในฐานข้อมูล) */
export const GACHA_ODDS: { rarity: Rarity | 'food'; pct: string }[] = [
  { rarity: 'mythic', pct: '0.3%' },
  { rarity: 'legend', pct: '2.7%' },
  { rarity: 'epic', pct: '9%' },
  { rarity: 'rare', pct: '18%' },
  { rarity: 'common', pct: '30%' },
  { rarity: 'food', pct: '40%' },
];

export const SHARD_PRICE: Record<Rarity, number> = { common: 30, rare: 80, epic: 200, legend: 600, mythic: 1500 };

const ERRORS: Record<string, () => string> = {
  not_enough_coins: () => t('เหรียญไม่พอ เล่นเพิ่มอีกนิดนะ', 'Not enough coins — play a bit more'),
  not_enough_shards: () => t('เศษชิ้นส่วนไม่พอ', 'Not enough shards'),
  already_owned: () => t('มีชิ้นนี้แล้ว', 'You already own this'),
};
const friendly = (msg: string) => ERRORS[Object.keys(ERRORS).find((k) => msg.includes(k)) ?? '']?.() ?? msg;

export async function fetchGacha(): Promise<GachaState> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('gacha_state');
  if (error) throw new Error(friendly(error.message));
  return data as GachaState;
}

export async function drawGacha(count: 1 | 10): Promise<{ results: GachaResult[]; coins: number; shards: number; pity: number }> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('gacha_draw', { p_count: count });
  if (error) throw new Error(friendly(error.message));
  return data as { results: GachaResult[]; coins: number; shards: number; pity: number };
}

export async function exchangeShards(itemId: string): Promise<number> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('shard_exchange', { p_item: itemId });
  if (error) throw new Error(friendly(error.message));
  return data as number;
}
