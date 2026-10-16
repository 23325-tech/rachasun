// ไอคอนกลางของแอพ (ใช้แทนอิโมจิ) — ไอคอนทึบในกล่องสีขอบหนาตามสไตล์เดิม
import type { CSSProperties } from 'react';
import {
  Crown,
  Diamond,
  Medal,
  ShieldStar,
  type Icon,
} from '@phosphor-icons/react';
import type { Tier } from '../lib/rank';

export { SUBJECT_ICON } from './subjectIcons';

export const TIER_STYLE: Record<Tier['key'], { icon: Icon; color: string }> = {
  bronze: { icon: Medal, color: '#c47a3a' },
  silver: { icon: Medal, color: '#8e98ad' },
  gold: { icon: Medal, color: '#e9a800' },
  platinum: { icon: ShieldStar, color: '#21b3bd' },
  diamond: { icon: Diamond, color: '#3d8bff' },
  legend: { icon: Crown, color: '#a35cff' },
};

export function TierIcon({ tier, size = 18 }: { tier: Tier['key']; size?: number }) {
  const t = TIER_STYLE[tier];
  return <t.icon weight="fill" size={size} color={t.color} />;
}

/** กล่องไอคอนสีไล่เฉดขอบหนา */
export function IconTile({ icon: I, grad, size = 46, iconSize = 26 }: { icon: Icon; grad: string; size?: number; iconSize?: number }) {
  return (
    <span className="icon-tile" style={{ '--g': grad, width: size, height: size } as CSSProperties}>
      <I weight="fill" size={iconSize} />
    </span>
  );
}

const MEDAL_COLOR = ['#e9a800', '#9aa3b5', '#c47a3a'];

/** อันดับ 1-3 เป็นเหรียญสี อันดับอื่นเป็นตัวเลข */
export function RankMedal({ rank, size = 24 }: { rank: number; size?: number }) {
  return rank >= 1 && rank <= 3 ? <Medal weight="fill" size={size} color={MEDAL_COLOR[rank - 1]} /> : <>{rank}</>;
}
