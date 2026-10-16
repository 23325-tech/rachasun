-- =========================================================
-- สเต็ป 10.1: ระดับชั้น (ประถม / ม.ต้น / ม.ปลาย / มหาลัย)
-- primary = ประถม, lower = ม.ต้น, upper = ม.ปลาย, uni = มหาลัย
-- =========================================================

-- ---------- คลังโจทย์: ระดับชั้น + วิชาวิทยาศาสตร์ (ประถม/ม.ต้น) ----------
-- โจทย์เดิมทั้งหมดเป็นของ ม.ปลาย
alter table public.questions
  add column level text not null default 'upper' check (level in ('primary', 'lower', 'upper', 'uni'));

alter table public.questions drop constraint questions_subject_check;
alter table public.questions
  add constraint questions_subject_check
  check (subject in ('math', 'science', 'physics', 'chemistry', 'biology', 'english'));

drop index public.questions_pick_idx;
create index questions_pick_idx on public.questions (level, subject, difficulty, track) where is_active;

-- ---------- โปรไฟล์: ระดับที่เลือกไว้ (ค่าเริ่มต้นตอนเปิดแอพ) ----------
alter table public.profiles
  add column level text not null default 'upper' check (level in ('primary', 'lower', 'upper', 'uni'));

grant insert (level) on public.profiles to authenticated;
grant update (level) on public.profiles to authenticated;

-- ---------- วิชาที่มีในแต่ละระดับ ----------
create function public.level_has_subject(p_level text, p_subject text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_level in ('primary', 'lower') then p_subject in ('math', 'science', 'english')
    when p_level in ('upper', 'uni') then p_subject in ('math', 'physics', 'chemistry', 'biology', 'english')
    else false
  end;
$$;

-- ---------- สุ่มโจทย์จากคลัง (เพิ่ม p_level ไว้ท้าย ค่าเริ่มต้น ม.ปลาย ให้โค้ดเดิมยังใช้ได้) ----------
drop function public.get_random_questions(text[], text, text, int, uuid[]);

create function public.get_random_questions(
  p_subjects text[],
  p_difficulty text,
  p_track text,
  p_limit int,
  p_exclude uuid[] default '{}',
  p_level text default 'upper'
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
     and not (id = any (p_exclude))
   order by random()
   limit least(greatest(p_limit, 0), 50);
$$;

-- ---------- ตรวจค่าตั้งห้อง/คำท้า/กลุ่ม (level ไม่ใส่ = ม.ปลาย) ----------
create or replace function public.valid_room_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
     and coalesce(s ->> 'level', 'upper') in ('primary', 'lower', 'upper', 'uni')
     and (s ->> 'subject' = 'all' or public.level_has_subject(coalesce(s ->> 'level', 'upper'), s ->> 'subject'))
     and s ->> 'difficulty' in ('easy', 'medium', 'hard')
     -- มหาลัยมีแค่แนวสอบในคณะ
     and s ->> 'track' in ('school', 'entrance')
     and not (coalesce(s ->> 'level', 'upper') = 'uni' and s ->> 'track' = 'entrance')
     and (s ->> 'count') in ('5', '10', '20')
$$;
