-- =========================================================
-- สเต็ป 26.1: แคลน (รับสมาชิกจากที่ไหนก็ได้ ไม่ผูกโรงเรียน)
--   อยู่ได้คนละ 1 แคลน แคลนละไม่เกิน 30 คน บทบาท: หัวหน้า / รอง / สมาชิก
--   ไม่มีแชทพิมพ์อิสระ: ส่งได้แค่ข้อความสำเร็จรูป (เชียร์) + บันทึกกิจกรรมของแคลน
-- =========================================================

create table public.clans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null constraint clan_name_allowed check (public.is_group_name_allowed(name)),
  -- <ไอคอน>.<สี> เช่น shield.purple
  emblem text not null default 'shield.purple' check (emblem ~ '^(shield|sword|lightning|flame|crown|star|rocket|atom|brain|planet|book|trophy)\.(purple|blue|teal|green|yellow|orange|red|pink)$'),
  description text not null default '' check (char_length(description) <= 120 and not public.has_banned_word(description)),
  -- เปิด = ใครก็กดเข้าได้จากหน้าค้นหา / ปิด = ต้องมีรหัสเชิญ
  open boolean not null default true,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.clan_members (
  clan_id uuid not null references public.clans (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'officer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

create table public.clan_feed (
  id bigint generated always as identity primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  -- cheer = ข้อความสำเร็จรูป, ที่เหลือ = กิจกรรมของระบบ
  kind text not null check (kind in ('cheer', 'create', 'join', 'leave', 'kick', 'role')),
  -- cheer: รหัสข้อความ / role: บทบาทใหม่ / kick: ชื่อคนที่ถูกเชิญออก
  payload text not null default '' check (char_length(payload) <= 40),
  created_at timestamptz not null default now()
);
create index clan_feed_clan_idx on public.clan_feed (clan_id, id desc);

create function public.is_clan_member(p_clan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clan_members where clan_id = p_clan and user_id = auth.uid());
$$;

alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_feed enable row level security;
create policy "Anyone signed in reads clans" on public.clans for select to authenticated using (true);
create policy "Members read their clan roster" on public.clan_members for select to authenticated using (public.is_clan_member(clan_id));
create policy "Members read their clan feed" on public.clan_feed for select to authenticated using (public.is_clan_member(clan_id));

create function public._clan_feed(p_clan uuid, p_user uuid, p_kind text, p_payload text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.clan_feed (clan_id, user_id, kind, payload) values (p_clan, p_user, p_kind, left(coalesce(p_payload, ''), 40));
  -- เก็บแค่ 60 รายการล่าสุด
  delete from public.clan_feed where clan_id = p_clan and id < (
    select min(id) from (select id from public.clan_feed where clan_id = p_clan order by id desc limit 60) k);
end;
$$;
revoke execute on function public._clan_feed(uuid, uuid, text, text) from public, anon, authenticated;

create function public._my_clan_role(out v_clan uuid, out v_role text)
language sql stable security definer set search_path = '' as $$
  select clan_id, role from public.clan_members where user_id = auth.uid();
$$;
revoke execute on function public._my_clan_role() from public, anon, authenticated;

create function public.create_clan(p_name text, p_emblem text, p_description text, p_open boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  if exists (select 1 from public.clan_members where user_id = auth.uid()) then raise exception 'already_in_clan'; end if;
  if not public.is_group_name_allowed(p_name) then raise exception 'bad_clan_name'; end if;
  if public.has_banned_word(coalesce(p_description, '')) then raise exception 'bad_description'; end if;
  for i in 1..20 loop
    v_code := '';
    for j in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.clans where code = v_code);
  end loop;
  insert into public.clans (code, name, emblem, description, open, owner_id)
  values (v_code, trim(p_name), p_emblem, trim(coalesce(p_description, '')), coalesce(p_open, true), auth.uid())
  returning id into v_id;
  insert into public.clan_members (clan_id, user_id, role) values (v_id, auth.uid(), 'leader');
  perform public._clan_feed(v_id, auth.uid(), 'create');
  return v_id;
end;
$$;

-- เข้าด้วยรหัสเชิญ (p_code) หรือกดเข้าแคลนที่เปิดอยู่ (p_clan)
create function public.join_clan(p_code text default null, p_clan uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clan public.clans;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  if p_code is not null then
    select * into v_clan from public.clans where code = upper(trim(p_code)) for update;
  else
    select * into v_clan from public.clans where id = p_clan for update;
    if found and not v_clan.open then raise exception 'clan_closed'; end if;
  end if;
  if v_clan.id is null then raise exception 'clan_not_found'; end if;
  if exists (select 1 from public.clan_members where user_id = auth.uid() and clan_id = v_clan.id) then return v_clan.id; end if;
  if exists (select 1 from public.clan_members where user_id = auth.uid()) then raise exception 'already_in_clan'; end if;
  if (select count(*) from public.clan_members where clan_id = v_clan.id) >= 30 then raise exception 'clan_full'; end if;
  insert into public.clan_members (clan_id, user_id) values (v_clan.id, auth.uid());
  perform public._clan_feed(v_clan.id, auth.uid(), 'join');
  return v_clan.id;
end;
$$;

-- ออกจากแคลน: หัวหน้าออก -> ส่งต่อให้รองที่อยู่นานสุด (ไม่มีก็สมาชิกที่อยู่นานสุด) / คนสุดท้ายออก -> ลบแคลน
create function public.leave_clan()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next uuid;
begin
  select * into r from public._my_clan_role();
  if r.v_clan is null then return; end if;
  delete from public.clan_members where user_id = auth.uid();
  if not exists (select 1 from public.clan_members where clan_id = r.v_clan) then
    delete from public.clans where id = r.v_clan;
    return;
  end if;
  perform public._clan_feed(r.v_clan, auth.uid(), 'leave');
  if r.v_role = 'leader' then
    select user_id into v_next from public.clan_members where clan_id = r.v_clan
     order by (role = 'officer') desc, joined_at limit 1;
    update public.clan_members set role = 'leader' where clan_id = r.v_clan and user_id = v_next;
    update public.clans set owner_id = v_next where id = r.v_clan;
    perform public._clan_feed(r.v_clan, v_next, 'role', 'leader');
  end if;
end;
$$;

-- หัวหน้าเชิญใครออกก็ได้ / รองเชิญได้เฉพาะสมาชิก
create function public.kick_clan_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_target text;
  v_name text;
begin
  select * into r from public._my_clan_role();
  select role into v_target from public.clan_members where clan_id = r.v_clan and user_id = p_user;
  if r.v_clan is null or v_target is null or p_user = auth.uid() then raise exception 'not_allowed'; end if;
  if not (r.v_role = 'leader' or (r.v_role = 'officer' and v_target = 'member')) then raise exception 'not_allowed'; end if;
  select nickname into v_name from public.profiles where id = p_user;
  delete from public.clan_members where clan_id = r.v_clan and user_id = p_user;
  perform public._clan_feed(r.v_clan, auth.uid(), 'kick', coalesce(v_name, ''));
end;
$$;

-- หัวหน้าเท่านั้น: ตั้งรอง / ลดเป็นสมาชิก / ส่งต่อหัวหน้า (ตัวเองกลายเป็นรอง)
create function public.set_clan_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select * into r from public._my_clan_role();
  if r.v_role is distinct from 'leader' or p_user = auth.uid() or p_role not in ('leader', 'officer', 'member')
     or not exists (select 1 from public.clan_members where clan_id = r.v_clan and user_id = p_user) then
    raise exception 'not_allowed';
  end if;
  if p_role = 'leader' then
    update public.clan_members set role = 'officer' where clan_id = r.v_clan and user_id = auth.uid();
    update public.clans set owner_id = p_user where id = r.v_clan;
  end if;
  update public.clan_members set role = p_role where clan_id = r.v_clan and user_id = p_user;
  perform public._clan_feed(r.v_clan, p_user, 'role', p_role);
end;
$$;

-- หัวหน้าแก้ข้อมูลแคลน
create function public.update_clan(p_name text, p_emblem text, p_description text, p_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select * into r from public._my_clan_role();
  if r.v_role is distinct from 'leader' then raise exception 'not_allowed'; end if;
  if not public.is_group_name_allowed(p_name) then raise exception 'bad_clan_name'; end if;
  if public.has_banned_word(coalesce(p_description, '')) then raise exception 'bad_description'; end if;
  update public.clans
     set name = trim(p_name), emblem = p_emblem, description = trim(coalesce(p_description, '')), open = coalesce(p_open, true)
   where id = r.v_clan;
end;
$$;

-- ข้อความสำเร็จรูป (กันสแปม: 1 ครั้งต่อ 20 วินาที)
create function public.clan_cheer(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_key not in ('go', 'push', 'great', 'thanks', 'gg', 'study', 'welcome', 'fire') then raise exception 'bad_cheer'; end if;
  select * into r from public._my_clan_role();
  if r.v_clan is null then raise exception 'not_in_clan'; end if;
  if exists (select 1 from public.clan_feed where clan_id = r.v_clan and user_id = auth.uid() and kind = 'cheer'
              and created_at > now() - interval '20 seconds') then
    raise exception 'too_fast';
  end if;
  perform public._clan_feed(r.v_clan, auth.uid(), 'cheer', p_key);
end;
$$;

-- แคลนของฉัน: ข้อมูล + สมาชิก + กิจกรรมล่าสุด (ไม่มีแคลน = null)
create function public.my_clan()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'code', c.code, 'name', c.name, 'emblem', c.emblem, 'description', c.description, 'open', c.open,
    'myRole', m.role,
    'members', (select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'tag', p.tag, 'avatar', p.avatar,
                                                    'xp', p.xp, 'role', x.role, 'joinedAt', x.joined_at)
                                 order by case x.role when 'leader' then 0 when 'officer' then 1 else 2 end, p.xp desc)
                  from public.clan_members x join public.profiles p on p.id = x.user_id where x.clan_id = c.id),
    'feed', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'payload', f.payload, 'at', f.created_at,
                                                          'nickname', p.nickname) order by f.id desc), '[]'::jsonb)
               from (select * from public.clan_feed where clan_id = c.id order by id desc limit 30) f
               left join public.profiles p on p.id = f.user_id)
  )
  from public.clan_members m join public.clans c on c.id = m.clan_id
  where m.user_id = auth.uid();
$$;

-- หาแคลนที่เปิดรับ (ยังไม่เต็ม) ค้นจากชื่อได้
create function public.browse_clans(p_query text default '')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.members desc, x.created_at desc), '[]'::jsonb)
  from (
    select c.id, c.name, c.emblem, c.description, c.created_at, count(m.user_id) members
      from public.clans c join public.clan_members m on m.clan_id = c.id
     where c.open and (coalesce(p_query, '') = '' or c.name ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
     group by c.id
    having count(m.user_id) < 30
     order by count(m.user_id) desc, c.created_at desc
     limit 30
  ) x;
$$;

grant execute on function public.create_clan(text, text, text, boolean) to authenticated;
grant execute on function public.join_clan(text, uuid) to authenticated;
grant execute on function public.leave_clan() to authenticated;
grant execute on function public.kick_clan_member(uuid) to authenticated;
grant execute on function public.set_clan_role(uuid, text) to authenticated;
grant execute on function public.update_clan(text, text, text, boolean) to authenticated;
grant execute on function public.clan_cheer(text) to authenticated;
grant execute on function public.my_clan() to authenticated;
grant execute on function public.browse_clans(text) to authenticated;
