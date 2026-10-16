import { useCallback, useEffect, useState } from 'react';
import { groupBoard, groupLink, leaveGroup, type GroupBoard } from '../lib/groups';
import { startDaily } from '../lib/asyncPlay';
import { AsyncPlayScreen } from './AsyncPlayScreen';
import { settingsLabel, difficultyText } from '../data/subjects';
import { XpBadge, type XpState } from '../components/XpBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RankMedal } from '../components/icons';
import { CalendarBlank,CalendarDots,CheckCircle,Star,Trophy,Users,WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  groupId: string;
  guest: boolean;
  onBack: () => void;
  onLeft: () => void;
  onRegister: () => void;
  onXpAwarded: () => void;
}


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
        title={t('โจทย์วันนี้', 'Today\'s questions')}
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
        <div className="loading__brain"><Trophy weight="fill" className="ico" /></div>
        <p className="loading__msg">{error || t('กำลังโหลดกลุ่ม...', 'Loading group...')}</p>
        {error && (
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            {t('← กลับ', '← Back')}
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
    const text = t(
      `มาเข้ากลุ่ม "${g.name}" ใน Brain Gym ฝึกโจทย์ประจำวันแข่งกัน! รหัสกลุ่ม ${g.code}`,
      `Join "${g.name}" on Brain Gym and compete on daily questions! Group code ${g.code}`,
    );
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
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">{g.name}</div>
        <div className="quiz__score"><Users weight="fill" className="ico" /> {board.rows.length}</div>
      </header>

      <section className="code-card pop-in">
        <span className="code-card__label">
          {settingsLabel(g.settings)} · {difficultyText(g.settings.difficulty)} · {t('10 ข้อ/วัน', '10 Qs/day')}
        </span>
        <span className="code-card__code code-card__code--small">{g.code}</span>
        <button type="button" className="btn btn--ghost btn--block" onClick={share}>
          {copied ? t('คัดลอกลิงก์แล้ว', 'Link copied') : t('ชวนเพื่อนเข้ากลุ่ม', 'Invite friends')}
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
            <CalendarBlank weight="fill" className="ico" /> {t('วันนี้', 'Today')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'week'}
            className={`segmented__opt ${period === 'week' ? 'is-active' : ''}`}
            onClick={() => setPeriod('week')}
          >
            <CalendarDots weight="fill" className="ico" /> {t('สัปดาห์นี้', 'This week')}
          </button>
        </div>
        <ol className="ranking">
          {board.rows.map((r, i) => {
            const ranked = r.played > 0;
            return (
              <li key={`${r.nickname}-${r.tag}`} className={`ranking__item ${r.isMe ? 'is-me' : ''} ${i === 0 && ranked ? 'is-winner' : ''}`}>
                <span className="ranking__rank">{ranked ? <RankMedal rank={i + 1} /> : '–'}</span>
                <span className="ranking__avatar">
                  <PlayerAvatar code={r.avatar} size={36} />
                </span>
                <span className="ranking__name">
                  {r.isMe ? t('คุณ', 'You') : r.nickname}
                  {period === 'week' && r.played > 0 && <span className="ranking__bot">{t(`${r.played} วัน`, `${r.played} d`)}</span>}
                </span>
                <span className="ranking__score">{ranked ? (
                    <>
                      <Star weight="fill" className="ico" /> {r.score}
                    </>
                  ) : (
                    t('ยังไม่เล่น', 'Not yet')
                  )}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}

      {!confirmLeave ? (
        <button type="button" className="link-btn group-leave" onClick={() => setConfirmLeave(true)}>
          {t('ออกจากกลุ่ม', 'Leave group')}
        </button>
      ) : (
        <div className="alert">
          <p className="alert__msg">{t(`ออกจากกลุ่ม "${g.name}" จริงไหม? คะแนนของคุณในกลุ่มนี้จะหายไป`, `Leave "${g.name}"? Your scores in this group will be lost`)}</p>
          <div className="bottom-bar--row">
            <button type="button" className="btn btn--ghost btn--grow" onClick={() => setConfirmLeave(false)}>
              {t('ยกเลิก', 'Cancel')}
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
              {t('ออกจากกลุ่ม', 'Leave group')}
            </button>
          </div>
        </div>
      )}

      <div className="cta-bar">
        {playedToday ? (
          <p className="cta-bar__summary"><CheckCircle weight="fill" className="ico" /> {t('เล่นโจทย์วันนี้แล้ว ได้', 'Done today, scored')} <Star weight="fill" className="ico" /> {meToday?.score} · {t('พรุ่งนี้มาใหม่นะ!', 'see you tomorrow!')}</p>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={play}>
            {busy ? t('กำลังเตรียมโจทย์...', 'Preparing questions...') : t('เล่นโจทย์วันนี้', 'Play today\'s questions')}
          </button>
        )}
      </div>
    </div>
  );
}
