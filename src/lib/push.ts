import { ensureSession } from './supabase';
import { getLang, t } from './i18n';

/** VAPID public key (เปิดเผยได้) คู่กับ VAPID_PRIVATE_KEY ใน Supabase secrets */
const VAPID_PUBLIC_KEY = 'BGem7qHE2ANu55f3a09opH1gSiJCPn8a1sYCxo74rWJYhcD9cABoOxmKStSTM6dqU2cbnLS0wz7e-1lym8QVmz8';

export interface NotifPrefs {
  devices: number;
  homework: boolean;
  countdown: boolean;
  mistakes: boolean;
  league: boolean;
  cheers: boolean;
}

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhone/iPad ที่ยังไม่ได้ติดตั้งแอปลงหน้าจอโฮม (Web Push ใช้ได้เฉพาะแอปที่ติดตั้งแล้ว) */
export const iosNeedsInstall = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone);

function keyBytes(b64: string) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error(t('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน', "This browser doesn't support notifications"));
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(t('ยังไม่ได้อนุญาตการแจ้งเตือน เปิดได้ในการตั้งค่าเบราว์เซอร์', 'Notifications are blocked. Allow them in your browser settings.'));
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  const sb = await ensureSession();
  const { error } = await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_lang: getLang() });
  if (error) throw new Error(t('เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง', "Couldn't turn on notifications, please try again"));
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const sb = await ensureSession();
  await sb.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function fetchNotifPrefs(): Promise<NotifPrefs> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('my_notif_prefs');
  if (error) throw new Error(error.message);
  return data as NotifPrefs;
}

export async function saveNotifPrefs(p: NotifPrefs): Promise<void> {
  const sb = await ensureSession();
  const { error } = await sb.rpc('set_notif_prefs', { p_homework: p.homework, p_countdown: p.countdown, p_mistakes: p.mistakes, p_league: p.league, p_cheers: p.cheers });
  if (error) throw new Error(t('บันทึกไม่สำเร็จ', 'Could not save'));
}

export async function sendTestPush(): Promise<number> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke<{ sent?: number; error?: string }>('push-send', { body: { action: 'test' } });
  if (error || !data) throw new Error(t('ส่งไม่สำเร็จ รอสักครู่แล้วลองใหม่', 'Could not send, wait a moment and try again'));
  return data.sent ?? 0;
}
