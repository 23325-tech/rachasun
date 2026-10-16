import { createElement, useEffect, useState } from 'react';
import { BookBookmark, CalendarCheck, CheckCircle, Clock, Lightning, Plant } from '@phosphor-icons/react';
import type { Subject } from '../types';
import { SUBJECTS } from '../data/subjects';
import { chapterName } from '../data/chapters';
import { t } from '../lib/i18n';
import { fetchMistakes, type MistakeState } from '../lib/mistakes';

interface Props {
  onBack: () => void;
  /** เริ่มรอบทบทวน (all = ล่วงหน้า) */
  onReview: (all: boolean) => Promise<void>;
}

const BOXES = [
  { box: '1', label: () => t('1 วัน', '1 day') },
  { box: '2', label: () => t('3 วัน', '3 days') },
  { box: '3', label: () => t('7 วัน', '7 days') },
  { box: '4', label: () => t('14 วัน', '14 days') },
];

function untilText(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  const h = Math.max(1, Math.round(ms / 3_600_000));
  return h >= 24 ? t(`อีก ${Math.round(h / 24)} วัน`, `in ${Math.round(h / 24)}d`) : t(`อีก ${h} ชม.`, `in ${h}h`);
}

/** สมุดข้อผิด: ข้อที่เคยผิดกลับมาทบทวนตามรอบความจำ 1 -> 3 -> 7 -> 14 วัน */
export function MistakeScreen({ onBack, onReview }: Props) {
  const [state, setState] = useState<MistakeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMistakes()
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const start = async (all: boolean) => {
    setBusy(true);
    setError('');
    try {
      await onReview(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const maxBox = state ? Math.max(1, state.graduated, ...BOXES.map((b) => state.boxes[b.box] ?? 0)) : 1;

  return (
    <div className="screen mistakes">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <BookBookmark weight="fill" className="ico" /> {t('สมุดข้อผิด', 'Mistake notebook')}
        </div>
      </header>

      {!state && !error && <p className="muted analysis__loading">{t('กำลังโหลด...', 'Loading...')}</p>}

      {state && state.active === 0 && state.graduated === 0 && (
        <section className="settings-card mistakes__empty">
          <Plant weight="fill" size={44} />
          <p>
            {t(
              'ยังไม่มีข้อผิดเลย! ตอบผิดเมื่อไหร่ ข้อนั้นจะมาอยู่ที่นี่ แล้ววนกลับมาให้ทบทวนตามรอบ 1 → 3 → 7 → 14 วัน จนจำได้จริง',
              'No mistakes yet! Any question you miss lands here and comes back on a 1 → 3 → 7 → 14 day schedule until you really know it.',
            )}
          </p>
        </section>
      )}

      {state && (state.active > 0 || state.graduated > 0) && (
        <>
          <section className={`settings-card mistakes__today ${state.due > 0 ? 'has-due' : ''}`}>
            <div className="mistakes__due">
              <strong>{state.due}</strong>
              <span>{t('ข้อ ครบกำหนดทบทวนวันนี้', 'due for review today')}</span>
            </div>
            {state.due > 0 ? (
              <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={() => start(false)}>
                <Lightning weight="fill" className="ico" /> {t(`ทบทวนวันนี้ (${Math.min(state.due, 10)} ข้อ)`, `Review now (${Math.min(state.due, 10)})`)}
              </button>
            ) : (
              <p className="mistakes__clear">
                <CheckCircle weight="fill" className="ico" /> {t('ทบทวนครบแล้ววันนี้', 'All caught up today')}
                {state.nextDueAt && (
                  <small>
                    <Clock weight="bold" size={12} /> {t('รอบถัดไป', 'Next')} {untilText(state.nextDueAt)}
                  </small>
                )}
              </p>
            )}
            {state.active > state.due && (
              <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={() => start(true)}>
                {t('ทบทวนล่วงหน้า', 'Review ahead')}
              </button>
            )}
          </section>

          <section className="settings-card">
            <h2 className="section-title section-title--dark">
              <CalendarCheck weight="fill" className="ico" /> {t('รอบความจำ', 'Memory boxes')}
            </h2>
            <div className="mistakes__boxes">
              {BOXES.map((b) => {
                const n = state.boxes[b.box] ?? 0;
                return (
                  <div key={b.box} className={`mistakes__box mistakes__box--${b.box}`}>
                    <span className="mistakes__bar" style={{ height: `${12 + (60 * n) / maxBox}px` }} />
                    <strong>{n}</strong>
                    <small>{b.label()}</small>
                  </div>
                );
              })}
              <div className="mistakes__box mistakes__box--done">
                <span className="mistakes__bar" style={{ height: `${12 + (60 * state.graduated) / maxBox}px` }} />
                <strong>{state.graduated}</strong>
                <small>{t('จำได้แล้ว', 'Learned')}</small>
              </div>
            </div>
            <p className="muted mistakes__hint">
              {t('ทบทวนตอนครบกำหนดแล้วตอบถูก = เลื่อนไปรอบถัดไป · ตอบผิด = กลับไปรอบ 1 วัน', 'Correct when due = next box · wrong = back to 1 day')}
            </p>
          </section>

          {state.bySubject.length > 0 && (
            <section className="settings-card">
              <h2 className="section-title section-title--dark">{t('วิชาที่ผิดบ่อย', 'By subject')}</h2>
              <ul className="mistakes__list">
                {state.bySubject.map((s) => {
                  const info = SUBJECTS[s.subject as Subject];
                  return (
                    <li key={s.subject}>
                      <span>
                        {info && createElement(info.icon, { weight: 'fill', size: 16, color: info.color })} {info?.name ?? s.subject}
                      </span>
                      <span>
                        {s.active} {t('ข้อ', 'Qs')}
                        {s.due > 0 && <b className="mistakes__pill">{t(`ถึงกำหนด ${s.due}`, `${s.due} due`)}</b>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {state.byChapter.length > 0 && (
                <>
                  <h3 className="mistakes__sub">{t('บทที่ต้องระวัง', 'Watch-out chapters')}</h3>
                  <ul className="mistakes__list">
                    {state.byChapter.map((c) => (
                      <li key={c.chapter}>
                        <span>{chapterName(c.chapter) ?? c.chapter}</span>
                        <span>
                          {c.active} {t('ข้อ', 'Qs')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
