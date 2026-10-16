import { useEffect, useState } from 'react';

/** สถานะเน็ต (อัปเดตเมื่อเน็ตหลุด/กลับมา) */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'bg-install-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * ปุ่มติดตั้งแอพ
 * - Android/Chrome: ใช้ beforeinstallprompt กดปุ่มเดียวติดตั้ง
 * - iPhone/iPad (Safari): ไม่มีปุ่มติดตั้งอัตโนมัติ ต้องแนะนำให้กดแชร์ -> เพิ่มไปยังหน้าจอโฮม
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* โหมดส่วนตัว */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return {
    /** แสดงอะไรไหม: 'button' (Android), 'ios' (คำแนะนำ), null (ติดตั้งแล้ว/ปิดไปแล้ว/ไม่รองรับ) */
    kind: standalone || dismissed ? null : deferred ? ('button' as const) : ios ? ('ios' as const) : null,
    install,
    dismiss,
  };
}
