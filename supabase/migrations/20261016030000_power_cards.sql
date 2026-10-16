-- =========================================================
-- สเต็ป 7: การ์ดพลัง (โล่ + 50/50) ในห้องออนไลน์
-- จำนวนการ์ดในมืออยู่ใน rooms.state.players[].cards (เซิร์ฟเวอร์เป็นคนแก้)
-- =========================================================

-- ใช้การ์ดข้ามข้อ (50/50 บนข้อเติมคำตอบ)
alter table public.room_answers add column skipped boolean not null default false;

-- บันทึกการใช้การ์ด (ลับ): 50/50 บนข้อปรนัยเก็บตัวเลือกที่ถูกตัด เพื่อส่งให้เจ้าตัวคนเดียว
create table public.room_card_uses (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  card text not null check (card in ('fifty')),
  payload jsonb,
  created_at timestamptz not null default now(),
  primary key (room_id, round, user_id)
);

alter table public.room_card_uses enable row level security;
revoke all on public.room_card_uses from anon, authenticated;

-- เจ้าของห้อง (ห้องส่วนตัว) เลือกโหมด classic / items ในล็อบบี้
create function public.update_room_mode(p_room uuid, p_mode text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  if p_mode not in ('classic', 'items') then
    raise exception 'invalid_settings';
  end if;
  update public.rooms
     set mode = p_mode
   where id = p_room and host_id = auth.uid() and status <> 'playing' and kind = 'private'
  returning * into v_room;
  if not found then
    raise exception 'not_host';
  end if;
  return v_room;
end;
$$;

revoke execute on function public.update_room_mode(uuid, text) from public, anon;
grant execute on function public.update_room_mode(uuid, text) to authenticated;
