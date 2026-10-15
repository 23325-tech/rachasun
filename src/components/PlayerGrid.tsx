import type { BattlePlayer, DamageReason } from '../game/battle';

export type PlayerStatus = 'thinking' | 'locked' | 'correct' | 'wrong' | 'timeout' | 'out';

/** aim = เป้าเล็งขึ้น, bang = ยิงโดน หัวใจแตก */
export type HitStage = 'none' | 'aim' | 'bang';

interface Props {
  players: BattlePlayer[];
  maxHearts: number;
  meId: string;
  status: Record<string, PlayerStatus>;
  /** ผู้เล่นที่โดนยิงในข้อนี้ -> จำนวนหัวใจที่เสีย */
  hits: Record<string, { lost: number; reason: DamageReason }>;
  hitStage: HitStage;
}

const STATUS_ICON: Record<PlayerStatus, string> = {
  thinking: '💭',
  locked: '🔒',
  correct: '✅',
  wrong: '❌',
  timeout: '⏰',
  out: '💀',
};

export function PlayerGrid({ players, maxHearts, meId, status, hits, hitStage }: Props) {
  return (
    <div className={`player-grid player-grid--${Math.min(players.length, 8)}`}>
      {players.map((p) => {
        const hit = hits[p.id];
        const out = p.rank !== null && p.hearts === 0;
        const st = out && !hit ? 'out' : status[p.id] ?? 'thinking';
        // ตอน bang หัวใจลดแล้ว ให้ดวงที่เพิ่งเสียเล่นแอนิเมชันแตก
        const breakingFrom = hit && hitStage === 'bang' ? p.hearts : -1;
        const breakingTo = hit && hitStage === 'bang' ? p.hearts + hit.lost : -1;
        return (
          <div
            key={p.id}
            className={[
              'pcard',
              p.id === meId && 'pcard--me',
              out && hitStage !== 'bang' && 'is-out',
              hit && hitStage === 'aim' && 'is-aimed',
              hit && hitStage === 'bang' && 'is-hit',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="pcard__avatar" aria-hidden>
              {p.avatar}
              {hit && hitStage === 'aim' && <span className="pcard__crosshair">🎯</span>}
              {hit && hitStage === 'bang' && <span className="pcard__boom">💥</span>}
            </div>
            <div className="pcard__name">{p.id === meId ? 'คุณ' : p.name}</div>
            <div className="pcard__hearts" aria-label={`หัวใจ ${p.hearts} ดวง`}>
              {Array.from({ length: maxHearts }, (_, i) => {
                const breaking = i >= breakingFrom && i < breakingTo;
                const full = i < p.hearts;
                return (
                  <span key={i} className={`heart ${full ? 'heart--full' : 'heart--empty'} ${breaking ? 'heart--breaking' : ''}`}>
                    {full || breaking ? '❤️' : '🖤'}
                  </span>
                );
              })}
            </div>
            <span className={`pcard__status pcard__status--${st}`} aria-label={st}>
              {STATUS_ICON[st]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
