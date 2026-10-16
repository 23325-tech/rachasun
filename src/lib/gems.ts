import { ensureSession } from './supabase';
import { t } from './i18n';

export interface Topup {
  paymentId: string;
  /** รูป QR พร้อมเพย์ (data URL) */
  qr: string | null;
  expiresAt: string | null;
  amount: number;
  gems: number;
  /** โหมดทดสอบของ Omise (ไม่ตัดเงินจริง) */
  test: boolean;
}

export type TopupStatus = 'pending' | 'successful' | 'failed' | 'expired';

const ERRORS: Record<string, string> = {
  get members_only() { return t('เติมเพชรได้เฉพาะสมาชิก สมัครก่อนนะ (กันเพชรหายถ้าเปลี่ยนเครื่อง)', 'Only members can buy gems — sign up first so gems are never lost'); },
  get too_many_pending() { return t('มีรายการรอจ่ายหลายรายการแล้ว รอสักครู่แล้วลองใหม่', 'Too many unpaid top-ups — please wait a moment'); },
  get payments_not_configured() { return t('ระบบจ่ายเงินยังไม่เปิด', 'Payments are not set up yet'); },
  get pack_not_found() { return t('ไม่พบแพ็กนี้', 'Pack not found'); },
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke<T & { error?: string }>('gems-pay', { body });
  if (error || !data || data.error) {
    let code = data?.error;
    // functions.invoke เก็บ body ของ error ไว้ใน context
    const ctx = (error as { context?: Response } | null)?.context;
    if (!code && ctx) code = (await ctx.json().catch(() => ({})))?.error;
    throw new Error(ERRORS[code ?? ''] ?? t('จ่ายเงินไม่สำเร็จ ลองใหม่อีกครั้ง', 'Payment failed, please try again'));
  }
  return data;
}

export const createTopup = (pack: string) => call<Topup>({ action: 'create', pack });
export const topupStatus = (paymentId: string) => call<{ status: TopupStatus; gems: number }>({ action: 'status', paymentId });
