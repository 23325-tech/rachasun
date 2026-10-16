-- สเต็ป 9.1: แต้มแรงค์ (RP) จากห้องสุ่มจับคู่ (ยศคำนวณจาก RP ใน supabase/functions/_shared/rank.ts)
alter table public.profiles add column rp int not null default 0 check (rp >= 0);

-- เรียกได้เฉพาะเซิร์ฟเวอร์ (room-game) RP ต่ำสุด 0
create function public.apply_rank_points(p_user uuid, p_delta int)
returns table (rp_delta int, rp_total int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_old int;
begin
  select rp into v_old from public.profiles where id = p_user for update;
  if not found then
    return;
  end if;
  return query
  update public.profiles p
     set rp = greatest(0, p.rp + p_delta)
   where p.id = p_user
  returning p.rp - v_old, p.rp;
end;
$$;

revoke execute on function public.apply_rank_points(uuid, int) from public, anon, authenticated;
grant execute on function public.apply_rank_points(uuid, int) to service_role;
