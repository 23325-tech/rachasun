-- =========================================================
-- สเต็ป 27.2: แพ็กโจทย์ออฟไลน์
--   ดาวน์โหลดโจทย์รายบท/รายวิชาเก็บในเครื่อง ฝึกได้ตอนไม่มีเน็ต แล้วซิงก์ผลขึ้นมาภายหลัง
--   ผลออฟไลน์นับในสถิติรายบท + สมุดข้อผิด (ผ่าน answer_log) แต่ไม่ได้ XP / เหรียญ / คะแนนลีก
-- =========================================================

alter table public.answer_log drop constraint if exists answer_log_mode_check;
alter table public.answer_log add constraint answer_log_mode_check check (mode in ('solo', 'bots', 'room', 'async', 'mock', 'offline'));

-- โจทย์สำหรับแพ็ก (สูงสุด 60 ข้อ) ทุกความยาก ทั้งสองแนวข้อสอบ
create function public.offline_pack(p_level text, p_subject text, p_chapter text default null, p_count int default 40)
returns setof public.questions
language sql
stable
security definer
set search_path = ''
as $$
  select q.* from public.questions q
   where q.is_active and q.level = p_level and q.subject = p_subject
     and (p_chapter is null or q.chapter = p_chapter)
   order by random()
   limit least(greatest(coalesce(p_count, 40), 1), 60);
$$;
grant execute on function public.offline_pack(text, text, text, int) to authenticated;

-- ซิงก์ผลออฟไลน์: [{ key, questionId, given, correct, timeMs, at }] ครั้งละไม่เกิน 200 ข้อ
--   ปรนัยตรวจใหม่ฝั่งเซิร์ฟเวอร์ / เติมคำใช้ผลจากเครื่อง (กระทบแค่สถิติของตัวเอง ไม่มีรางวัล)
create function public.sync_offline_answers(p_items jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  it jsonb;
  q public.questions;
  v_correct boolean;
  v_at timestamptz;
  v_n int := 0;
  v_rows int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'bad_items'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(it ->> 'key', '') !~ '^[A-Za-z0-9:_-]{6,80}$' then continue; end if;
    select * into q from public.questions where id = (it ->> 'questionId')::uuid;
    if not found then continue; end if;
    if q.type = 'mcq' then
      v_correct := (it ->> 'given') ~ '^[0-3]$' and (it ->> 'given')::int = q.answer_index;
    else
      v_correct := coalesce((it ->> 'correct')::boolean, false) and coalesce(it ->> 'given', '') <> '';
    end if;
    v_at := least(now(), greatest(now() - interval '14 days', coalesce((it ->> 'at')::timestamptz, now())));
    insert into public.answer_log (user_id, question_id, level, subject, chapter, difficulty, correct, time_ms, mode, source_key, created_at)
    values (auth.uid(), q.id, q.level, q.subject, q.chapter, q.difficulty, v_correct,
            least(600000, greatest(0, coalesce(round((it ->> 'timeMs')::numeric)::int, 0))), 'offline', 'offline:' || (it ->> 'key'), v_at)
    on conflict (user_id, source_key) do nothing;
    get diagnostics v_rows = row_count;
    v_n := v_n + v_rows;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.sync_offline_answers(jsonb) to authenticated;
