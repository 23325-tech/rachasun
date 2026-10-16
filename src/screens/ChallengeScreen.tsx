import { useCallback, useEffect, useState } from 'react';
import { LEVELS, subjectInfo, difficultyText } from '../data/subjects';
import { challengeLink, fetchChallengeBoard, startChallenge, type ChallengeBoard } from '../lib/asyncPlay';
import { AsyncPlayScreen } from './AsyncPlayScreen';
import { XpBadge, type XpState } from '../components/XpBadge';

interface Props {
  code: string;
  guest: boolean;
  /** ผู้สร้างคำท้า: เล่นทันทีหลังสร้าง */
  autoPlay?: boolean;
  onHome: () => void;
  onRegister: () => void;
  onXpAwarded: () => void;
}

const MEDAL = ['🥇', '🥈', '🥉'];

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'หมดเวลาแล้ว';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `เหลือ ${h} ชม. ${m} นาที` : `เหลือ ${m} นาที`;
}

export function ChallengeScreen({ code, guest, autoPlay, onHome, onRegister, onXpAwarded }: Props) {
  const [board, setBoard] = useState<ChallengeBoard | null | undefined>(undefined);
  const [playId, setPlayId] = useState<string | null>(null);
  const [xp, setXp] = useState<XpState>({ status: 'off' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    try {
      setBoard(await fetchChallengeBoard(code));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [code]);

  const play = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setPlayId((await startChallenge(code)).playId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      reload();
    } finally {
      setBusy(false);
    }
  }, [code, reload]);

  useEffect(() => {
    reload();
    if (autoPlay) play();
  }, [reload, autoPlay, play]);

  if (playId) {
    return (
      <AsyncPlayScreen
        playId={playId}
        title="🔗 คำท้า"
        onQuit={() => {
          setPlayId(null);
          reload();
        }}
        onDone={(r) => {
          setPlayId(null);
          if (r.xp) {
            setXp({ status: 'saved', gained: r.xp.gained, total: r.xp.total });
            onXpAwarded();
          }
          reload();
        }}
      />
    );
  }

  if (board === undefined) {
    return (
      <div className="screen loading">
        <div className="loading__brain">🔗</div>
        <p className="loading__msg">{busy ? 'กำลังเตรียมคำท้า...' : 'กำลังโหลดคำท้า...'}</p>
      </div>
    );
  }

  if (board === null) {
    return (
      <div className="screen loading">
        <div className="loading__brain">😕</div>
        <p className="loading__msg">ไม่พบคำท้านี้ ตรวจลิงก์อีกครั้งนะ</p>
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          🏠 หน้าแรก
        </button>
      </div>
    );
  }

  const s = board.settings;
  const level = LEVELS[s.level ?? 'upper'];
  const sub = s.subject === 'all' ? null : subjectInfo(s.subject, s.level);
  const subject = `${level.emoji} ${level.name} · ${sub ? `${sub.emoji} ${sub.name}` : '🌈 ทุกวิชา'}`;
  const mine = board.rows.find((r) => r.isMe);
  const iAmCreator = !!mine?.isCreator;
  const canStart = !board.me && !board.expired;
  const canResume = !!board.me && !board.me.finished && !board.expired;

  const share = async () => {
    const url = challengeLink(board.code);
    const text = `${mine?.finished ? `ฉันได้ ${mine.score} คะแนน ` : ''}มาลองทำโจทย์ชุดเดียวกันใน Brain Gym แข่งกันหน่อย! (ภายใน 24 ชม.)`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Brain Gym คำท้า', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ผู้ใช้กดยกเลิก */
    }
  };

  return (
    <div className="screen challenge">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onHome} aria-label="กลับหน้าแรก">
          ←
        </button>
        <div className="quiz__progress">🔗 คำท้า {board.code}</div>
      </header>

      <section className="challenge-hero pop-in">
        <div className="challenge-hero__avatar">{board.creator?.avatar ?? '❔'}</div>
        <h1 className="challenge-hero__title">
          {iAmCreator ? 'คำท้าของคุณ' : `${board.creator?.nickname ?? 'เพื่อน'} ท้าคุณ!`}
        </h1>
        <p className="challenge-hero__meta">
          {subject} · {difficultyText(s.difficulty)} · {board.count} ข้อ
        </p>
        <p className={`challenge-hero__time ${board.expired ? 'is-expired' : ''}`}>⏳ {timeLeft(board.expiresAt)}</p>
      </section>

      <XpBadge xp={xp} guest={guest} onRegister={onRegister} />

      <section className="settings-card">
        <h2 className="section-title section-title--dark">🏆 อันดับ ({board.rows.filter((r) => r.finished).length} คนเล่นแล้ว)</h2>
        {board.rows.length === 0 ? (
          <p className="muted">ยังไม่มีใครเล่น เป็นคนแรกเลย!</p>
        ) : (
          <ol className="ranking">
            {board.rows.map((r, i) => (
              <li key={`${r.nickname}-${r.tag}`} className={`ranking__item ${r.isMe ? 'is-me' : ''} ${i === 0 && r.finished ? 'is-winner' : ''}`}>
                <span className="ranking__rank">{r.finished ? MEDAL[i] ?? i + 1 : '…'}</span>
                <span className="ranking__avatar">{r.avatar}</span>
                <span className="ranking__name">
                  {r.isMe ? 'คุณ' : r.nickname}
                  {r.isCreator && <span className="ranking__bot">ผู้ท้า</span>}
                </span>
                <span className="ranking__score">{r.finished ? `⭐ ${r.score}` : 'กำลังเล่น'}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && <p className="form-error">😵 {error}</p>}

      <div className="cta-bar">
        {(canStart || canResume) && (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={play}>
            {busy ? 'กำลังเริ่ม...' : canResume ? 'เล่นต่อ ▶' : 'รับคำท้า! ⚔️'}
          </button>
        )}
        {!board.expired && (
          <button type="button" className={`btn btn--block ${canStart || canResume ? 'btn--ghost' : 'btn--primary btn--big'}`} onClick={share}>
            {copied ? '✅ คัดลอกลิงก์แล้ว' : '📤 ส่งลิงก์ท้าเพื่อน'}
          </button>
        )}
      </div>
    </div>
  );
}
