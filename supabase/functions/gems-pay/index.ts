// Edge Function: เติมเพชรด้วยพร้อมเพย์ (Omise)
//   { action: 'create', pack }   -> สร้าง QR
//   { action: 'status', paymentId } -> เช็กกับ Omise แล้วเพิ่มเพชรถ้าจ่ายแล้ว
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createPromptPayCharge, getCharge, qrDataUrl } from '../_shared/omise.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const user = auth.user;
    if (!user) return json({ error: 'not_signed_in' }, 401);

    const body = await req.json().catch(() => ({}));

    if (body.action === 'create') {
      // เติมเงินจริงได้เฉพาะสมาชิก (แขกล้างเครื่องแล้วเพชรหาย)
      if (user.is_anonymous) return json({ error: 'members_only' }, 403);
      const { data: pack } = await admin.from('gem_packs').select('*').eq('id', String(body.pack ?? '')).maybeSingle();
      if (!pack) return json({ error: 'pack_not_found' }, 400);

      // กันสร้างรายการค้างเยอะเกิน
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await admin
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('created_at', since);
      if ((count ?? 0) >= 5) return json({ error: 'too_many_pending' }, 429);

      const { data: pay, error } = await admin
        .from('payments')
        .insert({ user_id: user.id, pack_id: pack.id, amount_thb: pack.price_thb, gems: pack.gems })
        .select('id')
        .single();
      if (error) throw error;

      const charge = await createPromptPayCharge(pack.price_thb * 100, { payment_id: pay.id, user_id: user.id });
      await admin.from('payments').update({ charge_id: charge.id }).eq('id', pay.id);
      return json({
        paymentId: pay.id,
        qr: await qrDataUrl(charge),
        expiresAt: charge.expires_at ?? null,
        amount: pack.price_thb,
        gems: pack.gems,
        test: !charge.livemode,
      });
    }

    if (body.action === 'status') {
      const { data: pay } = await admin
        .from('payments')
        .select('id,status,charge_id,gems')
        .eq('id', String(body.paymentId ?? ''))
        .eq('user_id', user.id)
        .maybeSingle();
      if (!pay) return json({ error: 'payment_not_found' }, 404);
      let status = pay.status as string;
      if (status === 'pending' && pay.charge_id) {
        const charge = await getCharge(pay.charge_id);
        const { data } = await admin.rpc('settle_payment', { p_charge_id: pay.charge_id, p_status: charge.status });
        status = data === 'unknown' ? 'pending' : (data as string);
      }
      const { data: prof } = await admin.from('profiles').select('gems').eq('id', user.id).single();
      return json({ status, gems: prof?.gems ?? 0 });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return json({ error: msg.includes('payments_not_configured') ? 'payments_not_configured' : 'payment_error' }, 500);
  }
});
