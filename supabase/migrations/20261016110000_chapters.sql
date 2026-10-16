-- =========================================================
-- สเต็ป 11.1: ฝึกแยกบท + ความยากระดับ "ท้าทาย"
-- รหัสบท = "ระดับ.วิชา.ลำดับ" (ดู supabase/functions/_shared/chapters.ts)
-- =========================================================

-- ---------- คลังโจทย์: บท + ความยากท้าทาย ----------
alter table public.questions add column chapter text;

alter table public.questions drop constraint questions_difficulty_check;
alter table public.questions
  add constraint questions_difficulty_check check (difficulty in ('easy', 'medium', 'hard', 'challenge'));

create index questions_chapter_idx on public.questions (chapter, difficulty, track) where is_active;

-- ---------- สุ่มโจทย์: กรองบทได้ (null = ทุกบท) ----------
drop function public.get_random_questions(text[], text, text, int, uuid[], text);

create function public.get_random_questions(
  p_subjects text[],
  p_difficulty text,
  p_track text,
  p_limit int,
  p_exclude uuid[] default '{}',
  p_level text default 'upper',
  p_chapters text[] default null
)
returns setof public.questions
language sql
stable
security invoker
set search_path = ''
as $$
  select *
    from public.questions
   where is_active
     and level = p_level
     and subject = any (p_subjects)
     and difficulty = p_difficulty
     and track = p_track
     and (p_chapters is null or cardinality(p_chapters) = 0 or chapter = any (p_chapters))
     and not (id = any (p_exclude))
   order by random()
   limit least(greatest(p_limit, 0), 50);
$$;

-- ---------- ค่าตั้งห้อง/คำท้า/กลุ่ม: รองรับ "ท้าทาย" ----------
create or replace function public.valid_room_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
     and coalesce(s ->> 'level', 'upper') in ('primary', 'lower', 'upper', 'uni')
     and (s ->> 'subject' = 'all' or public.level_has_subject(coalesce(s ->> 'level', 'upper'), s ->> 'subject'))
     and s ->> 'difficulty' in ('easy', 'medium', 'hard', 'challenge')
     -- มหาลัยมีแค่แนวสอบในคณะ
     and s ->> 'track' in ('school', 'entrance')
     and not (coalesce(s ->> 'level', 'upper') = 'uni' and s ->> 'track' = 'entrance')
     and (s ->> 'count') in ('5', '10', '20')
$$;

-- ---------- XP: ข้อท้าทายตอบถูก x2 ----------
drop function public.record_game(text, int, int, int, int, int, int);

-- XP = 10 ต่อข้อที่ตอบถูก (ง่าย x0.7, ยาก x1.5, ท้าทาย x2) + 10 จบเกม + ดวลชนะ 30 / ติด Top 3 (เมื่อมี 4 คนขึ้นไป) 15
create function public.record_game(
  p_mode text,
  p_questions int,
  p_correct_easy int,
  p_correct_medium int,
  p_correct_hard int,
  p_rank int default null,
  p_players int default null,
  p_correct_challenge int default 0
)
returns table (xp_gained int, xp_total int, games_played int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_correct int := coalesce(p_correct_easy, 0) + coalesce(p_correct_medium, 0) + coalesce(p_correct_hard, 0)
                   + coalesce(p_correct_challenge, 0);
  v_xp int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_mode not in ('solo', 'bots') then
    raise exception 'invalid mode';
  end if;
  if p_questions not between 1 and 60
     or least(p_correct_easy, p_correct_medium, p_correct_hard, coalesce(p_correct_challenge, 0)) < 0
     or v_correct > p_questions then
    raise exception 'invalid answer counts';
  end if;
  if p_mode = 'bots' and (p_players not between 2 and 8 or p_rank not between 1 and p_players) then
    raise exception 'invalid rank';
  end if;

  select last_game_at into v_last from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile not found';
  end if;
  -- กันการยิง request รัวๆ เพื่อปั๊ม XP
  if v_last is not null and v_last > now() - interval '10 seconds' then
    raise exception 'too many games, slow down';
  end if;

  v_xp := round(10 * (0.7 * coalesce(p_correct_easy, 0) + coalesce(p_correct_medium, 0)
                      + 1.5 * coalesce(p_correct_hard, 0) + 2 * coalesce(p_correct_challenge, 0)))::int
          + 10
          + case
              when p_mode = 'bots' and p_rank = 1 then 30
              when p_mode = 'bots' and p_rank <= 3 and p_players >= 4 then 15
              else 0
            end;

  return query
  update public.profiles p
     set xp = p.xp + v_xp,
         games_played = p.games_played + 1,
         correct_answers = p.correct_answers + v_correct,
         wins = p.wins + case when p_mode = 'bots' and p_rank = 1 then 1 else 0 end,
         last_game_at = now()
   where p.id = v_uid
  returning v_xp, p.xp, p.games_played;
end;
$$;

revoke execute on function public.record_game(text, int, int, int, int, int, int, int) from public, anon;
grant execute on function public.record_game(text, int, int, int, int, int, int, int) to authenticated;

drop function public.record_online_game(uuid, int, int, int, int, int, int);

create function public.record_online_game(
  p_user uuid,
  p_questions int,
  p_correct_easy int,
  p_correct_medium int,
  p_correct_hard int,
  p_rank int,
  p_players int,
  p_correct_challenge int default 0
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
  v_xp := round(10 * (0.7 * p_correct_easy + p_correct_medium + 1.5 * p_correct_hard
                      + 2 * coalesce(p_correct_challenge, 0)))::int
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
         correct_answers = p.correct_answers + p_correct_easy + p_correct_medium + p_correct_hard
                           + coalesce(p_correct_challenge, 0),
         wins = p.wins + case when p_rank = 1 then 1 else 0 end,
         last_game_at = now()
   where p.id = p_user
  returning v_xp, p.xp;
end;
$$;

revoke execute on function public.record_online_game(uuid, int, int, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.record_online_game(uuid, int, int, int, int, int, int, int) to service_role;
