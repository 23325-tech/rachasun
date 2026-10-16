import { lazy, Suspense, useEffect } from 'react';
import { use3D } from '../lib/perf';
import { PlayerAvatar } from './PlayerAvatar';
import { t } from '../lib/i18n';

const StageScene = lazy(() => import('./StageScene').then((m) => ({ default: m.StageScene })));

export interface VsPlayer {
  id: string;
  name: string;
  avatar: string;
}

interface Props {
  players: VsPlayer[];
  meId: string;
  /** ข้อความใต้ VS เช่น "กำลังเตรียมโจทย์..." */
  subtitle?: string;
  /** ปิดเองอัตโนมัติหลังกี่มิลลิวินาที (ไม่ใส่ = คนเรียกปิดเอง) */
  autoCloseMs?: number;
  onDone?: () => void;
}

/** หน้า VS ก่อนเริ่มเกม: ตัวละครทุกคนยืนเรียงบนเวที */
export function VersusIntro({ players, meId, subtitle, autoCloseMs, onDone }: Props) {
  useEffect(() => {
    if (!autoCloseMs || !onDone) return;
    const t = setTimeout(onDone, autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onDone]);

  const label = (p: VsPlayer) => <span className={`vs-name ${p.id === meId ? 'is-me' : ''}`}>{p.id === meId ? t('คุณ', 'You') : p.name}</span>;

  return (
    <div className="vs-intro" role="dialog" aria-label={t('ผู้เล่นในเกมนี้', 'Players in this game')} onClick={onDone}>
      <div className="vs-intro__badge">
        <span>VS</span>
      </div>
      {use3D() ? (
        <Suspense fallback={null}>
          <StageScene
            className={`stage-scene vs-intro__stage ${players.length > 4 ? 'is-two-rows' : ''}`}
            layout="row"
            actors={players.map((p) => ({ code: p.avatar, pose: p.id === meId ? 'cheer' : 'wave' }))}
            labels={players.map(label)}
          />
        </Suspense>
      ) : (
        <div className="vs-intro__static">
          {players.map((p) => (
            <div key={p.id} className="vs-intro__card">
              <PlayerAvatar code={p.avatar} size={72} framing="full" className="is-bare" />
              {label(p)}
            </div>
          ))}
        </div>
      )}
      <p className="vs-intro__sub">{subtitle ?? t(`${players.length} คน · ตอบถูกและเร็ว ยิงหัวใจคนอื่น!`, `${players.length} players · answer right and fast to shoot hearts!`)}</p>
      {onDone && <p className="vs-intro__skip">{t('แตะเพื่อข้าม', 'Tap to skip')}</p>}
    </div>
  );
}
