-- =========================================================
-- สเต็ป 27.3: สรุปรายสัปดาห์ถึงผู้ปกครองทาง LINE OA
--   นักเรียนสร้างรหัสเชื่อม (หมดอายุ 24 ชม.) ผู้ปกครองแอด LINE OA แล้วพิมพ์รหัส -> เชื่อมกัน (สูงสุด 3 คน)
--   นักเรียนยกเลิกได้ทุกเมื่อ / ผู้ปกครองพิมพ์ "ยกเลิก" ใน LINE เพื่อหยุดรับ
--   ทุกวันอาทิตย์ 19:00 เวลาไทย Edge Function line-weekly ส่งสรุป (รหัสลับ cron ใน Vault ชื่อ line_cron_secret)
-- =========================================================

create table public.parent_link_codes (
  code text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.parent_link_codes enable row level security;

create table public.parent_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  line_user_id text not null check (line_user_id ~ '^U[0-9a-f]{32}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  unique (user_id, line_user_id)
);
create index parent_links_line_idx on public.parent_links (line_user_id);
alter table public.parent_links enable row level security;
create policy "Students read their own parent links" on public.parent_links for select to authenticated using (user_id = auth.uid());

-- กันส่งสรุปซ้ำในสัปดาห์เดียวกัน
create table public.parent_summary_log (
  week date not null,
  link_id uuid not null references public.parent_links (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (week, link_id)
);
alter table public.parent_summary_log enable row level security;

-- ---------- หน้าเว็บ (นักเรียน) ----------
create function public.create_parent_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  if (select count(*) from public.parent_links where user_id = auth.uid()) >= 3 then raise exception 'too_many_parents'; end if;
  for i in 1..20 loop
    v_code := 'P';
    for j in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.parent_link_codes where code = v_code);
  end loop;
  insert into public.parent_link_codes (code, user_id, expires_at) values (v_code, auth.uid(), now() + interval '24 hours')
  on conflict (user_id) do update set code = excluded.code, expires_at = excluded.expires_at;
  return jsonb_build_object('code', v_code, 'expiresAt', now() + interval '24 hours');
end;
$$;

create function public.my_parent_links()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'links', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', display_name, 'createdAt', created_at) order by created_at)
                         from public.parent_links where user_id = auth.uid()), '[]'::jsonb),
    'code', (select jsonb_build_object('code', code, 'expiresAt', expires_at) from public.parent_link_codes
              where user_id = auth.uid() and expires_at > now()));
$$;

create function public.remove_parent_link(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.parent_links where id = p_id and user_id = auth.uid();
$$;

grant execute on function public.create_parent_code() to authenticated;
grant execute on function public.my_parent_links() to authenticated;
grant execute on function public.remove_parent_link(uuid) to authenticated;

-- ---------- ใช้โดย Edge Function (service role) ----------
-- ผู้ปกครองส่งรหัสมาใน LINE: เชื่อมกับนักเรียน คืนชื่อเล่นนักเรียน (null = รหัสผิด/หมดอายุ/เต็ม)
create function public.claim_parent_code(p_code text, p_line_user text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.parent_link_codes where code = upper(trim(p_code)) and expires_at > now() for update;
  if v_user is null then return null; end if;
  if (select count(*) from public.parent_links where user_id = v_user) >= 3
     and not exists (select 1 from public.parent_links where user_id = v_user and line_user_id = p_line_user) then
    return null;
  end if;
  insert into public.parent_links (user_id, line_user_id, display_name) values (v_user, p_line_user, left(coalesce(p_name, ''), 60))
  on conflict (user_id, line_user_id) do update set display_name = excluded.display_name;
  delete from public.parent_link_codes where user_id = v_user;
  return (select nickname from public.profiles where id = v_user);
end;
$$;
revoke execute on function public.claim_parent_code(text, text, text) from public, anon, authenticated;

-- ข้อมูลสรุปสัปดาห์ (จันทร์-อาทิตย์ เวลาไทย) ของนักเรียนหนึ่งคน
create function public.weekly_summary(p_user uuid, p_week date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select public.league_week_from(p_week) s, public.league_week_from(p_week) + interval '7 days' e,
           public.league_week_from(p_week) - interval '7 days' ps
  ), this_week as (
    select a.* from public.answer_log a, bounds b where a.user_id = p_user and a.created_at >= b.s and a.created_at < b.e
  ), last_week as (
    select a.* from public.answer_log a, bounds b where a.user_id = p_user and a.created_at >= b.ps and a.created_at < b.s
  )
  select jsonb_build_object(
    'nickname', (select nickname from public.profiles where id = p_user),
    'days', (select count(distinct (created_at at time zone 'Asia/Bangkok')::date) from this_week),
    'answers', (select count(*) from this_week),
    'correct', (select count(*) filter (where correct) from this_week),
    'lastAnswers', (select count(*) from last_week),
    'lastCorrect', (select count(*) filter (where correct) from last_week),
    'xp', (select coalesce(sum(x.amount), 0) from public.xp_ledger x, bounds b where x.user_id = p_user and x.created_at >= b.s and x.created_at < b.e),
    'weak', coalesce((select jsonb_agg(jsonb_build_object('chapter', chapter, 'answers', n, 'accuracy', acc) order by acc)
                        from (select chapter, count(*) n, round(count(*) filter (where correct)::numeric / count(*), 2) acc
                                from this_week where chapter is not null group by chapter having count(*) >= 5
                               order by acc limit 3) w), '[]'::jsonb),
    'homeworkDone', (select count(*) from public.homework h join public.classroom_members m on m.classroom_id = h.classroom_id and m.user_id = p_user, bounds b
                      where h.due_at >= b.s and h.due_at < b.e
                        and exists (select 1 from public.quiz_plays q where q.set_id = h.set_id and q.user_id = p_user and q.finished_at is not null)),
    'homeworkTotal', (select count(*) from public.homework h join public.classroom_members m on m.classroom_id = h.classroom_id and m.user_id = p_user, bounds b
                       where h.due_at >= b.s and h.due_at < b.e),
    'mistakesDue', (select count(*) from public.mistake_cards where user_id = p_user and graduated_at is null and due_at <= now())
  );
$$;
revoke execute on function public.weekly_summary(uuid, date) from public, anon, authenticated;

-- นักเรียนดูตัวอย่างสรุปของตัวเอง (สัปดาห์นี้)
create function public.my_weekly_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.weekly_summary(auth.uid(), public.league_week());
$$;
grant execute on function public.my_weekly_summary() to authenticated;

-- ---------- ตั้งเวลา: อาทิตย์ 19:00 เวลาไทย = 12:00 UTC ----------
select cron.schedule(
  'line-weekly',
  '0 12 * * 0',
  $$
  select net.http_post(
    url := 'https://eggofsxenrutwjmhzkvr.supabase.co/functions/v1/line-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'line_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
