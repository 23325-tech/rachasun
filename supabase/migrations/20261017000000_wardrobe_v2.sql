-- =========================================================
-- สเต็ป 22.1: รหัสหน้าตา v2 (12 ช่อง) + ของฟรีเพิ่มเป็น ~56 ชิ้น
--   v2 . ผิว . ผม . ทรงผม . ตา . ชุด . หมวก . ของในมือ . ใบหน้า . สัตว์เลี้ยง . ออร่า . ชุดตัวละคร . เอฟเฟกต์ยิง
--   รหัส v1 (7 ช่อง) ยังใช้ได้ ช่องที่ขาด = n
--   รายการของสร้างจาก supabase/functions/_shared/wardrobe.ts
-- =========================================================

alter table public.wardrobe_items drop constraint wardrobe_items_slot_check;
alter table public.wardrobe_items add constraint wardrobe_items_slot_check
  check (slot in ('skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item', 'face', 'pet', 'aura', 'set', 'shot'));

insert into public.wardrobe_items (id, slot, value, name, rarity, coin, gem, sort) values
  ('skin_fair', 'skin', 'ffd9c2', 'ผิวอ่อน', 'common', null, null, 0),
  ('skin_rosy', 'skin', 'f6c6ae', 'ผิวอมชมพู', 'common', null, null, 1),
  ('skin_honey', 'skin', 'e9b48a', 'ผิวน้ำผึ้ง', 'common', null, null, 2),
  ('skin_tan', 'skin', 'b97a56', 'ผิวแทน', 'common', null, null, 3),
  ('skin_deep', 'skin', '8d5524', 'ผิวเข้ม', 'common', null, null, 4),
  ('skin_porcelain', 'skin', 'fff0e6', 'ผิวขาวใส', 'common', null, null, 5),
  ('skin_olive', 'skin', 'd9a877', 'ผิวสองสี', 'common', null, null, 6),
  ('skin_cocoa', 'skin', '6b3e26', 'ผิวโกโก้', 'common', null, null, 7),
  ('hair_dark', 'hair', '3b2a4d', 'ผมน้ำตาลเข้ม', 'common', null, null, 8),
  ('hair_black', 'hair', '1f1a24', 'ผมดำ', 'common', null, null, 9),
  ('hair_brown', 'hair', '7a4a2a', 'ผมน้ำตาล', 'common', null, null, 10),
  ('hair_chestnut', 'hair', '8b5a3c', 'ผมสีเกาลัด', 'common', null, null, 11),
  ('hair_auburn', 'hair', 'a0442c', 'ผมแดงอิฐ', 'common', null, null, 12),
  ('hair_honey', 'hair', 'c08a4a', 'ผมสีน้ำผึ้ง', 'common', null, null, 13),
  ('hair_ash', 'hair', '7d7d8f', 'ผมเทาหม่น', 'common', null, null, 14),
  ('hair_silver', 'hair', 'c9c9d6', 'ผมสีเงิน', 'common', null, null, 15),
  ('hair_navy', 'hair', '2c3e7a', 'ผมน้ำเงินเข้ม', 'common', null, null, 16),
  ('hair_forest', 'hair', '2f5a3a', 'ผมเขียวเข้ม', 'common', null, null, 17),
  ('hair_wine', 'hair', '6e2a3e', 'ผมแดงไวน์', 'common', null, null, 18),
  ('hair_cocoa', 'hair', '4a2c1f', 'ผมช็อกโกแลต', 'common', null, null, 19),
  ('hair_blonde', 'hair', 'd9a066', 'ผมบลอนด์', 'common', 300, null, 20),
  ('hair_pink', 'hair', 'ff8fc0', 'ผมชมพูพาสเทล', 'rare', 600, null, 21),
  ('hair_lavender', 'hair', 'b48cff', 'ผมม่วงลาเวนเดอร์', 'rare', 600, null, 22),
  ('hair_galaxy', 'hair', '4fb6ff', 'ผมฟ้ากาแล็กซี่', 'epic', null, 19, 23),
  ('style_short', 'style', 's', 'ผมสั้นเรียบร้อย', 'common', null, null, 24),
  ('style_bob', 'style', 'b', 'ผมบ็อบ', 'common', null, null, 25),
  ('style_long', 'style', 'l', 'ผมยาว', 'common', null, null, 26),
  ('style_ponytail', 'style', 't', 'ผมหางม้า', 'common', null, null, 27),
  ('style_twintails', 'style', 'w', 'ผมแกละสองข้าง', 'common', null, null, 28),
  ('style_curly', 'style', 'c', 'ผมหยิก', 'common', null, null, 29),
  ('style_spiky', 'style', 'p', 'ผมตั้งชี้', 'rare', 800, null, 30),
  ('style_bun', 'style', 'u', 'มวยผม', 'epic', null, 39, 31),
  ('eyes_dark', 'eyes', '3b2a4d', 'ตาสีเข้ม', 'common', null, null, 32),
  ('eyes_brown', 'eyes', '6b3e26', 'ตาสีน้ำตาล', 'common', null, null, 33),
  ('eyes_hazel', 'eyes', '8a6a2f', 'ตาสีอำพัน', 'common', null, null, 34),
  ('eyes_gray', 'eyes', '5e6a7a', 'ตาสีเทา', 'common', null, null, 35),
  ('eyes_purple', 'eyes', '6a4aa8', 'ตาสีม่วง', 'common', null, null, 36),
  ('eyes_amber', 'eyes', 'b8742a', 'ตาสีส้มทอง', 'common', null, null, 37),
  ('eyes_teal', 'eyes', '2a8a8a', 'ตาสีเขียวน้ำทะเล', 'common', null, null, 38),
  ('eyes_blue', 'eyes', '2b5fa8', 'ตาสีฟ้า', 'common', 200, null, 39),
  ('eyes_green', 'eyes', '2f7a4a', 'ตาสีเขียว', 'common', 200, null, 40),
  ('outfit_school', 'outfit', 'u-2b3a8c', 'ชุดนักเรียน', 'common', null, null, 41),
  ('outfit_school_black', 'outfit', 'u-2a2a33', 'ชุดนักเรียน (กางเกงดำ)', 'common', null, null, 42),
  ('outfit_skirt', 'outfit', 'k-2b3a8c', 'ชุดนักเรียนกระโปรง', 'common', null, null, 43),
  ('outfit_skirt_black', 'outfit', 'k-2a2a33', 'ชุดนักเรียนกระโปรงดำ', 'common', null, null, 44),
  ('outfit_tee_orange', 'outfit', 't-ff8a3c', 'เสื้อยืดส้ม', 'common', null, null, 45),
  ('outfit_tee_blue', 'outfit', 't-3d8bff', 'เสื้อยืดฟ้า', 'common', null, null, 46),
  ('outfit_tee_green', 'outfit', 't-22c58b', 'เสื้อยืดเขียว', 'common', null, null, 47),
  ('outfit_sport_green', 'outfit', 's-22a06b', 'ชุดกีฬาเขียว', 'common', null, null, 48),
  ('outfit_hoodie_gray', 'outfit', 'h-8a8fa3', 'ฮู้ดดี้เทา', 'common', null, null, 49),
  ('outfit_hoodie', 'outfit', 'h-7c5cff', 'ฮู้ดดี้ม่วง', 'rare', 1200, null, 50),
  ('outfit_sport_red', 'outfit', 's-ff5d73', 'ชุดกีฬาแดง', 'rare', 1000, null, 51),
  ('outfit_sport_blue', 'outfit', 's-2f7bff', 'ชุดกีฬาน้ำเงิน', 'rare', 1000, null, 52),
  ('outfit_labcoat', 'outfit', 'l-22c58b', 'เสื้อกาวน์นักวิทย์', 'epic', null, 49, 53),
  ('hat_none', 'hat', 'n', 'ไม่ใส่หมวก', 'common', null, null, 54),
  ('hat_headband', 'hat', 'd', 'ที่คาดผม', 'common', null, null, 55),
  ('hat_ribbon', 'hat', 'r', 'โบว์', 'common', null, null, 56),
  ('hat_flower', 'hat', 'f', 'กิ๊บดอกไม้', 'common', null, null, 57),
  ('hat_cap', 'hat', 'c', 'แก๊ปแดง', 'common', 400, null, 58),
  ('hat_beanie', 'hat', 'b', 'หมวกไหมพรม', 'rare', 900, null, 59),
  ('hat_headphones', 'hat', 'h', 'หูฟังเกมเมอร์', 'epic', null, 49, 60),
  ('hat_grad', 'hat', 'g', 'หมวกบัณฑิต', 'legend', null, 59, 61),
  ('item_none', 'item', 'n', 'มือว่าง', 'common', null, null, 62),
  ('item_pencil', 'item', 'p', 'ดินสอสีทอง', 'common', 250, null, 63),
  ('item_book', 'item', 'k', 'ตำราเล่มโปรด', 'rare', 700, null, 64),
  ('item_flask', 'item', 'f', 'ขวดทดลองเรืองแสง', 'epic', null, 29, 65),
  ('face_none', 'face', 'n', 'หน้าเปล่า', 'common', null, null, 66),
  ('face_glasses', 'face', 'g', 'แว่นตา', 'common', null, null, 67),
  ('face_round', 'face', 'o', 'แว่นกลม', 'common', null, null, 68),
  ('face_freckles', 'face', 'f', 'กระบนแก้ม', 'common', null, null, 69),
  ('face_star', 'face', 's', 'สติกเกอร์ดาว', 'common', null, null, 70),
  ('pet_none', 'pet', 'n', 'ไม่มีสัตว์เลี้ยง', 'common', null, null, 71),
  ('aura_none', 'aura', 'n', 'ไม่มีออร่า', 'common', null, null, 72),
  ('set_none', 'set', 'n', 'ตัวละครปกติ', 'common', null, null, 73),
  ('shot_none', 'shot', 'n', 'กระสุนปกติ', 'common', null, null, 74)
on conflict (id) do update set slot = excluded.slot, value = excluded.value, name = excluded.name,
  rarity = excluded.rarity, coin = excluded.coin, gem = excluded.gem, sort = excluded.sort;

-- รูปแบบรหัส: v1 7 ช่อง หรือ v2 12 ช่อง (+ กรอบฤดูกาล) ตรวจละเอียดใน look_allowed
alter table public.profiles drop constraint profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar ~ '^v[12](\.[0-9a-z-]{1,13}){7}((\.[0-9a-z-]{1,13}){5})?(\+[0-9]{1,3}[bsgpdl])?$');

create or replace function public.look_allowed(p_avatar text, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := split_part(p_avatar, '+', 1);
  v_frame text := nullif(split_part(p_avatar, '+', 2), '');
  v_parts text[];
  v_slots text[] := array['skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item', 'face', 'pet', 'aura', 'set', 'shot'];
  v_count int;
begin
  v_parts := string_to_array(v_base, '.');
  if v_parts[1] = 'v1' and array_length(v_parts, 1) = 8 then
    v_count := 7;
  elsif v_parts[1] = 'v2' and array_length(v_parts, 1) = 13 then
    v_count := 12;
  else
    return false;
  end if;
  if v_frame is not null then
    if v_frame !~ '^[0-9]{1,3}[bsgpdl]$' or not exists (
      select 1 from public.season_rewards r
       where r.user_id = p_user
         and r.season_no = left(v_frame, length(v_frame) - 1)::int
         and public.tier_letter(r.tier) = right(v_frame, 1)
    ) then
      return false;
    end if;
  end if;
  for i in 1..v_count loop
    if not exists (
      select 1 from public.wardrobe_items w
       where w.slot = v_slots[i] and w.value = v_parts[i + 1]
         and ((w.coin is null and w.gem is null)
              or exists (select 1 from public.owned_items o where o.user_id = p_user and o.item_id = w.id))
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;
