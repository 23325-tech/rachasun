-- =========================================================
-- สเต็ป 19.1: ฤดูกาลแรงค์
--   ฤดูกาลละ 2 เดือน (ฤดูกาล 1 เริ่ม 16 ต.ค. 2026 เวลาไทย)
--   จบฤดูกาล: ได้เหรียญ + กรอบตามยศสูงสุดในฤดูกาล (ต้องเล่นสุ่มหาคู่ ≥ 5 เกม) แล้ว RP เหลือครึ่งหนึ่ง
--   อันดับฤดูกาล: Top 100 ตาม RP ปัจจุบัน (เฉพาะคนที่เล่นในฤดูกาลนี้แล้ว)
-- =========================================================

create table public.seasons (
  no int primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz
);
alter table public.seasons enable row level security;
create policy "Seasons are public" on public.seasons for select to anon, authenticated using (true);

insert into public.seasons (no, starts_at, ends_at)
values (1, '2026-10-16 00:00:00+07', '2026-12-16 00:00:00+07');

-- สถิติในฤดูกาลปัจจุบัน (หน้าเว็บอ่านได้ แก้ไม่ได้)
alter table public.profiles
  add column season_peak_rp int not null default 0,
  add column season_games int not null default 0;
update public.profiles set season_peak_rp = rp;

-- รางวัลฤดูกาล (กรอบสะสม + เหรียญที่ได้)
create table public.season_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  season_no int not null references public.seasons (no),
  peak_rp int not null,
  tier text not null,
  coins int not null,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, season_no)
);
alter table public.season_rewards enable row level security;
create policy "Users read their own season rewards" on public.season_rewards for select to authenticated using (user_id = auth.uid());

alter table public.coin_ledger drop constraint coin_ledger_reason_check;
alter table public.coin_ledger add constraint coin_ledger_reason_check check (reason in ('play', 'checkin', 'buy', 'season'));

-- ยศจาก RP (ตรงกับ supabase/functions/_shared/rank.ts)
create function public.tier_of(p_rp int)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_rp >= 2000 then 'legend'
    when p_rp >= 1400 then 'diamond'
    when p_rp >= 900 then 'platinum'
    when p_rp >= 500 then 'gold'
    when p_rp >= 200 then 'silver'
    else 'bronze'
  end;
$$;

create function public.season_coins(p_tier text)
returns int language sql immutable set search_path = '' as $$
  select case p_tier
    when 'legend' then 1500
    when 'diamond' then 1000
    when 'platinum' then 700
    when 'gold' then 400
    when 'silver' then 200
    else 100
  end;
$$;

-- RP จากห้องสุ่มหาคู่: นับเกมในฤดูกาล + จำ RP สูงสุด
create or replace function public.apply_rank_points(p_user uuid, p_delta int)
returns table (rp_delta int, rp_total int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_old int;
begin
  select rp into v_old from public.profiles where id = p_user for update;
  if not found then
    return;
  end if;
  return query
  update public.profiles p
     set rp = greatest(0, p.rp + p_delta),
         season_peak_rp = greatest(p.season_peak_rp, greatest(0, p.rp + p_delta)),
         season_games = p.season_games + 1
   where p.id = p_user
  returning p.rp - v_old, p.rp;
end;
$$;

-- ปิดฤดูกาลที่ครบเวลาแล้ว (cron เรียกทุก 15 นาที ปิดซ้ำไม่ได้)
create function public.close_due_seasons()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons;
  v_closed int := 0;
begin
  loop
    select * into v_season from public.seasons
     where closed_at is null and ends_at <= now()
     order by no limit 1
     for update skip locked;
    exit when not found;

    -- รางวัล: เล่นครบ 5 เกม
    insert into public.season_rewards (user_id, season_no, peak_rp, tier, coins)
    select p.id, v_season.no, p.season_peak_rp, public.tier_of(p.season_peak_rp), public.season_coins(public.tier_of(p.season_peak_rp))
      from public.profiles p
     where p.season_games >= 5
    on conflict do nothing;

    insert into public.coin_ledger (user_id, amount, reason)
    select r.user_id, r.coins, 'season' from public.season_rewards r where r.season_no = v_season.no;

    update public.profiles p
       set coins = p.coins + r.coins
      from public.season_rewards r
     where r.season_no = v_season.no and r.user_id = p.id;

    -- soft reset: RP เหลือครึ่ง เริ่มนับฤดูกาลใหม่
    update public.profiles
       set rp = rp / 2,
           season_peak_rp = rp / 2,
           season_games = 0
     where rp > 0 or season_games > 0 or season_peak_rp > 0;

    update public.seasons set closed_at = now() where no = v_season.no;
    insert into public.seasons (no, starts_at, ends_at)
    values (v_season.no + 1, v_season.ends_at, v_season.ends_at + interval '2 months')
    on conflict do nothing;
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end;
$$;
revoke execute on function public.close_due_seasons() from public, anon, authenticated;

select cron.schedule('season-close', '*/15 * * * *', $$select public.close_due_seasons()$$);

-- ข้อมูลฤดูกาลสำหรับหน้าเว็บ: ฤดูกาลปัจจุบัน + อันดับของเรา + Top 100 + รางวัลที่ยังไม่ได้ดู
create function public.season_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.seasons;
  v_me public.profiles;
  v_rank int;
begin
  select * into v_season from public.seasons where closed_at is null order by no limit 1;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.season_games > 0 then
    select count(*) + 1 into v_rank from public.profiles
     where season_games > 0 and (rp > v_me.rp or (rp = v_me.rp and season_peak_rp > v_me.season_peak_rp));
  end if;
  return jsonb_build_object(
    'no', v_season.no,
    'startsAt', v_season.starts_at,
    'endsAt', v_season.ends_at,
    'me', jsonb_build_object(
      'rp', coalesce(v_me.rp, 0),
      'peakRp', coalesce(v_me.season_peak_rp, 0),
      'games', coalesce(v_me.season_games, 0),
      'rank', v_rank
    ),
    'top', coalesce((
      select jsonb_agg(row_to_json(x) order by x.rp desc, x.peak desc)
        from (
          select p.id, p.nickname, p.tag, p.avatar, p.rp, p.season_peak_rp as peak
            from public.profiles p
           where p.season_games > 0
           order by p.rp desc, p.season_peak_rp desc
           limit 100
        ) x
    ), '[]'::jsonb),
    'unseen', coalesce((
      select jsonb_agg(jsonb_build_object('season', r.season_no, 'tier', r.tier, 'peakRp', r.peak_rp, 'coins', r.coins) order by r.season_no)
        from public.season_rewards r
       where r.user_id = v_uid and not r.seen
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.season_state() to anon, authenticated;
