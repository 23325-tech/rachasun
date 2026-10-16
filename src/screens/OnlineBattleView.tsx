import { useEffect, useMemo, useRef, useState } from 'react';
import type { FillQuestion, McqQuestion } from '../types';
import { heartsFor, isAlive, type BattlePlayer } from '../game/battle';
import { callGame, serverNow, type OnlineGameState } from '../lib/roomGame';
import { DIFFICULTY_LABEL, SUBJECTS } from '../data/subjects';
import { MathText } from '../components/MathText';
import { TimerBar } from '../components/TimerBar';
import { ChoiceList } from '../components/ChoiceList';
import { FillAnswerInput } from '../components/FillAnswerInput';
import { PlayerGrid, type HitStage, type PlayerStatus } from '../components/PlayerGrid';

interface Props {
  roomId: string;
  state: OnlineGameState;
  myId: string;
  onLeave: () => void;
}

const AIM_AT = 500;
const BANG_AT = 1100;
const REASON_TEXT = { wrong: 'ตอบผิด', timeout: 'หมดเวลา', slowest: 'ตอบช้าสุด' } as const;
const CARD_TEXT = { shield: '🛡️ โล่', fifty: '✂️ 50/50' } as const;

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
  const [cardResult, setCardResult] = useState<{ round: number; removed?: number[]; skipped?: boolean } | null>(null);
  const [usingCard, setUsingCard] = useState(false);
  const [hitStage, setHitStage] = useState<HitStage>('none');
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
    timersRef.current.push(window.setTimeout(() => setHitStage('aim'), AIM_AT));
    timersRef.current.push(
      window.setTimeout(() => {
        setHitStage('bang');
        setShownPlayers(playersRef.current);
        lastPlayersRef.current = playersRef.current;
      }, BANG_AT),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.round, revealRound]);

  // ใครก็กระตุ้นเซิร์ฟเวอร์ได้เมื่อถึงเวลา (หมดเวลาตอบ / หมดช่วงเฉลย)
  const lastTickRef = useRef(0);
  useEffect(() => {
    const due =
      (s.phase === 'question' && s.deadline && now > s.deadline + 900) ||
      (s.phase === 'reveal' && s.nextAt && now > s.nextAt + 150);
    if (!due || Date.now() - lastTickRef.current < 1500) return;
    lastTickRef.current = Date.now() + Math.random() * 400;
    callGame('tick', { roomId }).catch(() => {});
  }, [now, s.phase, s.deadline, s.nextAt, roomId]);

  useEffect(() => {
    if (s.phase !== 'question' || !s.cardUsed?.[myId] || cardResult?.round === s.round) return;
    callGame('use_card', { roomId, round: s.round, card: 'fifty' })
      .then((r) => setCardResult({ round: s.round, removed: r.removed, skipped: r.skipped }))
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
  const locked = !meAlive || !!answeredThisRound || showingReveal || !!beforeStart || s.phase !== 'question';

  const useFifty = async () => {
    if (locked || usingCard) return;
    setUsingCard(true);
    setAnswerError('');
    try {
      const r = await callGame('use_card', { roomId, round: s.round, card: 'fifty' });
      setCardResult({ round: s.round, removed: r.removed, skipped: r.skipped });
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
  const hits: Record<string, { lost: number; reason: 'wrong' | 'timeout' | 'slowest'; blocked?: boolean }> = {};
  if (showingReveal && reveal) {
    for (const d of reveal.outcome.damages) hits[d.playerId] = { lost: d.heartsLost, reason: d.reason, blocked: d.blocked };
    for (const id of reveal.disconnected) {
      const before = lastPlayersRef.current.find((p) => p.id === id)?.hearts ?? 1;
      hits[id] = { lost: Math.max(1, before), reason: 'timeout' };
    }
  }
  const myHit = !!hits[myId] && !hits[myId].blocked;
  const myCards = me?.cards;
  const newCard = s.dealt?.round === s.round ? s.dealt.cards[myId] : undefined;
  const showDealt = !!newCard && s.phase === 'question' && !!s.startsAt && now < s.startsAt + 3500;
  const nameOf = (id: string) => (id === myId ? 'คุณ' : s.players.find((p) => p.id === id)?.name ?? '?');
  const sudden = s.round >= s.questionCount;
  const subject = q ? SUBJECTS[q.subject] : null;
  const remaining = s.deadline ? Math.max(0, s.deadline - now) : 0;
  const nextIn = s.nextAt ? Math.max(0, Math.ceil((s.nextAt - now) / 1000)) : 0;

  return (
    <div className={`screen battle ${sudden ? 'battle--sudden' : ''} ${myHit && hitStage === 'bang' ? 'battle--me-hit' : ''}`}>
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onLeave} aria-label="ออกจากห้อง">
          ✕
        </button>
        <div className="quiz__progress">
          {sudden ? <span className="sudden-tag">⚡ SUDDEN DEATH</span> : <>ข้อ {s.round + 1}/{s.questionCount}</>}
        </div>
        <div className="quiz__score">
          👥 {s.players.filter(isAlive).length}/{s.players.length}
        </div>
      </header>

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
          🎁 ได้การ์ด <strong>{CARD_TEXT[newCard]}</strong>!
        </div>
      )}

      {beforeStart ? (
        <div className="countdown pop-in" key={`cd-${s.round}`}>
          <span className="countdown__num">{Math.ceil((s.startsAt! - now) / 1000)}</span>
          <span className="countdown__label">{s.round === 0 ? 'เตรียมตัว!' : 'ข้อต่อไป'}</span>
        </div>
      ) : (
        <>
          {s.limitMs && !showingReveal && <TimerBar remainingMs={remaining} limitMs={s.limitMs} />}

          {sudden && s.phase === 'question' && <div className="sudden-banner pop-in">⚡ ผิดหรือช้าสุด = ตกรอบทันที!</div>}

          {q && subject && (
            <article key={`q-${s.round}`} className="card question-card pop-in">
              <div className="question-card__meta">
                <span className="tag" style={{ background: subject.color }}>
                  {subject.emoji} {subject.name}
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

          {!meAlive && !showingReveal && <p className="waiting">👀 คุณตกรอบแล้ว กำลังดูเพื่อนแข่งต่อ...</p>}
          {s.phase === 'question' && answeredThisRound && !answerError && (
            <p className="waiting">{myCard?.skipped ? '⏭️ ข้ามข้อนี้แล้ว รอคนอื่นอยู่...' : '🔒 ล็อกคำตอบแล้ว รอคนอื่นอยู่...'}</p>
          )}

          {s.items && myCards && meAlive && !showingReveal && (
            <div className="card-bar">
              <div className="power-card power-card--passive" title="ติดตัวไว้ กันการโดนยิงให้อัตโนมัติ">
                <span className="power-card__icon">🛡️</span>
                <span className="power-card__name">โล่</span>
                <span className="power-card__count">x{myCards.shield}</span>
                <span className="power-card__hint">กันอัตโนมัติ</span>
              </div>
              <button
                type="button"
                className="power-card"
                disabled={locked || usingCard || myCards.fifty < 1 || !!myCard}
                onClick={useFifty}
              >
                <span className="power-card__icon">{q?.type === 'fill' ? '⏭️' : '✂️'}</span>
                <span className="power-card__name">{q?.type === 'fill' ? 'ข้ามข้อ' : '50/50'}</span>
                <span className="power-card__count">x{myCards.fifty}</span>
                <span className="power-card__hint">{myCard ? 'ใช้แล้ว' : 'กดใช้'}</span>
              </button>
            </div>
          )}
          {answerError && <p className="form-error">😵 {answerError}</p>}
        </>
      )}

      {showingReveal && reveal && (
        <div className="reveal-sheet slide-up">
          {reveal.answerText !== undefined && (
            <p className="reveal-sheet__answer">
              เฉลย: <strong>{reveal.answerText}</strong>
            </p>
          )}
          <div className="shot-list">
            {reveal.outcome.damages.length === 0 && reveal.disconnected.length === 0 ? (
              <p className="shot-list__none">😮 ไม่มีใครโดนยิงข้อนี้</p>
            ) : (
              <>
                {reveal.outcome.damages.map((d) =>
                  d.blocked ? (
                    <p key={d.playerId} className="shot-list__item shot-list__item--blocked">
                      🛡️ <strong>{nameOf(d.playerId)}</strong> ใช้โล่กันกระสุนไว้ได้! ({REASON_TEXT[d.reason]})
                    </p>
                  ) : (
                  <p key={d.playerId} className={`shot-list__item ${d.playerId === myId ? 'is-me' : ''}`}>
                    💥 <strong>{nameOf(d.playerId)}</strong> โดนยิง ({REASON_TEXT[d.reason]})
                    {reveal.outcome.eliminated.includes(d.playerId) && <span className="shot-list__out"> ตกรอบ!</span>}
                  </p>
                  ),
                )}
                {Object.entries(reveal.results)
                  .filter(([, r]) => r.skipped)
                  .map(([id]) => (
                    <p key={`skip-${id}`} className="shot-list__item">
                      ⏭️ <strong>{nameOf(id)}</strong> ใช้การ์ดข้ามข้อนี้
                    </p>
                  ))}
                {reveal.disconnected.map((id) => (
                  <p key={id} className={`shot-list__item ${id === myId ? 'is-me' : ''}`}>
                    📵 <strong>{nameOf(id)}</strong> หลุดการเชื่อมต่อ <span className="shot-list__out">ตกรอบ!</span>
                  </p>
                ))}
              </>
            )}
          </div>
          <details className="explain">
            <summary>💡 ดูคำอธิบาย</summary>
            <MathText text={reveal.explanation} />
          </details>
          {s.phase === 'finished' ? (
            <p className="game-over pop-in">🏁 จบเกม!</p>
          ) : (
            <p className="next-in">ข้อต่อไปใน {nextIn} วินาที...</p>
          )}
        </div>
      )}
    </div>
  );
}
