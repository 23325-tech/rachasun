// แคตตาล็อกของแต่งตัวละคร + รูปแบบรหัสหน้าตา (ใช้ร่วมกันทั้งหน้าเว็บ สคริปต์สร้าง seed SQL และเซิร์ฟเวอร์)
// รหัสหน้าตาเก็บในคอลัมน์ avatar
//   v2 . สีผิว . สีผม . ทรงผม . สีตา . ชุด(แบบ-สี) . หมวก . ของในมือ . ใบหน้า . สัตว์เลี้ยง . ออร่า . ชุดตัวละคร . เอฟเฟกต์ยิง
//   รหัสเก่า v1 มีแค่ 7 ช่องแรก (ช่องที่เหลือ = n ไม่ใส่)

export type Slot = 'skin' | 'hair' | 'style' | 'eyes' | 'outfit' | 'hat' | 'item' | 'face' | 'pet' | 'aura' | 'set' | 'shot';
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
  /** ชื่อภาษาอังกฤษ */
  en?: string;
}

const free = (id: string, slot: Slot, value: string, name: string, en?: string): WardrobeItem => ({ id, slot, value, name, rarity: 'common', en });

export const WARDROBE: WardrobeItem[] = [
  // สีผิว (ฟรีทุกสี)
  free('skin_fair', 'skin', 'ffd9c2', 'ผิวอ่อน'),
  free('skin_rosy', 'skin', 'f6c6ae', 'ผิวอมชมพู'),
  free('skin_honey', 'skin', 'e9b48a', 'ผิวน้ำผึ้ง'),
  free('skin_tan', 'skin', 'b97a56', 'ผิวแทน'),
  free('skin_deep', 'skin', '8d5524', 'ผิวเข้ม'),
  free('skin_porcelain', 'skin', 'fff0e6', 'ผิวขาวใส', 'Porcelain'),
  free('skin_olive', 'skin', 'd9a877', 'ผิวสองสี', 'Olive'),
  free('skin_cocoa', 'skin', '6b3e26', 'ผิวโกโก้', 'Cocoa'),
  // สีผม
  free('hair_dark', 'hair', '3b2a4d', 'ผมน้ำตาลเข้ม'),
  free('hair_black', 'hair', '1f1a24', 'ผมดำ'),
  free('hair_brown', 'hair', '7a4a2a', 'ผมน้ำตาล'),
  free('hair_chestnut', 'hair', '8b5a3c', 'ผมสีเกาลัด', 'Chestnut hair'),
  free('hair_auburn', 'hair', 'a0442c', 'ผมแดงอิฐ', 'Auburn hair'),
  free('hair_honey', 'hair', 'c08a4a', 'ผมสีน้ำผึ้ง', 'Honey hair'),
  free('hair_ash', 'hair', '7d7d8f', 'ผมเทาหม่น', 'Ash gray hair'),
  free('hair_silver', 'hair', 'c9c9d6', 'ผมสีเงิน', 'Silver hair'),
  free('hair_navy', 'hair', '2c3e7a', 'ผมน้ำเงินเข้ม', 'Navy hair'),
  free('hair_forest', 'hair', '2f5a3a', 'ผมเขียวเข้ม', 'Forest green hair'),
  free('hair_wine', 'hair', '6e2a3e', 'ผมแดงไวน์', 'Wine red hair'),
  free('hair_cocoa', 'hair', '4a2c1f', 'ผมช็อกโกแลต', 'Chocolate hair'),
  { id: 'hair_blonde', slot: 'hair', value: 'd9a066', name: 'ผมบลอนด์', rarity: 'common', coin: 300 },
  { id: 'hair_pink', slot: 'hair', value: 'ff8fc0', name: 'ผมชมพูพาสเทล', rarity: 'rare', coin: 600 },
  { id: 'hair_lavender', slot: 'hair', value: 'b48cff', name: 'ผมม่วงลาเวนเดอร์', rarity: 'rare', coin: 600 },
  { id: 'hair_galaxy', slot: 'hair', value: '4fb6ff', name: 'ผมฟ้ากาแล็กซี่', rarity: 'epic', gem: 19 },
  // ทรงผม
  free('style_short', 'style', 's', 'ผมสั้นเรียบร้อย'),
  free('style_bob', 'style', 'b', 'ผมบ็อบ'),
  free('style_long', 'style', 'l', 'ผมยาว', 'Long'),
  free('style_ponytail', 'style', 't', 'ผมหางม้า', 'Ponytail'),
  free('style_twintails', 'style', 'w', 'ผมแกละสองข้าง', 'Twin tails'),
  free('style_curly', 'style', 'c', 'ผมหยิก', 'Curly'),
  { id: 'style_spiky', slot: 'style', value: 'p', name: 'ผมตั้งชี้', rarity: 'rare', coin: 800 },
  { id: 'style_bun', slot: 'style', value: 'u', name: 'มวยผม', rarity: 'epic', gem: 39 },
  // สีตา
  free('eyes_dark', 'eyes', '3b2a4d', 'ตาสีเข้ม'),
  free('eyes_brown', 'eyes', '6b3e26', 'ตาสีน้ำตาล', 'Brown eyes'),
  free('eyes_hazel', 'eyes', '8a6a2f', 'ตาสีอำพัน', 'Hazel eyes'),
  free('eyes_gray', 'eyes', '5e6a7a', 'ตาสีเทา', 'Gray eyes'),
  free('eyes_purple', 'eyes', '6a4aa8', 'ตาสีม่วง', 'Purple eyes'),
  free('eyes_amber', 'eyes', 'b8742a', 'ตาสีส้มทอง', 'Amber eyes'),
  free('eyes_teal', 'eyes', '2a8a8a', 'ตาสีเขียวน้ำทะเล', 'Teal eyes'),
  { id: 'eyes_blue', slot: 'eyes', value: '2b5fa8', name: 'ตาสีฟ้า', rarity: 'common', coin: 200 },
  { id: 'eyes_green', slot: 'eyes', value: '2f7a4a', name: 'ตาสีเขียว', rarity: 'common', coin: 200 },
  // ชุด
  free('outfit_school', 'outfit', 'u-2b3a8c', 'ชุดนักเรียน'),
  free('outfit_school_black', 'outfit', 'u-2a2a33', 'ชุดนักเรียน (กางเกงดำ)'),
  free('outfit_skirt', 'outfit', 'k-2b3a8c', 'ชุดนักเรียนกระโปรง', 'School uniform (skirt)'),
  free('outfit_skirt_black', 'outfit', 'k-2a2a33', 'ชุดนักเรียนกระโปรงดำ', 'School uniform (black skirt)'),
  free('outfit_tee_orange', 'outfit', 't-ff8a3c', 'เสื้อยืดส้ม', 'Orange T-shirt'),
  free('outfit_tee_blue', 'outfit', 't-3d8bff', 'เสื้อยืดฟ้า', 'Blue T-shirt'),
  free('outfit_tee_green', 'outfit', 't-22c58b', 'เสื้อยืดเขียว', 'Green T-shirt'),
  free('outfit_sport_green', 'outfit', 's-22a06b', 'ชุดกีฬาเขียว', 'Green sportswear'),
  free('outfit_hoodie_gray', 'outfit', 'h-8a8fa3', 'ฮู้ดดี้เทา', 'Gray hoodie'),
  { id: 'outfit_hoodie', slot: 'outfit', value: 'h-7c5cff', name: 'ฮู้ดดี้ม่วง', rarity: 'rare', coin: 1200 },
  { id: 'outfit_sport_red', slot: 'outfit', value: 's-ff5d73', name: 'ชุดกีฬาแดง', rarity: 'rare', coin: 1000 },
  { id: 'outfit_sport_blue', slot: 'outfit', value: 's-2f7bff', name: 'ชุดกีฬาน้ำเงิน', rarity: 'rare', coin: 1000 },
  { id: 'outfit_labcoat', slot: 'outfit', value: 'l-22c58b', name: 'เสื้อกาวน์นักวิทย์', rarity: 'epic', gem: 49 },
  // หมวก
  free('hat_none', 'hat', 'n', 'ไม่ใส่หมวก'),
  free('hat_headband', 'hat', 'd', 'ที่คาดผม', 'Headband'),
  free('hat_ribbon', 'hat', 'r', 'โบว์', 'Ribbon'),
  free('hat_flower', 'hat', 'f', 'กิ๊บดอกไม้', 'Flower clip'),
  { id: 'hat_cap', slot: 'hat', value: 'c', name: 'แก๊ปแดง', rarity: 'common', coin: 400 },
  { id: 'hat_beanie', slot: 'hat', value: 'b', name: 'หมวกไหมพรม', rarity: 'rare', coin: 900 },
  { id: 'hat_headphones', slot: 'hat', value: 'h', name: 'หูฟังเกมเมอร์', rarity: 'epic', gem: 49 },
  { id: 'hat_grad', slot: 'hat', value: 'g', name: 'หมวกบัณฑิต', rarity: 'legend', gem: 59 },
  // ของในมือ
  free('item_none', 'item', 'n', 'มือว่าง'),
  { id: 'item_pencil', slot: 'item', value: 'p', name: 'ดินสอสีทอง', rarity: 'common', coin: 250 },
  { id: 'item_book', slot: 'item', value: 'k', name: 'ตำราเล่มโปรด', rarity: 'rare', coin: 700 },
  { id: 'item_flask', slot: 'item', value: 'f', name: 'ขวดทดลองเรืองแสง', rarity: 'epic', gem: 29 },
  // ใบหน้า
  free('face_none', 'face', 'n', 'หน้าเปล่า', 'Plain'),
  free('face_glasses', 'face', 'g', 'แว่นตา', 'Glasses'),
  free('face_round', 'face', 'o', 'แว่นกลม', 'Round glasses'),
  free('face_freckles', 'face', 'f', 'กระบนแก้ม', 'Freckles'),
  free('face_star', 'face', 's', 'สติกเกอร์ดาว', 'Star sticker'),
  // ของพิเศษ (สเต็ป 22.2-22.5 จะเพิ่มชิ้นที่ซื้อได้)
  free('pet_none', 'pet', 'n', 'ไม่มีสัตว์เลี้ยง', 'No pet'),
  free('aura_none', 'aura', 'n', 'ไม่มีออร่า', 'No aura'),
  free('set_none', 'set', 'n', 'ตัวละครปกติ', 'Default character'),
  free('shot_none', 'shot', 'n', 'กระสุนปกติ', 'Default shot'),
];

export const SLOT_ORDER: Slot[] = ['skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item', 'face', 'pet', 'aura', 'set', 'shot'];
/** จำนวนช่องของรหัสรุ่นแรก */
const V1_SLOTS = 7;

export type Look = Record<Slot, string>;

export const DEFAULT_LOOK_CODE = 'v2.ffd9c2.3b2a4d.s.3b2a4d.u-2b3a8c.n.n.n.n.n.n.n';

/** รหัส -> ค่าทีละช่อง (รูปแบบผิด = null) */
export function parseLook(code: string | null | undefined): Look | null {
  if (!code) return null;
  // ส่วนท้าย "+1g" = กรอบฤดูกาล ไม่ใช่ส่วนของหน้าตา
  const [ver, ...parts] = code.split('+')[0].split('.');
  if (ver === 'v1' && parts.length === V1_SLOTS) parts.push(...Array(SLOT_ORDER.length - V1_SLOTS).fill('n'));
  else if (ver !== 'v2' || parts.length !== SLOT_ORDER.length) return null;
  return Object.fromEntries(SLOT_ORDER.map((s, i) => [s, parts[i]])) as Look;
}

export const encodeLook = (look: Look) => ['v2', ...SLOT_ORDER.map((s) => look[s] ?? 'n')].join('.');

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
