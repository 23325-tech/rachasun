-- =========================================================
-- สเต็ป 24.2: AI ติวเตอร์ (คำใบ้ทีละขั้น -> วิธีทำเต็ม)
--   โควตาต่อวัน (เวลาไทย): สมาชิก แชท 30 / รูป 5, ผู้เล่นไม่สมัคร แชท 15 / รูป 2
--   นับฝั่งเซิร์ฟเวอร์เท่านั้น (Edge Function ai-tutor เรียก tutor_consume ด้วย service role)
-- =========================================================

create table public.tutor_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  chats int not null default 0,
  photos int not null default 0,
  primary key (user_id, day)
);
alter table public.tutor_usage enable row level security;
create policy "Users read their own tutor usage" on public.tutor_usage for select to authenticated using (user_id = auth.uid());

create function public.tutor_limit(p_kind text, p_guest boolean)
returns int language sql immutable set search_path = '' as $$
  select case when p_kind = 'photo' then (case when p_guest then 2 else 5 end)
              else (case when p_guest then 15 else 30 end) end;
$$;

-- ใช้โควตา 1 ครั้ง (p_delta = -1 คืนโควตาเมื่อ AI ตอบไม่สำเร็จ) คืน {ok, used, limit}
create function public.tutor_consume(p_user uuid, p_kind text, p_guest boolean, p_delta int default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Bangkok')::date;
  v_limit int := public.tutor_limit(p_kind, p_guest);
  v_used int;
begin
  if p_kind not in ('chat', 'photo') then
    raise exception 'bad kind';
  end if;
  insert into public.tutor_usage (user_id, day) values (p_user, v_day) on conflict do nothing;
  select case when p_kind = 'chat' then chats else photos end into v_used
    from public.tutor_usage where user_id = p_user and day = v_day for update;
  if p_delta > 0 and v_used >= v_limit then
    return jsonb_build_object('ok', false, 'used', v_used, 'limit', v_limit);
  end if;
  v_used := greatest(0, v_used + p_delta);
  if p_kind = 'chat' then
    update public.tutor_usage set chats = v_used where user_id = p_user and day = v_day;
  else
    update public.tutor_usage set photos = v_used where user_id = p_user and day = v_day;
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'limit', v_limit);
end;
$$;
revoke execute on function public.tutor_consume(uuid, text, boolean, int) from public, anon, authenticated;

-- โควตาที่เหลือวันนี้ของตัวเอง
create function public.tutor_quota()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'chatUsed', coalesce(u.chats, 0),
    'chatLimit', public.tutor_limit('chat', g.guest),
    'photoUsed', coalesce(u.photos, 0),
    'photoLimit', public.tutor_limit('photo', g.guest))
  from (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) guest) g
  left join public.tutor_usage u on u.user_id = auth.uid() and u.day = (now() at time zone 'Asia/Bangkok')::date;
$$;
grant execute on function public.tutor_quota() to authenticated;
