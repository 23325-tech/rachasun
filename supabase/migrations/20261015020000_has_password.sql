-- บัญชีที่ผูกอีเมลแล้ว (ตอนเปิด Confirm email) ต้องตั้งรหัสผ่านหลังยืนยันอีเมล
-- ฟังก์ชันนี้ให้แอพรู้ว่ายังไม่ได้ตั้ง เพื่อเตือนผู้เล่น (คืนค่าเฉพาะของตัวเอง ไม่เปิดเผยข้อมูลอื่น)
create function public.my_account_status()
returns table (has_password boolean, email_confirmed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password, '') <> '',
         u.email_confirmed_at is not null
    from auth.users u
   where u.id = auth.uid()
$$;

revoke execute on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated;
