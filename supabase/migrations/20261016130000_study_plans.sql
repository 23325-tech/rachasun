-- =========================================================
-- สเต็ป 11.3: แผนการฝึกรายสัปดาห์ + คำแนะนำจาก AI (วันละครั้ง)
-- หนึ่งแผนต่อผู้เล่นต่อระดับชั้น สร้างใหม่ทุกวันจันทร์ (เวลาไทย) หรือกดจัดใหม่เอง
-- =========================================================

create table public.study_plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level text not null check (level in ('primary', 'lower', 'upper', 'uni')),
  -- วันจันทร์ของสัปดาห์ที่แผนนี้ใช้ (เวลาไทย)
  week_start date not null,
  sessions_per_day smallint not null check (sessions_per_day between 1 and 3),
  days_per_week smallint not null check (days_per_week between 3 and 7),
  subjects text[] not null check (cardinality(subjects) between 1 and 6),
  -- [{ day: 0-6 (จันทร์=0), chapter, difficulty, reason, done }]
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 21),
  advice text,
  advice_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, level)
);

alter table public.study_plans enable row level security;

create policy "Users read their own plans"
  on public.study_plans for select to authenticated
  using (user_id = auth.uid());

create policy "Users create their own plans"
  on public.study_plans for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users update their own plans"
  on public.study_plans for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- คำแนะนำ AI เขียนได้เฉพาะเซิร์ฟเวอร์ (กันการปลอมเวลาเพื่อขอเกินวันละครั้ง)
revoke insert, update on public.study_plans from anon, authenticated;
grant insert (user_id, level, week_start, sessions_per_day, days_per_week, subjects, items, updated_at)
  on public.study_plans to authenticated;
grant update (week_start, sessions_per_day, days_per_week, subjects, items, updated_at)
  on public.study_plans to authenticated;
