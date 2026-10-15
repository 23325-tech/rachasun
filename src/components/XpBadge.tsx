import { levelFromXp } from '../lib/level';

export type XpState =
  | { status: 'saving' }
  | { status: 'saved'; gained: number; total: number }
  | { status: 'error'; message: string }
  | { status: 'off' };

/** แสดง XP ที่ได้จากเกมนี้ + แจ้งเลเวลอัป */
export function XpBadge({ xp, guest, onRegister }: { xp: XpState; guest: boolean; onRegister: () => void }) {
  if (xp.status === 'off') return null;
  if (xp.status === 'saving') return <div className="xp-badge">⏳ กำลังบันทึก XP...</div>;
  if (xp.status === 'error') return <div className="xp-badge xp-badge--error">บันทึก XP ไม่สำเร็จ: {xp.message}</div>;

  const before = levelFromXp(xp.total - xp.gained).level;
  const after = levelFromXp(xp.total);
  return (
    <div className="xp-badge pop-in">
      <div className="xp-badge__gain">+{xp.gained} XP</div>
      {after.level > before && <div className="xp-badge__levelup bounce">🎉 เลเวลอัป! Lv {after.level}</div>}
      <span className="xp-bar">
        <span className="xp-bar__fill" style={{ transform: `scaleX(${after.current / after.needed})` }} />
      </span>
      <div className="xp-badge__meta">
        Lv {after.level} · {after.current}/{after.needed} XP
      </div>
      {guest && (
        <button type="button" className="link-btn" onClick={onRegister}>
          💾 สมัครสมาชิกเพื่อเก็บ XP ไว้ถาวร
        </button>
      )}
    </div>
  );
}
