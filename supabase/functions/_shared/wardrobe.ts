// แคตตาล็อกของแต่งตัวละคร + รูปแบบรหัสหน้าตา (ใช้ร่วมกันทั้งหน้าเว็บ สคริปต์สร้าง seed SQL และเซิร์ฟเวอร์)
// รหัสหน้าตาเก็บในคอลัมน์ avatar เช่น "v1.ffd9c2.3b2a4d.s.3b2a4d.u-2b3a8c.n.n"
//   = v1 . สีผิว . สีผม . ทรงผม . สีตา . ชุด(แบบ-สี) . หมวก . ของในมือ

export type Slot = 'skin' | 'hair' | 'style' | 'eyes' | 'outfit' | 'hat' | 'item';
export type Rarity = 'common' | 'rare' | 'epic' | 'legend';

export interface WardrobeItem {
  /** รหัสสินค้า (ไม่เปลี่ยน ใช้อ้างอิงการซื้อ) */
  id: string;
  slot: Slot;
  /** ค่าที่อยู่ในรหัสหน้าตา */
  value: string;
  name: string;
  rarity: Rarity;
  coin?: number;
  gem?: number;
}

const free = (id: string, slot: Slot, value: string, name: string): WardrobeItem => ({ id, slot, value, name, rarity: 'common' });

export const WARDROBE: WardrobeItem[] = [
  // สีผิว (ฟรีทุกสี)
  free('skin_fair', 'skin', 'ffd9c2', 'ผิวอ่อน'),
  free('skin_rosy', 'skin', 'f6c6ae', 'ผิวอมชมพู'),
  free('skin_honey', 'skin', 'e9b48a', 'ผิวน้ำผึ้ง'),
  free('skin_tan', 'skin', 'b97a56', 'ผิวแทน'),
  free('skin_deep', 'skin', '8d5524', 'ผิวเข้ม'),
  // สีผม
  free('hair_dark', 'hair', '3b2a4d', 'ผมน้ำตาลเข้ม'),
  free('hair_black', 'hair', '1f1a24', 'ผมดำ'),
  free('hair_brown', 'hair', '7a4a2a', 'ผมน้ำตาล'),
  { id: 'hair_blonde', slot: 'hair', value: 'd9a066', name: 'ผมบลอนด์', rarity: 'common', coin: 300 },
  { id: 'hair_pink', slot: 'hair', value: 'ff8fc0', name: 'ผมชมพูพาสเทล', rarity: 'rare', coin: 600 },
  { id: 'hair_lavender', slot: 'hair', value: 'b48cff', name: 'ผมม่วงลาเวนเดอร์', rarity: 'rare', coin: 600 },
  { id: 'hair_galaxy', slot: 'hair', value: '4fb6ff', name: 'ผมฟ้ากาแล็กซี่', rarity: 'epic', gem: 19 },
  // ทรงผม
  free('style_short', 'style', 's', 'ผมสั้นเรียบร้อย'),
  free('style_bob', 'style', 'b', 'ผมบ็อบ'),
  { id: 'style_spiky', slot: 'style', value: 'p', name: 'ผมตั้งชี้', rarity: 'rare', coin: 800 },
  { id: 'style_bun', slot: 'style', value: 'u', name: 'มวยผม', rarity: 'epic', gem: 39 },
  // สีตา
  free('eyes_dark', 'eyes', '3b2a4d', 'ตาสีเข้ม'),
  { id: 'eyes_blue', slot: 'eyes', value: '2b5fa8', name: 'ตาสีฟ้า', rarity: 'common', coin: 200 },
  { id: 'eyes_green', slot: 'eyes', value: '2f7a4a', name: 'ตาสีเขียว', rarity: 'common', coin: 200 },
  // ชุด
  free('outfit_school', 'outfit', 'u-2b3a8c', 'ชุดนักเรียน'),
  free('outfit_school_black', 'outfit', 'u-2a2a33', 'ชุดนักเรียน (กางเกงดำ)'),
  { id: 'outfit_hoodie', slot: 'outfit', value: 'h-7c5cff', name: 'ฮู้ดดี้ม่วง', rarity: 'rare', coin: 1200 },
  { id: 'outfit_sport_red', slot: 'outfit', value: 's-ff5d73', name: 'ชุดกีฬาแดง', rarity: 'rare', coin: 1000 },
  { id: 'outfit_sport_blue', slot: 'outfit', value: 's-2f7bff', name: 'ชุดกีฬาน้ำเงิน', rarity: 'rare', coin: 1000 },
  { id: 'outfit_labcoat', slot: 'outfit', value: 'l-22c58b', name: 'เสื้อกาวน์นักวิทย์', rarity: 'epic', gem: 49 },
  // หมวก
  free('hat_none', 'hat', 'n', 'ไม่ใส่หมวก'),
  { id: 'hat_cap', slot: 'hat', value: 'c', name: 'แก๊ปแดง', rarity: 'common', coin: 400 },
  { id: 'hat_beanie', slot: 'hat', value: 'b', name: 'หมวกไหมพรม', rarity: 'rare', coin: 900 },
  { id: 'hat_headphones', slot: 'hat', value: 'h', name: 'หูฟังเกมเมอร์', rarity: 'epic', gem: 49 },
  { id: 'hat_grad', slot: 'hat', value: 'g', name: 'หมวกบัณฑิต', rarity: 'legend', gem: 59 },
  // ของในมือ
  free('item_none', 'item', 'n', 'มือว่าง'),
  { id: 'item_pencil', slot: 'item', value: 'p', name: 'ดินสอสีทอง', rarity: 'common', coin: 250 },
  { id: 'item_book', slot: 'item', value: 'k', name: 'ตำราเล่มโปรด', rarity: 'rare', coin: 700 },
  { id: 'item_flask', slot: 'item', value: 'f', name: 'ขวดทดลองเรืองแสง', rarity: 'epic', gem: 29 },
];

export const SLOT_ORDER: Slot[] = ['skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item'];

export type Look = Record<Slot, string>;

export const DEFAULT_LOOK_CODE = 'v1.ffd9c2.3b2a4d.s.3b2a4d.u-2b3a8c.n.n';

/** รหัส -> ค่าทีละช่อง (รูปแบบผิด = null) */
export function parseLook(code: string | null | undefined): Look | null {
  if (!code || !code.startsWith('v1.')) return null;
  const parts = code.split('.').slice(1);
  if (parts.length !== SLOT_ORDER.length) return null;
  return Object.fromEntries(SLOT_ORDER.map((s, i) => [s, parts[i]])) as Look;
}

export const encodeLook = (look: Look) => ['v1', ...SLOT_ORDER.map((s) => look[s])].join('.');

export const isFree = (it: WardrobeItem) => !it.coin && !it.gem;

/** สุ่มหน้าตาจากของที่ใช้ได้ (ค่าเริ่มต้น = ของฟรี) */
export function randomLook(pool: WardrobeItem[] = WARDROBE.filter(isFree), rand: () => number = Math.random): Look {
  const pick = (slot: Slot) => {
    const items = pool.filter((i) => i.slot === slot);
    return items[Math.floor(rand() * items.length)].value;
  };
  return Object.fromEntries(SLOT_ORDER.map((s) => [s, pick(s)])) as Look;
}

/** สุ่มแบบคงที่จากข้อความ (เช่น อวตารอิโมจิเก่า) เพื่อให้คนเดิมได้หน้าตาเดิมเสมอ */
export function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
