-- =========================================================
-- สเต็ป 19.2: กรอบฤดูกาล + ป๊อปอัปผลฤดูกาล + ประวัติ
--   กรอบเก็บเป็นส่วนท้ายของรหัสหน้าตา "+<ฤดูกาล><ยศ>" เช่น v1....n+1g (ฤดูกาล 1 ทอง)
--   รูปผู้เล่นทุกที่ได้กรอบไปด้วยเอง ใส่ได้เฉพาะกรอบที่ได้จริง (season_rewards)
-- =========================================================

create function public.tier_letter(p_tier text)
returns text language sql immutable set search_path = '' as $$
  select case p_tier when 'bronze' then 'b' when 'silver' then 's' when 'gold' then 'g'
    when 'platinum' then 'p' when 'diamond' then 'd' when 'legend' then 'l' end;
$$;

create or replace function public.look_allowed(p_avatar text, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := split_part(p_avatar, '+', 1);
  v_frame text := nullif(split_part(p_avatar, '+', 2), '');
  v_parts text[];
  v_slots text[] := array['skin', 'hair', 'style', 'eyes', 'outfit', 'hat', 'item'];
begin
  if v_base !~ '^v1\.[0-9a-f]{6}\.[0-9a-f]{6}\.[sbpu]\.[0-9a-f]{6}\.[ulhs]-[0-9a-f]{6}\.[ncbhg]\.[npkf]$' then
    return false;
  end if;
  if v_frame is not null then
    if v_frame !~ '^[0-9]{1,3}[bsgpdl]$' or not exists (
      select 1 from public.season_rewards r
       where r.user_id = p_user
         and r.season_no = left(v_frame, length(v_frame) - 1)::int
         and public.tier_letter(r.tier) = right(v_frame, 1)
    ) then
      return false;
    end if;
  end if;
  v_parts := string_to_array(v_base, '.');
  for i in 1..7 loop
    if not exists (
      select 1 from public.wardrobe_items w
       where w.slot = v_slots[i] and w.value = v_parts[i + 1]
         and ((w.coin is null and w.gem is null)
              or exists (select 1 from public.owned_items o where o.user_id = p_user and o.item_id = w.id))
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- เลือกกรอบ (null = ไม่ใส่กรอบ)
create function public.set_frame(p_season int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tier text;
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_season is not null then
    select r.tier into v_tier from public.season_rewards r where r.user_id = v_uid and r.season_no = p_season;
    if not found then
      raise exception 'frame_not_owned';
    end if;
  end if;
  update public.profiles
     set avatar = split_part(avatar, '+', 1)
                  || case when p_season is null then '' else '+' || p_season || public.tier_letter(v_tier) end
   where id = v_uid
  returning avatar into v_avatar;
  return v_avatar;
end;
$$;
grant execute on function public.set_frame(int) to authenticated;

-- ปิดป๊อปอัปผลฤดูกาล
create function public.mark_season_rewards_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.season_rewards set seen = true where user_id = auth.uid() and not seen;
$$;
grant execute on function public.mark_season_rewards_seen() to authenticated;

-- ประวัติรางวัลฤดูกาลทั้งหมดของเรา (หน้าบัญชี)
create function public.my_season_history()
returns table (season_no int, tier text, peak_rp int, coins int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.season_no, r.tier, r.peak_rp, r.coins
    from public.season_rewards r
   where r.user_id = auth.uid()
   order by r.season_no desc;
$$;
grant execute on function public.my_season_history() to authenticated;

-- รูปแบบรหัสหน้าตายอมให้มีกรอบต่อท้าย
alter table public.profiles drop constraint profiles_avatar_check;
alter table public.profiles
  add constraint profiles_avatar_check
  check (avatar ~ '^v1\.[0-9a-f]{6}\.[0-9a-f]{6}\.[sbpu]\.[0-9a-f]{6}\.[ulhs]-[0-9a-f]{6}\.[ncbhg]\.[npkf](\+[0-9]{1,3}[bsgpdl])?$');
