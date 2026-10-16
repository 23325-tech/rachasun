import { useEffect, useRef, useState } from 'react';
import { Camera, ChalkboardTeacher, ImageSquare, ShieldCheck, Sparkle } from '@phosphor-icons/react';
import { MathText } from '../components/MathText';
import { TutorSheet } from '../components/TutorSheet';
import { t } from '../lib/i18n';
import { TutorError, fetchTutorQuota, photoTutor, shrinkImage, type TutorQuestion, type TutorQuota, type TutorTurn } from '../lib/tutor';

interface Props {
  onBack: () => void;
}

/** ถ่ายรูปโจทย์ -> AI ถอดโจทย์ แล้วใบ้ทีละขั้น (รูปไม่ถูกเก็บ ส่งไปให้ AI อ่านแล้วทิ้ง) */
export function PhotoTutorScreen({ onBack }: Props) {
  const [quota, setQuota] = useState<TutorQuota | null>(null);
  const [image, setImage] = useState<{ base64: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ question: TutorQuestion; initial: TutorTurn[] } | null>(null);
  const [open, setOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTutorQuota('photo').then(setQuota).catch(() => {});
  }, []);

  const left = quota ? Math.max(0, quota.limit - quota.used) : null;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setResult(null);
    try {
      setImage(await shrinkImage(file));
    } catch {
      setError(t('เปิดรูปนี้ไม่ได้ ลองรูปอื่น', "Couldn't open this image, try another"));
    }
  };

  const send = async () => {
    if (!image || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await photoTutor(image.base64);
      setQuota(res.quota);
      setResult({ question: res.question, initial: [{ role: 'tutor', kind: 'hint', text: res.reply }] });
      setOpen(true);
    } catch (err) {
      if (err instanceof TutorError && err.quota) setQuota(err.quota);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen photo-tutor">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Camera weight="fill" className="ico" /> {t('ถ่ายรูปโจทย์', 'Snap a problem')}
        </div>
      </header>

      <section className="settings-card photo-tutor__pick">
        <p className="muted" style={{ margin: 0 }}>
          {t('ถ่ายโจทย์ที่ทำไม่ได้ 1 ข้อ AI จะอ่านโจทย์แล้วใบ้ทีละขั้นให้ลองคิดเอง', 'Snap one problem you are stuck on. The AI reads it and hints step by step.')}
        </p>
        <button type="button" className="photo-tutor__drop" onClick={() => cameraRef.current?.click()} disabled={busy}>
          {image ? (
            <img src={image.url} alt={t('รูปโจทย์', 'Problem photo')} />
          ) : (
            <>
              <Camera weight="fill" size={48} />
              {t('แตะเพื่อถ่ายรูป', 'Tap to take a photo')}
            </>
          )}
        </button>
        <div className="photo-tutor__row">
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera weight="fill" className="ico" /> {image ? t('ถ่ายใหม่', 'Retake') : t('ถ่ายรูป', 'Camera')}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => galleryRef.current?.click()}>
            <ImageSquare weight="fill" className="ico" /> {t('เลือกรูป', 'Gallery')}
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" className="btn btn--primary btn--block btn--big" disabled={!image || busy || left === 0} onClick={send}>
          <Sparkle weight="fill" className="ico" /> {busy ? t('AI กำลังอ่านโจทย์...', 'AI is reading...') : t('ให้ AI ช่วยอธิบาย', 'Ask the AI')}
        </button>
        {quota && (
          <p className="muted photo-tutor__note">
            {t(`เหลือ ${left}/${quota.limit} รูปวันนี้`, `${left}/${quota.limit} photos left today`)}
            {quota.limit < 5 && t(' · สมัครสมาชิกได้วันละ 5 รูป', ' · members get 5 a day')}
          </p>
        )}
        <p className="muted photo-tutor__note">
          <ShieldCheck weight="fill" /> {t('รูปไม่ถูกเก็บไว้ ส่งให้ AI อ่านแล้วทิ้งทันที', 'Photos are not stored: the AI reads them and they are discarded')}
        </p>
        {error && <p className="form-error">{error}</p>}
      </section>

      {result && (
        <section className="settings-card photo-tutor__read">
          <h2 className="section-title section-title--dark">{t('โจทย์ที่ AI อ่านได้', 'What the AI read')}</h2>
          <MathText text={result.question.ctx.prompt} />
          {result.question.ctx.choices && (
            <ul className="photo-tutor__choices">
              {result.question.ctx.choices.map((c, i) => (
                <li key={i}>
                  <MathText text={c} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="tutor-open" onClick={() => setOpen(true)}>
            <ChalkboardTeacher weight="fill" size={22} />
            <span>
              <strong>{t('คุยกับ AI ติวเตอร์ต่อ', 'Continue with the AI tutor')}</strong>
            </span>
          </button>
        </section>
      )}
      {open && result && <TutorSheet question={result.question} initial={result.initial} onClose={() => setOpen(false)} />}
    </div>
  );
}
