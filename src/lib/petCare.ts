import { ensureSession } from './supabase';
import { t } from './i18n';

export interface FoodStock {
  id: 'biscuit' | 'fish' | 'cake';
  coin: number;
  growth: number;
  qty: number;
}

export interface PetLevel {
  /** รหัสสินค้า เช่น pet_cat */
  id: string;
  level: number;
  growth: number;
  /** ค่าเติบโตที่ต้องใช้ขึ้นเลเวลถัดไป (เลเวลเต็ม = 0) */
  need: number;
  fedAt: string | null;
}

export interface PetCareState {
  coins: number;
  foods: FoodStock[];
  pets: PetLevel[];
}

/** ไม่ได้ป้อนเกินนี้ = หิว (งอน) */
const HUNGRY_MS = 24 * 3600_000;
export const isHungry = (p: Pick<PetLevel, 'fedAt'>, now = Date.now()) => !p.fedAt || now - Date.parse(p.fedAt) > HUNGRY_MS;

export const FOOD_NAME: Record<FoodStock['id'], () => string> = {
  biscuit: () => t('บิสกิต', 'Biscuit'),
  fish: () => t('ปลาย่าง', 'Grilled fish'),
  cake: () => t('เค้กทอง', 'Golden cake'),
};

const ERRORS: Record<string, () => string> = {
  not_enough_coins: () => t('เหรียญไม่พอ', 'Not enough coins'),
  no_food: () => t('อาหารหมดแล้ว ซื้อเพิ่มก่อนนะ', 'Out of food — buy more first'),
  pet_not_owned: () => t('ยังไม่มีสัตว์เลี้ยงตัวนี้', "You don't own this pet"),
};
const friendly = (msg: string) => ERRORS[Object.keys(ERRORS).find((k) => msg.includes(k)) ?? '']?.() ?? msg;

export async function fetchPetCare(): Promise<PetCareState> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('pet_care_state');
  if (error) throw new Error(friendly(error.message));
  return data as PetCareState;
}

export async function buyFood(food: FoodStock['id'], qty: number): Promise<number> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('buy_food', { p_food: food, p_qty: qty });
  if (error) throw new Error(friendly(error.message));
  return data as number;
}

export async function feedPet(pet: string, food: FoodStock['id']): Promise<{ level: number; growth: number; need: number; levelsUp: number }> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('feed_pet', { p_pet: pet, p_food: food });
  if (error) throw new Error(friendly(error.message));
  return data as { level: number; growth: number; need: number; levelsUp: number };
}
