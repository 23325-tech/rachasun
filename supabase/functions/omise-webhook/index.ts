// Edge Function: Omise แจ้งผลการจ่ายเงิน (ตั้ง URL นี้ในหน้า Webhooks ของ Omise)
// Omise ไม่ได้เซ็นข้อความ จึงไม่เชื่อข้อมูลที่ส่งมา: ดึงสถานะจริงจาก Omise ด้วย secret key ทุกครั้ง
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCharge } from '../_shared/omise.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  try {
    const event = await req.json().catch(() => null);
    const obj = event?.data;
    if (obj?.object === 'charge' && typeof obj.id === 'string' && /^chrg_[a-z0-9_]+$/i.test(obj.id)) {
      const charge = await getCharge(obj.id);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await admin.rpc('settle_payment', { p_charge_id: charge.id, p_status: charge.status });
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
  }
  // ตอบ 200 เสมอ (สถานะจริงเช็กซ้ำได้จากหน้าเว็บอยู่แล้ว)
  return new Response('ok');
});
