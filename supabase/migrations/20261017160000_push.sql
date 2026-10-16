-- =========================================================
-- สเต็ป 27.1: แจ้งเตือน Web Push
--   เรื่องที่แจ้ง (ปิดเองได้ทีละเรื่อง): การบ้านใกล้ครบกำหนด (24 ชม.), นับถอยหลังวันสอบ 100/30/7/1 วัน,
--   สมุดข้อผิดถึงรอบ (18:00), ผลลีกแคลน (จันทร์), สรุปเชียร์จากเพื่อน (19:00)
--   ห้ามรบกวน 21:00-07:00 เวลาไทย และไม่เกินวันละ 2 ครั้ง (เรียงความสำคัญตามลำดับข้างบน)
--   Edge Function push-send ถูกเรียกทุกชั่วโมงโดย pg_cron (รหัสลับใน Vault ชื่อ push_cron_secret)
-- =========================================================

create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  lang text not null default 'th' check (lang in ('th', 'en')),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "Users read their own push subscriptions" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

create table public.notif_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  homework boolean not null default true,
  countdown boolean not null default true,
  mistakes boolean not null default true,
  league boolean not null default true,
  cheers boolean not null default true
);
alter table public.notif_prefs enable row level security;
create policy "Users read their own notification prefs" on public.notif_prefs for select to authenticated using (user_id = auth.uid());

-- ที่ส่งไปแล้ว (กันส่งซ้ำ + นับเพดานรายวัน)
create table public.notif_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('homework', 'countdown', 'mistakes', 'league', 'cheers', 'test')),
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
create index notif_log_day_idx on public.notif_log (user_id, sent_at);
alter table public.notif_log enable row level security;

-- ---------- หน้าเว็บ ----------
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lang = 'en' then 'en' else 'th' end)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang;
  insert into public.notif_prefs (user_id) values (auth.uid()) on conflict do nothing;
end;
$$;

create function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create function public.my_notif_prefs()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'devices', (select count(*) from public.push_subscriptions where user_id = auth.uid()),
    'homework', coalesce(p.homework, true), 'countdown', coalesce(p.countdown, true), 'mistakes', coalesce(p.mistakes, true),
    'league', coalesce(p.league, true), 'cheers', coalesce(p.cheers, true))
  from (select 1) x left join public.notif_prefs p on p.user_id = auth.uid();
$$;

create function public.set_notif_prefs(p_homework boolean, p_countdown boolean, p_mistakes boolean, p_league boolean, p_cheers boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.notif_prefs (user_id, homework, countdown, mistakes, league, cheers)
  values (auth.uid(), p_homework, p_countdown, p_mistakes, p_league, p_cheers)
  on conflict (user_id) do update set homework = excluded.homework, countdown = excluded.countdown,
    mistakes = excluded.mistakes, league = excluded.league, cheers = excluded.cheers;
$$;

grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.my_notif_prefs() to authenticated;
grant execute on function public.set_notif_prefs(boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ---------- รายการที่ควรแจ้งตอนนี้ (ยกเว้นนับถอยหลัง ซึ่ง Edge Function คิดจากตารางสอบเอง) ----------
-- priority: 1 การบ้าน, 2 นับถอยหลัง, 3 สมุดข้อผิด, 4 ลีก, 5 เชียร์
create function public.push_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, ref text, priority int, data jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamp := p_now at time zone 'Asia/Bangkok';
  v_hour int := extract(hour from v_now);
  v_day text := to_char(v_now, 'YYYY-MM-DD');
begin
  if v_hour < 7 or v_hour >= 21 then return; end if;

  return query
  with subs as (
    select distinct s.user_id, coalesce(p.homework, true) homework, coalesce(p.mistakes, true) mistakes,
           coalesce(p.league, true) league, coalesce(p.cheers, true) cheers
      from public.push_subscriptions s left join public.notif_prefs p on p.user_id = s.user_id
  )
  -- การบ้านครบกำหนดภายใน 24 ชม. ที่ยังไม่ส่ง
  select s.user_id, 'homework'::text, h.id::text, 1,
         jsonb_build_object('title', h.title, 'class', c.name, 'dueAt', h.due_at)
    from subs s
    join public.classroom_members m on m.user_id = s.user_id
    join public.homework h on h.classroom_id = m.classroom_id and h.due_at > p_now and h.due_at <= p_now + interval '24 hours'
    join public.classrooms c on c.id = h.classroom_id
   where s.homework
     and not exists (select 1 from public.quiz_plays q where q.set_id = h.set_id and q.user_id = s.user_id and q.finished_at is not null)
  union all
  -- สมุดข้อผิดถึงรอบ (ตั้งแต่ 18:00)
  select s.user_id, 'mistakes', v_day, 3, jsonb_build_object('due', d.n)
    from subs s
    cross join lateral (select count(*) n from public.mistake_cards mc
                         where mc.user_id = s.user_id and mc.graduated_at is null and mc.due_at <= p_now) d
   where s.mistakes and v_hour >= 18 and d.n > 0
  union all
  -- ผลลีกสัปดาห์ที่แล้ว (จันทร์ ตั้งแต่ 08:00)
  select s.user_id, 'league', r.week::text, 4,
         jsonb_build_object('rank', r.rank, 'move', r.move, 'tier', r.tier, 'coins', w.coins)
    from subs s
    join public.clan_members cm on cm.user_id = s.user_id
    join public.league_results r on r.clan_id = cm.clan_id and r.week = public.league_week(p_now) - 7
    left join public.league_rewards w on w.week = r.week and w.user_id = s.user_id
   where s.league and extract(isodow from v_now) = 1 and v_hour >= 8 and r.rank is not null
  union all
  -- สรุปเชียร์จากเพื่อนในแคลน 24 ชม. ล่าสุด (ตั้งแต่ 19:00)
  select s.user_id, 'cheers', v_day, 5, jsonb_build_object('count', f.n)
    from subs s
    join public.clan_members cm on cm.user_id = s.user_id
    cross join lateral (select count(*) n from public.clan_feed cf
                         where cf.clan_id = cm.clan_id and cf.kind = 'cheer' and cf.user_id <> s.user_id
                           and cf.created_at > p_now - interval '24 hours') f
   where s.cheers and v_hour >= 19 and f.n > 0;
end;
$$;
revoke execute on function public.push_due(timestamptz) from public, anon, authenticated;

-- ส่งไปแล้ววันนี้กี่ครั้ง (ไม่นับข้อความทดสอบ)
create function public.push_sent_today(p_users uuid[])
returns table (user_id uuid, n int)
language sql stable security definer set search_path = '' as $$
  select l.user_id, count(*)::int from public.notif_log l
   where l.user_id = any (p_users) and l.kind <> 'test'
     and l.sent_at >= ((now() at time zone 'Asia/Bangkok')::date::timestamp at time zone 'Asia/Bangkok')
   group by l.user_id;
$$;
revoke execute on function public.push_sent_today(uuid[]) from public, anon, authenticated;

-- ---------- ตั้งเวลา: ทุกชั่วโมงที่นาที 2 ----------
select cron.schedule(
  'push-send-hourly',
  '2 * * * *',
  $$
  select net.http_post(
    url := 'https://eggofsxenrutwjmhzkvr.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
