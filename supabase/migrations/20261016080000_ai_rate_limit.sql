-- สเต็ป 9.3: จำกัดการให้ AI สร้างโจทย์ต่อผู้ใช้ (กันโควตา Gemini ฟรีหมด)
-- บันทึกโดย Edge Function generate-questions (ตารางลับ)
create table public.ai_generation_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  questions int not null,
  created_at timestamptz not null default now()
);
create index ai_generation_log_user_time_idx on public.ai_generation_log (user_id, created_at);

alter table public.ai_generation_log enable row level security;
revoke all on public.ai_generation_log from anon, authenticated;
