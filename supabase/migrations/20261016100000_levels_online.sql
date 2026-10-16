-- =========================================================
-- สเต็ป 10.2: ระดับชั้นในห้องออนไลน์ / สุ่มจับคู่ / กลุ่มเพื่อน
-- (ห้องเพื่อนใช้ valid_room_settings ที่รองรับ level แล้วตั้งแต่ 10.1)
-- =========================================================

-- กลุ่มที่สร้างก่อนมีระดับชั้น = ม.ปลาย
update public.groups set settings = settings || '{"level": "upper"}' where not settings ? 'level';

-- ---------- หาเกม: จับคู่เฉพาะคนระดับเดียวกัน ----------
drop function public.find_match(text, text, text, text);

create function public.find_match(p_subject text, p_difficulty text, p_track text, p_mode text default 'classic', p_level text default 'upper')
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_settings jsonb := jsonb_build_object('subject', p_subject, 'difficulty', p_difficulty, 'track', p_track, 'level', p_level, 'count', 10);
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

revoke execute on function public.find_match(text, text, text, text, text) from public, anon;
grant execute on function public.find_match(text, text, text, text, text) to authenticated;

-- ---------- สร้างกลุ่ม: เลือกระดับได้ (ค่าเริ่มต้น ม.ปลาย) ----------
drop function public.create_group(text, text, text, text);

create function public.create_group(p_name text, p_subject text, p_difficulty text, p_track text, p_level text default 'upper')
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_settings jsonb := jsonb_build_object('subject', p_subject, 'difficulty', p_difficulty, 'track', p_track, 'level', p_level, 'count', 10);
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

revoke execute on function public.create_group(text, text, text, text, text) from public, anon;
grant execute on function public.create_group(text, text, text, text, text) to authenticated;
