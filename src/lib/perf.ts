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

const SAVER_KEY = 'bg_data_saver';

/** ผู้ใช้ตั้งโหมดประหยัดเน็ตเอง: '1' เปิด / '0' ปิด / ไม่มี = ตามเครือข่าย */
export function dataSaverSetting(): '1' | '0' | null {
  try {
    const v = localStorage.getItem(SAVER_KEY);
    return v === '1' || v === '0' ? v : null;
  } catch {
    return null;
  }
}

export function setDataSaver(on: boolean | null) {
  try {
    if (on === null) localStorage.removeItem(SAVER_KEY);
    else localStorage.setItem(SAVER_KEY, on ? '1' : '0');
  } catch {
    /* โหมดส่วนตัว */
  }
}

/** เครือข่ายช้า หรือเครื่องเปิด Data Saver ไว้ */
export function slowNetwork(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === '2g' || c.effectiveType === 'slow-2g');
}

/** ประหยัดเน็ต: ไม่โหลด 3D/เอฟเฟกต์ ใช้รูปตัวละคร 2D */
export const dataSaver = () => {
  const s = dataSaverSetting();
  return s === null ? slowNetwork() : s === '1';
};

export const use3D = () => !reduce3DSetting() && !isLowEnd() && !dataSaver();
