import { createElement, useEffect, useState } from 'react';
import { listMocks, MOCK_ICON, type MockAttemptSummary, type MockExam, type MockPaper, paperTitle } from '../lib/mock';
import { Exam, WarningCircle, Wrench } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  onBack: () => void;
  onStart: (paperId: string, half: boolean) => Promise<void>;
  onReview: (attemptId: string) => void;
}

const EXAM_ORDER: MockExam[] = ['math1', 'math2', 'physics', 'chemistry', 'biology', 'english'];

/** เลือกวิชาและชุดข้อสอบจำลอง A-Level */
export function MockMenuScreen({ onBack, onStart, onReview }: Props) {
  const [data, setData] = useState<{ papers: MockPaper[]; attempts: MockAttemptSummary[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listMocks()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const begin = async (paperId: string, half: boolean) => {
    setBusy(`${paperId}:${half}`);
    setError('');
    try {
      await onStart(paperId, half);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  };

  const attemptOf = (paperId: string, half: boolean) => data?.attempts.find((a) => a.paperId === paperId && a.half === half);

  const button = (p: MockPaper, half: boolean) => {
    const a = attemptOf(p.id, half);
    const label = half
      ? t(`ครึ่งชุด · ${Math.ceil(p.count / 2)} ข้อ · ${p.minutes / 2} นาที`, `Half · ${Math.ceil(p.count / 2)} Qs · ${p.minutes / 2} min`)
      : t(`เต็มชุด · ${p.count} ข้อ · ${p.minutes} นาที`, `Full · ${p.count} Qs · ${p.minutes} min`);
    if (a?.submitted)
      return (
        <button type="button" className="mock-paper__btn is-done" onClick={() => onReview(a.id)}>
          <span>{label}</span>
          <strong>{a.score?.toFixed(2)} {t('คะแนน · ดูเฉลย', 'pts · review')}</strong>
        </button>
      );
    const resuming = a && !a.submitted;
    return (
      <button type="button" className="mock-paper__btn" disabled={!!busy} onClick={() => begin(p.id, half)}>
        <span>{label}</span>
        <strong>{busy === `${p.id}:${half}` ? t('กำลังเปิด...', 'Opening...') : resuming ? t('ทำต่อ', 'Resume') : t('เริ่มสอบ', 'Start exam')}</strong>
      </button>
    );
  };

  return (
    <div className="screen mock-menu">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress"><Exam weight="fill" className="ico" /> {t('จำลองสอบ A-Level', 'A-Level mock exam')}</div>
      </header>

      <section className="settings-card">
        <p className="mock-menu__intro">
          {t('ข้อสอบแนว A-Level แต่งใหม่โดย AI ตามสัดส่วนบทของข้อสอบจริง จับเวลาเหมือนสนามจริง', 'A-Level-style papers written by AI with the real chapter mix, timed like the real exam')}
          <br />
          <span className="muted">{t('ทำได้ชุดละ 1 ครั้งต่อความยาว เพื่อเทียบคะแนนกับคนอื่นได้ยุติธรรม · ออกกลางคันได้ แต่เวลายังเดินต่อ', 'One attempt per set and length so scores compare fairly · you can leave, but the clock keeps running')}</span>
        </p>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
      {!data && !error && <p className="muted analysis__loading">{t('กำลังโหลดชุดข้อสอบ...', 'Loading papers...')}</p>}

      {data &&
        EXAM_ORDER.map((exam) => {
          const papers = data.papers.filter((p) => p.exam === exam);
          if (!papers.length) return null;
          return (
            <section key={exam} className="settings-card mock-exam-card">
              <h2 className="section-title section-title--dark">
                {createElement(MOCK_ICON[exam], { weight: 'fill', size: 22 })} {paperTitle(papers[0].title)}
              </h2>
              {papers.map((p) => (
                <div key={p.id} className="mock-paper">
                  <span className="mock-paper__no">{t('ชุดที่', 'Set')} {p.no}</span>
                  {button(p, false)}
                  {button(p, true)}
                </div>
              ))}
            </section>
          );
        })}

      {data && !data.papers.length && (
        <section className="settings-card analysis__empty">
          <p className="analysis__big"><Wrench weight="fill" className="ico" /></p>
          <p>{t('กำลังเตรียมชุดข้อสอบ ลองกลับมาใหม่อีกสักพักนะ', 'Papers are being prepared — check back soon')}</p>
        </section>
      )}
    </div>
  );
}
