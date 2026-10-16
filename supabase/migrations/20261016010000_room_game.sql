-- =========================================================
-- สเต็ป 5.2: เล่นจริงในห้องออนไลน์
-- ตารางในไฟล์นี้ "ลับ": เปิด RLS แต่ไม่มี policy -> อ่าน/เขียนได้เฉพาะ Edge Function (service role)
-- สถานะที่เปิดเผยได้อยู่ใน rooms.state (สมาชิกห้องอ่านได้ + ส่งผ่าน Realtime)
-- =========================================================

-- โจทย์ของแต่ละข้อในห้อง (มีเฉลย)
create table public.room_rounds (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  question jsonb not null,
  primary key (room_id, round)
);

-- คำตอบของผู้เล่นแต่ละคน (เวลาวัดจากนาฬิกาเซิร์ฟเวอร์)
create table public.room_answers (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  given jsonb,
  correct boolean not null,
  time_ms int not null,
  created_at timestamptz not null default now(),
  primary key (room_id, round, user_id)
);

alter table public.room_rounds enable row level security;
alter table public.room_answers enable row level security;
revoke all on public.room_rounds, public.room_answers from anon, authenticated;

-- ---------- XP โหมดออนไลน์ (เรียกได้เฉพาะเซิร์ฟเวอร์) ----------
-- สูตรเดียวกับ record_game: 10/ข้อถูก (ง่าย x0.7, ยาก x1.5) + 10 จบเกม + ชนะ 30 / Top 3 (4 คนขึ้นไป) 15
create function public.record_online_game(
  p_user uuid,
  p_questions int,
  p_correct_easy int,
  p_correct_medium int,
  p_correct_hard int,
  p_rank int,
  p_players int
)
returns table (xp_gained int, xp_total int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_xp int;
begin
  v_xp := round(10 * (0.7 * p_correct_easy + p_correct_medium + 1.5 * p_correct_hard))::int
          + 10
          + case
              when p_rank = 1 then 30
              when p_rank <= 3 and p_players >= 4 then 15
              else 0
            end;

  return query
  update public.profiles p
     set xp = p.xp + v_xp,
         games_played = p.games_played + 1,
         correct_answers = p.correct_answers + p_correct_easy + p_correct_medium + p_correct_hard,
         wins = p.wins + case when p_rank = 1 then 1 else 0 end,
         last_game_at = now()
   where p.id = p_user
  returning v_xp, p.xp;
end;
$$;

revoke execute on function public.record_online_game(uuid, int, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.record_online_game(uuid, int, int, int, int, int, int) to service_role;

-- ---------- ห้องค้าง ----------
-- ห้องที่สถานะ playing แต่ไม่มีความเคลื่อนไหวเกิน 10 นาที (ทุกคนปิดแอพ) ให้เข้าได้อีกครั้ง
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
