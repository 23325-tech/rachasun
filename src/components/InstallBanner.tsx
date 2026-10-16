import { useState } from 'react';
import { useInstallPrompt } from '../hooks/usePwa';
import { DownloadSimple } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

/** ชวนติดตั้งแอพลงหน้าจอหลัก (ซ่อนเองเมื่อเปิดจากแอพที่ติดตั้งแล้ว) */
export function InstallBanner() {
  const { kind, install, dismiss } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);
  if (!kind) return null;

  return (
    <div className="install-banner pop-in">
      <img className="install-banner__icon" src="/pwa-192.png" alt="" />
      <div className="install-banner__body">
        <strong>{t('ติดตั้ง Brain Gym', 'Install Brain Gym')}</strong>
        <span>{t('เปิดเต็มจอเหมือนแอพ เข้าเร็วจากหน้าจอหลัก', 'Full screen like an app, quick from your home screen')}</span>
        {showIosHelp && (
          <ol className="install-banner__steps">
            <li>
              {t('กดปุ่ม', 'Tap')} <b>{t('แชร์', 'Share')}</b> {t('(สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่าง Safari', '(square with an up arrow) at the bottom of Safari')}
            </li>
            <li>
              {t('เลือก', 'Choose')} <b>{t('เพิ่มไปยังหน้าจอโฮม', 'Add to Home Screen')}</b>
            </li>
            <li>
              {t('กด', 'Tap')} <b>{t('เพิ่ม', 'Add')}</b>
            </li>
          </ol>
        )}
      </div>
      <div className="install-banner__actions">
        {kind === 'button' ? (
          <button type="button" className="btn btn--primary install-banner__btn" onClick={install}>
            <DownloadSimple weight="fill" className="ico" /> {t('ติดตั้ง', 'Install')}
          </button>
        ) : (
          !showIosHelp && (
            <button type="button" className="btn btn--primary install-banner__btn" onClick={() => setShowIosHelp(true)}>
              <DownloadSimple weight="fill" className="ico" /> {t('วิธีติดตั้ง', 'How to install')}
            </button>
          )
        )}
        <button type="button" className="install-banner__close" onClick={dismiss} aria-label={t('ปิด', 'Close')}>
          ✕
        </button>
      </div>
    </div>
  );
}
