-- =========================================================
-- สเต็ป 5.1: ห้องออนไลน์ (ล็อบบี้)
-- เขียนข้อมูลห้องได้ผ่านฟังก์ชันด้านล่างเท่านั้น ตารางอ่านได้เฉพาะสมาชิกในห้อง
-- =========================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  -- { subject: 'all'|subject, difficulty, track, count }
  settings jsonb not null,
  -- สถานะเกมที่เปิดเผยได้ (ใช้ในสเต็ป 5.2)
  state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- สำเนาชื่อ ณ ตอนเข้าห้อง
  nickname text not null,
  tag smallint not null,
  avatar text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_players_user_idx on public.room_players (user_id);

create trigger rooms_touch
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------- สิทธิ์อ่าน: เฉพาะสมาชิกในห้อง ----------
create function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.room_players where room_id = p_room and user_id = auth.uid())
$$;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

create policy "Members can read their room"
  on public.rooms for select to authenticated
  using (public.is_room_member(id));

create policy "Members can read room players"
  on public.room_players for select to authenticated
  using (public.is_room_member(room_id));

revoke insert, update, delete on public.rooms, public.room_players from anon, authenticated;

-- ส่งการเปลี่ยนแปลงแบบเรียลไทม์ (Realtime ยังเคารพ RLS ด้านบน)
alter publication supabase_realtime add table public.rooms, public.room_players;

-- ---------- ตรวจค่าตั้งห้อง ----------
create function public.valid_room_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
     and s ->> 'subject' in ('all', 'math', 'physics', 'chemistry', 'biology', 'english')
     and s ->> 'difficulty' in ('easy', 'medium', 'hard')
     and s ->> 'track' in ('school', 'entrance')
     and (s ->> 'count') in ('5', '10', '20')
$$;

alter table public.rooms add constraint rooms_settings_valid check (public.valid_room_settings(settings));

-- ---------- เพิ่มผู้เล่นปัจจุบันเข้าห้อง (ใช้ภายใน) ----------
create function public._add_me_to_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'profile_required';
  end if;
  insert into public.room_players (room_id, user_id, nickname, tag, avatar)
  values (p_room, v_profile.id, v_profile.nickname, v_profile.tag, v_profile.avatar)
  on conflict (room_id, user_id) do update set last_seen_at = now();
end;
$$;

revoke execute on function public._add_me_to_room(uuid) from public, anon, authenticated;

-- ---------- สร้างห้อง ----------
create function public.create_room(p_settings jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- ไม่มีตัวที่สับสนง่าย (0/O, 1/I/L)
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.valid_room_settings(p_settings) then
    raise exception 'invalid_settings';
  end if;

  -- ออกจากห้องเก่าที่ยังค้างอยู่ก่อน (อยู่ได้ทีละห้อง)
  perform public.leave_room(rp.room_id) from public.room_players rp where rp.user_id = auth.uid();

  for i in 1..20 loop
    v_code := '';
    for j in 1..5 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      insert into public.rooms (code, host_id, settings)
      values (v_code, auth.uid(), p_settings)
      returning * into v_room;
      exit;
    exception when unique_violation then
      -- รหัสซ้ำ สุ่มใหม่
    end;
  end loop;

  if v_room.id is null then
    raise exception 'could not allocate room code';
  end if;

  perform public._add_me_to_room(v_room.id);
  return v_room;
end;
$$;

-- ---------- เข้าห้องด้วยรหัส ----------
create function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'room_not_found';
  end if;

  -- เป็นสมาชิกอยู่แล้ว (เช่น รีเฟรชหน้า) ให้กลับเข้าห้องได้เสมอ
  if exists (select 1 from public.room_players where room_id = v_room.id and user_id = auth.uid()) then
    update public.room_players set last_seen_at = now() where room_id = v_room.id and user_id = auth.uid();
    return v_room;
  end if;

  if v_room.status = 'playing' then
    raise exception 'room_in_game';
  end if;

  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if v_count >= 8 then
    raise exception 'room_full';
  end if;

  perform public.leave_room(rp.room_id) from public.room_players rp where rp.user_id = auth.uid();
  perform public._add_me_to_room(v_room.id);
  return v_room;
end;
$$;

-- ---------- ออกจากห้อง ----------
create function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_next uuid;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then
    return;
  end if;

  delete from public.room_players where room_id = p_room and user_id = auth.uid();

  -- ไม่เหลือใครแล้ว -> ลบห้อง
  if not exists (select 1 from public.room_players where room_id = p_room) then
    delete from public.rooms where id = p_room;
    return;
  end if;

  -- เจ้าของห้องออก -> ยกให้คนที่เข้ามาก่อนสุดที่ยังอยู่
  if v_room.host_id = auth.uid() then
    select user_id into v_next from public.room_players where room_id = p_room order by joined_at limit 1;
    update public.rooms set host_id = v_next where id = p_room;
  end if;
end;
$$;

-- ---------- เจ้าของห้องแก้ค่าตั้งห้อง ----------
create function public.update_room_settings(p_room uuid, p_settings jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  if not public.valid_room_settings(p_settings) then
    raise exception 'invalid_settings';
  end if;
  update public.rooms
     set settings = p_settings
   where id = p_room and host_id = auth.uid() and status <> 'playing'
  returning * into v_room;
  if not found then
    raise exception 'not_host';
  end if;
  return v_room;
end;
$$;

-- ---------- บอกว่ายังอยู่ (ใช้ตัดคนหลุดในสเต็ป 5.2) ----------
create function public.room_heartbeat(p_room uuid)
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.room_players set last_seen_at = now()
   where room_id = p_room and user_id = auth.uid()
  returning now()
$$;

revoke execute on function
  public.create_room(jsonb),
  public.join_room(text),
  public.leave_room(uuid),
  public.update_room_settings(uuid, jsonb),
  public.room_heartbeat(uuid)
from public, anon;

grant execute on function
  public.create_room(jsonb),
  public.join_room(text),
  public.leave_room(uuid),
  public.update_room_settings(uuid, jsonb),
  public.room_heartbeat(uuid)
to authenticated;
