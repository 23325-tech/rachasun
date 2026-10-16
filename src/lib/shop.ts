import { ensureSession } from './supabase';
import { t } from './i18n';

export interface GemPack {
  id: string;
  price: number;
  gems: number;
}

export interface ShopState {
  coins: number;
  gems: number;
  packs: GemPack[];
  owned: string[];
  /** รหัสสินค้าหายากขึ้นไปที่วางขายรอบนี้ (8 ชิ้น เปลี่ยนทุก 3 วัน) */
  rotation: string[];
  rotationEndsAt: string;
  checkin: { claimedToday: boolean; playedToday: boolean; streak: number; rewards: number[] };
  playCoinsToday: number;
  playCap: number;
}

const ERRORS: Record<string, string> = {
  get not_enough_coins() { return t('เหรียญไม่พอ เล่นเพิ่มอีกนิดนะ', 'Not enough coins — play a bit more'); },
  get not_enough_gems() { return t('เพชรไม่พอ เติมเพชรก่อนนะ', 'Not enough gems — top up first'); },
  get already_owned() { return t('มีชิ้นนี้แล้ว', 'You already own this'); },
  get not_in_shop() { return t('ชิ้นนี้หมดรอบขายแล้ว รอวนกลับมานะ', 'No longer on sale this round — it will come back'); },
  get gem_item() { return t('ชิ้นนี้ใช้เพชร (เติมเพชรเร็วๆ นี้)', 'This costs gems (top-up coming soon)'); },
  get play_first() { return t('เล่นจบ 1 เกมก่อน แล้วค่อยรับเหรียญเช็กอินนะ', 'Finish 1 game first, then claim your check-in coins'); },
  get already_claimed() { return t('วันนี้รับไปแล้ว พรุ่งนี้มาใหม่นะ', 'Already claimed today — come back tomorrow'); },
};

const friendly = (msg: string) => ERRORS[Object.keys(ERRORS).find((k) => msg.includes(k)) ?? ''] ?? msg;

export async function fetchShopState(): Promise<ShopState> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('shop_state');
  if (error) throw new Error(friendly(error.message));
  const d = data as Record<string, unknown> & { checkin: Record<string, unknown> };
  return {
    coins: d.coins as number,
    gems: (d.gems as number) ?? 0,
    packs: (d.packs as GemPack[]) ?? [],
    owned: (d.owned as string[]) ?? [],
    rotation: (d.rotation as string[]) ?? [],
    rotationEndsAt: d.rotation_ends_at as string,
    checkin: {
      claimedToday: !!d.checkin.claimed_today,
      playedToday: !!d.checkin.played_today,
      streak: d.checkin.streak as number,
      rewards: d.checkin.rewards as number[],
    },
    playCoinsToday: d.play_coins_today as number,
    playCap: d.play_cap as number,
  };
}

/** ซื้อด้วยเหรียญหรือเพชร คืนยอดเหรียญที่เหลือ */
export async function buyItem(itemId: string): Promise<number> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('buy_item', { p_item: itemId });
  if (error) throw new Error(friendly(error.message));
  return data as number;
}

export async function claimCheckin(): Promise<{ reward: number; streak: number; coins: number }> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('claim_checkin');
  if (error) throw new Error(friendly(error.message));
  return (data as { reward: number; streak: number; coins: number }[])[0];
}

/** เหลือเวลาอีกเท่าไหร่ เช่น "2 วัน 5 ชม." */
export function timeLeft(iso: string, now = Date.now()): string {
  const ms = Math.max(0, Date.parse(iso) - now);
  const h = Math.floor(ms / 3600_000);
  const d = Math.floor(h / 24);
  return d > 0
    ? t(`${d} วัน ${h % 24} ชม.`, `${d}d ${h % 24}h`)
    : h > 0
      ? t(`${h} ชม. ${Math.floor((ms % 3600_000) / 60_000)} นาที`, `${h}h ${Math.floor((ms % 3600_000) / 60_000)}m`)
      : t(`${Math.ceil(ms / 60_000)} นาที`, `${Math.ceil(ms / 60_000)}m`);
}
