-- =========================================================
-- สเต็ป 17.2: เพชร (เงินจริง) ผ่าน Omise พร้อมเพย์
--   แพ็ก 29฿=30 / 59฿=65 / 99฿=115 / 149฿=180 เพชร
--   เติมได้เฉพาะสมาชิก (ไม่ใช่แขก) · เพิ่มเพชรเฉพาะเมื่อเซิร์ฟเวอร์ยืนยันกับ Omise ว่าจ่ายสำเร็จ (ซ้ำไม่ได้)
-- =========================================================

alter table public.profiles add column gems int not null default 0 check (gems >= 0);

create table public.gem_packs (
  id text primary key,
  price_thb int not null check (price_thb > 0),
  gems int not null check (gems > 0),
  sort int not null
);
alter table public.gem_packs enable row level security;
create policy "Gem packs are public" on public.gem_packs for select to anon, authenticated using (true);
insert into public.gem_packs (id, price_thb, gems, sort) values
  ('p29', 29, 30, 1),
  ('p59', 59, 65, 2),
  ('p99', 99, 115, 3),
  ('p149', 149, 180, 4);

-- การชำระเงินแต่ละครั้ง (Edge Function เขียน หน้าเว็บอ่านของตัวเองได้)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id text not null references public.gem_packs (id),
  amount_thb int not null,
  gems int not null,
  method text not null default 'promptpay',
  charge_id text unique,
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_user_idx on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
create policy "Users read their own payments" on public.payments for select to authenticated using (user_id = auth.uid());

create table public.gem_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('topup', 'buy')),
  item_id text references public.wardrobe_items (id),
  payment_id uuid references public.payments (id),
  created_at timestamptz not null default now()
);
create index gem_ledger_user_idx on public.gem_ledger (user_id, created_at desc);
alter table public.gem_ledger enable row level security;
create policy "Users read their own gem history" on public.gem_ledger for select to authenticated using (user_id = auth.uid());

-- เซิร์ฟเวอร์ยืนยันผลจาก Omise แล้ว: บันทึกสถานะ + เพิ่มเพชร (เรียกซ้ำได้ เพิ่มเพชรครั้งเดียว)
create function public.settle_payment(p_charge_id text, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments where charge_id = p_charge_id for update;
  if not found then
    return 'unknown';
  end if;
  if v_pay.status <> 'pending' then
    return v_pay.status;
  end if;
  if p_status = 'successful' then
    update public.payments set status = 'successful', paid_at = now() where id = v_pay.id;
    update public.profiles set gems = gems + v_pay.gems where id = v_pay.user_id;
    insert into public.gem_ledger (user_id, amount, reason, payment_id) values (v_pay.user_id, v_pay.gems, 'topup', v_pay.id);
    return 'successful';
  elsif p_status in ('failed', 'expired', 'reversed') then
    update public.payments set status = case when p_status = 'expired' then 'expired' else 'failed' end where id = v_pay.id;
    return 'failed';
  end if;
  return 'pending';
end;
$$;
revoke execute on function public.settle_payment(text, text) from public, anon, authenticated;
grant execute on function public.settle_payment(text, text) to service_role;

-- ซื้อของ: ของเหรียญเหมือนเดิม / ของเพชรใช้เพชร (ของเพชรขายตลอด หรือเฉพาะในรอบหมุนเวียนถ้าหายาก)
create or replace function public.buy_item(p_item text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.wardrobe_items;
  v_p public.profiles;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_item from public.wardrobe_items where id = p_item;
  if not found then raise exception 'item_not_found'; end if;
  if v_item.coin is null and v_item.gem is null then raise exception 'free_item'; end if;
  if exists (select 1 from public.owned_items where user_id = v_uid and item_id = p_item) then
    raise exception 'already_owned';
  end if;
  if v_item.rarity <> 'common' and not exists (select 1 from public.shop_rotation() r where r = p_item) then
    raise exception 'not_in_shop';
  end if;

  select * into v_p from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;

  if v_item.gem is not null then
    if v_p.gems < v_item.gem then raise exception 'not_enough_gems'; end if;
    update public.profiles set gems = gems - v_item.gem where id = v_uid;
    insert into public.owned_items (user_id, item_id) values (v_uid, p_item);
    insert into public.gem_ledger (user_id, amount, reason, item_id) values (v_uid, -v_item.gem, 'buy', p_item);
    return v_p.coins;
  end if;

  if v_p.coins < v_item.coin then raise exception 'not_enough_coins'; end if;
  update public.profiles set coins = coins - v_item.coin where id = v_uid;
  insert into public.owned_items (user_id, item_id) values (v_uid, p_item);
  insert into public.coin_ledger (user_id, amount, reason, item_id) values (v_uid, -v_item.coin, 'buy', p_item);
  return v_p.coins - v_item.coin;
end;
$$;

-- ร้าน: ส่งยอดเพชร + แพ็กเพชรด้วย
create or replace function public.shop_state()
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
    'gems', v_p.gems,
    'packs', (select jsonb_agg(jsonb_build_object('id', g.id, 'price', g.price_thb, 'gems', g.gems) order by g.sort) from public.gem_packs g),
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
