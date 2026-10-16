-- =========================================================
-- สเต็ป 8.2: กลุ่มเพื่อน + ลีดเดอร์บอร์ดรายวัน/รายสัปดาห์
-- - เข้ากลุ่มด้วยรหัสชวน อยู่ได้สูงสุด 5 กลุ่ม กลุ่มละไม่เกิน 50 คน
-- - โจทย์ประจำวัน 10 ข้อตามวิชา/ความยากของกลุ่ม เล่นได้วันละครั้ง (วันใหม่ = เที่ยงคืนเวลาไทย)
-- - รายสัปดาห์ = ผลรวมคะแนนรายวัน จันทร์-อาทิตย์
-- =========================================================

-- ---------- คำต้องห้าม (ใช้ร่วมกันทั้งชื่อเล่นและชื่อกลุ่ม) ----------
create function public.has_banned_word(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
      from unnest(array[
        'ควย', 'เหี้ย', 'เหี้ยะ', 'สัส', 'สัด', 'ไอสัตว์', 'ไอ้สัตว์', 'หี', 'เย็ด', 'แตด', 'ระยำ', 'อีดอก',
        'ดอกทอง', 'กะหรี่', 'ชิบหาย', 'มึง', 'สันดาน', 'จัญไร', 'เงี่ยน', 'ส้นตีน', 'ตอแหล', 'อีห่า', 'พ่อง',
        'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigger', 'nigga', 'faggot', 'slut',
        'whore', 'porn', 'sex', 'rape', 'nazi', 'hitler', 'asshole', 'bastard', 'admin', 'moderator'
      ]) as bad(word)
     where public.normalize_nickname(p) like '%' || bad.word || '%'
  )
$$;

create or replace function public.is_nickname_allowed(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(trim(p)) between 2 and 16
     and public.normalize_nickname(p) <> ''
     and not public.has_banned_word(p)
$$;

create function public.is_group_name_allowed(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(trim(p)) between 2 and 30
     and public.normalize_nickname(p) <> ''
     and not public.has_banned_word(p)
$$;

-- ---------- ตาราง ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null constraint group_name_allowed check (public.is_group_name_allowed(name)),
  -- { subject, difficulty, track, count: 10 }
  settings jsonb not null check (public.valid_room_settings(settings)),
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- ชุดโจทย์ประจำวันของกลุ่ม (สร้างตอนมีคนกดเล่นคนแรกของวัน โดย Edge Function)
create table public.group_daily (
  group_id uuid not null references public.groups (id) on delete cascade,
  day date not null,
  set_id uuid not null references public.quiz_sets (id) on delete cascade,
  primary key (group_id, day)
);

create function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid())
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_daily enable row level security;

create policy "Members can read their groups" on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy "Members can read group members" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

revoke insert, update, delete on public.groups, public.group_members from anon, authenticated;
revoke all on public.group_daily from anon, authenticated;

-- วันที่ปัจจุบันตามเวลาไทย
create function public.today_th()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Bangkok')::date
$$;

-- ---------- ตรวจโควตา ----------
create function public._check_group_quota()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 5 then
    raise exception 'too_many_groups';
  end if;
end;
$$;
revoke execute on function public._check_group_quota() from public, anon, authenticated;

-- ---------- สร้างกลุ่ม ----------
create function public.create_group(p_name text, p_subject text, p_difficulty text, p_track text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_settings jsonb := jsonb_build_object('subject', p_subject, 'difficulty', p_difficulty, 'track', p_track, 'count', 10);
  v_group public.groups;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_required';
  end if;
  if not public.valid_room_settings(v_settings) then
    raise exception 'invalid_settings';
  end if;
  if not public.is_group_name_allowed(p_name) then
    raise exception 'bad_group_name';
  end if;
  perform public._check_group_quota();

  for i in 1..20 loop
    v_code := '';
    for j in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      insert into public.groups (code, name, settings, owner_id)
      values (v_code, trim(p_name), v_settings, auth.uid())
      returning * into v_group;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid());
  return v_group;
end;
$$;

-- ---------- เข้ากลุ่ม ----------
create function public.join_group(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_required';
  end if;
  select * into v_group from public.groups where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'group_not_found';
  end if;
  if exists (select 1 from public.group_members where group_id = v_group.id and user_id = auth.uid()) then
    return v_group;
  end if;
  if (select count(*) from public.group_members where group_id = v_group.id) >= 50 then
    raise exception 'group_full';
  end if;
  perform public._check_group_quota();
  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid());
  return v_group;
end;
$$;

-- ---------- ออกจากกลุ่ม ----------
create function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  delete from public.group_members where group_id = p_group and user_id = auth.uid();
  if not exists (select 1 from public.group_members where group_id = p_group) then
    delete from public.groups where id = p_group;
    return;
  end if;
  if (select owner_id from public.groups where id = p_group) = auth.uid() then
    select user_id into v_next from public.group_members where group_id = p_group order by joined_at limit 1;
    update public.groups set owner_id = v_next where id = p_group;
  end if;
end;
$$;

-- ---------- กลุ่มของฉัน ----------
create function public.my_groups()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id,
           'code', g.code,
           'name', g.name,
           'settings', g.settings,
           'members', (select count(*) from public.group_members m where m.group_id = g.id),
           'playedToday', exists (
             select 1 from public.group_daily gd
               join public.quiz_plays qp on qp.set_id = gd.set_id
              where gd.group_id = g.id and gd.day = public.today_th()
                and qp.user_id = auth.uid() and qp.finished_at is not null),
           'todayScore', (
             select qp.score from public.group_daily gd
               join public.quiz_plays qp on qp.set_id = gd.set_id
              where gd.group_id = g.id and gd.day = public.today_th() and qp.user_id = auth.uid()))
         order by gm.joined_at), '[]'::jsonb)
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
   where gm.user_id = auth.uid()
$$;

-- ---------- ตารางอันดับ ----------
-- p_period: 'day' = วันนี้, 'week' = จันทร์ถึงวันนี้ (เวลาไทย)
create function public.group_board(p_group uuid, p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_result jsonb;
begin
  if not public.is_group_member(p_group) then
    raise exception 'not_member';
  end if;
  v_from := case when p_period = 'week' then date_trunc('week', public.today_th())::date else public.today_th() end;

  select jsonb_build_object(
    'group', jsonb_build_object('id', g.id, 'code', g.code, 'name', g.name, 'settings', g.settings,
                                'isOwner', g.owner_id = auth.uid()),
    'period', p_period,
    'from', v_from,
    'today', public.today_th(),
    'rows', coalesce((
      select jsonb_agg(r order by (r ->> 'score')::int desc, (r ->> 'played')::int desc, r ->> 'nickname')
        from (
          select jsonb_build_object(
                   'nickname', p.nickname, 'tag', p.tag, 'avatar', p.avatar,
                   'isMe', m.user_id = auth.uid(),
                   'score', coalesce(sum(qp.score) filter (where qp.finished_at is not null), 0),
                   'played', count(qp.finished_at)) as r
            from public.group_members m
            join public.profiles p on p.id = m.user_id
            left join public.group_daily gd
                   on gd.group_id = m.group_id and gd.day between v_from and public.today_th()
            left join public.quiz_plays qp on qp.set_id = gd.set_id and qp.user_id = m.user_id
           where m.group_id = p_group
           group by m.user_id, p.nickname, p.tag, p.avatar
        ) s
    ), '[]'::jsonb)
  )
  into v_result
  from public.groups g
  where g.id = p_group;
  return v_result;
end;
$$;

revoke execute on function
  public.create_group(text, text, text, text),
  public.join_group(text),
  public.leave_group(uuid),
  public.my_groups(),
  public.group_board(uuid, text)
from public, anon;
grant execute on function
  public.create_group(text, text, text, text),
  public.join_group(text),
  public.leave_group(uuid),
  public.my_groups(),
  public.group_board(uuid, text)
to authenticated;
