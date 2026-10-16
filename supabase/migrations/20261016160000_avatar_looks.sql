-- =========================================================
-- สเต็ป 16.2a: ตัวละคร 3D แทนอวตารอิโมจิ
-- หน้าตาเก็บเป็นรหัสในคอลัมน์ avatar เดิม: v1.ผิว.สีผม.ทรงผม.สีตา.ชุด.หมวก.ของในมือ
-- แคตตาล็อกของแต่ง (สร้างจาก supabase/functions/_shared/wardrobe.ts)
-- =========================================================

create table public.wardrobe_items (
  id text primary key,
  slot text not null check (slot in ('skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item')),
  value text not null,
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legend')),
  coin int check (coin > 0),
  gem int check (gem > 0),
  sort int not null default 0,
  unique (slot, value)
);
alter table public.wardrobe_items enable row level security;
create policy "Anyone can read the wardrobe" on public.wardrobe_items for select to anon, authenticated using (true);

insert into public.wardrobe_items (id, slot, value, name, rarity, coin, gem, sort) values
  ('skin_fair', 'skin', 'ffd9c2', 'ผิวอ่อน', 'common', null, null, 0),
  ('skin_rosy', 'skin', 'f6c6ae', 'ผิวอมชมพู', 'common', null, null, 1),
  ('skin_honey', 'skin', 'e9b48a', 'ผิวน้ำผึ้ง', 'common', null, null, 2),
  ('skin_tan', 'skin', 'b97a56', 'ผิวแทน', 'common', null, null, 3),
  ('skin_deep', 'skin', '8d5524', 'ผิวเข้ม', 'common', null, null, 4),
  ('hair_dark', 'hair', '3b2a4d', 'ผมน้ำตาลเข้ม', 'common', null, null, 5),
  ('hair_black', 'hair', '1f1a24', 'ผมดำ', 'common', null, null, 6),
  ('hair_brown', 'hair', '7a4a2a', 'ผมน้ำตาล', 'common', null, null, 7),
  ('hair_blonde', 'hair', 'd9a066', 'ผมบลอนด์', 'common', 300, null, 8),
  ('hair_pink', 'hair', 'ff8fc0', 'ผมชมพูพาสเทล', 'rare', 600, null, 9),
  ('hair_lavender', 'hair', 'b48cff', 'ผมม่วงลาเวนเดอร์', 'rare', 600, null, 10),
  ('hair_galaxy', 'hair', '4fb6ff', 'ผมฟ้ากาแล็กซี่', 'epic', null, 19, 11),
  ('style_short', 'style', 's', 'ผมสั้นเรียบร้อย', 'common', null, null, 12),
  ('style_bob', 'style', 'b', 'ผมบ็อบ', 'common', null, null, 13),
  ('style_spiky', 'style', 'p', 'ผมตั้งชี้', 'rare', 800, null, 14),
  ('style_bun', 'style', 'u', 'มวยผม', 'epic', null, 39, 15),
  ('eyes_dark', 'eyes', '3b2a4d', 'ตาสีเข้ม', 'common', null, null, 16),
  ('eyes_blue', 'eyes', '2b5fa8', 'ตาสีฟ้า', 'common', 200, null, 17),
  ('eyes_green', 'eyes', '2f7a4a', 'ตาสีเขียว', 'common', 200, null, 18),
  ('outfit_school', 'outfit', 'u-2b3a8c', 'ชุดนักเรียน', 'common', null, null, 19),
  ('outfit_school_black', 'outfit', 'u-2a2a33', 'ชุดนักเรียน (กางเกงดำ)', 'common', null, null, 20),
  ('outfit_hoodie', 'outfit', 'h-7c5cff', 'ฮู้ดดี้ม่วง', 'rare', 1200, null, 21),
  ('outfit_sport_red', 'outfit', 's-ff5d73', 'ชุดกีฬาแดง', 'rare', 1000, null, 22),
  ('outfit_sport_blue', 'outfit', 's-2f7bff', 'ชุดกีฬาน้ำเงิน', 'rare', 1000, null, 23),
  ('outfit_labcoat', 'outfit', 'l-22c58b', 'เสื้อกาวน์นักวิทย์', 'epic', null, 49, 24),
  ('hat_none', 'hat', 'n', 'ไม่ใส่หมวก', 'common', null, null, 25),
  ('hat_cap', 'hat', 'c', 'แก๊ปแดง', 'common', 400, null, 26),
  ('hat_beanie', 'hat', 'b', 'หมวกไหมพรม', 'rare', 900, null, 27),
  ('hat_headphones', 'hat', 'h', 'หูฟังเกมเมอร์', 'epic', null, 49, 28),
  ('hat_grad', 'hat', 'g', 'หมวกบัณฑิต', 'legend', null, 59, 29),
  ('item_none', 'item', 'n', 'มือว่าง', 'common', null, null, 30),
  ('item_pencil', 'item', 'p', 'ดินสอสีทอง', 'common', 250, null, 31),
  ('item_book', 'item', 'k', 'ตำราเล่มโปรด', 'rare', 700, null, 32),
  ('item_flask', 'item', 'f', 'ขวดทดลองเรืองแสง', 'epic', null, 29, 33)
;

-- ---------- ตรวจหน้าตาที่บันทึก ----------
-- ทุกช่องต้องเป็นของในแคตตาล็อก และ (ยังไม่มีร้านค้า) ต้องเป็นของฟรี — สเต็ป 17.1 จะเพิ่ม "ของที่ซื้อแล้ว"
create function public.look_allowed(p_avatar text, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_slots text[] := array['skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item'];
begin
  if p_avatar !~ '^v1\.[0-9a-f]{6}\.[0-9a-f]{6}\.[sbpu]\.[0-9a-f]{6}\.[ulhs]-[0-9a-f]{6}\.[ncbhg]\.[npkf]$' then
    return false;
  end if;
  v_parts := string_to_array(p_avatar, '.');
  for i in 1..7 loop
    if not exists (
      select 1 from public.wardrobe_items w
       where w.slot = v_slots[i] and w.value = v_parts[i + 1]
         and w.coin is null and w.gem is null
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function public.check_profile_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.avatar is distinct from old.avatar then
    if not public.look_allowed(new.avatar, new.id) then
      raise exception 'avatar_not_allowed';
    end if;
  end if;
  return new;
end;
$$;

-- ---------- ผู้เล่นเดิม: สุ่มตัวละครจากของฟรีให้ ----------
alter table public.profiles drop constraint profiles_avatar_check;

-- (อ้าง p.id ในซับคิวรีเพื่อให้สุ่มใหม่ทุกแถว)
update public.profiles p
   set avatar = 'v1.' || (select w.value from public.wardrobe_items w where w.slot = 'skin' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1)
       || '.' || (select w.value from public.wardrobe_items w where w.slot = 'hair' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1)
       || '.' || (select w.value from public.wardrobe_items w where w.slot = 'style' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1)
       || '.' || (select w.value from public.wardrobe_items w where w.slot = 'eyes' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1)
       || '.' || (select w.value from public.wardrobe_items w where w.slot = 'outfit' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1)
       || '.' || (select w.value from public.wardrobe_items w where w.slot = 'hat' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1)
       || '.' || (select w.value from public.wardrobe_items w where w.slot = 'item' and w.coin is null and w.gem is null and p.id is not null order by random() limit 1);

alter table public.profiles alter column avatar set default 'v1.ffd9c2.3b2a4d.s.3b2a4d.u-2b3a8c.n.n';
alter table public.profiles
  add constraint profiles_avatar_check
  check (avatar ~ '^v1\.[0-9a-f]{6}\.[0-9a-f]{6}\.[sbpu]\.[0-9a-f]{6}\.[ulhs]-[0-9a-f]{6}\.[ncbhg]\.[npkf]$');

create trigger profiles_avatar_allowed
  before insert or update of avatar on public.profiles
  for each row execute function public.check_profile_avatar();

-- ห้องที่ค้างอยู่ใช้หน้าตาใหม่ด้วย
update public.room_players rp set avatar = p.avatar from public.profiles p where p.id = rp.user_id;
