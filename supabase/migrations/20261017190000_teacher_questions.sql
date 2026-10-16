-- =========================================================
-- สเต็ป 28.1: คลังโจทย์ของครู
--   ครูเขียนเอง หรือสั่ง AI ร่างให้ (ตรวจ/แก้ก่อนบันทึก) ใช้ได้เฉพาะห้องที่ครูสอน ไม่ปนกับคลังกลาง
--   AI: วันละ 10 ครั้ง ครั้งละไม่เกิน 10 ข้อ เฉพาะสมาชิก (Edge Function teacher-ai นับโควตา)
-- =========================================================

create table public.teacher_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  level text not null check (level in ('primary', 'lower', 'upper', 'uni')),
  subject text not null check (subject in ('math', 'science', 'physics', 'chemistry', 'biology', 'english')),
  chapter text check (chapter is null or chapter ~ '^[a-z]+\.[a-z]+\.[0-9]+$'),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'challenge')),
  type text not null check (type in ('mcq', 'fill')),
  prompt text not null check (char_length(prompt) between 3 and 2000),
  choices jsonb,
  answer_index int,
  answer jsonb,
  explanation text not null default '' check (char_length(explanation) <= 2000),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_q_shape check (
    (type = 'mcq' and jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4 and answer_index between 0 and 3 and answer is null)
    or (type = 'fill' and choices is null and answer_index is null and jsonb_typeof(answer) = 'object'
        and ((answer ->> 'kind' = 'number' and jsonb_typeof(answer -> 'value') = 'number')
          or (answer ->> 'kind' = 'text' and jsonb_typeof(answer -> 'accepted') = 'array' and jsonb_array_length(answer -> 'accepted') between 1 and 10)))
  )
);
create index teacher_questions_teacher_idx on public.teacher_questions (teacher_id, created_at desc);
alter table public.teacher_questions enable row level security;
create policy "Teachers read their own questions" on public.teacher_questions for select to authenticated using (teacher_id = auth.uid());

create table public.teacher_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.teacher_ai_usage enable row level security;

-- บันทึก (เพิ่มใหม่ถ้าไม่มี p_id / แก้ของตัวเอง) คืน id
create function public.save_teacher_question(p_id uuid, p_q jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_choice jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then raise exception 'members_only'; end if;
  if (select count(*) from public.teacher_questions where teacher_id = auth.uid()) >= 2000 and p_id is null then raise exception 'bank_full'; end if;
  if public.has_banned_word(coalesce(p_q ->> 'prompt', '')) then raise exception 'bad_text'; end if;
  if p_q ->> 'type' = 'mcq' then
    for v_choice in select * from jsonb_array_elements(coalesce(p_q -> 'choices', '[]'::jsonb)) loop
      if jsonb_typeof(v_choice) <> 'string' or char_length(v_choice #>> '{}') not between 1 and 500 then raise exception 'bad_choices'; end if;
    end loop;
  end if;
  if p_id is null then
    insert into public.teacher_questions (teacher_id, level, subject, chapter, difficulty, type, prompt, choices, answer_index, answer, explanation, source)
    values (auth.uid(), p_q ->> 'level', p_q ->> 'subject', nullif(p_q ->> 'chapter', ''), p_q ->> 'difficulty', p_q ->> 'type',
            trim(p_q ->> 'prompt'), case when p_q ->> 'type' = 'mcq' then p_q -> 'choices' end,
            case when p_q ->> 'type' = 'mcq' then (p_q ->> 'answerIndex')::int end,
            case when p_q ->> 'type' = 'fill' then p_q -> 'answer' end,
            trim(coalesce(p_q ->> 'explanation', '')), case when p_q ->> 'source' = 'ai' then 'ai' else 'manual' end)
    returning id into v_id;
  else
    update public.teacher_questions
       set level = p_q ->> 'level', subject = p_q ->> 'subject', chapter = nullif(p_q ->> 'chapter', ''),
           difficulty = p_q ->> 'difficulty', type = p_q ->> 'type', prompt = trim(p_q ->> 'prompt'),
           choices = case when p_q ->> 'type' = 'mcq' then p_q -> 'choices' end,
           answer_index = case when p_q ->> 'type' = 'mcq' then (p_q ->> 'answerIndex')::int end,
           answer = case when p_q ->> 'type' = 'fill' then p_q -> 'answer' end,
           explanation = trim(coalesce(p_q ->> 'explanation', '')), updated_at = now()
     where id = p_id and teacher_id = auth.uid()
    returning id into v_id;
    if v_id is null then raise exception 'not_allowed'; end if;
  end if;
  return v_id;
end;
$$;

create function public.delete_teacher_question(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.teacher_questions where id = p_id and teacher_id = auth.uid();
$$;

-- โควตา AI วันนี้ (ใช้ไป/ทั้งหมด)
create function public.teacher_ai_quota()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('used', coalesce((select n from public.teacher_ai_usage where user_id = auth.uid() and day = (now() at time zone 'Asia/Bangkok')::date), 0), 'limit', 10);
$$;

-- ใช้โควตา 1 ครั้ง (service role) / p_delta = -1 คืนโควตาเมื่อ AI ล้มเหลว
create function public.teacher_ai_consume(p_user uuid, p_delta int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Bangkok')::date;
  v_n int;
begin
  insert into public.teacher_ai_usage (user_id, day) values (p_user, v_day) on conflict do nothing;
  select n into v_n from public.teacher_ai_usage where user_id = p_user and day = v_day for update;
  if p_delta > 0 and v_n >= 10 then return jsonb_build_object('ok', false, 'used', v_n, 'limit', 10); end if;
  v_n := greatest(0, v_n + p_delta);
  update public.teacher_ai_usage set n = v_n where user_id = p_user and day = v_day;
  return jsonb_build_object('ok', true, 'used', v_n, 'limit', 10);
end;
$$;
revoke execute on function public.teacher_ai_consume(uuid, int) from public, anon, authenticated;

grant execute on function public.save_teacher_question(uuid, jsonb) to authenticated;
grant execute on function public.delete_teacher_question(uuid) to authenticated;
grant execute on function public.teacher_ai_quota() to authenticated;
