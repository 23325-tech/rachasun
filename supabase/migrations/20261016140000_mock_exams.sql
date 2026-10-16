-- =========================================================
-- สเต็ป 11.4: จำลองสอบ A-Level (ม.ปลาย)
-- ชุดข้อสอบกลาง (ทุกคนทำชุดเดียวกัน) สร้างล่วงหน้าโดยเซิร์ฟเวอร์ / ทำได้ทั้งเต็มชุดและครึ่งชุด
-- เฉลยอยู่ในตารางที่หน้าเว็บอ่านไม่ได้ ทุกอย่างผ่าน Edge Function mock-exam
-- =========================================================

create table public.mock_papers (
  id uuid primary key default gen_random_uuid(),
  -- math1 / math2 / physics / chemistry / biology / english
  exam text not null check (exam in ('math1', 'math2', 'physics', 'chemistry', 'biology', 'english')),
  no int not null check (no >= 1),
  status text not null default 'building' check (status in ('building', 'ready')),
  -- [{ type: 'mcq5' | 'fill' | 'multi', chapter, difficulty, prompt, choices?, answer_index?, answer?, statements?, truths?, explanation }]
  questions jsonb not null default '[]',
  -- จำนวนข้อเป้าหมายตามพิมพ์เขียว (ใช้ตอนสร้างทีละช่วง)
  target int not null,
  created_at timestamptz not null default now(),
  unique (exam, no)
);

create table public.mock_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paper_id uuid not null references public.mock_papers (id) on delete cascade,
  half boolean not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  -- { "<ข้อ>": คำตอบ }
  answers jsonb not null default '{}',
  submitted_at timestamptz,
  score numeric(5, 2),
  -- ผลรายข้อ/รายบท (บันทึกตอนตรวจ)
  result jsonb,
  -- ทำได้ครั้งเดียวต่อชุดต่อความยาว (เทียบคะแนนกับคนอื่นได้ยุติธรรม)
  unique (user_id, paper_id, half)
);

create index mock_attempts_paper_idx on public.mock_attempts (paper_id, half) where submitted_at is not null;

alter table public.mock_papers enable row level security;
alter table public.mock_attempts enable row level security;
-- ไม่มี policy = หน้าเว็บอ่าน/เขียนตรงไม่ได้ (Edge Function ใช้ service role)

-- ประวัติคำตอบ: นับข้อสอบจำลองด้วย
alter table public.answer_log drop constraint answer_log_mode_check;
alter table public.answer_log
  add constraint answer_log_mode_check check (mode in ('solo', 'bots', 'room', 'async', 'mock'));
