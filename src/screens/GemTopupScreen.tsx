import { useEffect, useState } from 'react';
import { CheckCircle, Diamond, QrCode, ShieldCheck, UserPlus, WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';
import { createTopup, topupStatus, type Topup } from '../lib/gems';
import type { GemPack } from '../lib/shop';

interface Props {
  packs: GemPack[];
  gems: number;
  guest: boolean;
  onBack: () => void;
  onAccount: () => void;
  /** เติมสำเร็จ: โหลดยอดใหม่ */
  onPaid: () => void;
}

/** เติมเพชรด้วยพร้อมเพย์: เลือกแพ็ก -> สแกน QR -> รอยืนยันจากเซิร์ฟเวอร์ */
export function GemTopupScreen({ packs, gems, guest, onBack, onAccount, onPaid }: Props) {
  const [topup, setTopup] = useState<Topup | null>(null);
  const [status, setStatus] = useState<'pending' | 'successful' | 'failed' | 'expired'>('pending');
  const [balance, setBalance] = useState(gems);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // เช็กสถานะทุก 3 วินาทีระหว่างแสดง QR
  useEffect(() => {
    if (!topup || status !== 'pending') return;
    const id = setInterval(() => {
      topupStatus(topup.paymentId)
        .then((r) => {
          setStatus(r.status);
          setBalance(r.gems);
          if (r.status === 'successful') onPaid();
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [topup, status, onPaid]);

  const buy = async (pack: GemPack) => {
    setBusy(pack.id);
    setError('');
    try {
      setTopup(await createTopup(pack.id));
      setStatus('pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const best = packs.reduce((b, p) => (p.gems / p.price > b.gems / b.price ? p : b), packs[0]);

  return (
    <div className="screen gems">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={topup && status === 'pending' ? () => setTopup(null) : onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Diamond weight="fill" className="ico" /> {t('เติมเพชร', 'Top up gems')}
        </div>
        <span className="coin-pill gem-pill">
          <Diamond weight="fill" size={16} /> {balance.toLocaleString()}
        </span>
      </header>

      {guest ? (
        <section className="settings-card gems__guest">
          <UserPlus weight="fill" size={40} />
          <p>{t('เติมเพชรได้เฉพาะสมาชิก สมัครก่อนเพื่อให้เพชรที่ซื้อไม่หายเมื่อเปลี่ยนเครื่อง', 'Only members can buy gems. Sign up so the gems you buy are never lost when you switch devices.')}</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onAccount}>
            {t('สมัครสมาชิก', 'Sign up')}
          </button>
        </section>
      ) : !topup ? (
        <>
          <div className="gems__packs">
            {packs.map((p) => (
              <button key={p.id} type="button" className="gem-pack" disabled={!!busy} onClick={() => buy(p)}>
                {p === best && <span className="gem-pack__tag">{t('คุ้มสุด', 'Best value')}</span>}
                <Diamond weight="fill" size={34} className="gem-pack__icon" />
                <strong>{p.gems}</strong>
                <small>{t('เพชร', 'gems')}</small>
                <span className="gem-pack__price">{busy === p.id ? t('กำลังสร้าง QR...', 'Creating QR...') : `฿${p.price}`}</span>
              </button>
            ))}
          </div>
          <p className="gems__note">
            <QrCode weight="fill" className="ico" /> {t('จ่ายด้วยพร้อมเพย์ สแกน QR จากแอปธนาคารไหนก็ได้', 'Pay with PromptPay — scan the QR with any banking app')}
          </p>
          <p className="gems__note">
            <ShieldCheck weight="fill" className="ico" /> {t('เพชรเข้าบัญชีอัตโนมัติหลังจ่ายสำเร็จ ใช้ซื้อของพิเศษในร้าน', 'Gems arrive automatically after payment; use them for special shop items')}
          </p>
        </>
      ) : status === 'successful' ? (
        <section className="settings-card gems__done pop-in">
          <CheckCircle weight="fill" size={56} />
          <h2>{t(`ได้ ${topup.gems} เพชรแล้ว!`, `You got ${topup.gems} gems!`)}</h2>
          <p className="muted">{t(`ยอดเพชรตอนนี้ ${balance}`, `Balance: ${balance} gems`)}</p>
          <button type="button" className="btn btn--primary btn--block btn--big" onClick={onBack}>
            {t('กลับไปร้านค้า', 'Back to shop')}
          </button>
        </section>
      ) : status === 'pending' ? (
        <section className="settings-card gems__qr">
          {topup.test && <p className="gems__test">{t('โหมดทดสอบ ไม่ตัดเงินจริง', 'Test mode — no real money')}</p>}
          <h2>
            ฿{topup.amount} · <Diamond weight="fill" className="ico" /> {topup.gems}
          </h2>
          {topup.qr ? <img className="gems__qr-img" src={topup.qr} alt={t('QR พร้อมเพย์', 'PromptPay QR')} /> : <p>{t('โหลด QR ไม่สำเร็จ', "Couldn't load the QR")}</p>}
          <p className="waiting">{t('สแกนจ่ายแล้วรอสักครู่ ระบบจะยืนยันเอง...', 'Scan to pay, then wait — we confirm automatically...')}</p>
          {topup.expiresAt && (
            <p className="muted">
              {t('QR หมดอายุ', 'QR expires')} {new Date(topup.expiresAt).toLocaleTimeString()}
            </p>
          )}
        </section>
      ) : (
        <section className="settings-card gems__done">
          <WarningCircle weight="fill" size={48} />
          <p>{status === 'expired' ? t('QR หมดอายุแล้ว', 'The QR has expired') : t('การจ่ายเงินไม่สำเร็จ', 'The payment failed')}</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => setTopup(null)}>
            {t('ลองใหม่', 'Try again')}
          </button>
        </section>
      )}

      {error && (
        <p className="form-error">
          <WarningCircle weight="fill" className="ico" /> {error}
        </p>
      )}
    </div>
  );
}
