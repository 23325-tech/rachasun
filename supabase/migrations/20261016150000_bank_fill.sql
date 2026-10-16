-- =========================================================
-- สเต็ป 11.5: เติมคลังโจทย์อัตโนมัติทุกคืน (ตี 2 - ตี 5 เวลาไทย)
-- วันละราว 100 ข้อ ไล่เติมช่อง (บท x ความยาก x แนวข้อสอบ) ที่มีโจทย์น้อยที่สุดก่อน
-- คืนวันจันทร์ออกชุดข้อสอบจำลอง A-Level ใหม่ครบทุกวิชา
-- =========================================================

-- จำนวนข้อที่เติมแต่ละวัน (เวลาไทย) ใช้หยุดเมื่อครบโควตา
create table public.bank_fill_log (
  day date primary key,
  questions int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.bank_fill_log enable row level security;
-- ไม่มี policy: เฉพาะ Edge Function (service role)

-- จำนวนโจทย์ที่ใช้ได้ในแต่ละช่อง
create function public.bank_counts()
returns table (chapter text, difficulty text, track text, n int)
language sql
stable
security definer
set search_path = ''
as $$
  select q.chapter, q.difficulty, q.track, count(*)::int
    from public.questions q
   where q.is_active and q.chapter is not null
   group by 1, 2, 3;
$$;
revoke execute on function public.bank_counts() from public, anon, authenticated;
grant execute on function public.bank_counts() to service_role;

-- บวกยอดเติมของวันนี้แบบปลอดภัยเมื่อเรียกซ้อนกัน
create function public.bank_fill_add(p_day date, p_n int)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.bank_fill_log (day, questions) values (p_day, p_n)
  on conflict (day) do update set questions = public.bank_fill_log.questions + excluded.questions, updated_at = now()
  returning questions;
$$;
revoke execute on function public.bank_fill_add(date, int) from public, anon, authenticated;
grant execute on function public.bank_fill_add(date, int) to service_role;

-- ---------- ตั้งเวลา ----------
-- ต้องเก็บรหัสลับไว้ใน Vault ชื่อ bank_fill_secret ก่อน (ค่าเดียวกับ secret BANK_FILL_SECRET ของ Edge Function)
-- ห้ามใส่รหัสลับในไฟล์นี้
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ทุก 10 นาที ช่วง 19:00-21:50 UTC = ตี 2 - ตี 4:50 เวลาไทย
select cron.schedule(
  'bank-fill-nightly',
  '*/10 19-21 * * *',
  $$
  select net.http_post(
    url := 'https://eggofsxenrutwjmhzkvr.supabase.co/functions/v1/bank-fill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bank_fill_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
