-- =========================================================
-- สเต็ป 8.1: ลิงก์ท้าเพื่อน (ชุดโจทย์ล็อก + เล่นแยกเวลา)
-- ตารางในไฟล์นี้ลับทั้งหมด (เปิด RLS ไม่มี policy) เข้าถึงผ่าน Edge Function async-play
-- และฟังก์ชัน challenge_board ด้านล่างเท่านั้น
-- =========================================================

-- ชุดโจทย์ที่ล็อกไว้ (เก็บสำเนาโจทย์พร้อมเฉลย ให้ทุกคนได้ชุดเดียวกันแม้คลังจะเปลี่ยน)
create table public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('challenge', 'daily')),
  settings jsonb not null,
  questions jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- การเล่นของแต่ละคน (เล่นได้ชุดละครั้ง)
create table public.quiz_plays (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.quiz_sets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ข้อที่กำลังเล่น (0 = ข้อแรก) และเวลาที่เซิร์ฟเวอร์ส่งข้อนั้นให้
  idx int not null default 0,
  served_at timestamptz,
  score int not null default 0,
  correct int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (set_id, user_id)
);

create table public.quiz_play_answers (
  play_id uuid not null references public.quiz_plays (id) on delete cascade,
  idx int not null,
  given jsonb,
  correct boolean not null,
  time_ms int not null,
  points int not null,
  primary key (play_id, idx)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  set_id uuid not null references public.quiz_sets (id) on delete cascade,
  creator_id uuid references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.quiz_sets enable row level security;
alter table public.quiz_plays enable row level security;
alter table public.quiz_play_answers enable row level security;
alter table public.challenges enable row level security;
revoke all on public.quiz_sets, public.quiz_plays, public.quiz_play_answers, public.challenges from anon, authenticated;

-- ---------- ตารางอันดับคำท้า (ใครมีลิงก์ก็ดูได้) ----------
create function public.challenge_board(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', c.code,
    'settings', s.settings,
    'count', jsonb_array_length(s.questions),
    'expiresAt', c.expires_at,
    'expired', c.expires_at < now(),
    'creator', (select jsonb_build_object('nickname', p.nickname, 'tag', p.tag, 'avatar', p.avatar)
                  from public.profiles p where p.id = c.creator_id),
    'me', (select jsonb_build_object('started', true, 'finished', qp.finished_at is not null, 'score', qp.score)
             from public.quiz_plays qp where qp.set_id = c.set_id and qp.user_id = auth.uid()),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nickname', p.nickname, 'tag', p.tag, 'avatar', p.avatar,
               'score', qp.score, 'correct', qp.correct,
               'finished', qp.finished_at is not null,
               'isMe', qp.user_id = auth.uid(),
               'isCreator', qp.user_id = c.creator_id)
             order by (qp.finished_at is null), qp.score desc, qp.finished_at)
        from public.quiz_plays qp
        join public.profiles p on p.id = qp.user_id
       where qp.set_id = c.set_id
    ), '[]'::jsonb)
  )
  from public.challenges c
  join public.quiz_sets s on s.id = c.set_id
  where c.code = upper(trim(p_code))
$$;

revoke execute on function public.challenge_board(text) from public, anon;
grant execute on function public.challenge_board(text) to authenticated;
