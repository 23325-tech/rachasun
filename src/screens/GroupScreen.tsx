import { useCallback, useEffect, useState } from 'react';
import { groupBoard, groupLink, leaveGroup, type GroupBoard } from '../lib/groups';
import { startDaily } from '../lib/asyncPlay';
import { AsyncPlayScreen } from './AsyncPlayScreen';
import { subjectLabel } from './GroupsScreen';
import { XpBadge, type XpState } from '../components/XpBadge';

interface Props {
  groupId: string;
  guest: boolean;
  onBack: () => void;
  onLeft: () => void;
  onRegister: () => void;
  onXpAwarded: () => void;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const DIFF_TEXT = { easy: '🌱 ง่าย', medium: '🔥 กลาง', hard: '💀 ยาก' } as const;

/** หน้ากลุ่ม: โจทย์ประจำวัน + อันดับวันนี้ / สัปดาห์นี้ */
export function GroupScreen({ groupId, guest, onBack, onLeft, onRegister, onXpAwarded }: Props) {
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const [board, setBoard] = useState<GroupBoard | null>(null);
  const [today, setToday] = useState<GroupBoard | null>(null);
  const [playId, setPlayId] = useState<string | null>(null);
  const [xp, setXp] = useState<XpState>({ status: 'off' });
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([groupBoard(groupId, period), period === 'day' ? null : groupBoard(groupId, 'day')]);
      setBoard(b);
      setToday(t ?? b);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [groupId, period]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (playId) {
    return (
      <AsyncPlayScreen
        playId={playId}
        title="🏆 โจทย์วันนี้"
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
          setPeriod('day');
          reload();
        }}
      />
    );
  }

  if (!board) {
    return (
      <div className="screen loading">
        <div className="loading__brain">🏆</div>
        <p className="loading__msg">{error || 'กำลังโหลดกลุ่ม...'}</p>
        {error && (
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            ← กลับ
          </button>
        )}
      </div>
    );
  }

  const g = board.group;
  const meToday = today?.rows.find((r) => r.isMe);
  const playedToday = (meToday?.played ?? 0) > 0;

  const play = async () => {
    setBusy(true);
    setError('');
    try {
      setPlayId((await startDaily(groupId)).playId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      reload();
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = groupLink(g.code);
    const text = `มาเข้ากลุ่ม "${g.name}" ใน Brain Gym ฝึกโจทย์ประจำวันแข่งกัน! รหัสกลุ่ม ${g.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Brain Gym', text, url });
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
    <div className="screen group">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">{g.name}</div>
        <div className="quiz__score">👥 {board.rows.length}</div>
      </header>

      <section className="code-card pop-in">
        <span className="code-card__label">
          {subjectLabel(g.settings.subject)} · {DIFF_TEXT[g.settings.difficulty]} · 10 ข้อ/วัน
        </span>
        <span className="code-card__code code-card__code--small">{g.code}</span>
        <button type="button" className="btn btn--ghost btn--block" onClick={share}>
          {copied ? '✅ คัดลอกลิงก์แล้ว' : '📤 ชวนเพื่อนเข้ากลุ่ม'}
        </button>
      </section>

      <XpBadge xp={xp} guest={guest} onRegister={onRegister} />

      <section className="settings-card">
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={period === 'day'}
            className={`segmented__opt ${period === 'day' ? 'is-active' : ''}`}
            onClick={() => setPeriod('day')}
          >
            📅 วันนี้
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'week'}
            className={`segmented__opt ${period === 'week' ? 'is-active' : ''}`}
            onClick={() => setPeriod('week')}
          >
            🗓️ สัปดาห์นี้
          </button>
        </div>
        <ol className="ranking">
          {board.rows.map((r, i) => {
            const ranked = r.played > 0;
            return (
              <li key={`${r.nickname}-${r.tag}`} className={`ranking__item ${r.isMe ? 'is-me' : ''} ${i === 0 && ranked ? 'is-winner' : ''}`}>
                <span className="ranking__rank">{ranked ? MEDAL[i] ?? i + 1 : '–'}</span>
                <span className="ranking__avatar">{r.avatar}</span>
                <span className="ranking__name">
                  {r.isMe ? 'คุณ' : r.nickname}
                  {period === 'week' && r.played > 0 && <span className="ranking__bot">{r.played} วัน</span>}
                </span>
                <span className="ranking__score">{ranked ? `⭐ ${r.score}` : 'ยังไม่เล่น'}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {error && <p className="form-error">😵 {error}</p>}

      {!confirmLeave ? (
        <button type="button" className="link-btn group-leave" onClick={() => setConfirmLeave(true)}>
          ออกจากกลุ่ม
        </button>
      ) : (
        <div className="alert">
          <p className="alert__msg">ออกจากกลุ่ม "{g.name}" จริงไหม? คะแนนของคุณในกลุ่มนี้จะหายไป</p>
          <div className="bottom-bar--row">
            <button type="button" className="btn btn--ghost btn--grow" onClick={() => setConfirmLeave(false)}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn--primary btn--grow"
              onClick={() =>
                leaveGroup(groupId)
                  .then(onLeft)
                  .catch((e) => setError(e instanceof Error ? e.message : String(e)))
              }
            >
              ออกจากกลุ่ม
            </button>
          </div>
        </div>
      )}

      <div className="cta-bar">
        {playedToday ? (
          <p className="cta-bar__summary">✅ เล่นโจทย์วันนี้แล้ว ได้ ⭐ {meToday?.score} · พรุ่งนี้มาใหม่นะ!</p>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={play}>
            {busy ? 'กำลังเตรียมโจทย์...' : 'เล่นโจทย์วันนี้ 🎯'}
          </button>
        )}
      </div>
    </div>
  );
}
