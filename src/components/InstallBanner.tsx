import { useState } from 'react';
import { useInstallPrompt } from '../hooks/usePwa';

/** ชวนติดตั้งแอพลงหน้าจอหลัก (ซ่อนเองเมื่อเปิดจากแอพที่ติดตั้งแล้ว) */
export function InstallBanner() {
  const { kind, install, dismiss } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);
  if (!kind) return null;

  return (
    <div className="install-banner pop-in">
      <img className="install-banner__icon" src="/pwa-192.png" alt="" />
      <div className="install-banner__body">
        <strong>ติดตั้ง Brain Gym</strong>
        <span>เปิดเต็มจอเหมือนแอพ เข้าเร็วจากหน้าจอหลัก</span>
        {showIosHelp && (
          <ol className="install-banner__steps">
            <li>
              กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่าง Safari
            </li>
            <li>
              เลือก <b>เพิ่มไปยังหน้าจอโฮม</b>
            </li>
            <li>
              กด <b>เพิ่ม</b>
            </li>
          </ol>
        )}
      </div>
      <div className="install-banner__actions">
        {kind === 'button' ? (
          <button type="button" className="btn btn--primary install-banner__btn" onClick={install}>
            📲 ติดตั้ง
          </button>
        ) : (
          !showIosHelp && (
            <button type="button" className="btn btn--primary install-banner__btn" onClick={() => setShowIosHelp(true)}>
              📲 วิธีติดตั้ง
            </button>
          )
        )}
        <button type="button" className="install-banner__close" onClick={dismiss} aria-label="ปิด">
          ✕
        </button>
      </div>
    </div>
  );
}
