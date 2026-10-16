import type { BattlePlayer, DamageReason } from '../game/battle';
import { PlayerAvatar } from './PlayerAvatar';
import { Alarm, ChatCircleDots, CheckCircle, Crosshair, Heart, Lightning, LockSimple, ShieldCheck, SkipForward, Skull, XCircle, type Icon } from '@phosphor-icons/react';
import { createElement, lazy, Suspense, useMemo } from 'react';
import type { Pose } from '../three/chibi';
import { chibiOf } from '../lib/look';
import { t } from '../lib/i18n';

const Avatar3D = lazy(() => import('./Avatar3D').then((m) => ({ default: m.Avatar3D })));

export type PlayerStatus = 'thinking' | 'locked' | 'correct' | 'wrong' | 'timeout' | 'out' | 'skipped';

/** aim = เป้าเล็งขึ้น, bang = ยิงโดน หัวใจแตก */
export type HitStage = 'none' | 'aim' | 'bang';

interface Props {
  players: BattlePlayer[];
  maxHearts: number;
  meId: string;
  status: Record<string, PlayerStatus>;
  /** ผู้เล่นที่โดนยิงในข้อนี้ -> จำนวนหัวใจที่เสีย */
  hits: Record<string, { lost: number; reason: DamageReason; blocked?: boolean }>;
  hitStage: HitStage;
}

const STATUS_ICON: Record<PlayerStatus, Icon> = {
  thinking: ChatCircleDots,
  locked: LockSimple,
  correct: CheckCircle,
  wrong: XCircle,
  timeout: Alarm,
  out: Skull,
  skipped: SkipForward,
};

export function PlayerGrid({ players, maxHearts, meId, status, hits, hitStage }: Props) {
  return (
    <div className={`player-grid player-grid--${Math.min(players.length, 8)}`}>
      {players.map((p) => {
        const hit = hits[p.id];
        const out = p.rank !== null && p.hearts === 0;
        const st = out && !hit ? 'out' : status[p.id] ?? 'thinking';
        // ตอน bang หัวใจลดแล้ว ให้ดวงที่เพิ่งเสียเล่นแอนิเมชันแตก
        const blocked = !!hit?.blocked;
        const breakingFrom = hit && !blocked && hitStage === 'bang' ? p.hearts : -1;
        const sad = (hit && !blocked && hitStage === 'bang') || st === 'wrong' || st === 'timeout';
        const happy = st === 'correct' && !sad;
        const pose: Pose = happy ? 'cheer' : sad ? 'sad' : 'idle';
        const breakingTo = hit && !blocked && hitStage === 'bang' ? p.hearts + hit.lost : -1;
        return (
          <div
            key={p.id}
            className={[
              'pcard',
              p.id === meId && 'pcard--me',
              out && hitStage !== 'bang' && 'is-out',
              hit && hitStage === 'aim' && 'is-aimed',
              hit && !blocked && hitStage === 'bang' && 'is-hit',
              blocked && hitStage === 'bang' && 'is-shielded',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className={`pcard__avatar ${happy ? 'react-happy' : ''} ${sad ? 'react-sad' : ''}`} aria-hidden>
              {p.id === meId ? (
                <MeLive code={p.avatar} pose={pose} />
              ) : (
                <PlayerAvatar code={p.avatar} size={42} />
              )}
              {hit && hitStage === 'aim' && (
                <span className="pcard__crosshair">
                  <Crosshair weight="bold" size={30} />
                </span>
              )}
              {hit && hitStage === 'bang' && (
                <span className="pcard__boom">
                  {blocked ? <ShieldCheck weight="fill" size={30} /> : <Lightning weight="fill" size={30} />}
                </span>
              )}
            </div>
            <div className="pcard__name">{p.id === meId ? t('คุณ', 'You') : p.name}</div>
            {(p.cards?.shield ?? 0) > 0 && (
              <span className="pcard__shield" aria-label={t(`มีโล่ ${p.cards?.shield} อัน`, `${p.cards?.shield} shield(s)`)}>
                <ShieldCheck weight="fill" size={14} />
                {(p.cards?.shield ?? 0) > 1 ? p.cards?.shield : ''}
              </span>
            )}
            <div className="pcard__hearts" aria-label={t(`หัวใจ ${p.hearts} ดวง`, `${p.hearts} hearts`)}>
              {Array.from({ length: maxHearts }, (_, i) => {
                const breaking = i >= breakingFrom && i < breakingTo;
                const full = i < p.hearts;
                return (
                  <span key={i} className={`heart ${full ? 'heart--full' : 'heart--empty'} ${breaking ? 'heart--breaking' : ''}`}>
                    <Heart weight={full || breaking ? 'fill' : 'bold'} size={14} />
                  </span>
                );
              })}
            </div>
            <span className={`pcard__status pcard__status--${st}`} aria-label={st}>
              {createElement(STATUS_ICON[st], { weight: 'fill', size: 16 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** ตัวละครของเราแบบ 3D ครึ่งตัว (หน้าตาคำนวณครั้งเดียวต่อรหัส) */
function MeLive({ code, pose }: { code: string; pose: Pose }) {
  const look = useMemo(() => chibiOf(code), [code]);
  return (
    <Suspense fallback={<PlayerAvatar code={code} size={42} />}>
      <Avatar3D look={look} code={code} framing="bust" pose={pose} className="pcard__live" />
    </Suspense>
  );
}
