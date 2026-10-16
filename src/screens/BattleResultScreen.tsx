import type { BattlePlayer } from '../game/battle';
import { XpBadge, type XpState } from '../components/XpBadge';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface Props {
  players: BattlePlayer[];
  meId: string;
  /** ไม่ส่งมา = กดเล่นอีกรอบไม่ได้ (เช่น ไม่ใช่เจ้าของห้อง) จะแสดง waitingLabel แทน */
  onReplay?: () => void;
  replayLabel?: string;
  waitingLabel?: string;
  onHome: () => void;
  homeLabel?: string;
  xp: XpState;
  guest: boolean;
  onRegister: () => void;
}

function headline(rank: number, total: number, sharedFirst: boolean) {
  if (rank === 1 && sharedFirst) return { emoji: '🤝', title: 'เสมอกัน!' };
  if (rank === 1) return { emoji: '🏆', title: 'ชนะเลิศ!' };
  if (rank <= Math.ceil(total / 2)) return { emoji: '🔥', title: 'เกือบแล้ว!' };
  return { emoji: '💪', title: 'แก้มือรอบหน้า!' };
}

export function BattleResultScreen({
  players,
  meId,
  onReplay,
  replayLabel = 'ดวลอีกรอบ ⚔️',
  waitingLabel,
  onHome,
  homeLabel = '🏠 หน้าแรก',
  xp,
  guest,
  onRegister,
}: Props) {
  const sorted = [...players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.score - a.score);
  const me = players.find((p) => p.id === meId)!;
  const myRank = me.rank ?? players.length;
  const sharedFirst = players.filter((p) => p.rank === 1).length > 1;
  const h = headline(myRank, players.length, sharedFirst && myRank === 1);

  return (
    <div className="screen result">
      <header className="result__hero pop-in">
        <div className="result__emoji bounce">{h.emoji}</div>
        <h1 className="result__title">{h.title}</h1>
        <div className="result__score">
          อันดับ {myRank} จาก {players.length}
        </div>
      </header>

      <XpBadge xp={xp} guest={guest} onRegister={onRegister} />

      <ol className="ranking">
        {sorted.map((p) => (
          <li key={p.id} className={`ranking__item ${p.id === meId ? 'is-me' : ''} ${p.rank === 1 ? 'is-winner' : ''}`}>
            <span className="ranking__rank">{MEDAL[p.rank ?? 0] ?? p.rank}</span>
            <span className="ranking__avatar" aria-hidden>
              {p.avatar}
            </span>
            <span className="ranking__name">
              {p.id === meId ? 'คุณ' : p.name}
              {p.isBot && <span className="ranking__bot">BOT</span>}
            </span>
            <span className="ranking__score">⭐ {p.score}</span>
          </li>
        ))}
      </ol>

      <div className="bottom-bar bottom-bar--row">
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          {homeLabel}
        </button>
        {onReplay ? (
          <button type="button" className="btn btn--primary btn--grow" onClick={onReplay}>
            {replayLabel}
          </button>
        ) : (
          <p className="waiting waiting--grow">{waitingLabel}</p>
        )}
      </div>
    </div>
  );
}
