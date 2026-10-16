-- =========================================================
-- สเต็ป 22.2d: ตู้สุ่มด้วยเหรียญ (ไม่ใช้เงินจริง)
--   1 ครั้ง 300 เหรียญ / 10 ครั้ง 2,700 (10 ครั้งการันตีหายากขึ้นไปอย่างน้อย 1 ชิ้น)
--   อัตรา: อาหาร 40% / ธรรมดา 30% / หายาก 18% / เอพิก 9% / ตำนาน 2.7% / มิธิก 0.3%
--   การันตี: ไม่ได้ตำนานขึ้นไปครบ 60 ครั้ง ครั้งถัดไปได้แน่นอน (ได้แล้วนับใหม่)
--   ของซ้ำ -> เศษชิ้นส่วน (ธรรมดา 5 / หายาก 15 / เอพิก 40 / ตำนาน 120 / มิธิก 300)
--   แลกเศษ: ธรรมดา 30 / หายาก 80 / เอพิก 200 / ตำนาน 600 / มิธิก 1,500
-- =========================================================

alter table public.profiles
  add column shards int not null default 0 check (shards >= 0),
  add column gacha_pity int not null default 0;

alter table public.coin_ledger drop constraint coin_ledger_reason_check;
alter table public.coin_ledger add constraint coin_ledger_reason_check check (reason in ('play', 'checkin', 'buy', 'season', 'gacha'));

create table public.gacha_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text references public.wardrobe_items (id),
  food_id text references public.pet_foods (id),
  food_qty int,
  rarity text not null,
  duplicate boolean not null default false,
  shards int not null default 0,
  created_at timestamptz not null default now()
);
create index gacha_log_user_idx on public.gacha_log (user_id, created_at desc);
alter table public.gacha_log enable row level security;
create policy "Users read their own gacha log" on public.gacha_log for select to authenticated using (user_id = auth.uid());

create function public.shard_value(p_rarity text)
returns int language sql immutable set search_path = '' as $$
  select case p_rarity when 'mythic' then 300 when 'legend' then 120 when 'epic' then 40 when 'rare' then 15 else 5 end;
$$;
create function public.shard_price(p_rarity text)
returns int language sql immutable set search_path = '' as $$
  select case p_rarity when 'mythic' then 1500 when 'legend' then 600 when 'epic' then 200 when 'rare' then 80 else 30 end;
$$;

-- สุ่มระดับ (เลขสุ่ม 0..1) — แยกไว้ให้ทดสอบง่าย
create function public.gacha_tier(p_roll float8)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_roll < 0.003 then 'mythic'
    when p_roll < 0.030 then 'legend'
    when p_roll < 0.120 then 'epic'
    when p_roll < 0.300 then 'rare'
    when p_roll < 0.600 then 'common'
    else 'food'
  end;
$$;

create function public.gacha_draw(p_count int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cost int;
  v_p public.profiles;
  v_pity int;
  v_results jsonb := '[]'::jsonb;
  v_tier text;
  v_item public.wardrobe_items;
  v_food text;
  v_qty int;
  v_dup boolean;
  v_sh int;
  v_got_rare boolean := false;
  i int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_count not in (1, 10) then raise exception 'bad_count'; end if;
  v_cost := case when p_count = 10 then 2700 else 300 end;
  select * into v_p from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;
  if v_p.coins < v_cost then raise exception 'not_enough_coins'; end if;
  update public.profiles set coins = coins - v_cost where id = v_uid;
  insert into public.coin_ledger (user_id, amount, reason) values (v_uid, -v_cost, 'gacha');
  v_pity := v_p.gacha_pity;

  for i in 1..p_count loop
    v_pity := v_pity + 1;
    if v_pity >= 60 then
      v_tier := case when random() < 0.1 then 'mythic' else 'legend' end;
    else
      v_tier := public.gacha_tier(random());
      -- 10 ครั้ง: ครั้งสุดท้ายการันตีหายากขึ้นไป
      if p_count = 10 and i = 10 and not v_got_rare and v_tier in ('food', 'common') then
        v_tier := 'rare';
      end if;
    end if;
    if v_tier in ('rare', 'epic', 'legend', 'mythic') then v_got_rare := true; end if;
    if v_tier in ('legend', 'mythic') then v_pity := 0; end if;

    if v_tier = 'food' then
      v_food := (array['biscuit', 'biscuit', 'biscuit', 'fish', 'fish', 'cake'])[1 + floor(random() * 6)::int];
      v_qty := case v_food when 'biscuit' then 3 when 'fish' then 2 else 1 end;
      perform public.add_food(v_uid, v_food, v_qty, 'gacha');
      insert into public.gacha_log (user_id, food_id, food_qty, rarity) values (v_uid, v_food, v_qty, 'common');
      v_results := v_results || jsonb_build_object('type', 'food', 'id', v_food, 'qty', v_qty, 'rarity', 'common');
    else
      select * into v_item from public.wardrobe_items
       where rarity = v_tier and (coin is not null or gem is not null or gacha)
       order by random() limit 1;
      v_dup := exists (select 1 from public.owned_items where user_id = v_uid and item_id = v_item.id);
      v_sh := case when v_dup then public.shard_value(v_tier) else 0 end;
      if v_dup then
        update public.profiles set shards = shards + v_sh where id = v_uid;
      else
        insert into public.owned_items (user_id, item_id) values (v_uid, v_item.id);
      end if;
      insert into public.gacha_log (user_id, item_id, rarity, duplicate, shards) values (v_uid, v_item.id, v_tier, v_dup, v_sh);
      v_results := v_results || jsonb_build_object('type', 'item', 'id', v_item.id, 'rarity', v_tier, 'duplicate', v_dup, 'shards', v_sh);
    end if;
  end loop;

  update public.profiles set gacha_pity = v_pity where id = v_uid;
  select * into v_p from public.profiles where id = v_uid;
  return jsonb_build_object('results', v_results, 'coins', v_p.coins, 'shards', v_p.shards, 'pity', v_pity);
end;
$$;
grant execute on function public.gacha_draw(int) to authenticated;

-- แลกเศษชิ้นส่วนเป็นของที่เลือก (ของที่ยังไม่มี และไม่ใช่ของฟรี)
create function public.shard_exchange(p_item text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.wardrobe_items;
  v_price int;
  v_shards int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_item from public.wardrobe_items where id = p_item and (coin is not null or gem is not null or gacha);
  if not found then raise exception 'item_not_found'; end if;
  if exists (select 1 from public.owned_items where user_id = v_uid and item_id = p_item) then raise exception 'already_owned'; end if;
  v_price := public.shard_price(v_item.rarity);
  select shards into v_shards from public.profiles where id = v_uid for update;
  if v_shards < v_price then raise exception 'not_enough_shards'; end if;
  update public.profiles set shards = shards - v_price where id = v_uid;
  insert into public.owned_items (user_id, item_id) values (v_uid, p_item);
  return v_shards - v_price;
end;
$$;
grant execute on function public.shard_exchange(text) to authenticated;

create function public.gacha_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'coins', p.coins, 'shards', p.shards, 'pity', p.gacha_pity,
    'owned', coalesce((select jsonb_agg(item_id) from public.owned_items where user_id = p.id), '[]'::jsonb))
    from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.gacha_state() to authenticated;
