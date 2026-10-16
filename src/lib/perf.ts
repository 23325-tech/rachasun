// ตัดสินว่าเครื่องนี้ควรแสดง 3D ไหม (เครื่องสเปกต่ำ / ผู้ใช้ปิดเอง = ใช้ภาพนิ่งแทน)
const KEY = 'bg_reduce_3d';

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

/** ผู้ใช้กดปิด 3D เอง */
export function reduce3DSetting(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setReduce3D(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* โหมดส่วนตัว */
  }
}

/** เครื่องอ่อน: RAM ≤ 2GB, CPU ≤ 2 คอร์, ไม่มี WebGL หรือขอลดการเคลื่อนไหว */
export function isLowEnd(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (!hasWebGL()) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export const use3D = () => !reduce3DSetting() && !isLowEnd();
