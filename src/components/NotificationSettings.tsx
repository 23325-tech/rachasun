import { useEffect, useState } from 'react';
import { Bell, BellSlash } from '@phosphor-icons/react';
import { t } from '../lib/i18n';
import {
  currentSubscription,
  disablePush,
  enablePush,
  fetchNotifPrefs,
  iosNeedsInstall,
  pushSupported,
  saveNotifPrefs,
  sendTestPush,
  type NotifPrefs,
} from '../lib/push';

const KINDS: { key: keyof Omit<NotifPrefs, 'devices'>; label: () => string; hint: () => string }[] = [
  { key: 'homework', label: () => t('การบ้านใกล้ครบกำหนด', 'Homework due soon'), hint: () => t('ก่อนครบกำหนด 24 ชม. ถ้ายังไม่ได้ทำ', '24h before the due time if not done') },
  { key: 'countdown', label: () => t('นับถอยหลังวันสอบ', 'Exam countdown'), hint: () => t('เหลือ 100, 30, 7 และ 1 วัน ตามเป้าอันดับ 1', '100, 30, 7 and 1 days before, from goal #1') },
  { key: 'mistakes', label: () => t('สมุดข้อผิดถึงรอบ', 'Mistake reviews due'), hint: () => t('วันละครั้งตอน 18:00', 'Once a day at 18:00') },
  { key: 'league', label: () => t('ผลลีกแคลน', 'Clan league results'), hint: () => t('ทุกวันจันทร์', 'Every Monday') },
  { key: 'cheers', label: () => t('สรุปเชียร์จากเพื่อน', 'Cheers from your clan'), hint: () => t('รวมเป็นวันละครั้งตอน 19:00', 'One daily round-up at 19:00') },
];

/** ตั้งค่าแจ้งเตือน Web Push: เปิด/ปิดบนเครื่องนี้ + เลือกเรื่องที่อยากรับ */
export function NotificationSettings() {
  const [on, setOn] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    currentSubscription()
      .then((s) => setOn(!!s))
      .catch(() => setOn(false));
    fetchNotifPrefs()
      .then(setPrefs)
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!pushSupported() || iosNeedsInstall()) {
    return (
      <section className="settings-card notif">
        <h2 className="section-title section-title--dark">
          <Bell weight="fill" className="ico" /> {t('การแจ้งเตือน', 'Notifications')}
        </h2>
        <p className="muted notif__note">
          {iosNeedsInstall()
            ? t('บน iPhone/iPad ต้องกด "แชร์" แล้ว "เพิ่มไปยังหน้าจอโฮม" ก่อน แล้วเปิดแอปจากหน้าจอโฮมเพื่อเปิดแจ้งเตือน', 'On iPhone/iPad, tap Share → "Add to Home Screen" first, then open the app from the home screen to turn on notifications.')
            : t('เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน', "This browser doesn't support notifications yet.")}
        </p>
      </section>
    );
  }

  return (
    <section className="settings-card notif">
      <h2 className="section-title section-title--dark">
        <Bell weight="fill" className="ico" /> {t('การแจ้งเตือน', 'Notifications')}
      </h2>
      <p className="muted notif__note">{t('ไม่แจ้งช่วง 21:00-07:00 และไม่เกินวันละ 2 ครั้ง', 'Never between 21:00-07:00, and at most 2 a day')}</p>
      {on ? (
        <div className="notif__row">
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() =>
              run(async () => {
                const sent = await sendTestPush();
                setMsg(t(`ส่งแล้ว ${sent} เครื่อง`, `Sent to ${sent} device(s)`));
              })
            }>
            {t('ส่งทดสอบ', 'Send test')}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await disablePush();
                setOn(false);
              })
            }
          >
            <BellSlash weight="bold" className="ico" /> {t('ปิดบนเครื่องนี้', 'Turn off here')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy || on === null}
          onClick={() =>
            run(async () => {
              await enablePush();
              setOn(true);
              setPrefs(await fetchNotifPrefs());
            })
          }
        >
          <Bell weight="fill" className="ico" /> {t('เปิดแจ้งเตือนบนเครื่องนี้', 'Turn on notifications')}
        </button>
      )}
      {on && prefs && (
        <ul className="notif__kinds">
          {KINDS.map((k) => (
            <li key={k.key}>
              <label className="toggle-row">
                <span className="toggle-row__text">
                  <b>{k.label()}</b>
                  <small>{k.hint()}</small>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={prefs[k.key]}
                  disabled={busy}
                  onChange={(e) => {
                    const next = { ...prefs, [k.key]: e.target.checked };
                    setPrefs(next);
                    void run(() => saveNotifPrefs(next));
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="dream__saved">{msg}</p>}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
