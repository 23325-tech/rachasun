import { displayName, type Profile } from '../lib/profile';
import { levelFromXp } from '../lib/level';
import { tierOf } from '../lib/rank';

interface Props {
  profile: Profile;
  guest: boolean;
  needsPassword: boolean;
  onOpen: () => void;
}

export function ProfileCard({ profile, guest, needsPassword, onOpen }: Props) {
  const lv = levelFromXp(profile.xp);
  const tier = tierOf(profile.rp ?? 0);
  return (
    <button type="button" className="profile-card" onClick={onOpen} aria-label="เปิดหน้าบัญชี">
      <span className="profile-card__avatar" aria-hidden>
        {profile.avatar}
      </span>
      <span className="profile-card__body">
        <span className="profile-card__row">
          <span className="profile-card__name">{displayName(profile)}</span>
          <span className="lv-badge">Lv {lv.level}</span>
          <span className={`tier-badge tier-badge--${tier.key}`} title={`${profile.rp ?? 0} RP`}>
            {tier.icon} {tier.name}
          </span>
        </span>
        <span className="xp-bar" aria-label={`XP ${lv.current} จาก ${lv.needed}`}>
          <span className="xp-bar__fill" style={{ transform: `scaleX(${lv.current / lv.needed})` }} />
        </span>
        <span className="profile-card__xp">
          {lv.current}/{lv.needed} XP
        </span>
      </span>
      <span className={`profile-card__cta ${guest || needsPassword ? 'is-guest' : ''}`}>
        {guest ? '💾 สมัคร' : needsPassword ? '🔑 ตั้งรหัส' : '👤'}
      </span>
    </button>
  );
}
