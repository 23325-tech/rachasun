import { useEffect, useState } from 'react';
import type { Difficulty, Subject, Track } from '../types';
import { SUBJECTS } from '../data/subjects';
import { heartsFor } from '../game/battle';
import {
  fetchRoom,
  inviteLink,
  subscribeRoom,
  updateRoomSettings,
  type Room,
  type RoomPlayer,
  type RoomSettings,
} from '../lib/rooms';

interface Props {
  roomId: string;
  myId: string;
  onLeave: () => void;
  /** ห้องถูกลบ / เราถูกเอาออกจากห้อง */
  onGone: (reason: string) => void;
}

const SUBJECT_OPTIONS: { value: Subject | 'all'; label: string }[] = [
  { value: 'all', label: '🌈 ทุกวิชา' },
  ...(Object.keys(SUBJECTS) as Subject[]).map((s) => ({ value: s, label: `${SUBJECTS[s].emoji} ${SUBJECTS[s].name}` })),
];
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: '🌱 ง่าย' },
  { value: 'medium', label: '🔥 กลาง' },
  { value: 'hard', label: '💀 ยาก' },
];
const TRACKS: { value: Track; label: string }[] = [
  { value: 'school', label: '🏫 สอบปกติ' },
  { value: 'entrance', label: '🎓 สอบเข้า' },
];
const COUNTS: RoomSettings['count'][] = [5, 10, 20];

export function LobbyScreen({ roomId, myId, onLeave, onGone }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    const reload = async () => {
      const r = await fetchRoom(roomId);
      if (!alive) return;
      if (!r.room) {
        onGone('ห้องนี้ถูกปิดแล้ว');
        return;
      }
      if (!r.players.some((p) => p.user_id === myId)) {
        onGone('คุณไม่ได้อยู่ในห้องนี้แล้ว');
        return;
      }
      setRoom(r.room);
      setPlayers(r.players);
    };
    // โหลดทันที ไม่ต้องรอ Realtime เชื่อมต่อเสร็จ
    reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    subscribeRoom(roomId, myId, () => void reload(), setOnline)
      .then((unsub) => {
        if (alive) unsubscribe = unsub;
        else unsub();
      })
      .catch((e) => console.warn('subscribe room failed', e));
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [roomId, myId, onGone]);

  if (!room) {
    return (
      <div className="screen loading">
        <div className="loading__brain">🚪</div>
        <p className="loading__msg">กำลังเข้าห้อง...</p>
      </div>
    );
  }

  const isHost = room.host_id === myId;
  const s = room.settings;
  const change = async (patch: Partial<RoomSettings>) => {
    setError('');
    try {
      setRoom(await updateRoomSettings(room.id, { ...s, ...patch }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const share = async () => {
    const url = inviteLink(room.code);
    const text = `มาดวลโจทย์กันใน Brain Gym! รหัสห้อง ${room.code}`;
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
        <button type="button" className="icon-btn" onClick={onLeave} aria-label="ออกจากห้อง">
          ✕
        </button>
        <div className="quiz__progress">ห้องรอเล่น</div>
        <div className="quiz__score">👥 {players.length}/8</div>
      </header>

      <section className="code-card pop-in">
        <span className="code-card__label">รหัสห้อง</span>
        <span className="code-card__code">{room.code}</span>
        <button type="button" className="btn btn--primary btn--block" onClick={share}>
          {copied ? '✅ คัดลอกลิงก์แล้ว' : '📤 ชวนเพื่อน'}
        </button>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">ผู้เล่นในห้อง</h2>
        <ul className="lobby-players">
          {players.map((p) => (
            <li key={p.user_id} className={`lobby-player ${p.user_id === myId ? 'is-me' : ''}`}>
              <span className="lobby-player__avatar">{p.avatar}</span>
              <span className="lobby-player__name">
                {p.nickname}
                <span className="lobby-player__tag">#{p.tag}</span>
                {p.user_id === myId && <span className="lobby-player__you"> (คุณ)</span>}
              </span>
              {p.user_id === room.host_id && (
                <span className="lobby-player__host" title="เจ้าของห้อง" aria-label="เจ้าของห้อง">
                  👑
                </span>
              )}
              <span
                className={`online-dot ${online.includes(p.user_id) ? 'is-online' : ''}`}
                aria-label={online.includes(p.user_id) ? 'ออนไลน์' : 'ไม่ได้เปิดแอพ'}
              />
            </li>
          ))}
          {Array.from({ length: Math.max(0, 2 - players.length) }, (_, i) => (
            <li key={`empty-${i}`} className="lobby-player is-empty">
              <span className="lobby-player__avatar">❔</span>
              <span className="lobby-player__name">รอเพื่อนเข้าห้อง...</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          ตั้งค่าห้อง {!isHost && <span className="muted">(เจ้าของห้องเป็นคนเลือก)</span>}
        </h2>
        <fieldset className="lobby-settings" disabled={!isHost}>
          <label className="field">
            <span className="field__label">วิชา</span>
            <select
              className="field__input"
              value={s.subject}
              onChange={(e) => change({ subject: e.target.value as RoomSettings['subject'] })}
            >
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`segmented__opt ${s.difficulty === d.value ? 'is-active' : ''}`}
                onClick={() => change({ difficulty: d.value })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            {TRACKS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`segmented__opt ${s.track === t.value ? 'is-active' : ''}`}
                onClick={() => change({ track: t.value })}
              >
                {t.label}
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
                {n} ข้อ
              </button>
            ))}
          </div>
        </fieldset>
        <p className="lobby-summary">หัวใจคนละ {heartsFor(s.count)} ดวง · ตอบช้าสุดโดนยิง!</p>
      </section>

      {error && <p className="form-error">😵 {error}</p>}

      <div className="cta-bar">
        {isHost ? (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled>
            {players.length < 2 ? 'รอเพื่อนอย่างน้อย 1 คน' : 'เริ่มเกม (เปิดในขั้น 5.2) 🔒'}
          </button>
        ) : (
          <p className="cta-bar__summary">⏳ รอเจ้าของห้องกดเริ่มเกม...</p>
        )}
      </div>
    </div>
  );
}
