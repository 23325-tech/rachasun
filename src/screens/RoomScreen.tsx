import { useEffect, useState } from 'react';
import { fetchRoom, subscribeRoom, type Room, type RoomPlayer } from '../lib/rooms';
import { callGame, heartbeat, syncClock, type OnlineGameState } from '../lib/roomGame';
import { LobbyView } from './LobbyView';
import { MatchmakingView } from './MatchmakingView';
import { OnlineBattleView } from './OnlineBattleView';
import { BattleResultScreen } from './BattleResultScreen';
import { Brain, DoorOpen } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  roomId: string;
  myId: string;
  guest: boolean;
  onLeave: () => void;
  /** ห้องถูกลบ / เราถูกเอาออกจากห้อง */
  onGone: (reason: string) => void;
  onRegister: () => void;
  /** เซิร์ฟเวอร์ให้ XP แล้ว -> โหลดโปรไฟล์ใหม่ */
  onXpAwarded: () => void;
  /** ห้องสุ่ม: จบเกมแล้วหาเกมใหม่ด้วยค่าเดิม */
  onFindAgain: () => void;
}

const HEARTBEAT_MS = 5000;
/** หลังจบเกม แสดงแอนิเมชันข้อสุดท้ายก่อนไปหน้าสรุป */
const RESULT_DELAY_MS = 3500;

/** ตัวกลางของห้องออนไลน์: เชื่อม Realtime, ส่งสัญญาณ "ยังอยู่", แล้วเลือกหน้าที่ต้องแสดง */
export function RoomScreen({ roomId, myId, guest, onLeave, onGone, onRegister, onXpAwarded, onFindAgain }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);

  // ---------- เชื่อมห้อง ----------
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    const reload = async () => {
      const r = await fetchRoom(roomId);
      if (!alive) return;
      if (!r.room) return onGone(t('ห้องนี้ถูกปิดแล้ว', 'This room was closed'));
      if (!r.players.some((p) => p.user_id === myId)) return onGone(t('คุณไม่ได้อยู่ในห้องนี้แล้ว', 'You\'re no longer in this room'));
      setRoom(r.room);
      setPlayers(r.players);
    };
    reload().catch(() => {});
    syncClock(roomId);
    subscribeRoom(roomId, myId, () => void reload().catch(() => {}), setOnline)
      .then((unsub) => {
        if (alive) unsubscribe = unsub;
        else unsub();
      })
      .catch((e) => console.warn('subscribe room failed', e));

    // ส่งสัญญาณ "ยังอยู่" (ไม่ส่งเกิน 15 วินาที = หลุด)
    const beat = () => heartbeat(roomId).catch(() => {});
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    // กลับมาจากแอพอื่น: ส่งสัญญาณทันที + โหลดสถานะล่าสุด
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        beat();
        reload().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      unsubscribe?.();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomId, myId, onGone]);

  // ---------- จบเกม -> หน้าสรุปผล ----------
  const state = room?.state as OnlineGameState | null;
  const finished = room?.status === 'finished' && state?.phase === 'finished';
  useEffect(() => {
    if (!finished) {
      setShowResult(false);
      return;
    }
    onXpAwarded();
    const id = window.setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    return () => clearTimeout(id);
  }, [finished, onXpAwarded]);

  if (!room) {
    return (
      <div className="screen loading">
        <div className="loading__brain"><DoorOpen weight="fill" className="ico" /></div>
        <p className="loading__msg">{t('กำลังเข้าห้อง...', 'Joining room...')}</p>
      </div>
    );
  }

  const isHost = room.host_id === myId;

  if ((room.status === 'lobby' || !state) && room.kind === 'public') {
    return <MatchmakingView room={room} players={players} myId={myId} onCancel={onLeave} />;
  }

  if (room.status === 'lobby' || !state) {
    return (
      <LobbyView
        room={room}
        players={players}
        online={online}
        myId={myId}
        onLeave={onLeave}
        onRoomChange={setRoom}
        onStart={async () => {
          await callGame('start', { roomId });
        }}
      />
    );
  }

  if (state.phase === 'preparing') {
    return (
      <div className="screen loading">
        <div className="loading__brain"><Brain weight="fill" className="ico" /></div>
        <p className="loading__msg">{t('กำลังเตรียมโจทย์ให้ทุกคน...', 'Preparing questions for everyone...')}</p>
        <p className="loading__sub">{t('ถ้าคลังโจทย์ไม่พอ AI จะสร้างเพิ่ม อาจใช้เวลา 10-40 วินาที', 'If the bank runs short, AI makes more — may take 10-40 s')}</p>
        <div className="loading__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (finished && showResult) {
    const myXp = state.xp?.[myId];
    return (
      <BattleResultScreen
        players={state.players}
        meId={myId}
        onHome={onLeave}
        homeLabel={t('ออกจากห้อง', 'Leave room')}
        onReplay={
          room.kind === 'public'
            ? onFindAgain
            : isHost
              ? () => void callGame('rematch', { roomId }).catch(() => {})
              : undefined
        }
        replayLabel={room.kind === 'public' ? t('หาเกมใหม่', 'Find a new game') : t('เล่นอีกรอบ (กลับล็อบบี้)', 'Play again (back to lobby)')}
        waitingLabel={t('รอเจ้าของห้องเริ่มรอบใหม่...', 'Waiting for the host to start again...')}
        xp={
          myXp
            ? { status: 'saved', gained: myXp.gained, total: myXp.total, rpDelta: myXp.rpDelta, rp: myXp.rp }
            : { status: 'off' }
        }
        guest={guest}
        onRegister={onRegister}
      />
    );
  }

  return <OnlineBattleView roomId={roomId} state={state} myId={myId} onLeave={onLeave} />;
}
