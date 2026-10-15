-- =========================================================
-- สเต็ป 4: โปรไฟล์ผู้เล่น (แขกหรือสมาชิก) + XP
-- =========================================================

-- ---------- กรองชื่อไม่เหมาะสม ----------
-- ทำให้เป็นรูปมาตรฐานก่อนตรวจ: ตัวเล็ก, ตัดช่องว่าง/สัญลักษณ์, แปลง leetspeak (0->o, 1->i, 3->e, 4->a, 5->s, @->a, $->s)
-- ต้องตรงกับ src/lib/nameFilter.ts
create function public.normalize_nickname(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           translate(lower(coalesce(p, '')), '01345@$', 'oieasas'),
           '[^a-z฀-๿]', '', 'g')
$$;

create function public.is_nickname_allowed(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(trim(p)) between 2 and 16
     and public.normalize_nickname(p) <> ''
     and not exists (
       select 1
         from unnest(array[
           -- ไทย
           'ควย', 'เหี้ย', 'เหี้ยะ', 'สัส', 'สัด', 'ไอสัตว์', 'ไอ้สัตว์', 'หี', 'เย็ด', 'แตด', 'ระยำ', 'อีดอก',
           'ดอกทอง', 'กะหรี่', 'ชิบหาย', 'มึง', 'สันดาน', 'จัญไร', 'เงี่ยน', 'ส้นตีน', 'ตอแหล', 'อีห่า', 'พ่อง',
           -- อังกฤษ
           'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigger', 'nigga', 'faggot', 'slut',
           'whore', 'porn', 'sex', 'rape', 'nazi', 'hitler', 'asshole', 'bastard', 'admin', 'moderator'
         ]) as bad(word)
        where public.normalize_nickname(p) like '%' || bad.word || '%'
     )
$$;

-- ---------- โปรไฟล์ ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null constraint nickname_allowed check (public.is_nickname_allowed(nickname)),
  -- เลขท้ายชื่อ ให้ชื่อซ้ำกันได้ เช่น ฟ้า#4821
  tag smallint not null default (floor(random() * 9000) + 1000)::smallint,
  avatar text not null default '😎' check (char_length(avatar) between 1 and 8),
  xp int not null default 0 check (xp >= 0),
  games_played int not null default 0,
  correct_answers int not null default 0,
  wins int not null default 0,
  last_game_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- โปรไฟล์เป็นข้อมูลสาธารณะ (ใช้ในห้องแข่ง/ลีดเดอร์บอร์ดภายหลัง)
create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- แก้เองได้เฉพาะชื่อและอวตาร / XP และสถิติแก้ได้ผ่าน record_game() เท่านั้น
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, nickname, avatar) on public.profiles to authenticated;
grant update (nickname, avatar) on public.profiles to authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- บันทึกผลเกม + ให้ XP ----------
-- XP = 10 ต่อข้อที่ตอบถูก (ง่าย x0.7, ยาก x1.5) + 10 จบเกม + ดวลชนะ 30 / ติด Top 3 (เมื่อมี 4 คนขึ้นไป) 15
create function public.record_game(
  p_mode text,
  p_questions int,
  p_correct_easy int,
  p_correct_medium int,
  p_correct_hard int,
  p_rank int default null,
  p_players int default null
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
  v_correct int := coalesce(p_correct_easy, 0) + coalesce(p_correct_medium, 0) + coalesce(p_correct_hard, 0);
  v_xp int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_mode not in ('solo', 'bots') then
    raise exception 'invalid mode';
  end if;
  if p_questions not between 1 and 60
     or least(p_correct_easy, p_correct_medium, p_correct_hard) < 0
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

  v_xp := round(10 * (0.7 * coalesce(p_correct_easy, 0) + coalesce(p_correct_medium, 0) + 1.5 * coalesce(p_correct_hard, 0)))::int
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

revoke execute on function public.record_game(text, int, int, int, int, int, int) from public, anon;
grant execute on function public.record_game(text, int, int, int, int, int, int) to authenticated;
