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
import type { ChibiLook, HairStyle, HandItem, Hat, Outfit } from '../three/chibi';

export { DEFAULT_LOOK_CODE, encodeLook, parseLook, randomLook, WARDROBE, type Look };

const STYLE: Record<string, HairStyle> = { s: 'short', b: 'bob', p: 'spiky', u: 'bun' };
const OUTFIT: Record<string, Outfit> = { u: 'uniform', l: 'labcoat', h: 'hoodie', s: 'sport' };
const HAT: Record<string, Hat> = { n: 'none', c: 'cap', b: 'beanie', h: 'headphones', g: 'grad' };
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
  };
}

export const chibiOf = (code: string | null | undefined) => toChibi(lookOf(code));

/** สุ่มหน้าตาใหม่จากของฟรี เป็นรหัสพร้อมบันทึก */
export const randomFreeCode = () => encodeLook(randomLook());

/** หน้าตาบอท: ใส่ของแต่งได้ทุกชิ้น (โชว์ของในร้าน) สุ่มคงที่ตามชื่อบอท */
export const botCode = (seed: string) => encodeLook(randomLook(WARDROBE, seededRand(`bot:${seed}`)));
