// ไอคอนกลางของแอพ (ใช้แทนอิโมจิ) — ไอคอนทึบในกล่องสีขอบหนาตามสไตล์เดิม
import type { CSSProperties } from 'react';
import {
  Atom,
  Crown,
  Diamond,
  Dna,
  Flask,
  Lightning,
  MathOperations,
  Medal,
  ShieldStar,
  Translate,
  type Icon,
} from '@phosphor-icons/react';
import type { Subject } from '../types';
import type { Tier } from '../lib/rank';

export const SUBJECT_ICON: Record<Subject, Icon> = {
  math: MathOperations,
  science: Atom,
  physics: Lightning,
  chemistry: Flask,
  biology: Dna,
  english: Translate,
};

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
