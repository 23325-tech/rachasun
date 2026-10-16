import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FillQuestion, McqQuestion } from '../types';
import { answerQuestion, nextQuestion, type AsyncAnswerResult, type AsyncQuestion } from '../lib/asyncPlay';
import { serverNow } from '../lib/roomGame';
import { DIFFICULTY_LABEL, SUBJECTS } from '../data/subjects';
import { MathText } from '../components/MathText';
import { TimerBar } from '../components/TimerBar';
import { ChoiceList } from '../components/ChoiceList';
import { FillAnswerInput } from '../components/FillAnswerInput';
import { Alarm, Brain, Confetti, Hourglass, Lightbulb, Star, WarningCircle, XCircle } from '@phosphor-icons/react';

interface Props {
  playId: string;
  title: string;
  onDone: (result: { score: number; xp?: { gained: number; total: number } }) => void;
  onQuit: () => void;
}

/** เล่นชุดโจทย์ล็อก: เซิร์ฟเวอร์ส่งทีละข้อ จับเวลา และตรวจคำตอบเอง */
export function AsyncPlayScreen({ playId, title, onDone, onQuit }: Props) {
  const [cur, setCur] = useState<AsyncQuestion | null>(null);
  const [given, setGiven] = useState<number | string | null>(null);
  const [result, setResult] = useState<AsyncAnswerResult | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(serverNow());
  const sendingRef = useRef(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const n = await nextQuestion(playId);
      if ('done' in n) {
        onDone({ score: n.score });
        return;
      }
      setCur(n);
      setGiven(null);
      setResult(null);
      sendingRef.current = false;
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [playId, onDone]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 100);
    return () => clearInterval(id);
  }, []);

  const send = useCallback(
    async (value: number | string | null) => {
      if (!cur || result || sendingRef.current) return;
      sendingRef.current = true;
      setGiven(value);
      try {
        setResult(await answerQuestion(playId, cur.index, value));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [cur, result, playId],
  );

  // หมดเวลา -> ส่งว่า "ไม่ได้ตอบ"
  const remaining = cur ? Math.max(0, cur.deadline - now) : 0;
  useEffect(() => {
    if (cur && !result && remaining <= 0) send(null);
  }, [cur, result, remaining, send]);

  const q = cur?.question;
  const mcq = useMemo<McqQuestion | null>(
    () =>
      q?.type === 'mcq'
        ? {
            id: `a${cur!.index}`,
            type: 'mcq',
            subject: q.subject,
            difficulty: q.difficulty,
            track: 'school',
            prompt: q.prompt,
            explanation: '',
            choices: (q.choices ?? ['', '', '', '']) as McqQuestion['choices'],
            answerIndex: (result?.answerIndex ?? 0) as McqQuestion['answerIndex'],
          }
        : null,
    [q, cur, result],
  );
  const fill = useMemo<FillQuestion | null>(
    () =>
      q?.type === 'fill'
        ? {
            id: `a${cur!.index}`,
            type: 'fill',
            subject: q.subject,
            difficulty: q.difficulty,
            track: 'school',
            prompt: q.prompt,
            explanation: '',
            answer: q.answerKind === 'number' ? { kind: 'number', value: 0, unit: q.unit } : { kind: 'text', accepted: [] },
          }
        : null,
    [q, cur],
  );

  if (!cur || !q) {
    return (
      <div className="screen loading">
        <div className="loading__brain"><Brain weight="fill" className="ico" /></div>
        <p className="loading__msg">{error || 'กำลังโหลดโจทย์...'}</p>
        {error && (
          <button type="button" className="btn btn--ghost" onClick={load}>
            ลองใหม่
          </button>
        )}
      </div>
    );
  }

  const subject = SUBJECTS[q.subject];
  const locked = given !== null || !!result || remaining <= 0;
  const isLast = cur.index + 1 >= cur.total;

  return (
    <div className="screen quiz">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onQuit} aria-label="ออก (เล่นต่อทีหลังได้)">
          ✕
        </button>
        <div className="quiz__progress">
          {title} · ข้อ {cur.index + 1}/{cur.total}
        </div>
        <div className="quiz__score"><Star weight="fill" className="ico" /> {result ? result.score : cur.score}</div>
      </header>

      <TimerBar remainingMs={result ? 0 : remaining} limitMs={cur.limitMs} />

      <article key={`q-${cur.index}`} className="card question-card pop-in">
        <div className="question-card__meta">
          <span className="tag" style={{ background: subject.color }}>
            <subject.icon weight="fill" size={16} /> {subject.name}
          </span>
          <span className="tag tag--ghost">{DIFFICULTY_LABEL[q.difficulty]}</span>
        </div>
        <MathText className="question-card__prompt" text={q.prompt} />
      </article>

      {mcq && (
        <ChoiceList
          key={`c-${cur.index}`}
          question={mcq}
          revealed={locked}
          showAnswer={!!result}
          selected={typeof given === 'number' ? given : null}
          onSelect={(i) => send(i)}
        />
      )}
      {fill && (
        <FillAnswerInput
          key={`f-${cur.index}`}
          question={fill}
          revealed={locked}
          correct={result ? result.correct : null}
          onSubmit={(v) => send(v)}
        />
      )}

      {!result && given !== null && !error && <p className="waiting"><Hourglass weight="fill" className="ico" /> กำลังตรวจคำตอบ...</p>}
      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}

      {result && (
        <div className="reveal-sheet slide-up">
          <div className={`verdict ${result.correct ? 'verdict--good' : 'verdict--bad'}`}>
            {result.correct ? (
              <>
                <span className="verdict__emoji bounce">
              <Confetti weight="fill" size={34} />
            </span>
                <span>ถูกต้อง!</span>
                <span className="verdict__points">+{result.points}</span>
              </>
            ) : (
              <>
                <span className="verdict__emoji shake">
              {result.timedOut ? <Alarm weight="fill" size={34} /> : <XCircle weight="fill" size={34} />}
            </span>
                <span>{result.timedOut ? 'หมดเวลา!' : 'ผิดจ้า'}</span>
              </>
            )}
          </div>
          {result.answerText !== undefined && !result.correct && (
            <p className="reveal-sheet__answer">
              เฉลย: <strong>{result.answerText}</strong>
            </p>
          )}
          <div className="reveal-sheet__explain">
            <span className="reveal-sheet__label"><Lightbulb weight="fill" className="ico" /> คำอธิบาย</span>
            <MathText text={result.explanation} />
          </div>
          <button
            type="button"
            className="btn btn--primary btn--block btn--big"
            onClick={() => (result.done ? onDone({ score: result.score, xp: result.xp }) : load())}
          >
            {isLast || result.done ? 'ดูอันดับ' : 'ข้อต่อไป ➜'}
          </button>
        </div>
      )}
    </div>
  );
}
