-- =========================================================
-- สเต็ป 26.2: ห้องเรียนครู
--   ครูสร้างห้อง (สูงสุด 10 ห้อง ห้องละ 60 คน) นักเรียนเข้าด้วยรหัส + ต้องกดยินยอมให้ครูเห็นสถิติ
--   นักเรียนอยู่ได้ 5 ห้อง (แยกจากแคลน) ครูเห็นสถิติรายบทเฉพาะคำตอบหลังเข้าห้อง ออกจากห้อง = ครูเห็นไม่ได้อีก
--   การบ้าน = ชุดโจทย์ล็อก (quiz_sets kind 'homework') เล่นผ่าน Edge Function async-play ได้คนละครั้ง
--   ไม่มีแชท: ครูเขียนประกาศได้คนเดียว
-- =========================================================

alter table public.quiz_sets drop constraint if exists quiz_sets_kind_check;
alter table public.quiz_sets add constraint quiz_sets_kind_check check (kind in ('challenge', 'daily', 'homework'));

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null constraint classroom_name_allowed check (public.is_group_name_allowed(name)),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  announcement text not null default '' check (char_length(announcement) <= 300 and not public.has_banned_word(announcement)),
  announced_at timestamptz,
  created_at timestamptz not null default now()
);
create index classrooms_teacher_idx on public.classrooms (teacher_id);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- เวลาที่นักเรียนกดยินยอมให้ครูเห็นสถิติ (เข้าห้องไม่ได้ถ้าไม่ยินยอม)
  consented_at timestamptz not null,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);
create index classroom_members_user_idx on public.classroom_members (user_id);

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  set_id uuid not null references public.quiz_sets (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 60 and not public.has_banned_word(title)),
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index homework_class_idx on public.homework (classroom_id, due_at desc);

create function public.is_classroom_teacher(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classrooms where id = p_class and teacher_id = auth.uid());
$$;
create function public.is_classroom_student(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classroom_members where classroom_id = p_class and user_id = auth.uid());
$$;

alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.homework enable row level security;
create policy "Teacher and students read the classroom" on public.classrooms for select to authenticated
  using (teacher_id = auth.uid() or public.is_classroom_student(id));
create policy "Teacher reads roster, students read own row" on public.classroom_members for select to authenticated
  using (user_id = auth.uid() or public.is_classroom_teacher(classroom_id));
create policy "Teacher and students read homework" on public.homework for select to authenticated
  using (public.is_classroom_teacher(classroom_id) or public.is_classroom_student(classroom_id));

create function public.create_classroom(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  if not public.is_group_name_allowed(p_name) then raise exception 'bad_class_name'; end if;
  if (select count(*) from public.classrooms where teacher_id = auth.uid()) >= 10 then raise exception 'too_many_classes'; end if;
  for i in 1..20 loop
    v_code := '';
    for j in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classrooms where code = v_code);
  end loop;
  insert into public.classrooms (code, name, teacher_id) values (v_code, trim(p_name), auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function public.join_classroom(p_code text, p_consent boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classrooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  select * into v_class from public.classrooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'class_not_found'; end if;
  if v_class.teacher_id = auth.uid() then raise exception 'own_class'; end if;
  if exists (select 1 from public.classroom_members where classroom_id = v_class.id and user_id = auth.uid()) then return v_class.id; end if;
  if not coalesce(p_consent, false) then raise exception 'consent_required'; end if;
  if (select count(*) from public.classroom_members where user_id = auth.uid()) >= 5 then raise exception 'too_many_joined'; end if;
  if (select count(*) from public.classroom_members where classroom_id = v_class.id) >= 60 then raise exception 'class_full'; end if;
  insert into public.classroom_members (classroom_id, user_id, consented_at) values (v_class.id, auth.uid(), now());
  return v_class.id;
end;
$$;

-- นักเรียนออกเอง หรือครูเชิญออก (p_user)
create function public.leave_classroom(p_class uuid, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is not null and p_user <> auth.uid() then
    if not public.is_classroom_teacher(p_class) then raise exception 'not_allowed'; end if;
    delete from public.classroom_members where classroom_id = p_class and user_id = p_user;
  else
    delete from public.classroom_members where classroom_id = p_class and user_id = auth.uid();
  end if;
end;
$$;

create function public.delete_classroom(p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_classroom_teacher(p_class) then raise exception 'not_allowed'; end if;
  delete from public.quiz_sets where id in (select set_id from public.homework where classroom_id = p_class);
  delete from public.classrooms where id = p_class;
end;
$$;

create function public.set_class_announcement(p_class uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_classroom_teacher(p_class) then raise exception 'not_allowed'; end if;
  if public.has_banned_word(coalesce(p_text, '')) then raise exception 'bad_text'; end if;
  update public.classrooms
     set announcement = left(trim(coalesce(p_text, '')), 300), announced_at = case when trim(coalesce(p_text, '')) = '' then null else now() end
   where id = p_class;
end;
$$;

create function public.delete_homework(p_homework uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set uuid;
begin
  select h.set_id into v_set from public.homework h where h.id = p_homework and public.is_classroom_teacher(h.classroom_id);
  if v_set is null then raise exception 'not_allowed'; end if;
  delete from public.quiz_sets where id = v_set;
end;
$$;

-- ห้องของฉัน (ทั้งที่สอนและที่เรียน)
create function public.my_classrooms()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'teaching', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code,
        'students', (select count(*) from public.classroom_members m where m.classroom_id = c.id)) order by c.created_at)
      from public.classrooms c where c.teacher_id = auth.uid()), '[]'::jsonb),
    'joined', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'teacher', p.nickname,
        'pending', (select count(*) from public.homework h
                     where h.classroom_id = c.id and h.due_at > now()
                       and not exists (select 1 from public.quiz_plays q where q.set_id = h.set_id and q.user_id = auth.uid() and q.finished_at is not null)))
        order by m.joined_at)
      from public.classroom_members m join public.classrooms c on c.id = m.classroom_id
      left join public.profiles p on p.id = c.teacher_id
      where m.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- หน้าห้องเรียน: ครูเห็นสถิตินักเรียน (หลังเข้าห้องเท่านั้น) / นักเรียนเห็นประกาศ + การบ้านของตัวเอง
create function public.classroom_view(p_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class public.classrooms;
  v_teacher boolean;
begin
  select * into v_class from public.classrooms where id = p_class;
  if not found then raise exception 'class_not_found'; end if;
  v_teacher := v_class.teacher_id = auth.uid();
  if not v_teacher and not public.is_classroom_student(p_class) then raise exception 'not_allowed'; end if;

  if not v_teacher then
    return jsonb_build_object(
      'id', v_class.id, 'name', v_class.name, 'role', 'student',
      'teacher', (select nickname from public.profiles where id = v_class.teacher_id),
      'announcement', v_class.announcement, 'announcedAt', v_class.announced_at,
      'consentedAt', (select consented_at from public.classroom_members where classroom_id = p_class and user_id = auth.uid()),
      'homework', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'title', h.title, 'dueAt', h.due_at,
            'settings', s.settings, 'count', jsonb_array_length(s.questions),
            'done', q.finished_at is not null, 'started', q.id is not null, 'correct', q.correct, 'score', q.score) order by h.due_at desc)
          from public.homework h join public.quiz_sets s on s.id = h.set_id
          left join public.quiz_plays q on q.set_id = h.set_id and q.user_id = auth.uid()
          where h.classroom_id = p_class), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'id', v_class.id, 'name', v_class.name, 'code', v_class.code, 'role', 'teacher',
    'announcement', v_class.announcement, 'announcedAt', v_class.announced_at,
    'students', coalesce((select jsonb_agg(jsonb_build_object(
          'id', p.id, 'nickname', p.nickname, 'tag', p.tag, 'avatar', p.avatar, 'joinedAt', m.joined_at,
          'answers', st.n, 'accuracy', case when st.n > 0 then round(st.ok::numeric / st.n, 3) end,
          'hwDone', (select count(*) from public.homework h join public.quiz_plays q on q.set_id = h.set_id and q.user_id = m.user_id and q.finished_at is not null
                      where h.classroom_id = p_class)) order by p.nickname)
        from public.classroom_members m join public.profiles p on p.id = m.user_id
        cross join lateral (select count(*) n, count(*) filter (where a.correct) ok from public.answer_log a
                              where a.user_id = m.user_id and a.created_at >= m.joined_at) st
        where m.classroom_id = p_class), '[]'::jsonb),
    'homework', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'title', h.title, 'dueAt', h.due_at,
          'settings', s.settings, 'count', jsonb_array_length(s.questions),
          'done', (select count(*) from public.quiz_plays q join public.classroom_members m on m.user_id = q.user_id and m.classroom_id = p_class
                    where q.set_id = h.set_id and q.finished_at is not null),
          'avgCorrect', (select round(avg(q.correct), 1) from public.quiz_plays q join public.classroom_members m on m.user_id = q.user_id and m.classroom_id = p_class
                          where q.set_id = h.set_id and q.finished_at is not null)) order by h.due_at desc)
        from public.homework h join public.quiz_sets s on s.id = h.set_id where h.classroom_id = p_class), '[]'::jsonb),
    -- บทที่ทั้งห้องตอบถูกน้อยสุด (อย่างน้อย 5 คำตอบ)
    'weakChapters', coalesce((select jsonb_agg(jsonb_build_object('chapter', chapter, 'answers', n, 'accuracy', acc) order by acc)
        from (select a.chapter, count(*) n, round(count(*) filter (where a.correct)::numeric / count(*), 3) acc
                from public.classroom_members m join public.answer_log a on a.user_id = m.user_id and a.created_at >= m.joined_at
               where m.classroom_id = p_class and a.chapter is not null
               group by a.chapter having count(*) >= 5 order by acc limit 8) w), '[]'::jsonb)
  );
end;
$$;

-- ครูดูรายบทของนักเรียนคนหนึ่ง (เฉพาะคำตอบหลังเข้าห้อง)
create function public.classroom_student(p_class uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_joined timestamptz;
begin
  if not public.is_classroom_teacher(p_class) then raise exception 'not_allowed'; end if;
  select joined_at into v_joined from public.classroom_members where classroom_id = p_class and user_id = p_user;
  if v_joined is null then raise exception 'not_allowed'; end if;
  return jsonb_build_object(
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('chapter', chapter, 'answers', n, 'accuracy', acc, 'avgMs', ms) order by acc)
        from (select a.chapter, count(*) n, round(count(*) filter (where a.correct)::numeric / count(*), 3) acc, round(avg(a.time_ms)) ms
                from public.answer_log a where a.user_id = p_user and a.created_at >= v_joined and a.chapter is not null
               group by a.chapter) c), '[]'::jsonb),
    'homework', coalesce((select jsonb_agg(jsonb_build_object('title', h.title, 'dueAt', h.due_at, 'count', jsonb_array_length(s.questions),
          'done', q.finished_at is not null, 'correct', q.correct, 'finishedAt', q.finished_at) order by h.due_at desc)
        from public.homework h join public.quiz_sets s on s.id = h.set_id
        left join public.quiz_plays q on q.set_id = h.set_id and q.user_id = p_user
       where h.classroom_id = p_class), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.create_classroom(text) to authenticated;
grant execute on function public.join_classroom(text, boolean) to authenticated;
grant execute on function public.leave_classroom(uuid, uuid) to authenticated;
grant execute on function public.delete_classroom(uuid) to authenticated;
grant execute on function public.set_class_announcement(uuid, text) to authenticated;
grant execute on function public.delete_homework(uuid) to authenticated;
grant execute on function public.my_classrooms() to authenticated;
grant execute on function public.classroom_view(uuid) to authenticated;
grant execute on function public.classroom_student(uuid, uuid) to authenticated;

-- ลบการบ้าน (ทางไหนก็ตาม รวมถึงห้อง/บัญชีครูถูกลบ) -> ลบชุดโจทย์ของการบ้านนั้นด้วย
create function public.drop_homework_set()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.quiz_sets where id = old.set_id and kind = 'homework';
  return old;
end;
$$;
create trigger homework_drop_set after delete on public.homework for each row execute function public.drop_homework_set();
