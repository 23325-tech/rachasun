-- =========================================================
-- สเต็ป 11.2: ประวัติคำตอบ + วิเคราะห์จุดอ่อนรายบท
-- นับทุกโหมด: ฝึกเดี่ยว/บอท (หน้าเว็บส่งผ่าน log_answers), ออนไลน์/คำท้า/กลุ่ม (เซิร์ฟเวอร์บันทึกเอง)
-- =========================================================

create table public.answer_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  level text not null,
  subject text not null,
  chapter text,
  difficulty text not null,
  correct boolean not null,
  time_ms int not null check (time_ms >= 0),
  mode text not null check (mode in ('solo', 'bots', 'room', 'async')),
  -- กันบันทึกซ้ำ เช่น room:<ห้อง>:<เวลาเริ่มข้อ>, play:<play>:<ข้อ>, client:<รอบ>:<โจทย์>
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create index answer_log_user_chapter_idx on public.answer_log (user_id, level, chapter, created_at desc);

alter table public.answer_log enable row level security;

-- อ่านได้เฉพาะของตัวเอง / เขียนผ่านฟังก์ชันเท่านั้น
create policy "Users read their own answers"
  on public.answer_log for select
  to authenticated
  using (user_id = auth.uid());

-- ---------- บันทึกคำตอบจากหน้าเว็บ (ฝึกเดี่ยว / ดวลบอท) ----------
-- รับแค่รหัสโจทย์ + ถูก/ผิด + เวลา ส่วนวิชา/บท/ความยาก ดึงจากคลังเอง (แก้ไขไม่ได้)
create function public.log_answers(p_mode text, p_run text, p_items jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_mode not in ('solo', 'bots') or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 60
     or length(coalesce(p_run, '')) not between 1 and 40 then
    raise exception 'invalid_items';
  end if;

  insert into public.answer_log (user_id, question_id, level, subject, chapter, difficulty, correct, time_ms, mode, source_key)
  select auth.uid(), q.id, q.level, q.subject, q.chapter, q.difficulty,
         coalesce((it ->> 'correct')::boolean, false),
         least(greatest(coalesce((it ->> 'time_ms')::int, 0), 0), 600000),
         p_mode,
         'client:' || p_run || ':' || q.id
    from jsonb_array_elements(p_items) it
    join public.questions q on q.id::text = it ->> 'question_id'
  on conflict (user_id, source_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.log_answers(text, text, jsonb) from public, anon;
grant execute on function public.log_answers(text, text, jsonb) to authenticated;

-- ---------- สถิติรายบทของฉัน ----------
-- recent_* = 20 ข้อล่าสุดของบทนั้น (ใช้ตัดสินถนัด/ควรฝึก), total = ทั้งหมดที่เคยทำ
create function public.my_chapter_stats(p_level text)
returns table (
  chapter text,
  subject text,
  total int,
  recent int,
  recent_correct int,
  avg_time_ms int,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select a.chapter, a.subject, a.correct, a.time_ms, a.created_at,
           row_number() over (partition by a.chapter order by a.created_at desc) as rn
      from public.answer_log a
     where a.user_id = auth.uid()
       and a.level = p_level
       and a.chapter is not null
  )
  select chapter,
         min(subject),
         count(*)::int,
         count(*) filter (where rn <= 20)::int,
         count(*) filter (where rn <= 20 and correct)::int,
         (avg(time_ms) filter (where rn <= 20))::int,
         max(created_at)
    from ranked
   group by chapter;
$$;

grant execute on function public.my_chapter_stats(text) to authenticated;
