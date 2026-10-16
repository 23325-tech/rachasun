-- สเต็ป 7 (ต่อ): การ์ดลดเวลาเพื่อน / เพิ่มเวลาตัวเอง / ยิงสวน
-- payload: slow/counter = { target }, extra = { deadline }
alter table public.room_card_uses drop constraint room_card_uses_card_check;
alter table public.room_card_uses
  add constraint room_card_uses_card_check check (card in ('fifty', 'slow', 'extra', 'counter'));
