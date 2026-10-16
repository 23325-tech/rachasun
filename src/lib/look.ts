// แปลงรหัสหน้าตา (คอลัมน์ avatar) <-> ค่าที่โมเดล 3D ใช้
import {
  DEFAULT_LOOK_CODE,
  encodeLook,
  parseLook,
  randomLook,
  seededRand,
  WARDROBE,
  type Look,
} from '../../supabase/functions/_shared/wardrobe';
import { t } from './i18n';
import type { ChibiLook, Face, HairStyle, HandItem, Hat, Outfit } from '../three/chibi';

export { DEFAULT_LOOK_CODE, encodeLook, parseLook, randomLook, WARDROBE, type Look };

// ชื่อไอเทมภาษาอังกฤษ (ไฟล์กลางใช้ร่วมกับเซิร์ฟเวอร์ จึงแปลงชื่อฝั่งหน้าเว็บที่นี่)
const ITEM_EN: Record<string, string> = {
  skin_fair: 'Fair', skin_rosy: 'Rosy', skin_honey: 'Honey', skin_tan: 'Tan', skin_deep: 'Deep',
  hair_dark: 'Dark brown hair', hair_black: 'Black hair', hair_brown: 'Brown hair', hair_blonde: 'Blonde hair',
  hair_pink: 'Pastel pink hair', hair_lavender: 'Lavender hair', hair_galaxy: 'Galaxy blue hair',
  style_short: 'Short', style_bob: 'Bob', style_spiky: 'Spiky', style_bun: 'Bun',
  eyes_dark: 'Dark eyes', eyes_blue: 'Blue eyes', eyes_green: 'Green eyes',
  outfit_school: 'School uniform', outfit_school_black: 'School uniform (black)', outfit_hoodie: 'Purple hoodie',
  outfit_sport_red: 'Red sportswear', outfit_sport_blue: 'Blue sportswear', outfit_labcoat: 'Lab coat',
  hat_none: 'No hat', hat_cap: 'Red cap', hat_beanie: 'Beanie', hat_headphones: 'Gamer headphones', hat_grad: 'Graduation cap',
  item_none: 'Empty hands', item_pencil: 'Golden pencil', item_book: 'Favorite textbook', item_flask: 'Glowing flask',
};
for (const it of WARDROBE) {
  const th = it.name;
  const en = ITEM_EN[it.id] ?? it.en ?? th;
  Object.defineProperty(it, 'name', { get: () => t(th, en), enumerable: true });
}

const STYLE: Record<string, HairStyle> = { s: 'short', b: 'bob', p: 'spiky', u: 'bun', l: 'long', t: 'ponytail', w: 'twintails', c: 'curly' };
const OUTFIT: Record<string, Outfit> = { u: 'uniform', l: 'labcoat', h: 'hoodie', s: 'sport', k: 'skirt', t: 'tee' };
const HAT: Record<string, Hat> = { n: 'none', c: 'cap', b: 'beanie', h: 'headphones', g: 'grad', d: 'headband', r: 'ribbon', f: 'flower' };
const FACE: Record<string, Face> = { n: 'none', g: 'glasses', o: 'round', f: 'freckles', s: 'star' };
const ITEM: Record<string, HandItem> = { n: 'none', p: 'pencil', k: 'book', f: 'flask' };

/** รหัสหน้าตา -> หน้าตาที่ใช้ได้เสมอ (รหัสเก่า/อิโมจิ = สุ่มแบบคงที่จากข้อความนั้น) */
export function lookOf(code: string | null | undefined): Look {
  return parseLook(code) ?? randomLook(undefined, seededRand(code || 'guest'));
}

export function toChibi(look: Look): ChibiLook {
  const [outfit, color] = look.outfit.split('-');
  return {
    skin: `#${look.skin}`,
    hair: `#${look.hair}`,
    hairStyle: STYLE[look.style] ?? 'short',
    eyes: `#${look.eyes}`,
    outfit: OUTFIT[outfit] ?? 'uniform',
    outfitColor: `#${color ?? '2b3a8c'}`,
    hat: HAT[look.hat] ?? 'none',
    item: ITEM[look.item] ?? 'none',
    face: FACE[look.face] ?? 'none',
  };
}

export const chibiOf = (code: string | null | undefined) => toChibi(lookOf(code));

/** สุ่มหน้าตาใหม่จากของฟรี เป็นรหัสพร้อมบันทึก */
export const randomFreeCode = () => encodeLook(randomLook());

/** หน้าตาบอท: ใส่ของแต่งได้ทุกชิ้น (โชว์ของในร้าน) สุ่มคงที่ตามชื่อบอท */
export const botCode = (seed: string) => encodeLook(randomLook(WARDROBE, seededRand(`bot:${seed}`)));

// ---------- กรอบฤดูกาล: ส่วนท้ายรหัสหน้าตา "+<ฤดูกาล><ยศ>" เช่น "+1g" ----------
export type FrameTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';
const TIER_BY_LETTER: Record<string, FrameTier> = { b: 'bronze', s: 'silver', g: 'gold', p: 'platinum', d: 'diamond', l: 'legend' };

/** กรอบที่ใส่อยู่ (ไม่มี = null) */
export function frameOf(code: string | null | undefined): { season: number; tier: FrameTier } | null {
  const m = code?.match(/\+(\d{1,3})([bsgpdl])$/);
  return m ? { season: Number(m[1]), tier: TIER_BY_LETTER[m[2]] } : null;
}

/** รหัสหน้าตาไม่รวมกรอบ */
export const lookCode = (code: string) => code.split('+')[0];

/** ใส่กรอบเดิมกลับเข้าไปในรหัสหน้าตาใหม่ (ตอนบันทึกชุดใหม่) */
export const keepFrame = (newCode: string, oldCode: string | null | undefined) => {
  const m = oldCode?.match(/\+\d{1,3}[bsgpdl]$/);
  return lookCode(newCode) + (m ? m[0] : '');
};
