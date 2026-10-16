import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '../types';
import {
  alivePlayers,
  heartsFor,
  isAlive,
  isSuddenDeath,
  resolveRound,
  type BattlePlayer,
  type RoundAnswer,
  type RoundOutcome,
} from '../game/battle';
import { botAnswer, type Bot, type BotAnswer } from '../game/bots';
import { getTimeLimitSec } from '../lib/timing';
import { calcPoints } from '../lib/scoring';
import { checkFillAnswer, formatFillAnswer } from '../lib/checkAnswer';
import { useCountdown } from '../hooks/useCountdown';
import { MathText } from '../components/MathText';
import { TimerBar } from '../components/TimerBar';
import { ChoiceList } from '../components/ChoiceList';
import { FillAnswerInput } from '../components/FillAnswerInput';
import { PlayerGrid, type HitStage, type PlayerStatus } from '../components/PlayerGrid';
import { DIFFICULTY_LABEL, SUBJECTS } from '../data/subjects';
import { Eye, FlagCheckered, Lightbulb, Lightning, LockSimple, SkipForward, SmileyMeh, Users, WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';
import { buildShots, fxBus } from '../fx/bus';
import { shotOf } from '../lib/look';
import { use3D } from '../lib/perf';

const BattleFx = lazy(() => import('../fx/BattleFx'));

export const ME_ID = 'me';

/** ผลงานของผู้เล่น (ใช้คำนวณ XP) */
export interface MyBattleStats {
  rounds: number;
  correct: Record<Question['difficulty'], number>;
  /** คำตอบของเราแต่ละข้อ (เก็บประวัติวิเคราะห์จุดอ่อน) */
  answers: { questionId: string; correct: boolean; timeMs: number }[];
}

interface Props {
  questions: Question[];
  /** จำนวนข้อปกติ (ข้อที่เกินจากนี้คือ Sudden Death) */
  questionCount: number;
  initialPlayers: BattlePlayer[];
  bots: Bot[];
  onFinish: (players: BattlePlayer[], myStats: MyBattleStats) => void;
  onQuit: () => void;
}

interface MyAnswer {
  correct: boolean;
  timeMs: number;
  timedOut: boolean;
  given: number | string | null;
}

type Phase = 'question' | 'reveal';

const AIM_AT = 500;
const BANG_AT = 1100;
const AUTO_NEXT_MS = 6000;
const SPECTATE_SPEED = 0.15;

const REASON_TEXT = {
  get wrong() { return t('ตอบผิด', 'wrong'); },
  get timeout() { return t('หมดเวลา', 'time out'); },
  get slowest() { return t('ตอบช้าสุด', 'slowest'); },
  get counter() { return t('โดนยิงสวน', 'counter-shot'); },
};

export function BattleScreen({ questions, questionCount, initialPlayers, bots, onFinish, onQuit }: Props) {
  const [players, setPlayers] = useState(initialPlayers);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [myAnswer, setMyAnswer] = useState<MyAnswer | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [roundAnswers, setRoundAnswers] = useState<Record<string, RoundAnswer>>({});
  const [hitStage, setHitStage] = useState<HitStage>('none');
  const [fx3d] = useState(use3D);
  const [spectate, setSpectate] = useState<'no' | 'asking' | 'watching'>('no');
  const [explainOpen, setExplainOpen] = useState(false);
  const [autoLeft, setAutoLeft] = useState(AUTO_NEXT_MS);

  const maxHearts = heartsFor(questionCount);
  const q = questions[round % questions.length];
  const limitMs = getTimeLimitSec(q) * 1000;
  const sudden = isSuddenDeath(round, questionCount);
  const meAlive = isAlive(players.find((p) => p.id === ME_ID)!);
  const fast = spectate === 'watching';

  // แผนคำตอบของบอทในข้อนี้ (สุ่มครั้งเดียวตอนเริ่มข้อ)
  const botPlan = useMemo(() => {
    const plan: Record<string, BotAnswer> = {};
    for (const b of bots) plan[b.id] = botAnswer(b, q.difficulty, limitMs);
    return plan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // ref ล่าสุดสำหรับใช้ใน timer callback
  const stateRef = useRef({ players, myAnswer, botPlan, limitMs, round, q });
  stateRef.current = { players, myAnswer, botPlan, limitMs, round, q };
  const myStatsRef = useRef<MyBattleStats>({ rounds: 0, correct: { easy: 0, medium: 0, hard: 0, challenge: 0 }, answers: [] });
  const timersRef = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timersRef.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const phaseRef = useRef<Phase>('question');
  const fastRef = useRef(fast);
  fastRef.current = fast;
  const spectateRef = useRef(spectate);
  spectateRef.current = spectate;

  const endRound = useCallback(() => {
    const s = stateRef.current;
    if (phaseRef.current !== 'question') return;
    phaseRef.current = 'reveal';

    const answers: RoundAnswer[] = [];
    for (const p of alivePlayers(s.players)) {
      if (p.id === ME_ID) {
        const a = s.myAnswer ?? { correct: false, timeMs: s.limitMs, timedOut: true, given: null };
        myStatsRef.current.rounds++;
        if (a.correct) myStatsRef.current.correct[s.q.difficulty]++;
        myStatsRef.current.answers.push({ questionId: s.q.id, correct: a.correct, timeMs: a.timeMs });
        answers.push({
          playerId: p.id,
          correct: a.correct,
          timeMs: a.timeMs,
          timedOut: a.timedOut,
          points: calcPoints(a.correct, s.limitMs - a.timeMs, s.limitMs),
        });
      } else {
        const b = s.botPlan[p.id];
        const timedOut = b.timeMs >= s.limitMs;
        answers.push({
          playerId: p.id,
          correct: b.correct,
          timeMs: b.timeMs,
          timedOut,
          points: calcPoints(b.correct, s.limitMs - b.timeMs, s.limitMs),
        });
      }
    }

    const result = resolveRound(s.players, answers, s.round, questionCount);
    setRoundAnswers(Object.fromEntries(answers.map((a) => [a.playerId, a])));
    setOutcome(result.outcome);
    setPhase('reveal');
    setExplainOpen(false);
    setAutoLeft(AUTO_NEXT_MS);

    const speed = fastRef.current ? 0.5 : 1;
    if (result.outcome.damages.length) {
      later(() => {
        setHitStage('aim');
        fxBus.shots(
          buildShots(result.outcome.damages, result.outcome.eliminated, answers, (id) => shotOf(s.players.find((p) => p.id === id)?.avatar)),
          (BANG_AT - AIM_AT) * speed,
        );
      }, AIM_AT * speed);
      later(() => {
        setHitStage('bang');
        setPlayers(result.players);
      }, BANG_AT * speed);
    } else {
      setPlayers(result.players);
    }

    const meNowOut = result.players.find((p) => p.id === ME_ID)!.rank !== null;
    if (result.outcome.gameOver) {
      later(() => onFinish(result.players, myStatsRef.current), (BANG_AT + 1800) * speed);
    } else if (meNowOut && spectateRef.current === 'no') {
      later(() => setSpectate('asking'), BANG_AT + 900);
    }
  }, [questionCount, onFinish]);

  const { remainingMs, getRemainingMs } = useCountdown(limitMs, phase === 'question' && !fast, round, endRound);
  const elapsed = limitMs - remainingMs;

  // บอทล็อกคำตอบตามเวลา / จบข้อเมื่อทุกคนตอบครบ
  const aliveBots = players.filter((p) => p.isBot && isAlive(p));
  const lockedBots = aliveBots.filter((b) => botPlan[b.id].timeMs < limitMs && botPlan[b.id].timeMs <= elapsed);
  useEffect(() => {
    if (phase !== 'question' || fast) return;
    const everyoneDone = (!meAlive || myAnswer !== null) && lockedBots.length === aliveBots.length;
    if (everyoneDone) endRound();
  }, [phase, fast, meAlive, myAnswer, lockedBots.length, aliveBots.length, endRound]);

  // โหมดดูต่อ: ข้อจบเร็วตามเวลาที่บอทตอบ (เร่งความเร็ว)
  useEffect(() => {
    if (phase !== 'question' || !fast) return;
    const longest = Math.max(...aliveBots.map((b) => Math.min(botPlan[b.id].timeMs, limitMs)));
    const id = window.setTimeout(endRound, longest * SPECTATE_SPEED + 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fast, round]);

  const nextRound = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    phaseRef.current = 'question';
    setHitStage('none');
    setOutcome(null);
    setMyAnswer(null);
    setRoundAnswers({});
    setRound((r) => r + 1);
    setPhase('question');
    window.scrollTo({ top: 0 });
  }, []);

  // เดินหน้าอัตโนมัติหลังเฉลย (หยุดนับถ้าเปิดอ่านคำอธิบาย หรือกำลังถามว่าจะดูต่อไหม)
  useEffect(() => {
    if (phase !== 'reveal' || outcome?.gameOver || explainOpen || spectate === 'asking') return;
    if (fast) {
      const id = window.setTimeout(nextRound, 1600);
      return () => clearTimeout(id);
    }
    const id = window.setInterval(() => setAutoLeft((t) => t - 100), 100);
    return () => clearInterval(id);
  }, [phase, outcome, explainOpen, spectate, fast, nextRound]);
  useEffect(() => {
    if (phase === 'reveal' && !fast && autoLeft <= 0) nextRound();
  }, [autoLeft, phase, fast, nextRound]);

  /** ข้ามไปดูผล: จำลองข้อที่เหลือทันที */
  const skipToEnd = () => {
    timersRef.current.forEach(clearTimeout);
    let ps = stateRef.current.players;
    let r = stateRef.current.round + 1;
    for (let guard = 0; guard < 500; guard++) {
      if (alivePlayers(ps).length <= 1) break;
      const qq = questions[r % questions.length];
      const lim = getTimeLimitSec(qq) * 1000;
      const answers = alivePlayers(ps).map((p) => {
        const bot = bots.find((x) => x.id === p.id);
        const b = bot ? botAnswer(bot, qq.difficulty, lim) : { correct: false, timeMs: lim };
        return {
          playerId: p.id,
          correct: b.correct,
          timeMs: b.timeMs,
          timedOut: b.timeMs >= lim,
          points: calcPoints(b.correct, lim - b.timeMs, lim),
        };
      });
      const res = resolveRound(ps, answers, r, questionCount);
      ps = res.players;
      if (res.outcome.gameOver) break;
      r++;
    }
    onFinish(ps, myStatsRef.current);
  };

  const answer = (correct: boolean, given: number | string) => {
    if (phase !== 'question' || myAnswer || !meAlive) return;
    const timeMs = limitMs - getRemainingMs();
    setMyAnswer({ correct, timeMs, timedOut: false, given });
  };

  // สถานะที่แสดงบนการ์ดผู้เล่น
  const status: Record<string, PlayerStatus> = {};
  for (const p of players) {
    if (!isAlive(p) && !outcome?.eliminated.includes(p.id)) status[p.id] = 'out';
    else if (phase === 'reveal') {
      const a = roundAnswers[p.id];
      status[p.id] = !a ? 'out' : a.correct ? 'correct' : a.timedOut ? 'timeout' : 'wrong';
    } else if (p.id === ME_ID) status[p.id] = myAnswer ? 'locked' : 'thinking';
    else status[p.id] = lockedBots.some((b) => b.id === p.id) ? 'locked' : 'thinking';
  }
  const hits = Object.fromEntries(
    (outcome?.damages ?? []).map((d) => [d.playerId, { lost: d.heartsLost, reason: d.reason }]),
  );
  const myHit = outcome?.damages.find((d) => d.playerId === ME_ID);
  const nameOf = (id: string) => (id === ME_ID ? t('คุณ', 'You') : players.find((p) => p.id === id)?.name ?? id);

  const subject = SUBJECTS[q.subject];
  const myGiven = myAnswer?.given ?? null;

  return (
    <div className={`screen battle ${sudden ? 'battle--sudden' : ''} ${myHit && hitStage === 'bang' ? 'battle--me-hit' : ''}`}>
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onQuit} aria-label={t('ออกจากเกม', 'Quit game')}>
          ✕
        </button>
        <div className="quiz__progress">
          {sudden ? (
            <span className="sudden-tag"><Lightning weight="fill" className="ico" /> SUDDEN DEATH</span>
          ) : (
            <>
              {t('ข้อ', 'Q')} {round + 1}/{questionCount}
            </>
          )}
        </div>
        <div className="quiz__score" aria-label={t('ผู้เล่นที่เหลือ', 'Players left')}>
          <Users weight="fill" className="ico" /> {alivePlayers(players).length}/{players.length}
        </div>
      </header>

      {fx3d && (
        <Suspense fallback={null}>
          <BattleFx />
        </Suspense>
      )}

      <PlayerGrid
        players={players}
        maxHearts={maxHearts}
        meId={ME_ID}
        status={status}
        hits={hits}
        hitStage={hitStage}
      />

      {!fast && (
        <TimerBar
          remainingMs={phase === 'reveal' ? Math.max(0, limitMs - (myAnswer?.timeMs ?? limitMs)) : remainingMs}
          limitMs={limitMs}
        />
      )}

      {sudden && phase === 'question' && <div className="sudden-banner pop-in"><Lightning weight="fill" className="ico" /> {t('ผิดหรือช้าสุด = ตกรอบทันที!', 'Wrong or slowest = out!')}</div>}

      <article key={`q-${round}`} className="card question-card pop-in">
        <div className="question-card__meta">
          <span className="tag" style={{ background: subject.color }}>
            <subject.icon weight="fill" size={16} /> {subject.name}
          </span>
          <span className="tag tag--ghost">{DIFFICULTY_LABEL[q.difficulty]}</span>
        </div>
        <MathText className="question-card__prompt" text={q.prompt} />
        {q.image && <img className="question-card__img" src={q.image} alt={q.imageAlt ?? ''} />}
      </article>

      {meAlive || phase === 'reveal' ? (
        q.type === 'mcq' ? (
          <ChoiceList
            key={`c-${round}`}
            question={q}
            revealed={phase === 'reveal' || !!myAnswer}
            selected={typeof myGiven === 'number' ? myGiven : null}
            showAnswer={phase === 'reveal'}
            onSelect={(i) => answer(i === q.answerIndex, i)}
          />
        ) : (
          <FillAnswerInput
            key={`f-${round}`}
            question={q}
            revealed={phase === 'reveal' || !!myAnswer}
            correct={phase === 'reveal' ? (myAnswer?.correct ?? false) : null}
            onSubmit={(v) => answer(checkFillAnswer(q.answer, v), v)}
          />
        )
      ) : null}

      {phase === 'question' && myAnswer && <p className="waiting"><LockSimple weight="fill" className="ico" /> {t('ล็อกคำตอบแล้ว รอคนอื่นอยู่...', 'Answer locked, waiting for others...')}</p>}

      {phase === 'reveal' && outcome && (
        <div className="reveal-sheet slide-up">
          {q.type === 'fill' && (
            <p className="reveal-sheet__answer">
              {t('เฉลย:', 'Answer:')} <strong>{formatFillAnswer(q.answer)}</strong>
            </p>
          )}
          <div className="shot-list">
            {outcome.damages.length === 0 ? (
              <p className="shot-list__none"><SmileyMeh weight="fill" className="ico" /> {t('ไม่มีใครโดนยิงข้อนี้', 'Nobody got hit this round')}</p>
            ) : (
              outcome.damages.map((d) => (
                <p key={d.playerId} className={`shot-list__item ${d.playerId === ME_ID ? 'is-me' : ''}`}>
                  <Lightning weight="fill" className="ico" /> <strong>{nameOf(d.playerId)}</strong> {t('โดนยิง', 'got hit')} ({REASON_TEXT[d.reason]})
                  {outcome.eliminated.includes(d.playerId) && <span className="shot-list__out"> {t('ตกรอบ!', 'Out!')}</span>}
                </p>
              ))
            )}
          </div>
          <details className="explain" onToggle={(e) => setExplainOpen((e.target as HTMLDetailsElement).open)}>
            <summary><Lightbulb weight="fill" className="ico" /> {t('ดูคำอธิบาย', 'Show explanation')}</summary>
            <MathText text={q.explanation} />
          </details>
          {!outcome.gameOver && !fast && spectate !== 'asking' && (
            <button type="button" className="btn btn--primary btn--block auto-next" onClick={nextRound}>
              <span className="auto-next__fill" style={{ transform: `scaleX(${explainOpen ? 1 : autoLeft / AUTO_NEXT_MS})` }} />
              <span className="auto-next__label">{t('ข้อต่อไป ➜', 'Next ➜')}</span>
            </button>
          )}
          {outcome.gameOver && <p className="game-over pop-in"><FlagCheckered weight="fill" className="ico" /> {t('จบเกม!', 'Game over!')}</p>}
        </div>
      )}

      {spectate === 'asking' && (
        <div className="overlay">
          <div className="overlay__card pop-in">
            <div className="overlay__emoji"><WarningCircle weight="fill" className="ico" /></div>
            <h2>{t('คุณตกรอบแล้ว!', 'You\'re out!')}</h2>
            <p>{t(`อันดับที่ ${players.find((p) => p.id === ME_ID)!.rank} จาก ${players.length}`, `Rank ${players.find((p) => p.id === ME_ID)!.rank} of ${players.length}`)}</p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setSpectate('watching');
                nextRound();
              }}
            >
              <Eye weight="fill" className="ico" /> {t('ดูต่อ (เร่งความเร็ว)', 'Keep watching (fast)')}
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={skipToEnd}>
              <SkipForward weight="fill" className="ico" /> {t('ข้ามไปดูผล', 'Skip to results')}
            </button>
          </div>
        </div>
      )}

      {fast && (
        <button type="button" className="btn btn--ghost skip-fab" onClick={skipToEnd}>
          <SkipForward weight="fill" className="ico" /> {t('ข้ามไปดูผล', 'Skip to results')}
        </button>
      )}
    </div>
  );
}
