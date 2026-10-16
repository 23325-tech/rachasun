import { levelFromXp } from '../lib/level';
import { tierOf } from '../lib/rank';
import { TierIcon } from './icons';
import { Coin, Confetti, FloppyDisk, Hourglass } from '@phosphor-icons/react';

export type XpState =
  | { status: 'saving' }
  | { status: 'saved'; gained: number; total: number; rpDelta?: number; rp?: number; coins?: number }
  | { status: 'error'; message: string }
  | { status: 'off' };

/** RP ที่ได้/เสียจากห้องสุ่ม + แจ้งเลื่อนยศ/ตกยศ */
function RankChange({ delta, rp }: { delta: number; rp: number }) {
  const before = tierOf(rp - delta);
  const after = tierOf(rp);
  return (
    <div className="rank-change">
      <span className={`rank-change__delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
        {delta >= 0 ? '+' : ''}
        {delta} RP
      </span>
      <span className="rank-change__tier">
        <TierIcon tier={after.key} size={18} /> {after.name} · {rp} RP
      </span>
      {after.min > before.min && <div className="rank-change__promo bounce">
          <Confetti weight="fill" size={18} /> เลื่อนยศเป็น <TierIcon tier={after.key} size={18} /> {after.name}!
        </div>}
      {after.min < before.min && <div className="rank-change__demo">
          ตกยศเป็น <TierIcon tier={after.key} size={18} /> {after.name} สู้ใหม่นะ!
        </div>}
    </div>
  );
}

/** แสดง XP ที่ได้จากเกมนี้ + แจ้งเลเวลอัป */
export function XpBadge({ xp, guest, onRegister }: { xp: XpState; guest: boolean; onRegister: () => void }) {
  if (xp.status === 'off') return null;
  if (xp.status === 'saving') return <div className="xp-badge"><Hourglass weight="fill" className="ico" /> กำลังบันทึก XP...</div>;
  if (xp.status === 'error') return <div className="xp-badge xp-badge--error">บันทึก XP ไม่สำเร็จ: {xp.message}</div>;

  const before = levelFromXp(xp.total - xp.gained).level;
  const after = levelFromXp(xp.total);
  return (
    <div className="xp-badge pop-in">
      <div className="xp-badge__gain">
        +{xp.gained} XP
        {xp.coins !== undefined && xp.coins > 0 && (
          <span className="xp-badge__coins">
            <Coin weight="fill" className="ico" /> +{xp.coins}
          </span>
        )}
      </div>
      {after.level > before && <div className="xp-badge__levelup bounce"><Confetti weight="fill" className="ico" /> เลเวลอัป! Lv {after.level}</div>}
      {xp.rpDelta !== undefined && xp.rp !== undefined && <RankChange delta={xp.rpDelta} rp={xp.rp} />}
      <span className="xp-bar">
        <span className="xp-bar__fill" style={{ transform: `scaleX(${after.current / after.needed})` }} />
      </span>
      <div className="xp-badge__meta">
        Lv {after.level} · {after.current}/{after.needed} XP
      </div>
      {guest && (
        <button type="button" className="link-btn" onClick={onRegister}>
          <FloppyDisk weight="fill" className="ico" /> สมัครสมาชิกเพื่อเก็บ XP ไว้ถาวร
        </button>
      )}
    </div>
  );
}
