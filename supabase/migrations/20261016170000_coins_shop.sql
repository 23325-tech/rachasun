-- =========================================================
-- สเต็ป 17.1: เหรียญ + ร้านค้า + เช็กอินรายวัน
--   เหรียญจากการเล่น = XP ที่ได้ (สูงสุดวันละ 500 ตามวันเวลาไทย)
--   เช็กอิน (ต้องเล่นจบ 1 เกมในวันนั้น): 20/30/40/50/60/80/150 วนทุก 7 วัน ขาดวันเริ่มใหม่ ไม่นับในเพดาน 500
--   ร้าน: ของธรรมดาขายตลอด / หายากขึ้นไปหมุนเวียน 8 ชิ้น เปลี่ยนทุก 3 วัน / ของเพชรรอสเต็ป 17.2
-- =========================================================

alter table public.profiles
  add column coins int not null default 0 check (coins >= 0),
  add column checkin_day date,
  add column checkin_streak int not null default 0;
-- คอลัมน์ใหม่ไม่อยู่ในสิทธิ์แก้ไขของหน้าเว็บ (grant update เดิมมีแค่ nickname/avatar/level)

-- บัญชีเหรียญ (ตรวจย้อนหลัง + คิดเพดานรายวัน)
create table public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('play', 'checkin', 'buy')),
  item_id text references public.wardrobe_items (id),
  created_at timestamptz not null default now()
);
create index coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);
alter table public.coin_ledger enable row level security;
create policy "Users read their own coin history" on public.coin_ledger for select to authenticated using (user_id = auth.uid());

-- ของที่ซื้อแล้ว (มีตลอดไป)
create table public.owned_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.wardrobe_items (id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.owned_items enable row level security;
create policy "Users read their own items" on public.owned_items for select to authenticated using (user_id = auth.uid());

-- ---------- เวลาไทย ----------
create function public.bkk_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Bangkok')::date;
$$;

-- ---------- เหรียญจากการเล่น: XP เพิ่มเท่าไหร่ ได้เหรียญเท่านั้น (เพดานรายวัน) ----------
create function public.coins_from_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap constant int := 500;
  v_used int;
  v_give int;
begin
  if new.xp <= old.xp then
    return new;
  end if;
  select coalesce(sum(amount), 0) into v_used
    from public.coin_ledger
   where user_id = new.id and reason = 'play'
     and created_at >= (public.bkk_today()::timestamp at time zone 'Asia/Bangkok');
  v_give := least(new.xp - old.xp, greatest(0, v_cap - v_used));
  if v_give > 0 then
    new.coins := new.coins + v_give;
    insert into public.coin_ledger (user_id, amount, reason) values (new.id, v_give, 'play');
  end if;
  return new;
end;
$$;

create trigger profiles_coins_from_xp
  before update of xp on public.profiles
  for each row execute function public.coins_from_xp();

-- ---------- ร้านหมุนเวียน ----------
-- รอบละ 3 วัน (นับจากวันที่ 1 ม.ค. 1970 เวลาไทย) สุ่มคงที่ด้วย md5(รหัสสินค้า + รอบ)
create function public.shop_period()
returns int language sql stable set search_path = '' as $$
  select floor((public.bkk_today() - date '1970-01-01') / 3)::int;
$$;

create function public.shop_rotation(p_period int default null)
returns setof text
language sql
stable
set search_path = ''
as $$
  select w.id
    from public.wardrobe_items w
   where w.rarity <> 'common' and (w.coin is not null or w.gem is not null)
   order by md5(w.id || ':' || coalesce(p_period, public.shop_period()))
   limit 8;
$$;

-- ---------- ใส่ได้ = ของฟรี หรือของที่ซื้อแล้ว ----------
create or replace function public.look_allowed(p_avatar text, p_user uuid)
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
         and ((w.coin is null and w.gem is null)
              or exists (select 1 from public.owned_items o where o.user_id = p_user and o.item_id = w.id))
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- ---------- ซื้อของด้วยเหรียญ ----------
create function public.buy_item(p_item text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.wardrobe_items;
  v_coins int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_item from public.wardrobe_items where id = p_item;
  if not found then raise exception 'item_not_found'; end if;
  if v_item.gem is not null then raise exception 'gem_item'; end if;
  if v_item.coin is null then raise exception 'free_item'; end if;
  if exists (select 1 from public.owned_items where user_id = v_uid and item_id = p_item) then
    raise exception 'already_owned';
  end if;
  if v_item.rarity <> 'common' and not exists (select 1 from public.shop_rotation() r where r = p_item) then
    raise exception 'not_in_shop';
  end if;

  select coins into v_coins from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;
  if v_coins < v_item.coin then raise exception 'not_enough_coins'; end if;

  update public.profiles set coins = coins - v_item.coin where id = v_uid;
  insert into public.owned_items (user_id, item_id) values (v_uid, p_item);
  insert into public.coin_ledger (user_id, amount, reason, item_id) values (v_uid, -v_item.coin, 'buy', p_item);
  return v_coins - v_item.coin;
end;
$$;
revoke execute on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;

-- ---------- เช็กอินรายวัน ----------
create function public.claim_checkin()
returns table (reward int, streak int, coins int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_today date := public.bkk_today();
  v_p public.profiles;
  v_streak int;
  v_reward int;
  v_rewards int[] := array[20, 30, 40, 50, 60, 80, 150];
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_p from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;
  if v_p.checkin_day = v_today then raise exception 'already_claimed'; end if;
  if v_p.last_game_at is null or (v_p.last_game_at at time zone 'Asia/Bangkok')::date <> v_today then
    raise exception 'play_first';
  end if;
  v_streak := case when v_p.checkin_day = v_today - 1 then v_p.checkin_streak % 7 + 1 else 1 end;
  v_reward := v_rewards[v_streak];
  update public.profiles p
     set coins = p.coins + v_reward, checkin_day = v_today, checkin_streak = v_streak
   where p.id = v_uid;
  insert into public.coin_ledger (user_id, amount, reason) values (v_uid, v_reward, 'checkin');
  return query select v_reward, v_streak, v_p.coins + v_reward;
end;
$$;
revoke execute on function public.claim_checkin() from public, anon;
grant execute on function public.claim_checkin() to authenticated;

-- ---------- สถานะร้าน + เช็กอิน (หน้าแรก/ร้านค้าเรียกครั้งเดียว) ----------
create function public.shop_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.bkk_today();
  v_p public.profiles;
  v_period int := public.shop_period();
  v_next int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_p from public.profiles where id = v_uid;
  if not found then raise exception 'profile_required'; end if;
  v_next := case when v_p.checkin_day = v_today - 1 or v_p.checkin_day = v_today then v_p.checkin_streak % 7 + 1 else 1 end;
  return jsonb_build_object(
    'coins', v_p.coins,
    'owned', coalesce((select jsonb_agg(item_id) from public.owned_items where user_id = v_uid), '[]'::jsonb),
    'rotation', (select jsonb_agg(r) from public.shop_rotation(v_period) r),
    -- รอบถัดไปเริ่มเที่ยงคืนเวลาไทย
    'rotation_ends_at', ((date '1970-01-01' + (v_period + 1) * 3)::timestamp at time zone 'Asia/Bangkok'),
    'checkin', jsonb_build_object(
      'claimed_today', v_p.checkin_day = v_today,
      'played_today', v_p.last_game_at is not null and (v_p.last_game_at at time zone 'Asia/Bangkok')::date = v_today,
      -- วันที่ของรอบ 7 วันที่จะได้ครั้งถัดไป (ถ้ารับวันนี้แล้ว = ของวันนี้)
      'streak', case when v_p.checkin_day = v_today then v_p.checkin_streak else v_next end,
      'rewards', jsonb_build_array(20, 30, 40, 50, 60, 80, 150)
    ),
    'play_coins_today', (select coalesce(sum(amount), 0) from public.coin_ledger
                          where user_id = v_uid and reason = 'play'
                            and created_at >= (v_today::timestamp at time zone 'Asia/Bangkok')),
    'play_cap', 500
  );
end;
$$;
revoke execute on function public.shop_state() from public, anon;
grant execute on function public.shop_state() to authenticated;
