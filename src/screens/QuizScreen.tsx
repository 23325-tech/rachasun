import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerResult, Question } from '../types';
import { DIFFICULTY_LABEL, DIFFICULTY_STARS, SUBJECTS } from '../data/subjects';
import { chapterName } from '../data/chapters';
import { getTimeLimitSec } from '../lib/timing';
import { calcPoints } from '../lib/scoring';
import { checkFillAnswer, formatFillAnswer } from '../lib/checkAnswer';
import { useCountdown } from '../hooks/useCountdown';
import { MathText } from '../components/MathText';
import { TimerBar } from '../components/TimerBar';
import { ChoiceList } from '../components/ChoiceList';
import { FillAnswerInput } from '../components/FillAnswerInput';
import { ReportPanel } from '../components/ReportPanel';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Alarm, BookOpenText, Confetti, Lightbulb, Star, XCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  questions: Question[];
  onFinish: (results: AnswerResult[]) => void;
  onQuit: () => void;
  /** รหัสหน้าตาตัวละคร แสดงท่าดีใจ/เสียใจตอนเฉลย */
  avatar?: string;
}

export function QuizScreen({ questions, onFinish, onQuit, avatar }: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [current, setCurrent] = useState<AnswerResult | null>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  const q = questions[index];
  const limitMs = getTimeLimitSec(q) * 1000;
  const revealed = current !== null;
  const totalScore = results.reduce((sum, r) => sum + r.points, 0) + (current?.points ?? 0);

  const finishQuestion = useCallback(
    (correct: boolean, given: AnswerResult['given'], remainingMs: number, timedOut: boolean) => {
      setCurrent({
        questionId: q.id,
        correct,
        timedOut,
        given,
        timeUsedMs: limitMs - remainingMs,
        points: calcPoints(correct, remainingMs, limitMs),
      });
    },
    [q.id, limitMs],
  );

  const { remainingMs, getRemainingMs } = useCountdown(limitMs, !revealed, index, () =>
    finishQuestion(false, null, 0, true),
  );

  // เลื่อนจอลงให้เห็นเฉลยทันทีหลังตอบ
  useEffect(() => {
    if (revealed) revealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [revealed]);

  const answerMcq =(i: number) => {
    if (revealed || q.type !== 'mcq') return;
    finishQuestion(i === q.answerIndex, i, getRemainingMs(), false);
  };

  const answerFill = (value: string) => {
    if (revealed || q.type !== 'fill') return;
    finishQuestion(checkFillAnswer(q.answer, value), value, getRemainingMs(), false);
  };

  const next = () => {
    if (!current) return;
    const all = [...results, current];
    if (index + 1 >= questions.length) {
      onFinish(all);
      return;
    }
    setResults(all);
    setCurrent(null);
    setIndex(index + 1);
    window.scrollTo({ top: 0 });
  };

  const subject = SUBJECTS[q.subject];
  const isLast = index + 1 >= questions.length;

  return (
    <div className="screen quiz">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onQuit} aria-label={t('ออกจากเกม', 'Quit game')}>
          ✕
        </button>
        <div className="quiz__progress">
          {t('ข้อ', 'Q')} {index + 1}/{questions.length}
        </div>
        <div className="quiz__score" aria-label={t('คะแนน', 'Score')}>
          <Star weight="fill" className="ico" /> {totalScore}
        </div>
      </header>

      <TimerBar remainingMs={revealed ? Math.max(0, limitMs - (current?.timeUsedMs ?? 0)) : remainingMs} limitMs={limitMs} />

      <article key={q.id} className="card question-card pop-in">
        <div className="question-card__meta">
          <span className="tag" style={{ background: subject.color }}>
            <subject.icon weight="fill" size={16} /> {subject.name}
          </span>
          <span className="tag tag--ghost">
            {'★'.repeat(DIFFICULTY_STARS[q.difficulty])} {DIFFICULTY_LABEL[q.difficulty]}
          </span>
          <span className="tag tag--ghost">{q.track === 'entrance' ? t('สอบเข้า', 'Entrance') : t('สอบปกติ', 'School')}</span>
          {q.chapter && chapterName(q.chapter) && <span className="tag tag--ghost"><BookOpenText weight="fill" className="ico" /> {chapterName(q.chapter)}</span>}
        </div>
        <MathText className="question-card__prompt" text={q.prompt} />
        {q.image && <img className="question-card__img" src={q.image} alt={q.imageAlt ?? ''} />}
      </article>

      {q.type === 'mcq' ? (
        <ChoiceList
          question={q}
          revealed={revealed}
          selected={typeof current?.given === 'number' ? current.given : null}
          onSelect={answerMcq}
        />
      ) : (
        <FillAnswerInput question={q} revealed={revealed} correct={current?.correct ?? null} onSubmit={answerFill} />
      )}

      {current && (
        <div ref={revealRef} className="reveal-sheet slide-up">
          <div className={`verdict ${current.correct ? 'verdict--good' : 'verdict--bad'}`}>
            {avatar && (
              <span className={`verdict__me ${current.correct ? 'react-happy' : 'react-sad'}`} aria-hidden>
                <PlayerAvatar code={avatar} size={46} />
              </span>
            )}
            {current.correct ? (
              <>
                <span className="verdict__emoji bounce">
              <Confetti weight="fill" size={34} />
            </span>
                <span>{t('ถูกต้อง!', 'Correct!')}</span>
                <span className="verdict__points">+{current.points}</span>
              </>
            ) : (
              <>
                <span className="verdict__emoji shake">
              {current.timedOut ? <Alarm weight="fill" size={34} /> : <XCircle weight="fill" size={34} />}
            </span>
                <span>{current.timedOut ? t('หมดเวลา!', 'Time\'s up!') : t('ผิดจ้า', 'Wrong')}</span>
              </>
            )}
          </div>
          {q.type === 'fill' && !current.correct && (
            <p className="reveal-sheet__answer">
              {t('เฉลย:', 'Answer:')} <strong>{formatFillAnswer(q.answer)}</strong>
            </p>
          )}
          <div className="reveal-sheet__explain">
            <span className="reveal-sheet__label"><Lightbulb weight="fill" className="ico" /> {t('คำอธิบาย', 'Explanation')}</span>
            <MathText text={q.explanation} />
          </div>
          {q.source === 'bank' && <ReportPanel key={q.id} questionId={q.id} />}
          <button type="button" className="btn btn--primary btn--block btn--big" onClick={next}>
            {isLast ? t('ดูผลลัพธ์', 'See results') : t('ข้อต่อไป ➜', 'Next ➜')}
          </button>
        </div>
      )}
    </div>
  );
}
