import { useCallback, useEffect, useState } from 'react';
import { LEVELS, subjectInfo, difficultyText } from '../data/subjects';
import { challengeLink, fetchChallengeBoard, startChallenge, type ChallengeBoard } from '../lib/asyncPlay';
import { AsyncPlayScreen } from './AsyncPlayScreen';
import { XpBadge, type XpState } from '../components/XpBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RankMedal } from '../components/icons';
import { Hourglass,House,LinkSimple,SmileySad,Star,Trophy,WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  code: string;
  guest: boolean;
  /** ผู้สร้างคำท้า: เล่นทันทีหลังสร้าง */
  autoPlay?: boolean;
  onHome: () => void;
  onRegister: () => void;
  onXpAwarded: () => void;
}


function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t('หมดเวลาแล้ว', 'Expired');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? t(`เหลือ ${h} ชม. ${m} นาที`, `${h} h ${m} min left`) : t(`เหลือ ${m} นาที`, `${m} min left`);
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
        title={t('คำท้า', 'Challenge')}
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
        <div className="loading__brain"><LinkSimple weight="fill" className="ico" /></div>
        <p className="loading__msg">{busy ? t('กำลังเตรียมคำท้า...', 'Preparing challenge...') : t('กำลังโหลดคำท้า...', 'Loading challenge...')}</p>
      </div>
    );
  }

  if (board === null) {
    return (
      <div className="screen loading">
        <div className="loading__brain"><SmileySad weight="fill" className="ico" /></div>
        <p className="loading__msg">{t('ไม่พบคำท้านี้ ตรวจลิงก์อีกครั้งนะ', 'Challenge not found, check the link')}</p>
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          <House weight="fill" className="ico" /> {t('หน้าแรก', 'Home')}
        </button>
      </div>
    );
  }

  const s = board.settings;
  const level = LEVELS[s.level ?? 'upper'];
  const sub = s.subject === 'all' ? null : subjectInfo(s.subject, s.level);
  const subject = `${level.name} · ${sub ? sub.name : t('ทุกวิชา', 'All subjects')}`;
  const mine = board.rows.find((r) => r.isMe);
  const iAmCreator = !!mine?.isCreator;
  const canStart = !board.me && !board.expired;
  const canResume = !!board.me && !board.me.finished && !board.expired;

  const share = async () => {
    const url = challengeLink(board.code);
    const text = t(
      `${mine?.finished ? `ฉันได้ ${mine.score} คะแนน ` : ''}มาลองทำโจทย์ชุดเดียวกันใน Brain Gym แข่งกันหน่อย! (ภายใน 24 ชม.)`,
      `${mine?.finished ? `I scored ${mine.score}. ` : ''}Try the same question set on Brain Gym and beat me! (within 24 h)`,
    );
    try {
      if (navigator.share) {
        await navigator.share({ title: t('Brain Gym คำท้า', 'Brain Gym challenge'), text, url });
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
        <button type="button" className="icon-btn" onClick={onHome} aria-label={t('กลับหน้าแรก', 'Back to home')}>
          ←
        </button>
        <div className="quiz__progress"><LinkSimple weight="fill" className="ico" /> {t('คำท้า', 'Challenge')} {board.code}</div>
      </header>

      <section className="challenge-hero pop-in">
        <div className="challenge-hero__avatar">
          <PlayerAvatar code={board.creator?.avatar} size={70} className="is-bare" />
        </div>
        <h1 className="challenge-hero__title">
          {iAmCreator ? t('คำท้าของคุณ', 'Your challenge') : t(`${board.creator?.nickname ?? 'เพื่อน'} ท้าคุณ!`, `${board.creator?.nickname ?? 'A friend'} challenges you!`)}
        </h1>
        <p className="challenge-hero__meta">
          {subject} · {difficultyText(s.difficulty)} · {board.count} {t('ข้อ', 'questions')}
        </p>
        <p className={`challenge-hero__time ${board.expired ? 'is-expired' : ''}`}><Hourglass weight="fill" className="ico" /> {timeLeft(board.expiresAt)}</p>
      </section>

      <XpBadge xp={xp} guest={guest} onRegister={onRegister} />

      <section className="settings-card">
        <h2 className="section-title section-title--dark"><Trophy weight="fill" className="ico" /> {t(`อันดับ (${board.rows.filter((r) => r.finished).length} คนเล่นแล้ว)`, `Leaderboard (${board.rows.filter((r) => r.finished).length} played)`)}</h2>
        {board.rows.length === 0 ? (
          <p className="muted">{t('ยังไม่มีใครเล่น เป็นคนแรกเลย!', 'Nobody has played yet — be the first!')}</p>
        ) : (
          <ol className="ranking">
            {board.rows.map((r, i) => (
              <li key={`${r.nickname}-${r.tag}`} className={`ranking__item ${r.isMe ? 'is-me' : ''} ${i === 0 && r.finished ? 'is-winner' : ''}`}>
                <span className="ranking__rank">{r.finished ? <RankMedal rank={i + 1} /> : '…'}</span>
                <span className="ranking__avatar">
                  <PlayerAvatar code={r.avatar} size={36} />
                </span>
                <span className="ranking__name">
                  {r.isMe ? t('คุณ', 'You') : r.nickname}
                  {r.isCreator && <span className="ranking__bot">{t('ผู้ท้า', 'Creator')}</span>}
                </span>
                <span className="ranking__score">{r.finished ? (
                    <>
                      <Star weight="fill" className="ico" /> {r.score}
                    </>
                  ) : (
                    t('กำลังเล่น', 'Playing')
                  )}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}

      <div className="cta-bar">
        {(canStart || canResume) && (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={play}>
            {busy ? t('กำลังเริ่ม...', 'Starting...') : canResume ? t('เล่นต่อ', 'Continue') : t('รับคำท้า!', 'Accept!')}
          </button>
        )}
        {!board.expired && (
          <button type="button" className={`btn btn--block ${canStart || canResume ? 'btn--ghost' : 'btn--primary btn--big'}`} onClick={share}>
            {copied ? t('คัดลอกลิงก์แล้ว', 'Link copied') : t('ส่งลิงก์ท้าเพื่อน', 'Send challenge link')}
          </button>
        )}
      </div>
    </div>
  );
}
