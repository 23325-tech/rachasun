-- =========================================================
-- สเต็ป 26.3: ลีกแคลนรายสัปดาห์
--   คะแนนสมาชิก = XP ที่ได้ในสัปดาห์ (ทุกโหมด นับหลังเข้าแคลนเท่านั้น) / คะแนนแคลน = รวม 20 คนที่ได้มากสุด
--   5 ชั้น บรอนซ์ ซิลเวอร์ โกลด์ แพลทินัม เพชร แต่ละชั้นแบ่งกลุ่มละไม่เกิน 20 แคลน
--   ทุกวันจันทร์ (เวลาไทย): อันดับ 1-4 เลื่อนขึ้น อันดับ 17-20 ตกชั้น แคลนที่ได้ 0 คะแนนไม่ถูกจัดอันดับ
--   รางวัล (เฉพาะสมาชิกที่ได้ XP ในสัปดาห์นั้น): อันดับ 1 = 300, 2-4 = 200, 5-10 = 100, ที่เหลือ = 50
--   คูณตามชั้น: บรอนซ์ x1 ซิลเวอร์ x1.25 โกลด์ x1.5 แพลทินัม x1.75 เพชร x2
-- =========================================================

-- ---------- บัญชี XP (ทุกครั้งที่ XP เพิ่ม ไม่ว่าจากโหมดไหน) ----------
create table public.xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index xp_ledger_user_idx on public.xp_ledger (user_id, created_at);
alter table public.xp_ledger enable row level security;
create policy "Users read their own xp history" on public.xp_ledger for select to authenticated using (user_id = auth.uid());

create function public.log_xp_gain()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.xp_ledger (user_id, amount) values (new.id, new.xp - old.xp);
  return new;
end;
$$;
create trigger profiles_log_xp after update of xp on public.profiles
  for each row when (new.xp > old.xp) execute function public.log_xp_gain();

-- ---------- เหรียญจากลีก ----------
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.coin_ledger'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reason%';
  execute format('alter table public.coin_ledger drop constraint %I', c);
end $$;
alter table public.coin_ledger add constraint coin_ledger_reason_check
  check (reason in ('play', 'checkin', 'buy', 'season', 'gacha', 'league'));

-- ---------- ตาราง ----------
create table public.clan_league (
  clan_id uuid primary key references public.clans (id) on delete cascade,
  tier smallint not null default 1 check (tier between 1 and 5)
);

-- กลุ่มของแต่ละแคลนในแต่ละสัปดาห์ (week = วันจันทร์ เวลาไทย)
create table public.league_groups (
  week date not null,
  clan_id uuid not null references public.clans (id) on delete cascade,
  tier smallint not null,
  group_no int not null,
  primary key (week, clan_id)
);
create index league_groups_group_idx on public.league_groups (week, tier, group_no);

create table public.league_results (
  week date not null,
  clan_id uuid not null references public.clans (id) on delete cascade,
  tier smallint not null,
  group_no int not null,
  -- null = 0 คะแนน ไม่ถูกจัดอันดับ
  rank int,
  score int not null,
  move smallint not null default 0 check (move in (-1, 0, 1)),
  primary key (week, clan_id)
);

create table public.league_rewards (
  week date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  clan_id uuid references public.clans (id) on delete set null,
  tier smallint not null,
  rank int not null,
  coins int not null,
  seen boolean not null default false,
  primary key (week, user_id)
);

alter table public.clan_league enable row level security;
alter table public.league_groups enable row level security;
alter table public.league_results enable row level security;
alter table public.league_rewards enable row level security;
create policy "Anyone signed in reads league tiers" on public.clan_league for select to authenticated using (true);
create policy "Anyone signed in reads league groups" on public.league_groups for select to authenticated using (true);
create policy "Anyone signed in reads league results" on public.league_results for select to authenticated using (true);
create policy "Users read their own league rewards" on public.league_rewards for select to authenticated using (user_id = auth.uid());

-- ---------- เวลา ----------
-- วันจันทร์ของสัปดาห์ (เวลาไทย)
create function public.league_week(p_at timestamptz default now())
returns date language sql stable set search_path = '' as $$
  select date_trunc('week', p_at at time zone 'Asia/Bangkok')::date;
$$;
create function public.league_week_from(p_week date)
returns timestamptz language sql immutable set search_path = '' as $$
  select p_week::timestamp at time zone 'Asia/Bangkok';
$$;

-- ---------- คะแนน ----------
-- XP ของสมาชิกในสัปดาห์ นับตั้งแต่เข้าแคลน
create function public.member_week_xp(p_user uuid, p_joined timestamptz, p_week date)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::int from public.xp_ledger
   where user_id = p_user
     and created_at >= greatest(public.league_week_from(p_week), p_joined)
     and created_at < public.league_week_from(p_week) + interval '7 days';
$$;

create function public.clan_week_score(p_clan uuid, p_week date)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(x), 0)::int from (
    select public.member_week_xp(m.user_id, m.joined_at, p_week) x
      from public.clan_members m where m.clan_id = p_clan
     order by 1 desc limit 20
  ) t;
$$;

-- ---------- จัดกลุ่ม ----------
-- ใส่แคลนลงกลุ่มของสัปดาห์นั้น (กลุ่มที่ยังไม่เต็มในชั้นของตัวเอง ไม่มีก็เปิดกลุ่มใหม่)
create function public.league_assign(p_clan uuid, p_week date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tier smallint;
  v_group int;
begin
  if exists (select 1 from public.league_groups where week = p_week and clan_id = p_clan) then return; end if;
  perform pg_advisory_xact_lock(hashtext('league:' || p_week));
  if exists (select 1 from public.league_groups where week = p_week and clan_id = p_clan) then return; end if;
  insert into public.clan_league (clan_id) values (p_clan) on conflict do nothing;
  select tier into v_tier from public.clan_league where clan_id = p_clan;
  select group_no into v_group from public.league_groups
   where week = p_week and tier = v_tier group by group_no having count(*) < 20 order by group_no limit 1;
  if v_group is null then
    select coalesce(max(group_no), 0) + 1 into v_group from public.league_groups where week = p_week and tier = v_tier;
  end if;
  insert into public.league_groups (week, clan_id, tier, group_no) values (p_week, p_clan, v_tier, v_group);
end;
$$;
revoke execute on function public.league_assign(uuid, date) from public, anon, authenticated;

-- ---------- ปิดสัปดาห์ (ทำซ้ำได้ ไม่จ่ายซ้ำ) ----------
create function public.league_close_week(p_week date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  c record;
  m record;
  v_rank int;
  v_size int;
  v_move smallint;
  v_coins int;
  v_closed int := 0;
begin
  if p_week >= public.league_week() then raise exception 'week_not_over'; end if;
  perform pg_advisory_xact_lock(hashtext('league-close:' || p_week));
  if exists (select 1 from public.league_results where week = p_week) then return 0; end if;

  -- แคลนที่ยังไม่ถูกจัดกลุ่มในสัปดาห์นั้น (ไม่มีใครเปิดดูลีกเลย) ก็ต้องได้แข่ง
  for c in select id from public.clans where created_at < public.league_week_from(p_week) + interval '7 days' loop
    perform public.league_assign(c.id, p_week);
  end loop;

  for g in select distinct tier, group_no from public.league_groups where week = p_week loop
    v_rank := 0;
    select count(*) into v_size from public.league_groups where week = p_week and tier = g.tier and group_no = g.group_no;
    for c in
      select lg.clan_id, public.clan_week_score(lg.clan_id, p_week) score, cl.created_at
        from public.league_groups lg join public.clans cl on cl.id = lg.clan_id
       where lg.week = p_week and lg.tier = g.tier and lg.group_no = g.group_no
       order by 2 desc, cl.created_at
    loop
      if c.score <= 0 then
        insert into public.league_results (week, clan_id, tier, group_no, rank, score, move) values (p_week, c.clan_id, g.tier, g.group_no, null, 0, 0);
        continue;
      end if;
      v_rank := v_rank + 1;
      v_move := case when v_rank <= 4 and g.tier < 5 then 1 when v_rank between 17 and 20 and g.tier > 1 then -1 else 0 end;
      insert into public.league_results (week, clan_id, tier, group_no, rank, score, move) values (p_week, c.clan_id, g.tier, g.group_no, v_rank, c.score, v_move);
      if v_move <> 0 then
        update public.clan_league set tier = tier + v_move where clan_id = c.clan_id;
      end if;
      v_coins := round((case when v_rank = 1 then 300 when v_rank <= 4 then 200 when v_rank <= 10 then 100 else 50 end)
                       * (1 + (g.tier - 1) * 0.25));
      for m in select user_id, joined_at from public.clan_members where clan_id = c.clan_id loop
        if public.member_week_xp(m.user_id, m.joined_at, p_week) > 0 then
          insert into public.league_rewards (week, user_id, clan_id, tier, rank, coins) values (p_week, m.user_id, c.clan_id, g.tier, v_rank, v_coins)
          on conflict do nothing;
          if found then
            update public.profiles set coins = coins + v_coins where id = m.user_id;
            insert into public.coin_ledger (user_id, amount, reason) values (m.user_id, v_coins, 'league');
          end if;
        end if;
      end loop;
    end loop;
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end;
$$;
revoke execute on function public.league_close_week(date) from public, anon, authenticated;

create function public.league_close_due()
returns void language sql security definer set search_path = '' as $$
  select public.league_close_week(public.league_week() - 7);
$$;
revoke execute on function public.league_close_due() from public, anon, authenticated;
select cron.schedule('league-close', '*/15 * * * *', $$select public.league_close_due()$$);

-- ---------- หน้าลีกของแคลนฉัน ----------
create function public.league_view()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clan uuid;
  v_week date := public.league_week();
  v_g public.league_groups;
begin
  select clan_id into v_clan from public.clan_members where user_id = auth.uid();
  if v_clan is null then return null; end if;
  perform public.league_assign(v_clan, v_week);
  select * into v_g from public.league_groups where week = v_week and clan_id = v_clan;
  return jsonb_build_object(
    'week', v_week,
    'endsAt', public.league_week_from(v_week) + interval '7 days',
    'tier', v_g.tier,
    'groupNo', v_g.group_no,
    'myClanId', v_clan,
    'standings', (select jsonb_agg(jsonb_build_object('clanId', s.clan_id, 'name', s.name, 'emblem', s.emblem, 'members', s.members, 'score', s.score)
                                   order by s.score desc, s.created_at)
                    from (select lg.clan_id, c.name, c.emblem, c.created_at,
                                 (select count(*) from public.clan_members x where x.clan_id = lg.clan_id) members,
                                 public.clan_week_score(lg.clan_id, v_week) score
                            from public.league_groups lg join public.clans c on c.id = lg.clan_id
                           where lg.week = v_week and lg.tier = v_g.tier and lg.group_no = v_g.group_no) s),
    'contributors', (select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'avatar', p.avatar, 'xp', s.xp, 'isMe', s.user_id = auth.uid())
                                      order by s.xp desc, p.nickname)
                       from (select m.user_id, public.member_week_xp(m.user_id, m.joined_at, v_week) xp
                               from public.clan_members m where m.clan_id = v_clan) s
                       join public.profiles p on p.id = s.user_id),
    'lastResult', (select jsonb_build_object('week', r.week, 'tier', r.tier, 'rank', r.rank, 'score', r.score, 'move', r.move)
                     from public.league_results r where r.clan_id = v_clan order by r.week desc limit 1),
    'reward', (select jsonb_build_object('week', w.week, 'coins', w.coins, 'rank', w.rank, 'tier', w.tier)
                 from public.league_rewards w where w.user_id = auth.uid() and not w.seen order by w.week desc limit 1)
  );
end;
$$;

create function public.league_reward_seen(p_week date)
returns void language sql security definer set search_path = '' as $$
  update public.league_rewards set seen = true where user_id = auth.uid() and week = p_week;
$$;

grant execute on function public.league_view() to authenticated;
grant execute on function public.league_reward_seen(date) to authenticated;
