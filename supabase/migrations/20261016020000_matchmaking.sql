-- =========================================================
-- สเต็ป 6: สุ่มห้อง / จับคู่อัตโนมัติ (คนจริงล้วน ไม่มีบอทเติมห้อง)
-- ห้องสาธารณะ = ห้องธรรมดาที่ระบบสร้างให้ ไม่มีรหัสให้แชร์ ไม่มีเจ้าของห้องตัวจริง
-- เริ่มเกมเมื่อ: ครบ 8 คน หรือ มี 2 คนขึ้นไปและผ่านไป 30 วินาทีนับจากคนแรกเข้าห้อง (ตัดสินใน room-game)
-- =========================================================

alter table public.rooms
  add column kind text not null default 'private' check (kind in ('private', 'public')),
  -- โหมดย่อย: classic = ไม่มีไอเทม, items = มีการ์ดพลัง (สเต็ป 7)
  add column mode text not null default 'classic' check (mode in ('classic', 'items'));

create index rooms_matchmaking_idx on public.rooms (created_at)
  where kind = 'public' and status = 'lobby';

-- ห้องสาธารณะเข้าด้วยรหัสไม่ได้ และแก้ค่าตั้งห้องไม่ได้
create or replace function public.update_room_settings(p_room uuid, p_settings jsonb)
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
   where id = p_room and host_id = auth.uid() and status <> 'playing' and kind = 'private'
  returning * into v_room;
  if not found then
    raise exception 'not_host';
  end if;
  return v_room;
end;
$$;

-- ---------- หาเกม ----------
create function public.find_match(p_subject text, p_difficulty text, p_track text, p_mode text default 'classic')
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_settings jsonb := jsonb_build_object('subject', p_subject, 'difficulty', p_difficulty, 'track', p_track, 'count', 10);
  v_room public.rooms;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.valid_room_settings(v_settings) or p_mode not in ('classic', 'items') then
    raise exception 'invalid_settings';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_required';
  end if;

  -- ออกจากห้องเก่าก่อน (อยู่ได้ทีละห้อง)
  perform public.leave_room(rp.room_id) from public.room_players rp where rp.user_id = auth.uid();

  -- กันสองคนกดพร้อมกันแล้วต่างคนต่างสร้างห้องใหม่
  perform pg_advisory_xact_lock(hashtext('match:' || v_settings::text || p_mode));

  select r.* into v_room
    from public.rooms r
   where r.kind = 'public'
     and r.status = 'lobby'
     and r.mode = p_mode
     and r.settings = v_settings
     and (select count(*) from public.room_players rp where rp.room_id = r.id) < 8
   order by r.created_at
   limit 1
   for update;

  if not found then
    for i in 1..20 loop
      v_code := '';
      for j in 1..5 loop
        v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      end loop;
      begin
        insert into public.rooms (code, host_id, settings, kind, mode)
        values (v_code, auth.uid(), v_settings, 'public', p_mode)
        returning * into v_room;
        exit;
      exception when unique_violation then
      end;
    end loop;
  end if;

  perform public._add_me_to_room(v_room.id);
  return v_room;
end;
$$;

revoke execute on function public.find_match(text, text, text, text) from public, anon;
grant execute on function public.find_match(text, text, text, text) to authenticated;

-- join_room: ห้องสาธารณะเข้าด้วยรหัสไม่ได้ (ยกเว้นเป็นสมาชิกอยู่แล้ว)
create or replace function public.join_room(p_code text)
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

  if exists (select 1 from public.room_players where room_id = v_room.id and user_id = auth.uid()) then
    update public.room_players set last_seen_at = now() where room_id = v_room.id and user_id = auth.uid();
    return v_room;
  end if;

  if v_room.kind = 'public' then
    raise exception 'room_not_found';
  end if;

  if v_room.status = 'playing' and v_room.updated_at > now() - interval '10 minutes' then
    raise exception 'room_in_game';
  end if;
  if v_room.status = 'playing' then
    update public.rooms set status = 'lobby', state = null where id = v_room.id returning * into v_room;
    delete from public.room_rounds where room_id = v_room.id;
    delete from public.room_answers where room_id = v_room.id;
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
