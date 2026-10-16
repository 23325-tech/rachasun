import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { FillQuestion, McqQuestion } from '../types';
import { heartsFor, isAlive, type BattlePlayer } from '../game/battle';
import { callGame, serverNow, type OnlineGameState } from '../lib/roomGame';
import { DIFFICULTY_LABEL, SUBJECTS } from '../data/subjects';
import { MathText } from '../components/MathText';
import { TimerBar } from '../components/TimerBar';
import { ChoiceList } from '../components/ChoiceList';
import { FillAnswerInput } from '../components/FillAnswerInput';
import { PlayerGrid, type HitStage, type PlayerStatus } from '../components/PlayerGrid';
import { CardBar, type ActiveCard } from '../components/CardBar';
import type { CardKind } from '../game/battle';
import { Crosshair, Eye, FlagCheckered, Gift, Hourglass, Lightbulb, Lightning, ShieldCheck, SkipForward, SmileyMeh, Users, WifiSlash } from '@phosphor-icons/react';
import { VersusIntro } from '../components/VersusIntro';
import { t } from '../lib/i18n';
import { buildShots, fxBus } from '../fx/bus';
import { use3D } from '../lib/perf';

const BattleFx = lazy(() => import('../fx/BattleFx'));

interface Props {
  roomId: string;
  state: OnlineGameState;
  myId: string;
  onLeave: () => void;
}

const AIM_AT = 500;
const BANG_AT = 1100;
const REASON_TEXT = {
  get wrong() { return t('ตอบผิด', 'wrong'); },
  get timeout() { return t('หมดเวลา', 'time out'); },
  get slowest() { return t('ตอบช้าสุด', 'slowest'); },
  get counter() { return t('โดนยิงสวน', 'counter-shot'); },
};
const CARD_TEXT: Record<CardKind, string> = {
  get shield() { return t('โล่', 'Shield'); },
  fifty: '50/50',
  get slow() { return t('ลดเวลาเพื่อน', 'Slow a rival'); },
  get extra() { return t('เพิ่มเวลาตัวเอง', 'Extra time'); },
  get counter() { return t('ยิงสวน', 'Counter'); },
};

/** อัปเดตทุก 100ms ให้ตัวจับเวลาเดิน */
function useServerClock() {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 100);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function OnlineBattleView({ roomId, state: s, myId, onLeave }: Props) {
  const now = useServerClock();
  const [myAnswer, setMyAnswer] = useState<{ round: number; given: number | string } | null>(null);
  const [answerError, setAnswerError] = useState('');
  /** ผลการ์ด 50/50 ของเราในข้อนี้ (เซิร์ฟเวอร์บอกเฉพาะเรา) */
  const [cardResult, setCardResult] = useState<{
    round: number;
    card: CardKind;
    removed?: number[];
    skipped?: boolean;
  } | null>(null);
  const [usingCard, setUsingCard] = useState(false);
  const [hitStage, setHitStage] = useState<HitStage>('none');
  const [fx3d] = useState(use3D);
  // หัวใจที่แสดง: ตอนเฉลยจะค้างค่าเดิมไว้จนถึงจังหวะยิง
  const [shownPlayers, setShownPlayers] = useState<BattlePlayer[]>(s.players);
  const lastPlayersRef = useRef<BattlePlayer[]>(s.players);
  const playersRef = useRef(s.players);
  playersRef.current = s.players;
  const animatedRoundRef = useRef(-1);
  const timersRef = useRef<number[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // แอนิเมชันยิงเมื่อมีผลเฉลยใหม่เข้ามา
  // (ไม่ยกเลิกตัวตั้งเวลาเมื่อข้อมูลห้องถูกโหลดซ้ำ ไม่งั้นหัวใจจะค้าง)
  const revealRound = s.reveal?.round ?? -1;
  useEffect(() => {
    if (s.phase === 'question') {
      setHitStage('none');
      setShownPlayers(playersRef.current);
      lastPlayersRef.current = playersRef.current;
      return;
    }
    const reveal = s.reveal;
    if (!reveal || animatedRoundRef.current >= reveal.round) return;
    animatedRoundRef.current = reveal.round;
    if (!reveal.outcome.damages.length && !reveal.disconnected.length) {
      setShownPlayers(playersRef.current);
      lastPlayersRef.current = playersRef.current;
      return;
    }
    setShownPlayers(lastPlayersRef.current);
    timersRef.current.push(
      window.setTimeout(() => {
        setHitStage('aim');
        const answers = Object.entries(reveal.results).map(([playerId, r]) => ({ playerId, correct: r.correct, timeMs: r.timeMs }));
        fxBus.shots(buildShots(reveal.outcome.damages, reveal.outcome.eliminated, answers), BANG_AT - AIM_AT);
      }, AIM_AT),
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setHitStage('bang');
        setShownPlayers(playersRef.current);
        lastPlayersRef.current = playersRef.current;
      }, BANG_AT),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.round, revealRound]);

  const myDeadline = s.deadlines?.[myId] ?? s.deadline ?? 0;
  const roundEnd = Math.max(s.deadline ?? 0, ...s.players.filter(isAlive).map((p) => s.deadlines?.[p.id] ?? s.deadline ?? 0));

  // ใครก็กระตุ้นเซิร์ฟเวอร์ได้เมื่อถึงเวลา (หมดเวลาตอบ / หมดช่วงเฉลย)
  const lastTickRef = useRef(0);
  useEffect(() => {
    const due =
      (s.phase === 'question' && s.deadline && now > roundEnd + 900) ||
      (s.phase === 'reveal' && s.nextAt && now > s.nextAt + 150);
    if (!due || Date.now() - lastTickRef.current < 1500) return;
    lastTickRef.current = Date.now() + Math.random() * 400;
    callGame('tick', { roomId }).catch(() => {});
  }, [now, s.phase, s.deadline, roundEnd, s.nextAt, roomId]);

  useEffect(() => {
    if (s.phase !== 'question' || !s.cardUsed?.[myId] || cardResult?.round === s.round) return;
    const used = s.cardUsed[myId];
    callGame('use_card', { roomId, round: s.round, card: used })
      .then((r) => setCardResult({ round: s.round, card: used, removed: r.removed, skipped: r.skipped }))
      .catch(() => {});
  }, [s.phase, s.round, s.cardUsed, myId, roomId, cardResult]);

  // ล้างคำตอบเมื่อขึ้นข้อใหม่
  useEffect(() => {
    setAnswerError('');
  }, [s.round]);

  const me = s.players.find((p) => p.id === myId);
  const meAlive = !!me && isAlive(me);
  const q = s.question;
  const myCard = cardResult?.round === s.round ? cardResult : null;
  const answeredThisRound = myAnswer?.round === s.round ? myAnswer : myCard?.skipped ? { round: s.round, given: '' } : null;
  const reveal = s.reveal?.round === s.round ? s.reveal : undefined;
  const showingReveal = (s.phase === 'reveal' || s.phase === 'finished') && !!reveal;
  const beforeStart = s.phase === 'question' && s.startsAt && now < s.startsAt;
  const pastMyDeadline = s.phase === 'question' && !!myDeadline && now > myDeadline;
  const locked =
    !meAlive || !!answeredThisRound || showingReveal || !!beforeStart || s.phase !== 'question' || pastMyDeadline;

  const useCard = async (card: ActiveCard, target?: string) => {
    if (usingCard) return;
    setUsingCard(true);
    setAnswerError('');
    try {
      const r = await callGame('use_card', { roomId, round: s.round, card, target });
      setCardResult({ round: s.round, card, removed: r.removed, skipped: r.skipped });
    } catch (e) {
      setAnswerError(e instanceof Error ? e.message : String(e));
    } finally {
      setUsingCard(false);
    }
  };

  const submit = async (given: number | string) => {
    if (locked) return;
    setMyAnswer({ round: s.round, given });
    try {
      await callGame('answer', { roomId, round: s.round, given });
    } catch (e) {
      setAnswerError(e instanceof Error ? e.message : String(e));
    }
  };

  // สร้างโจทย์ในรูปแบบที่คอมโพเนนต์เดิมใช้ (เฉลยใส่เฉพาะตอนเฉลยแล้ว)
  const mcq = useMemo<McqQuestion | null>(
    () =>
      q?.type === 'mcq'
        ? {
            id: `r${s.round}`,
            type: 'mcq',
            subject: q.subject,
            difficulty: q.difficulty,
            track: 'school',
            prompt: q.prompt,
            explanation: '',
            choices: (q.choices ?? ['', '', '', '']) as McqQuestion['choices'],
            answerIndex: (reveal?.answerIndex ?? 0) as McqQuestion['answerIndex'],
          }
        : null,
    [q, s.round, reveal],
  );
  const fill = useMemo<FillQuestion | null>(
    () =>
      q?.type === 'fill'
        ? {
            id: `r${s.round}`,
            type: 'fill',
            subject: q.subject,
            difficulty: q.difficulty,
            track: 'school',
            prompt: q.prompt,
            explanation: '',
            answer: q.answerKind === 'number' ? { kind: 'number', value: 0, unit: q.unit } : { kind: 'text', accepted: [] },
          }
        : null,
    [q, s.round],
  );

  // สถานะบนการ์ดผู้เล่น
  const status: Record<string, PlayerStatus> = {};
  for (const p of s.players) {
    const res = reveal?.results[p.id];
    if (showingReveal && res) status[p.id] = res.skipped ? 'skipped' : res.correct ? 'correct' : res.timedOut ? 'timeout' : 'wrong';
    else if (showingReveal && reveal?.disconnected.includes(p.id)) status[p.id] = 'timeout';
    else if (!isAlive(p)) status[p.id] = 'out';
    else status[p.id] = s.answered.includes(p.id) || answeredThisRound && p.id === myId ? 'locked' : 'thinking';
  }
  const hits: Record<string, { lost: number; reason: (typeof reveal & {})['outcome']['damages'][number]['reason']; blocked?: boolean }> = {};
  if (showingReveal && reveal) {
    for (const d of reveal.outcome.damages) {
      if (d.redirectedTo) continue; // คนที่ยิงสวนสำเร็จไม่โดน
      const prev = hits[d.playerId];
      const lost = (prev?.lost ?? 0) + d.heartsLost;
      hits[d.playerId] = { lost, reason: d.reason, blocked: lost === 0 && (d.blocked || prev?.blocked) };
    }
    for (const id of reveal.disconnected) {
      const before = lastPlayersRef.current.find((p) => p.id === id)?.hearts ?? 1;
      hits[id] = { lost: Math.max(1, before), reason: 'timeout' };
    }
  }
  const myHit = !!hits[myId] && !hits[myId].blocked;
  const myCards = me?.cards;
  const newCard = s.dealt?.round === s.round ? s.dealt.cards[myId] : undefined;
  const showDealt = !!newCard && s.phase === 'question' && !!s.startsAt && now < s.startsAt + 3500;
  const slowedBy = s.phase === 'question' ? s.slowed?.[myId] : undefined;
  const opponents = s.players
    .filter((p) => p.id !== myId && isAlive(p))
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, answered: s.answered.includes(p.id) }));
  const nameOf = (id: string) => (id === myId ? t('คุณ', 'You') : s.players.find((p) => p.id === id)?.name ?? '?');
  const sudden = s.round >= s.questionCount;
  const subject = q ? SUBJECTS[q.subject] : null;
  const remaining = myDeadline ? Math.max(0, myDeadline - now) : 0;
  const myLimit = myDeadline && s.startsAt ? myDeadline - s.startsAt : s.limitMs ?? 1;
  const nextIn = s.nextAt ? Math.max(0, Math.ceil((s.nextAt - now) / 1000)) : 0;

  return (
    <div className={`screen battle ${sudden ? 'battle--sudden' : ''} ${myHit && hitStage === 'bang' ? 'battle--me-hit' : ''}`}>
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onLeave} aria-label={t('ออกจากห้อง', 'Leave room')}>
          ✕
        </button>
        <div className="quiz__progress">
          {sudden ? <span className="sudden-tag"><Lightning weight="fill" className="ico" /> SUDDEN DEATH</span> : <>{t('ข้อ', 'Q')} {s.round + 1}/{s.questionCount}</>}
        </div>
        <div className="quiz__score">
          <Users weight="fill" className="ico" /> {s.players.filter(isAlive).length}/{s.players.length}
        </div>
      </header>

      {fx3d && (
        <Suspense fallback={null}>
          <BattleFx />
        </Suspense>
      )}

      <PlayerGrid
        players={shownPlayers}
        maxHearts={heartsFor(s.questionCount)}
        meId={myId}
        status={status}
        hits={hits}
        hitStage={hitStage}
      />

      {showDealt && newCard && (
        <div className="card-toast pop-in" role="status">
          <Gift weight="fill" className="ico" /> {t('ได้การ์ด', 'Got card')} <strong>{CARD_TEXT[newCard]}</strong>!
        </div>
      )}

      {beforeStart && s.round === 0 && (
        <VersusIntro
          players={s.players}
          meId={myId}
          subtitle={t(`เริ่มใน ${Math.ceil((s.startsAt! - now) / 1000)} วินาที`, `Starting in ${Math.ceil((s.startsAt! - now) / 1000)} s`)}
        />
      )}

      {beforeStart ? (
        <div className="countdown pop-in" key={`cd-${s.round}`}>
          <span className="countdown__num">{Math.ceil((s.startsAt! - now) / 1000)}</span>
          <span className="countdown__label">{s.round === 0 ? t('เตรียมตัว!', 'Get ready!') : t('ข้อต่อไป', 'Next question')}</span>
        </div>
      ) : (
        <>
          {s.limitMs && !showingReveal && (
            <div className={slowedBy ? 'timer-wrap is-slowed' : 'timer-wrap'}>
              <TimerBar remainingMs={remaining} limitMs={myLimit} />
            </div>
          )}
          {slowedBy && meAlive && !answeredThisRound && (
            <p className="slowed-note shake"><Hourglass weight="fill" className="ico" /> {t(`${nameOf(slowedBy)} ลดเวลาคุณ!`, `${nameOf(slowedBy)} slowed you down!`)}</p>
          )}

          {sudden && s.phase === 'question' && <div className="sudden-banner pop-in"><Lightning weight="fill" className="ico" /> {t('ผิดหรือช้าสุด = ตกรอบทันที!', 'Wrong or slowest = out!')}</div>}

          {q && subject && (
            <article key={`q-${s.round}`} className="card question-card pop-in">
              <div className="question-card__meta">
                <span className="tag" style={{ background: subject.color }}>
                  <subject.icon weight="fill" size={16} /> {subject.name}
                </span>
                <span className="tag tag--ghost">{DIFFICULTY_LABEL[q.difficulty]}</span>
              </div>
              <MathText className="question-card__prompt" text={q.prompt} />
            </article>
          )}

          {(meAlive || showingReveal) && mcq && (
            <ChoiceList
              key={`c-${s.round}`}
              question={mcq}
              revealed={locked}
              showAnswer={showingReveal}
              selected={typeof answeredThisRound?.given === 'number' ? answeredThisRound.given : null}
              removed={myCard?.removed}
              onSelect={(i) => submit(i)}
            />
          )}
          {(meAlive || showingReveal) && fill && (
            <FillAnswerInput
              key={`f-${s.round}`}
              question={fill}
              revealed={locked}
              correct={showingReveal && !reveal?.results[myId]?.skipped ? (reveal?.results[myId]?.correct ?? false) : null}
              onSubmit={(v) => submit(v)}
            />
          )}

          {!meAlive && !showingReveal && <p className="waiting"><Eye weight="fill" className="ico" /> {t('คุณตกรอบแล้ว กำลังดูเพื่อนแข่งต่อ...', 'You\'re out — watching the others...')}</p>}
          {s.phase === 'question' && answeredThisRound && !answerError && (
            <p className="waiting">{myCard?.skipped ? t('ข้ามข้อนี้แล้ว รอคนอื่นอยู่...', 'Skipped, waiting for others...') : t('ล็อกคำตอบแล้ว รอคนอื่นอยู่...', 'Answer locked, waiting for others...')}</p>
          )}

          {s.items && myCards && meAlive && !showingReveal && q && (
            <CardBar
              cards={myCards}
              questionType={q.type}
              opponents={opponents}
              answered={!!answeredThisRound}
              open={s.phase === 'question' && !beforeStart && !pastMyDeadline}
              usedCard={myCard?.card ?? s.cardUsed?.[myId] ?? null}
              busy={usingCard}
              onUse={useCard}
            />
          )}
        </>
      )}

      {showingReveal && reveal && (
        <div className="reveal-sheet slide-up">
          {reveal.answerText !== undefined && (
            <p className="reveal-sheet__answer">
              {t('เฉลย:', 'Answer:')} <strong>{reveal.answerText}</strong>
            </p>
          )}
          <div className="shot-list">
            {reveal.outcome.damages.length === 0 && reveal.disconnected.length === 0 ? (
              <p className="shot-list__none"><SmileyMeh weight="fill" className="ico" /> {t('ไม่มีใครโดนยิงข้อนี้', 'Nobody got hit this round')}</p>
            ) : (
              <>
                {reveal.outcome.damages.map((d) =>
                  d.redirectedTo ? (
                    <p key={`${d.playerId}-r`} className="shot-list__item shot-list__item--counter">
                      <Crosshair weight="fill" className="ico" /> <strong>{nameOf(d.playerId)}</strong> {t('ยิงสวน! ดาเมจเด้งไปหา', 'countered! Damage bounced to')} <strong>{nameOf(d.redirectedTo)}</strong>
                    </p>
                  ) : d.blocked ? (
                    <p key={`${d.playerId}-${d.reason}`} className="shot-list__item shot-list__item--blocked">
                      <ShieldCheck weight="fill" className="ico" /> <strong>{nameOf(d.playerId)}</strong> {t('ใช้โล่กันกระสุนไว้ได้!', 'blocked it with a shield!')} ({REASON_TEXT[d.reason]})
                    </p>
                  ) : (
                  <p key={`${d.playerId}-${d.reason}`} className={`shot-list__item ${d.playerId === myId ? 'is-me' : ''}`}>
                    <Lightning weight="fill" className="ico" /> <strong>{nameOf(d.playerId)}</strong> {t('โดนยิง', 'got hit')} ({REASON_TEXT[d.reason]})
                    {reveal.outcome.eliminated.includes(d.playerId) && <span className="shot-list__out"> {t('ตกรอบ!', 'Out!')}</span>}
                  </p>
                  ),
                )}
                {Object.entries(reveal.results)
                  .filter(([, r]) => r.skipped)
                  .map(([id]) => (
                    <p key={`skip-${id}`} className="shot-list__item">
                      <SkipForward weight="fill" className="ico" /> <strong>{nameOf(id)}</strong> {t('ใช้การ์ดข้ามข้อนี้', 'used a skip card')}
                    </p>
                  ))}
                {reveal.disconnected.map((id) => (
                  <p key={id} className={`shot-list__item ${id === myId ? 'is-me' : ''}`}>
                    <WifiSlash weight="fill" className="ico" /> <strong>{nameOf(id)}</strong> {t('หลุดการเชื่อมต่อ', 'disconnected')} <span className="shot-list__out">{t('ตกรอบ!', 'Out!')}</span>
                  </p>
                ))}
              </>
            )}
          </div>
          <details className="explain">
            <summary><Lightbulb weight="fill" className="ico" /> {t('ดูคำอธิบาย', 'Show explanation')}</summary>
            <MathText text={reveal.explanation} />
          </details>
          {s.phase === 'finished' ? (
            <p className="game-over pop-in"><FlagCheckered weight="fill" className="ico" /> {t('จบเกม!', 'Game over!')}</p>
          ) : (
            <p className="next-in">{t(`ข้อต่อไปใน ${nextIn} วินาที...`, `Next question in ${nextIn} s...`)}</p>
          )}
        </div>
      )}
    </div>
  );
}
