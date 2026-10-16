// เรียก Omise API ด้วย secret key (อยู่ใน Supabase function secret OMISE_SECRET_KEY เท่านั้น)
const API = 'https://api.omise.co';

export interface OmiseCharge {
  id: string;
  status: 'pending' | 'successful' | 'failed' | 'expired' | 'reversed';
  amount: number;
  expires_at?: string;
  livemode: boolean;
  source?: { scannable_code?: { image?: { download_uri?: string } } };
}

function auth(): string {
  const key = Deno.env.get('OMISE_SECRET_KEY');
  if (!key) throw new Error('payments_not_configured');
  return 'Basic ' + btoa(key + ':');
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, { ...init, headers: { Authorization: auth(), ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.object === 'error') throw new Error(`omise: ${body?.code ?? res.status} ${body?.message ?? ''}`.trim());
  return body as T;
}

/** สร้างรายการพร้อมเพย์ (จำนวนเงินเป็นสตางค์) */
export function createPromptPayCharge(amountSatang: number, meta: Record<string, string>): Promise<OmiseCharge> {
  const form = new URLSearchParams({ amount: String(amountSatang), currency: 'thb', 'source[type]': 'promptpay' });
  for (const [k, v] of Object.entries(meta)) form.set(`metadata[${k}]`, v);
  return call<OmiseCharge>('/charges', { method: 'POST', body: form });
}

export const getCharge = (id: string) => call<OmiseCharge>(`/charges/${encodeURIComponent(id)}`);

/** รูป QR พร้อมเพย์ (โหลดฝั่งเซิร์ฟเวอร์แล้วส่งเป็น data URL) */
export async function qrDataUrl(charge: OmiseCharge): Promise<string | null> {
  const uri = charge.source?.scannable_code?.image?.download_uri;
  if (!uri) return null;
  const res = await fetch(uri, { headers: { Authorization: auth() } });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') ?? 'image/png';
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}
