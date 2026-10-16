-- =========================================================
-- สเต็ป 25.1: เป้าหมายคณะในฝัน
--   เป้าได้สูงสุด 5 อันดับ ค่าน้ำหนักนักเรียนกรอกเอง (รวม 100%) ระบบไม่แต่งตัวเลขให้
--   คะแนนรายวิชา (เต็ม 100) ใช้ร่วมกันทุกเป้า, วันสอบเริ่มต้นอยู่ที่ src/data/tcas.ts แก้รายวิชาเป็นวันของตัวเองได้
-- =========================================================

create table public.dream_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- [{ university, faculty, target (0-100), weights: { <subject>: % } }]
  goals jsonb not null default '[]',
  -- { <subject>: คะแนน 0-100 } ที่นักเรียนกรอกเอง
  scores jsonb not null default '{}',
  -- { <subject>: 'YYYY-MM-DD' } วันสอบของตัวเอง
  exam_overrides jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.dream_plans enable row level security;
create policy "Users read their own dream plan" on public.dream_plans for select to authenticated using (user_id = auth.uid());

-- รหัสวิชาที่ใช้ได้ (ตรงกับ src/data/tcas.ts)
create function public.dream_subjects()
returns text[] language sql immutable set search_path = '' as $$
  select array['tgat','tgat1','tgat2','tgat3','tpat1','tpat2','tpat3','tpat4','tpat5',
               'a_math1','a_math2','a_phy','a_chem','a_bio','a_eng','a_thai','a_soc','a_sci','a_lang'];
$$;

create function public.save_dream(p_goals jsonb, p_scores jsonb, p_overrides jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal jsonb;
  v_key text;
  v_val jsonb;
  v_sum numeric;
  v_subjects text[] := public.dream_subjects();
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) > 5 then
    raise exception 'bad_goals';
  end if;
  for v_goal in select * from jsonb_array_elements(p_goals) loop
    if jsonb_typeof(v_goal) <> 'object'
       or length(coalesce(v_goal ->> 'faculty', '')) not between 1 and 80
       or length(coalesce(v_goal ->> 'university', '')) > 80
       or jsonb_typeof(v_goal -> 'target') <> 'number'
       or (v_goal ->> 'target')::numeric not between 0 and 100
       or jsonb_typeof(v_goal -> 'weights') <> 'object' then
      raise exception 'bad_goal';
    end if;
    v_sum := 0;
    for v_key, v_val in select * from jsonb_each(v_goal -> 'weights') loop
      if not v_key = any (v_subjects) or jsonb_typeof(v_val) <> 'number' or v_val::numeric not between 1 and 100 then
        raise exception 'bad_weight';
      end if;
      v_sum := v_sum + v_val::numeric;
    end loop;
    if v_sum <> 100 then
      raise exception 'weights_not_100';
    end if;
  end loop;
  if jsonb_typeof(p_scores) <> 'object' then
    raise exception 'bad_scores';
  end if;
  for v_key, v_val in select * from jsonb_each(p_scores) loop
    if not v_key = any (v_subjects) or jsonb_typeof(v_val) <> 'number' or v_val::numeric not between 0 and 100 then
      raise exception 'bad_score';
    end if;
  end loop;
  if jsonb_typeof(p_overrides) <> 'object' then
    raise exception 'bad_overrides';
  end if;
  for v_key, v_val in select * from jsonb_each(p_overrides) loop
    if not v_key = any (v_subjects) or jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'bad_override';
    end if;
    perform (v_val #>> '{}')::date;
  end loop;

  insert into public.dream_plans (user_id, goals, scores, exam_overrides, updated_at)
  values (auth.uid(), p_goals, p_scores, p_overrides, now())
  on conflict (user_id) do update
    set goals = excluded.goals, scores = excluded.scores, exam_overrides = excluded.exam_overrides, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.save_dream(jsonb, jsonb, jsonb) to authenticated;
