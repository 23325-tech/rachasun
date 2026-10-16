import { useState } from 'react';
import { MathText } from '../components/MathText';
import { chapterName } from '../data/chapters';
import { CHOICE5, type MockGiven, type MockReview, type MockReviewQuestion } from '../lib/mock';

interface Props {
  review: MockReview;
  onBack: () => void;
  onAnalysis: () => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function givenText(q: MockReviewQuestion, g: MockGiven): string {
  if (g === null || g === undefined || g === '') return 'ไม่ได้ตอบ';
  if (q.type === 'mcq5') return `${CHOICE5[g as number]}`;
  if (q.type === 'fill') return `${g}${q.unit ? ` ${q.unit}` : ''}`;
  return (g as (boolean | null)[]).map((x, k) => `${k + 1}) ${x === null ? '-' : x ? 'ถูก' : 'ผิด'}`).join('  ');
}

function answerText(q: MockReviewQuestion): string {
  if (q.type === 'mcq5') return CHOICE5[q.answerIndex ?? 0];
  if (q.type === 'fill') return q.answerText ?? '';
  return (q.truths ?? []).map((t, k) => `${k + 1}) ${t ? 'ถูก' : 'ผิด'}`).join('  ');
}

/** ผลสอบจำลอง: คะแนน เทียบกับคนอื่น รายบท และเฉลยทุกข้อ */
export function MockResultScreen({ review, onBack, onAnalysis }: Props) {
  const [filter, setFilter] = useState<'wrong' | 'all'>('wrong');
  const chapters = Object.entries(review.byChapter)
    .map(([id, v]) => ({ id, ...v, acc: v.ok / v.n }))
    .sort((a, b) => a.acc - b.acc);
  const shown = review.questions.filter((q) => filter === 'all' || !q.correct);
  const s = review.stats;

  return (
    <div className="screen mock-result">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">
          {review.title} · ชุด {review.no}
          {review.half ? ' (ครึ่งชุด)' : ''}
        </div>
      </header>

      <section className="settings-card mock-score">
        <span className="mock-score__big">{review.score.toFixed(2)}</span>
        <span className="muted">คะแนนเต็ม 100 · ถูก {review.correct}/{review.total} ข้อ</span>
        <div className="analysis__summary">
          <div>
            <span className="analysis__big">{s.avg.toFixed(1)}</span>
            <span className="muted">เฉลี่ยทุกคน</span>
          </div>
          <div>
            <span className="analysis__big">{s.top.toFixed(1)}</span>
            <span className="muted">สูงสุด</span>
          </div>
          <div>
            <span className="analysis__big">{s.percentile === null ? '–' : `${s.percentile}%`}</span>
            <span className="muted">เก่งกว่า ({s.takers} คนทำ)</span>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">📖 ผลรายบท</h2>
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
        <button type="button" className="btn btn--ghost btn--block" onClick={onAnalysis}>
          📊 ดูแผนฝึกจากผลสอบนี้
        </button>
      </section>

      <section className="settings-card">
        <div className="plan__head">
          <h2 className="section-title section-title--dark">📝 เฉลย</h2>
          <div className="segmented">
            <button type="button" className={`segmented__opt ${filter === 'wrong' ? 'is-active' : ''}`} onClick={() => setFilter('wrong')}>
              ข้อที่ผิด
            </button>
            <button type="button" className={`segmented__opt ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
              ทุกข้อ
            </button>
          </div>
        </div>
        {shown.length === 0 && <p className="muted">ไม่มีข้อที่ผิดเลย เก่งมาก! 🎉</p>}
        <ol className="mock-review">
          {shown.map((q) => (
            <li key={q.i} className={`mock-review__item ${q.correct ? 'is-correct' : 'is-wrong'}`}>
              <details>
                <summary>
                  <span>{q.correct ? '✅' : '❌'}</span>
                  <span>ข้อ {review.questions.indexOf(q) + 1}</span>
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
                  คำตอบของคุณ: <strong>{givenText(q, q.given)}</strong> · เฉลย: <strong>{answerText(q)}</strong>
                </p>
                <MathText className="mock-review__explain" text={q.explanation} />
              </details>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
