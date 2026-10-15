import type { AnswerResult, Question } from '../types';
import { SUBJECTS } from '../data/subjects';
import { MathText } from '../components/MathText';

interface Props {
  questions: Question[];
  results: AnswerResult[];
  onReplay: () => void;
  onHome: () => void;
}

function rankFor(accuracy: number) {
  if (accuracy >= 0.9) return { emoji: '🏆', title: 'สุดยอด!' };
  if (accuracy >= 0.7) return { emoji: '🔥', title: 'เก่งมาก!' };
  if (accuracy >= 0.5) return { emoji: '💪', title: 'ดีเลย สู้ต่อ!' };
  return { emoji: '🌱', title: 'ฝึกอีกนิดนะ!' };
}

export function ResultScreen({ questions, results, onReplay, onHome }: Props) {
  const total = results.reduce((s, r) => s + r.points, 0);
  const correct = results.filter((r) => r.correct).length;
  const accuracy = results.length ? correct / results.length : 0;
  const answered = results.filter((r) => !r.timedOut);
  const avgSec = answered.length ? answered.reduce((s, r) => s + r.timeUsedMs, 0) / answered.length / 1000 : 0;
  const rank = rankFor(accuracy);

  return (
    <div className="screen result">
      <header className="result__hero pop-in">
        <div className="result__emoji bounce">{rank.emoji}</div>
        <h1 className="result__title">{rank.title}</h1>
        <div className="result__score">{total.toLocaleString()} คะแนน</div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat__num">
            {correct}/{results.length}
          </div>
          <div className="stat__label">ตอบถูก</div>
        </div>
        <div className="stat">
          <div className="stat__num">{Math.round(accuracy * 100)}%</div>
          <div className="stat__label">ความแม่น</div>
        </div>
        <div className="stat">
          <div className="stat__num">{avgSec.toFixed(1)}s</div>
          <div className="stat__label">เวลาเฉลี่ย</div>
        </div>
      </div>

      <ol className="review">
        {questions.map((q, i) => {
          const r = results[i];
          return (
            <li key={q.id} className={`review__item ${r?.correct ? 'is-correct' : 'is-wrong'}`}>
              <span className="review__mark">{r?.correct ? '✓' : r?.timedOut ? '⏰' : '✗'}</span>
              <span className="review__subject">{SUBJECTS[q.subject].emoji}</span>
              <MathText className="review__prompt" text={q.prompt} />
              <span className="review__pts">+{r?.points ?? 0}</span>
            </li>
          );
        })}
      </ol>

      <div className="bottom-bar bottom-bar--row">
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          🏠 หน้าแรก
        </button>
        <button type="button" className="btn btn--primary btn--grow" onClick={onReplay}>
          เล่นอีกครั้ง 🔁
        </button>
      </div>
    </div>
  );
}
