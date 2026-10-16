import type { BattlePlayer } from '../game/battle';
import { XpBadge, type XpState } from '../components/XpBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Barbell, Fire, Handshake, Star, Trophy } from '@phosphor-icons/react';
import { RankMedal } from '../components/icons';
import { lazy, Suspense } from 'react';
import { use3D } from '../lib/perf';
import { t } from '../lib/i18n';

const StageScene = lazy(() => import('../components/StageScene').then((m) => ({ default: m.StageScene })));


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
  if (rank === 1 && sharedFirst) return { icon: Handshake, title: t('เสมอกัน!', 'It\'s a tie!') };
  if (rank === 1) return { icon: Trophy, title: t('ชนะเลิศ!', 'Winner!') };
  if (rank <= Math.ceil(total / 2)) return { icon: Fire, title: t('เกือบแล้ว!', 'So close!') };
  return { icon: Barbell, title: t('แก้มือรอบหน้า!', 'Get them next time!') };
}

export function BattleResultScreen({
  players,
  meId,
  onReplay,
  replayLabel = t('ดวลอีกรอบ', 'Rematch'),
  waitingLabel,
  onHome,
  homeLabel = t('หน้าแรก', 'Home'),
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
        <Podium top={sorted.slice(0, 3)} meId={meId} />
        <h1 className="result__title">
          <h.icon weight="fill" className="ico" /> {h.title}
        </h1>
        <div className="result__score">
          {t(`อันดับ ${myRank} จาก ${players.length}`, `Rank ${myRank} of ${players.length}`)}
        </div>
      </header>

      <XpBadge xp={xp} guest={guest} onRegister={onRegister} />

      <ol className="ranking">
        {sorted.map((p) => (
          <li key={p.id} className={`ranking__item ${p.id === meId ? 'is-me' : ''} ${p.rank === 1 ? 'is-winner' : ''}`}>
            <span className="ranking__rank">
              <RankMedal rank={p.rank ?? 0} />
            </span>
            <span className="ranking__avatar" aria-hidden>
              <PlayerAvatar code={p.avatar} size={36} />
            </span>
            <span className="ranking__name">
              {p.id === meId ? t('คุณ', 'You') : p.name}
              {p.isBot && <span className="ranking__bot">BOT</span>}
            </span>
            <span className="ranking__score"><Star weight="fill" className="ico" /> {p.score}</span>
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

/** แท่นรางวัล 3 อันดับแรก: ที่ 1 ดีใจ ที่ 2-3 ปรบมือ */
function Podium({ top, meId }: { top: BattlePlayer[]; meId: string }) {
  const name = (p: BattlePlayer) => (p.id === meId ? t('คุณ', 'You') : p.name);
  if (use3D()) {
    return (
      <Suspense fallback={<div className="podium-3d" />}>
        <StageScene
          className="stage-scene podium-3d"
          layout="podium"
          actors={top.map((p, i) => ({ code: p.avatar, pose: i === 0 ? 'cheer' : 'clap' }))}
          labels={top.map((p) => (
            <span className={`vs-name ${p.id === meId ? 'is-me' : ''}`}>{name(p)}</span>
          ))}
        />
      </Suspense>
    );
  }
  // ภาพนิ่ง: เรียง 2-1-3 บนแท่น CSS
  const order = [top[1], top[0], top[2]];
  return (
    <div className="podium-static">
      {order.map((p, i) =>
        p ? (
          <div key={p.id} className={`podium-static__col podium-static__col--${i === 1 ? 1 : i === 0 ? 2 : 3}`}>
            <PlayerAvatar code={p.avatar} size={84} framing="full" className="is-bare" />
            <span className={`vs-name ${p.id === meId ? 'is-me' : ''}`}>{name(p)}</span>
            <div className="podium-static__block">{i === 1 ? 1 : i === 0 ? 2 : 3}</div>
          </div>
        ) : null,
      )}
    </div>
  );
}
