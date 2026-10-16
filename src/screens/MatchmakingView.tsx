import { useEffect, useRef, useState } from 'react';
import { settingsLabel, trackLabel, difficultyText } from '../data/subjects';
import type { Room, RoomPlayer } from '../lib/rooms';
import { callGame, serverNow } from '../lib/roomGame';

interface Props {
  room: Room;
  players: RoomPlayer[];
  myId: string;
  onCancel: () => void;
}

/** ต้องตรงกับ MATCH_FULL / MATCH_WAIT_MS ใน supabase/functions/room-game */
const MATCH_FULL = 8;
const MATCH_WAIT_MS = 30_000;


/** ห้องสาธารณะที่ยังรอคน: แสดงคนที่เจอแล้ว + เวลาที่เหลือก่อนเริ่ม */
export function MatchmakingView({ room, players, myId, onCancel }: Props) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, []);

  const startAt = new Date(room.created_at).getTime() + MATCH_WAIT_MS;
  const enough = players.length >= 2;
  const ready = players.length >= MATCH_FULL || (enough && now >= startAt);
  const secondsLeft = Math.max(0, Math.ceil((startAt - now) / 1000));
  const searching = Math.floor((now - new Date(room.created_at).getTime()) / 1000);

  // ถึงเงื่อนไขแล้ว -> ขอให้เซิร์ฟเวอร์เริ่มเกม (เซิร์ฟเวอร์ตรวจซ้ำเอง ใครเรียกก่อนก็ได้)
  const lastCallRef = useRef(0);
  useEffect(() => {
    if (!ready || Date.now() - lastCallRef.current < 1500) return;
    lastCallRef.current = Date.now() + Math.random() * 300;
    callGame('auto_start', { roomId: room.id }).catch(() => {});
  }, [ready, now, room.id]);

  const s = room.settings;
  const subjectLabel = settingsLabel(s);

  return (
    <div className="screen matchmaking">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="ยกเลิกการหา">
          ✕
        </button>
        <div className="quiz__progress">🎲 สุ่มหาคู่แข่ง</div>
        <div className="quiz__score">
          👥 {players.length}/{MATCH_FULL}
        </div>
      </header>

      <div className="radar" aria-hidden>
        <span className="radar__ring" />
        <span className="radar__ring radar__ring--2" />
        <span className="radar__center">🔍</span>
      </div>

      <p className="match-status" role="status">
        {ready
          ? 'เจอแล้ว! กำลังเริ่มเกม...'
          : enough
            ? `เริ่มใน ${secondsLeft} วินาที (หรือทันทีเมื่อครบ ${MATCH_FULL} คน)`
            : 'กำลังหาผู้เล่นคนอื่น...'}
      </p>
      <p className="match-sub">
        {subjectLabel} · {difficultyText(s.difficulty)} · {trackLabel(s.level, s.track)} · 10 ข้อ
        {room.mode === 'items' ? ' · 🃏 การ์ดพลัง' : ''}
        <br />
        ค้นหามาแล้ว {Math.floor(searching / 60)}:{String(searching % 60).padStart(2, '0')}
      </p>

      <ul className="match-players">
        {Array.from({ length: MATCH_FULL }, (_, i) => {
          const p = players[i];
          return (
            <li key={p?.user_id ?? `empty-${i}`} className={`match-slot ${p ? 'is-filled pop-in' : ''} ${p?.user_id === myId ? 'is-me' : ''}`}>
              <span className="match-slot__avatar">{p ? p.avatar : '❔'}</span>
              <span className="match-slot__name">{p ? (p.user_id === myId ? 'คุณ' : p.nickname) : 'ว่าง'}</span>
            </li>
          );
        })}
      </ul>

      <div className="cta-bar">
        <button type="button" className="btn btn--ghost btn--block" onClick={onCancel}>
          ยกเลิกการหา
        </button>
      </div>
    </div>
  );
}
