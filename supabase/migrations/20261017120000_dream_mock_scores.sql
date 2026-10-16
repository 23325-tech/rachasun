-- =========================================================
-- สเต็ป 25.2: คะแนนจำลองสอบรายวิชาสำหรับเป้าคณะในฝัน
--   ใช้ค่าเฉลี่ย 3 ครั้งล่าสุดที่ส่งแล้ว (เต็มชุดและครึ่งชุด คะแนนเต็ม 100 ทั้งคู่)
-- =========================================================

create function public.my_mock_scores()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(exam, jsonb_build_object('avg', round(avg_score, 2), 'n', n, 'last', last_score, 'lastAt', last_at)), '{}'::jsonb)
  from (
    select exam,
           avg(score) avg_score,
           count(*) n,
           (array_agg(score order by submitted_at desc))[1] last_score,
           max(submitted_at) last_at
      from (
        select p.exam, a.score, a.submitted_at,
               row_number() over (partition by p.exam order by a.submitted_at desc) rn
          from public.mock_attempts a
          join public.mock_papers p on p.id = a.paper_id
         where a.user_id = auth.uid() and a.submitted_at is not null and a.score is not null
      ) x
     where rn <= 3
     group by exam
  ) s;
$$;
grant execute on function public.my_mock_scores() to authenticated;
