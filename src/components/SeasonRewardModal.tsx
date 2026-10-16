import { Coin, Confetti } from '@phosphor-icons/react';
import { PlayerAvatar } from './PlayerAvatar';
import { TierIcon } from './icons';
import { t } from '../lib/i18n';
import { lookCode } from '../lib/look';
import { TIERS } from '../lib/rank';
import type { SeasonReward } from '../lib/season';

const LETTER: Record<string, string> = { bronze: 'b', silver: 's', gold: 'g', platinum: 'p', diamond: 'd', legend: 'l' };

interface Props {
  rewards: SeasonReward[];
  avatar: string;
  busy: boolean;
  /** wear = ใส่กรอบล่าสุดเลย */
  onClose: (wear: boolean) => void;
}

/** ป๊อปอัปตอนเข้าเกมครั้งแรกหลังจบฤดูกาล */
export function SeasonRewardModal({ rewards, avatar, busy, onClose }: Props) {
  const last = rewards[rewards.length - 1];
  const tier = TIERS.find((x) => x.key === last.tier)!;
  const totalCoins = rewards.reduce((s, r) => s + r.coins, 0);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('ผลฤดูกาล', 'Season results')}>
      <div className="settings-card season-modal pop-in">
        <Confetti weight="fill" size={34} className="season-modal__burst" />
        <h2>{t(`จบฤดูกาล ${last.season} แล้ว!`, `Season ${last.season} is over!`)}</h2>
        <PlayerAvatar code={`${lookCode(avatar)}+${last.season}${LETTER[last.tier]}`} size={96} />
        <p className="season-modal__tier">
          <TierIcon tier={tier.key} size={22} /> {t(`ยศสูงสุด ${tier.name}`, `Peak tier: ${tier.name}`)} · {last.peakRp} RP
        </p>
        <p className="season-modal__coins">
          <Coin weight="fill" className="ico" /> +{totalCoins} {t('เหรียญ', 'coins')}
        </p>
        <p className="muted">
          {t(
            `ได้กรอบ${tier.name} ฤดูกาล ${last.season} แล้ว · RP ฤดูกาลใหม่เหลือครึ่งหนึ่ง`,
            `You earned the Season ${last.season} ${tier.name} frame · RP is halved for the new season`,
          )}
        </p>
        <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={() => onClose(true)}>
          {t('ใส่กรอบเลย', 'Wear frame')}
        </button>
        <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={() => onClose(false)}>
          {t('ไว้ทีหลัง', 'Later')}
        </button>
      </div>
    </div>
  );
}
