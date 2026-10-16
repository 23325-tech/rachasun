-- =========================================================
-- สเต็ป 24.1: สมุดข้อผิด + ทบทวนตามรอบความจำ
--   ตอบผิด/หมดเวลา (ทุกโหมดที่บันทึกลง answer_log) -> เข้าสมุด ครบกำหนดทบทวนใน 1 วัน
--   ทบทวนตอนครบกำหนด: ถูก = เลื่อนรอบ 1 -> 3 -> 7 -> 14 วัน -> จำได้แล้ว / ผิด = กลับไปรอบ 1 วัน
-- =========================================================

create table public.mistake_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  subject text not null,
  chapter text,
  box int not null default 1 check (box between 1 and 5),
  due_at timestamptz not null,
  wrong_count int not null default 1,
  last_wrong_at timestamptz not null default now(),
  graduated_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index mistake_cards_due_idx on public.mistake_cards (user_id, due_at) where graduated_at is null;
alter table public.mistake_cards enable row level security;
create policy "Users read their own mistakes" on public.mistake_cards for select to authenticated using (user_id = auth.uid());

-- ช่วงห่างของแต่ละรอบ (box 1..4) วัน
create function public.mistake_interval(p_box int)
returns interval language sql immutable set search_path = '' as $$
  select case p_box when 1 then interval '1 day' when 2 then interval '3 days' when 3 then interval '7 days' else interval '14 days' end;
$$;

create function public.track_mistake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.mistake_cards;
begin
  if new.question_id is null then
    return new;
  end if;
  if not new.correct then
    insert into public.mistake_cards (user_id, question_id, subject, chapter, box, due_at)
    values (new.user_id, new.question_id, new.subject, new.chapter, 1, now() + public.mistake_interval(1))
    on conflict (user_id, question_id) do update
      set box = 1,
          due_at = now() + public.mistake_interval(1),
          wrong_count = public.mistake_cards.wrong_count + 1,
          last_wrong_at = now(),
          graduated_at = null;
    return new;
  end if;
  -- ตอบถูก: นับเฉพาะตอนครบกำหนดทบทวน
  select * into v_card from public.mistake_cards
   where user_id = new.user_id and question_id = new.question_id and graduated_at is null and due_at <= now()
   for update;
  if found then
    if v_card.box >= 4 then
      update public.mistake_cards set box = 5, graduated_at = now() where user_id = new.user_id and question_id = new.question_id;
    else
      update public.mistake_cards
         set box = v_card.box + 1, due_at = now() + public.mistake_interval(v_card.box + 1)
       where user_id = new.user_id and question_id = new.question_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger answer_log_track_mistake
  after insert on public.answer_log
  for each row execute function public.track_mistake();

-- ภาพรวมสมุด
create function public.mistake_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'due', (select count(*) from public.mistake_cards where user_id = auth.uid() and graduated_at is null and due_at <= now()),
    'active', (select count(*) from public.mistake_cards where user_id = auth.uid() and graduated_at is null),
    'graduated', (select count(*) from public.mistake_cards where user_id = auth.uid() and graduated_at is not null),
    'nextDueAt', (select min(due_at) from public.mistake_cards where user_id = auth.uid() and graduated_at is null and due_at > now()),
    'boxes', coalesce((select jsonb_object_agg(box, n) from (
        select box, count(*) n from public.mistake_cards where user_id = auth.uid() and graduated_at is null group by box) b), '{}'::jsonb),
    'bySubject', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'active', active, 'due', due) order by active desc) from (
        select subject, count(*) active, count(*) filter (where due_at <= now()) due
          from public.mistake_cards where user_id = auth.uid() and graduated_at is null group by subject) s), '[]'::jsonb),
    'byChapter', coalesce((select jsonb_agg(jsonb_build_object('chapter', chapter, 'subject', subject, 'active', active) order by active desc) from (
        select chapter, subject, count(*) active
          from public.mistake_cards where user_id = auth.uid() and graduated_at is null and chapter is not null
         group by chapter, subject order by count(*) desc limit 8) c), '[]'::jsonb)
  );
$$;
grant execute on function public.mistake_state() to authenticated;

-- โจทย์ที่ครบกำหนดทบทวน (เก่าสุดก่อน) / p_all = ทบทวนล่วงหน้าทั้งหมดที่ยังไม่จำได้
create function public.mistake_questions(p_limit int, p_all boolean default false)
returns setof public.questions
language sql
stable
security definer
set search_path = ''
as $$
  select q.*
    from public.mistake_cards m
    join public.questions q on q.id = m.question_id and q.is_active
   where m.user_id = auth.uid() and m.graduated_at is null and (p_all or m.due_at <= now())
   order by m.due_at
   limit least(greatest(p_limit, 1), 30);
$$;
grant execute on function public.mistake_questions(int, boolean) to authenticated;

-- ใส่ข้อผิดย้อนหลังจากประวัติเดิม (ข้อที่คำตอบล่าสุดยังผิดอยู่) ให้ครบกำหนดทบทวนทันที
insert into public.mistake_cards (user_id, question_id, subject, chapter, box, due_at, wrong_count, last_wrong_at)
select l.user_id, l.question_id, l.subject, l.chapter, 1, now(), cnt.n, l.created_at
  from (
    select distinct on (user_id, question_id) user_id, question_id, subject, chapter, correct, created_at
      from public.answer_log where question_id is not null
     order by user_id, question_id, created_at desc
  ) l
  join (select user_id, question_id, count(*) filter (where not correct) n from public.answer_log group by 1, 2) cnt
    on cnt.user_id = l.user_id and cnt.question_id = l.question_id
 where not l.correct
on conflict do nothing;
