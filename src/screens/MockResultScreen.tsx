import { useState } from 'react';
import { MathText } from '../components/MathText';
import { chapterName } from '../data/chapters';
import { CHOICE5, type MockGiven, type MockReview, type MockReviewQuestion, paperTitle } from '../lib/mock';
import { BookOpenText, ChalkboardTeacher, ChartBar, CheckCircle, Confetti, Exam, XCircle, Trophy } from '@phosphor-icons/react';
import { t } from '../lib/i18n';
import { TutorSheet } from '../components/TutorSheet';
import type { TutorQuestion } from '../lib/tutor';

interface Props {
  review: MockReview;
  onBack: () => void;
  onAnalysis: () => void;
  onBoard: () => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function givenText(q: MockReviewQuestion, g: MockGiven): string {
  if (g === null || g === undefined || g === '') return t('ไม่ได้ตอบ', 'No answer');
  if (q.type === 'mcq5') return `${CHOICE5[g as number]}`;
  if (q.type === 'fill') return `${g}${q.unit ? ` ${q.unit}` : ''}`;
  return (g as (boolean | null)[]).map((x, k) => `${k + 1}) ${x === null ? '-' : x ? t('ถูก', 'T') : t('ผิด', 'F')}`).join('  ');
}

function answerText(q: MockReviewQuestion): string {
  if (q.type === 'mcq5') return CHOICE5[q.answerIndex ?? 0];
  if (q.type === 'fill') return q.answerText ?? '';
  return (q.truths ?? []).map((v, k) => `${k + 1}) ${v ? t('ถูก', 'T') : t('ผิด', 'F')}`).join('  ');
}

/** ข้อสอบจำลอง -> ข้อมูลสำหรับ AI ติวเตอร์ (ไม่อยู่ในคลังโจทย์ ส่งเฉลยไปเอง) */
function tutorOf(q: MockReviewQuestion): TutorQuestion {
  const choice = (k: number) => `${CHOICE5[k]}. ${q.choices?.[k] ?? ''}`;
  return {
    ctx: {
      level: 'upper',
      subject: q.chapter.split('.')[1] ?? '',
      chapter: q.chapter,
      prompt: q.prompt + (q.unit ? ` (${q.unit})` : ''),
      choices: q.choices,
      statements: q.statements,
      answer: q.type === 'mcq5' ? choice(q.answerIndex ?? 0) : answerText(q),
      explanation: q.explanation,
      given: q.given === null || q.given === undefined || q.given === '' ? '' : q.type === 'mcq5' ? choice(q.given as number) : givenText(q, q.given),
    },
  };
}

/** ผลสอบจำลอง: คะแนน เทียบกับคนอื่น รายบท และเฉลยทุกข้อ */
export function MockResultScreen({ review, onBack, onAnalysis, onBoard }: Props) {
  const [filter, setFilter] = useState<'wrong' | 'all'>('wrong');
  const [tutorQ, setTutorQ] = useState<MockReviewQuestion | null>(null);
  const chapters = Object.entries(review.byChapter)
    .map(([id, v]) => ({ id, ...v, acc: v.ok / v.n }))
    .sort((a, b) => a.acc - b.acc);
  const shown = review.questions.filter((q) => filter === 'all' || !q.correct);
  const s = review.stats;

  return (
    <div className="screen mock-result">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          {paperTitle(review.title)} · {t('ชุด', 'Set')} {review.no}
          {review.half ? t(' (ครึ่งชุด)', ' (half)') : ''}
        </div>
      </header>

      <section className="settings-card mock-score">
        <span className="mock-score__big">{review.score.toFixed(2)}</span>
        <span className="muted">{t(`คะแนนเต็ม 100 · ถูก ${review.correct}/${review.total} ข้อ`, `Out of 100 · ${review.correct}/${review.total} correct`)}</span>
        <div className="analysis__summary">
          <div>
            <span className="analysis__big">{s.avg.toFixed(1)}</span>
            <span className="muted">{t('เฉลี่ยทุกคน', 'Average')}</span>
          </div>
          <div>
            <span className="analysis__big">{s.top.toFixed(1)}</span>
            <span className="muted">{t('สูงสุด', 'Top')}</span>
          </div>
          <div>
            <span className="analysis__big">{s.percentile === null ? '–' : `${s.percentile}%`}</span>
            <span className="muted">{t(`เก่งกว่า (${s.takers} คนทำ)`, `Percentile (${s.takers} takers)`)}</span>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark"><BookOpenText weight="fill" className="ico" /> {t('ผลรายบท', 'By chapter')}</h2>
        <ul className="analysis__chapters">
          {chapters.map((c) => (
            <li key={c.id} className={`analysis__row analysis__row--${c.acc >= 0.8 ? 'strong' : c.acc >= 0.6 ? 'ok' : 'weak'}`}>
              <div className="analysis__row-btn">
                <span className="analysis__row-name">{chapterName(c.id)}</span>
                <span className="analysis__row-status">
                  {c.ok}/{c.n} ({pct(c.acc)})
                </span>
                <span className="analysis__bar" aria-hidden>
                  <span style={{ width: pct(c.acc) }} />
                </span>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--primary btn--block" onClick={onBoard}>
          <Trophy weight="fill" className="ico" /> {t('ดูอันดับชุดนี้', 'See leaderboard')}
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onAnalysis}>
          <ChartBar weight="fill" className="ico" /> {t('ดูแผนฝึกจากผลสอบนี้', 'See a study plan from this exam')}
        </button>
      </section>

      <section className="settings-card">
        <div className="plan__head">
          <h2 className="section-title section-title--dark"><Exam weight="fill" className="ico" /> {t('เฉลย', 'Answers')}</h2>
          <div className="segmented">
            <button type="button" className={`segmented__opt ${filter === 'wrong' ? 'is-active' : ''}`} onClick={() => setFilter('wrong')}>
              {t('ข้อที่ผิด', 'Wrong only')}
            </button>
            <button type="button" className={`segmented__opt ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
              {t('ทุกข้อ', 'All')}
            </button>
          </div>
        </div>
        {shown.length === 0 && <p className="muted">{t('ไม่มีข้อที่ผิดเลย เก่งมาก!', 'No wrong answers — amazing!')} <Confetti weight="fill" className="ico" /></p>}
        <ol className="mock-review">
          {shown.map((q) => (
            <li key={q.i} className={`mock-review__item ${q.correct ? 'is-correct' : 'is-wrong'}`}>
              <details>
                <summary>
                  <span>{q.correct ? <CheckCircle weight="fill" color="#149066" /> : <XCircle weight="fill" color="#d23a51" />}</span>
                  <span>{t('ข้อ', 'Q')} {review.questions.indexOf(q) + 1}</span>
                  <span className="muted">{chapterName(q.chapter)}</span>
                </summary>
                <MathText className="mock-review__prompt" text={q.prompt} />
                {q.choices && (
                  <ol className="mock-review__choices">
                    {q.choices.map((c, k) => (
                      <li key={k} className={k === q.answerIndex ? 'is-answer' : k === q.given ? 'is-given' : ''}>
                        <strong>{CHOICE5[k]}.</strong> <MathText text={c} />
                      </li>
                    ))}
                  </ol>
                )}
                {q.statements && (
                  <ol className="mock-review__choices">
                    {q.statements.map((st, k) => (
                      <li key={k}>
                        <MathText text={st} />
                      </li>
                    ))}
                  </ol>
                )}
                <p>
                  {t('คำตอบของคุณ:', 'Your answer:')} <strong>{givenText(q, q.given)}</strong> · {t('เฉลย:', 'Answer:')} <strong>{answerText(q)}</strong>
                </p>
                <MathText className="mock-review__explain" text={q.explanation} />
                <button type="button" className="tutor-open" onClick={() => setTutorQ(q)}>
                  <ChalkboardTeacher weight="fill" size={22} />
                  <span>
                    <strong>{t('ยังไม่เข้าใจ?', 'Still confused?')}</strong> {t('ถาม AI ติวเตอร์', 'Ask the AI tutor')}
                  </span>
                </button>
              </details>
            </li>
          ))}
        </ol>
      </section>
      {tutorQ && <TutorSheet question={tutorOf(tutorQ)} onClose={() => setTutorQ(null)} />}
    </div>
  );
}
