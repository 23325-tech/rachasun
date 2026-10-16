import { createElement, lazy, Suspense, useMemo } from 'react';
import { chibiOf } from '../lib/look';
import { PlayerAvatar } from '../components/PlayerAvatar';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));
import type { AnswerResult, Question } from '../types';
import { SUBJECTS } from '../data/subjects';
import { MathText } from '../components/MathText';
import { XpBadge, type XpState } from '../components/XpBadge';
import { Alarm, ArrowsClockwise, Barbell, Check, Fire, House, Plant, Trophy, X } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  questions: Question[];
  results: AnswerResult[];
  onReplay: () => void;
  onHome: () => void;
  xp: XpState;
  guest: boolean;
  onRegister: () => void;
  /** รหัสหน้าตาตัวละคร (ท่าตามผลคะแนน) */
  avatar?: string;
}

function rankFor(accuracy: number) {
  if (accuracy >= 0.9) return { icon: Trophy, title: t('สุดยอด!', 'Outstanding!') };
  if (accuracy >= 0.7) return { icon: Fire, title: t('เก่งมาก!', 'Great job!') };
  if (accuracy >= 0.5) return { icon: Barbell, title: t('ดีเลย สู้ต่อ!', 'Nice, keep going!') };
  return { icon: Plant, title: t('ฝึกอีกนิดนะ!', 'A bit more practice!') };
}

export function ResultScreen({ questions, results, onReplay, onHome, xp, guest, onRegister, avatar }: Props) {
  const total = results.reduce((s, r) => s + r.points, 0);
  const correct = results.filter((r) => r.correct).length;
  const accuracy = results.length ? correct / results.length : 0;
  const answered = results.filter((r) => !r.timedOut);
  const avgSec = answered.length ? answered.reduce((s, r) => s + r.timeUsedMs, 0) / answered.length / 1000 : 0;
  const rank = rankFor(accuracy);
  const pose = accuracy >= 0.7 ? 'cheer' : accuracy >= 0.5 ? 'clap' : 'sad';
  const look = useMemo(() => chibiOf(avatar), [avatar]);

  return (
    <div className="screen result">
      <header className="result__hero pop-in">
        {avatar ? (
          <Suspense fallback={<PlayerAvatar code={avatar} size={150} framing="full" className="is-bare" />}>
            <Avatar3D look={look} code={avatar} pose={pose} className="avatar3d result__me" />
          </Suspense>
        ) : (
          <div className="result__emoji bounce">
            <rank.icon weight="fill" size={72} />
          </div>
        )}
        <h1 className="result__title">
          {avatar && <rank.icon weight="fill" className="ico" />} {rank.title}
        </h1>
        <div className="result__score">{total.toLocaleString()} {t('คะแนน', 'points')}</div>
      </header>

      <XpBadge xp={xp} guest={guest} onRegister={onRegister} />

      <div className="stats">
        <div className="stat">
          <div className="stat__num">
            {correct}/{results.length}
          </div>
          <div className="stat__label">{t('ตอบถูก', 'Correct')}</div>
        </div>
        <div className="stat">
          <div className="stat__num">{Math.round(accuracy * 100)}%</div>
          <div className="stat__label">{t('ความแม่น', 'Accuracy')}</div>
        </div>
        <div className="stat">
          <div className="stat__num">{avgSec.toFixed(1)}s</div>
          <div className="stat__label">{t('เวลาเฉลี่ย', 'Avg. time')}</div>
        </div>
      </div>

      <ol className="review">
        {questions.map((q, i) => {
          const r = results[i];
          return (
            <li key={q.id} className={`review__item ${r?.correct ? 'is-correct' : 'is-wrong'}`}>
              <span className="review__mark">{r?.correct ? <Check weight="bold" /> : r?.timedOut ? <Alarm weight="fill" /> : <X weight="bold" />}</span>
              <span className="review__subject">{createElement(SUBJECTS[q.subject].icon, { weight: 'fill', size: 20, color: SUBJECTS[q.subject].color })}</span>
              <MathText className="review__prompt" text={q.prompt} />
              <span className="review__pts">+{r?.points ?? 0}</span>
            </li>
          );
        })}
      </ol>

      <div className="bottom-bar bottom-bar--row">
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          <House weight="fill" className="ico" /> {t('หน้าแรก', 'Home')}
        </button>
        <button type="button" className="btn btn--primary btn--grow" onClick={onReplay}>
          {t('เล่นอีกครั้ง', 'Play again')} <ArrowsClockwise weight="fill" className="ico" />
        </button>
      </div>
    </div>
  );
}
