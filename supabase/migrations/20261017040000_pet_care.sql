-- =========================================================
-- สเต็ป 22.2c: เลี้ยงสัตว์เลี้ยงให้โต
--   อาหาร 3 แบบ ซื้อด้วยเหรียญ: บิสกิต 50 (+20) / ปลาย่าง 150 (+70) / เค้กทอง 400 (+200 ค่าเติบโต)
--   ได้ฟรี: จบเกมที่ได้ XP >= 30 ได้บิสกิต 1 ชิ้น (วันละไม่เกิน 5) / เช็กอินรายวันได้ปลาย่าง 1 ชิ้น
--   เลเวล 1-10 (เลเวล n -> n+1 ใช้ 100 x n) ไม่เลี้ยงนาน = แค่งอน ไม่ลดเลเวล
-- =========================================================

create table public.pet_foods (
  id text primary key,
  coin int not null check (coin > 0),
  growth int not null check (growth > 0),
  sort int not null
);
alter table public.pet_foods enable row level security;
create policy "Pet foods are public" on public.pet_foods for select to anon, authenticated using (true);
insert into public.pet_foods (id, coin, growth, sort) values
  ('biscuit', 50, 20, 1),
  ('fish', 150, 70, 2),
  ('cake', 400, 200, 3);

-- คลังอาหาร
create table public.food_stock (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null references public.pet_foods (id),
  qty int not null default 0 check (qty >= 0),
  primary key (user_id, food_id)
);
alter table public.food_stock enable row level security;
create policy "Users read their own food" on public.food_stock for select to authenticated using (user_id = auth.uid());

-- ประวัติได้/ใช้อาหาร (คิดเพดานอาหารฟรีรายวัน)
create table public.food_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null references public.pet_foods (id),
  qty int not null,
  reason text not null check (reason in ('buy', 'play', 'checkin', 'feed', 'gacha')),
  created_at timestamptz not null default now()
);
create index food_ledger_user_idx on public.food_ledger (user_id, created_at desc);
alter table public.food_ledger enable row level security;
create policy "Users read their own food history" on public.food_ledger for select to authenticated using (user_id = auth.uid());

-- เลเวลสัตว์เลี้ยงแต่ละตัว
create table public.pet_levels (
  user_id uuid not null references auth.users (id) on delete cascade,
  pet_id text not null references public.wardrobe_items (id),
  level int not null default 1 check (level between 1 and 10),
  growth int not null default 0 check (growth >= 0),
  fed_at timestamptz,
  primary key (user_id, pet_id)
);
alter table public.pet_levels enable row level security;
create policy "Pet levels are public" on public.pet_levels for select to anon, authenticated using (true);

create function public.add_food(p_user uuid, p_food text, p_qty int, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.food_stock (user_id, food_id, qty) values (p_user, p_food, p_qty)
  on conflict (user_id, food_id) do update set qty = public.food_stock.qty + p_qty;
  insert into public.food_ledger (user_id, food_id, qty, reason) values (p_user, p_food, p_qty, p_reason);
$$;
revoke execute on function public.add_food(uuid, text, int, text) from public, anon, authenticated;

-- อาหารฟรีจากการเล่น / เช็กอิน
create function public.food_from_play()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today int;
begin
  if tg_op = 'UPDATE' and new.xp - old.xp >= 30 then
    select coalesce(sum(qty), 0) into v_today from public.food_ledger
     where user_id = new.id and reason = 'play'
       and created_at >= (public.bkk_today()::timestamp at time zone 'Asia/Bangkok');
    if v_today < 5 then
      perform public.add_food(new.id, 'biscuit', 1, 'play');
    end if;
  end if;
  if tg_op = 'UPDATE' and new.checkin_day is distinct from old.checkin_day and new.checkin_day is not null then
    perform public.add_food(new.id, 'fish', 1, 'checkin');
  end if;
  return new;
end;
$$;
create trigger profiles_food_from_play
  after update of xp, checkin_day on public.profiles
  for each row execute function public.food_from_play();

-- ซื้ออาหารด้วยเหรียญ
create function public.buy_food(p_food text, p_qty int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_food public.pet_foods;
  v_coins int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_qty < 1 or p_qty > 20 then raise exception 'bad_qty'; end if;
  select * into v_food from public.pet_foods where id = p_food;
  if not found then raise exception 'food_not_found'; end if;
  select coins into v_coins from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;
  if v_coins < v_food.coin * p_qty then raise exception 'not_enough_coins'; end if;
  update public.profiles set coins = coins - v_food.coin * p_qty where id = v_uid;
  insert into public.coin_ledger (user_id, amount, reason) values (v_uid, -v_food.coin * p_qty, 'buy');
  perform public.add_food(v_uid, p_food, p_qty, 'buy');
  return v_coins - v_food.coin * p_qty;
end;
$$;
grant execute on function public.buy_food(text, int) to authenticated;

-- ป้อนอาหาร: ต้องมีสัตว์ตัวนั้น และมีอาหาร
create function public.feed_pet(p_pet text, p_food text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_food public.pet_foods;
  v_pet public.wardrobe_items;
  v_lv int;
  v_growth int;
  v_up int := 0;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_pet from public.wardrobe_items where id = p_pet and slot = 'pet' and value <> 'n';
  if not found then raise exception 'pet_not_found'; end if;
  if not exists (select 1 from public.owned_items where user_id = v_uid and item_id = p_pet) then
    raise exception 'pet_not_owned';
  end if;
  select * into v_food from public.pet_foods where id = p_food;
  if not found then raise exception 'food_not_found'; end if;
  update public.food_stock set qty = qty - 1 where user_id = v_uid and food_id = p_food and qty > 0;
  if not found then raise exception 'no_food'; end if;
  insert into public.food_ledger (user_id, food_id, qty, reason) values (v_uid, p_food, -1, 'feed');

  insert into public.pet_levels (user_id, pet_id) values (v_uid, p_pet) on conflict do nothing;
  select level, growth into v_lv, v_growth from public.pet_levels where user_id = v_uid and pet_id = p_pet for update;
  v_growth := v_growth + v_food.growth;
  while v_lv < 10 and v_growth >= 100 * v_lv loop
    v_growth := v_growth - 100 * v_lv;
    v_lv := v_lv + 1;
    v_up := v_up + 1;
  end loop;
  if v_lv = 10 then v_growth := 0; end if;
  update public.pet_levels set level = v_lv, growth = v_growth, fed_at = now() where user_id = v_uid and pet_id = p_pet;
  return jsonb_build_object('level', v_lv, 'growth', v_growth, 'need', case when v_lv < 10 then 100 * v_lv else 0 end, 'levelsUp', v_up);
end;
$$;
grant execute on function public.feed_pet(text, text) to authenticated;

-- ข้อมูลหน้า "สัตว์เลี้ยงของฉัน"
create function public.pet_care_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'coins', (select coins from public.profiles where id = auth.uid()),
    'foods', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'coin', f.coin, 'growth', f.growth, 'qty', coalesce(s.qty, 0)) order by f.sort)
        from public.pet_foods f
        left join public.food_stock s on s.food_id = f.id and s.user_id = auth.uid()
    ), '[]'::jsonb),
    'pets', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', o.item_id,
          'level', coalesce(l.level, 1),
          'growth', coalesce(l.growth, 0),
          'need', case when coalesce(l.level, 1) < 10 then 100 * coalesce(l.level, 1) else 0 end,
          'fedAt', l.fed_at) order by w.sort)
        from public.owned_items o
        join public.wardrobe_items w on w.id = o.item_id and w.slot = 'pet'
        left join public.pet_levels l on l.user_id = o.user_id and l.pet_id = o.item_id
       where o.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.pet_care_state() to authenticated;
