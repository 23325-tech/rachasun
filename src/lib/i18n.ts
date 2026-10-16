import { useSyncExternalStore } from 'react';

/** ภาษาหน้าเว็บ (ตัวโจทย์ยังเป็นภาษาไทยเสมอ) */
export type Lang = 'th' | 'en';

const KEY = 'bg_lang';

function detect(): Lang {
  try {
    if (typeof localStorage === 'undefined') throw 0;
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    /* ใช้ค่าตามเครื่องแทน */
  }
  // ครั้งแรก: ตามภาษาเครื่อง
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return 'th';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs[0]?.toLowerCase().startsWith('th') ? 'th' : 'en';
}

let current: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;
const listeners = new Set<() => void>();

export const getLang = () => current;

/** เลือกข้อความตามภาษาปัจจุบัน: t('ไทย', 'English') */
export const t = (th: string, en: string) => (current === 'en' ? en : th);

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* จำไม่ได้ก็ไม่เป็นไร */
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

/** ให้คอมโพเนนต์วาดใหม่เมื่อเปลี่ยนภาษา */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLang,
    getLang,
  );
}
