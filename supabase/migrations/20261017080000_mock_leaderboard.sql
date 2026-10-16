-- =========================================================
-- สเต็ป 23: อันดับจำลองสอบ A-Level ต่อชุด (แยกเต็มชุด/ครึ่งชุด)
--   เรียงคะแนนมากไปน้อย เท่ากันใช้เวลาทำน้อยกว่าก่อน
--   ผู้เล่นเลือกไม่แสดงชื่อได้ (ขึ้นว่าผู้เล่นนิรนาม รูปตั้งต้น)
-- =========================================================

alter table public.profiles add column leaderboard_anon boolean not null default false;
grant update (leaderboard_anon) on public.profiles to authenticated;

create function public.mock_leaderboard(p_paper uuid, p_half boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select a.user_id, a.score, extract(epoch from (a.submitted_at - a.started_at))::int as secs,
           rank() over (order by a.score desc, (a.submitted_at - a.started_at)) as rnk
      from public.mock_attempts a
     where a.paper_id = p_paper and a.half = p_half and a.submitted_at is not null and a.score is not null
  )
  select jsonb_build_object(
    'takers', (select count(*) from ranked),
    'me', (select jsonb_build_object('rank', r.rnk, 'score', r.score, 'secs', r.secs) from ranked r where r.user_id = auth.uid()),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
          'rank', r.rnk,
          'score', r.score,
          'secs', r.secs,
          'isMe', r.user_id = auth.uid(),
          'anon', p.leaderboard_anon and r.user_id <> auth.uid(),
          'nickname', case when p.leaderboard_anon and r.user_id <> auth.uid() then null else p.nickname end,
          'tag', case when p.leaderboard_anon and r.user_id <> auth.uid() then null else p.tag end,
          'avatar', case when p.leaderboard_anon and r.user_id <> auth.uid() then null else p.avatar end
        ) order by r.rnk, r.secs)
        from (select * from ranked order by rnk, secs limit 100) r
        join public.profiles p on p.id = r.user_id
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.mock_leaderboard(uuid, boolean) to authenticated;
