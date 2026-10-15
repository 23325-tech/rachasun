-- =========================================================
-- สเต็ป 2: คลังโจทย์จาก AI + ระบบรายงานข้อผิด
-- =========================================================

-- ---------- คลังโจทย์ ----------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('math', 'physics', 'chemistry', 'biology', 'english')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  track text not null check (track in ('entrance', 'school')),
  type text not null check (type in ('mcq', 'fill')),
  prompt text not null,
  choices jsonb,                -- mcq: อาร์เรย์ข้อความ 4 ตัวเลือก
  answer_index smallint check (answer_index between 0 and 3),
  answer jsonb,                 -- fill: { kind: 'number', value, tolerance?, unit? } | { kind: 'text', accepted: [] }
  explanation text not null,
  time_limit_sec smallint,
  model text,                   -- โมเดล AI ที่สร้างข้อนี้
  report_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint questions_shape check (
    (type = 'mcq' and jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4 and answer_index is not null)
    or (type = 'fill' and jsonb_typeof(answer) = 'object')
  )
);

create index questions_pick_idx on public.questions (subject, difficulty, track) where is_active;

alter table public.questions enable row level security;

-- ทุกคนอ่านได้เฉพาะข้อที่ยังไม่ถูกตัด / เขียนได้เฉพาะ Edge Function (service role) เท่านั้น
create policy "Anyone can read active questions"
  on public.questions for select
  to anon, authenticated
  using (is_active);

-- ---------- รายงานข้อผิด ----------
create table public.question_reports (
  question_id uuid not null references public.questions (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('wrong_answer', 'unclear', 'display', 'other')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  -- คนละ 1 ครั้งต่อข้อ
  primary key (question_id, reporter_id)
);

alter table public.question_reports enable row level security;

-- ผู้ใช้ที่ล็อกอิน (รวมแขกแบบ anonymous sign-in) รายงานได้ในนามตัวเองเท่านั้น
create policy "Users can report as themselves"
  on public.question_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "Users can see their own reports"
  on public.question_reports for select
  to authenticated
  using (reporter_id = auth.uid());

-- นับยอดรายงาน และตัดข้อออกจากคลังเมื่อครบเกณฑ์
create function public.handle_question_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_threshold constant int := 3;
begin
  update public.questions
     set report_count = report_count + 1,
         is_active = case when report_count + 1 >= report_threshold then false else is_active end
   where id = new.question_id;
  return new;
end;
$$;

create trigger on_question_report
  after insert on public.question_reports
  for each row execute function public.handle_question_report();

-- ---------- สุ่มโจทย์จากคลัง ----------
create function public.get_random_questions(
  p_subjects text[],
  p_difficulty text,
  p_track text,
  p_limit int,
  p_exclude uuid[] default '{}'
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
     and subject = any (p_subjects)
     and difficulty = p_difficulty
     and track = p_track
     and not (id = any (p_exclude))
   order by random()
   limit least(greatest(p_limit, 0), 50);
$$;
