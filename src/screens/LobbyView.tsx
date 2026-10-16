import { useState } from 'react';
import { DIFFICULTY_OPTIONS } from '../data/subjects';
import { LevelSubjectFields } from '../components/LevelSubjectFields';
import { heartsFor } from '../game/battle';
import { inviteLink, updateRoomMode, updateRoomSettings, type Room, type RoomPlayer, type RoomSettings } from '../lib/rooms';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Cards, Crown, Hourglass, Scissors, ShieldCheck, Sword, Users, WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  room: Room;
  players: RoomPlayer[];
  /** user_id ที่เปิดแอพอยู่ตอนนี้ (Realtime presence) */
  online: string[];
  myId: string;
  onLeave: () => void;
  onRoomChange: (room: Room) => void;
  onStart: () => Promise<void>;
}

const DIFFICULTIES = DIFFICULTY_OPTIONS;
const COUNTS: RoomSettings['count'][] = [5, 10, 20];

/** หน้าล็อบบี้ (แสดงผลอย่างเดียว ข้อมูลห้องมาจาก RoomScreen) */
export function LobbyView({ room, players, online, myId, onLeave, onRoomChange, onStart }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const isHost = room.host_id === myId;
  const s = room.settings;
  const change = async (patch: Partial<RoomSettings>) => {
    setError('');
    try {
      onRoomChange(await updateRoomSettings(room.id, { ...s, ...patch }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const share = async () => {
    const url = inviteLink(room.code);
    const text = t(`มาดวลโจทย์กันใน Brain Gym! รหัสห้อง ${room.code}`, `Battle me on Brain Gym! Room code ${room.code}`);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Brain Gym', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ผู้ใช้กดยกเลิกการแชร์ */
    }
  };

  return (
    <div className="screen lobby">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onLeave} aria-label={t('ออกจากห้อง', 'Leave room')}>
          ✕
        </button>
        <div className="quiz__progress">{t('ห้องรอเล่น', 'Lobby')}</div>
        <div className="quiz__score"><Users weight="fill" className="ico" /> {players.length}/8</div>
      </header>

      <section className="code-card pop-in">
        <span className="code-card__label">{t('รหัสห้อง', 'Room code')}</span>
        <span className="code-card__code">{room.code}</span>
        <button type="button" className="btn btn--primary btn--block" onClick={share}>
          {copied ? t('คัดลอกลิงก์แล้ว', 'Link copied') : t('ชวนเพื่อน', 'Invite friends')}
        </button>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">{t('ผู้เล่นในห้อง', 'Players')}</h2>
        <ul className="lobby-players">
          {players.map((p) => (
            <li key={p.user_id} className={`lobby-player ${p.user_id === myId ? 'is-me' : ''}`}>
              <span className="lobby-player__avatar">
                <PlayerAvatar code={p.avatar} size={38} />
              </span>
              <span className="lobby-player__name">
                {p.nickname}
                <span className="lobby-player__tag">#{p.tag}</span>
                {p.user_id === myId && <span className="lobby-player__you"> {t('(คุณ)', '(you)')}</span>}
              </span>
              {p.user_id === room.host_id && (
                <span className="lobby-player__host" title={t('เจ้าของห้อง', 'Host')} aria-label={t('เจ้าของห้อง', 'Host')}>
                  <Crown weight="fill" className="ico" />
                </span>
              )}
              <span
                className={`online-dot ${online.includes(p.user_id) ? 'is-online' : ''}`}
                aria-label={online.includes(p.user_id) ? t('ออนไลน์', 'Online') : t('ไม่ได้เปิดแอพ', 'Not in the app')}
              />
            </li>
          ))}
          {Array.from({ length: Math.max(0, 2 - players.length) }, (_, i) => (
            <li key={`empty-${i}`} className="lobby-player is-empty">
              <span className="lobby-player__avatar">
                <PlayerAvatar size={38} />
              </span>
              <span className="lobby-player__name">{t('รอเพื่อนเข้าห้อง...', 'Waiting for friends...')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          {t('ตั้งค่าห้อง', 'Room settings')} {!isHost && <span className="muted">{t('(เจ้าของห้องเป็นคนเลือก)', '(host decides)')}</span>}
        </h2>
        <fieldset className="lobby-settings" disabled={!isHost}>
          <LevelSubjectFields value={s} onChange={(next) => change(next)} />
          <div className="segmented">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`segmented__opt ${s.difficulty === d.value ? 'is-active' : ''}`}
                onClick={() => change({ difficulty: d.value })}
              >
                <d.icon weight="fill" className="ico" /> {d.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`segmented__opt ${s.count === n ? 'is-active' : ''}`}
                onClick={() => change({ count: n })}
              >
                {t(`${n} ข้อ`, `${n} Qs`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="segmented">
          <button
            type="button"
            disabled={!isHost}
            className={`segmented__opt ${room.mode === 'classic' ? 'is-active' : ''}`}
            onClick={() => updateRoomMode(room.id, 'classic').then(onRoomChange).catch((e) => setError(String(e.message ?? e)))}
          >
            <Sword weight="fill" className="ico" /> {t('ไม่มีไอเทม', 'No items')}
          </button>
          <button
            type="button"
            disabled={!isHost}
            className={`segmented__opt ${room.mode === 'items' ? 'is-active' : ''}`}
            onClick={() => updateRoomMode(room.id, 'items').then(onRoomChange).catch((e) => setError(String(e.message ?? e)))}
          >
            <Cards weight="fill" className="ico" /> {t('การ์ดพลัง', 'Power cards')}
          </button>
        </div>
        <p className="lobby-summary">
          {t(`หัวใจคนละ ${heartsFor(s.count)} ดวง · ตอบช้าสุดโดนยิง!`, `${heartsFor(s.count)} hearts each · slowest gets hit!`)}
          {room.mode === 'items' && <> · {t('ได้การ์ดสุ่มทุก 3 ข้อ', 'random card every 3 questions')} (<ShieldCheck weight="fill" className="ico" /> {t('โล่', 'Shield')} / <Scissors weight="fill" className="ico" /> 50/50)</>}
        </p>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}

      <div className="cta-bar">
        {isHost ? (
          <button
            type="button"
            className="btn btn--primary btn--block btn--big"
            disabled={players.length < 2 || starting}
            onClick={async () => {
              setStarting(true);
              setError('');
              try {
                await onStart();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setStarting(false);
              }
            }}
          >
            {players.length < 2 ? t('รอเพื่อนอย่างน้อย 1 คน', 'Need at least 1 friend') : starting ? t('กำลังเริ่ม...', 'Starting...') : t('เริ่มเกม!', 'Start game!')}
          </button>
        ) : (
          <p className="cta-bar__summary"><Hourglass weight="fill" className="ico" /> {t('รอเจ้าของห้องกดเริ่มเกม...', 'Waiting for the host to start...')}</p>
        )}
      </div>
    </div>
  );
}
