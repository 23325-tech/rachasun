import { Atom, BookOpen, Brain, Crown, Flame, Lightning, Planet, Rocket, Shield, Star, Sword, Trophy, type Icon } from '@phosphor-icons/react';
import { EMBLEM_COLORS } from '../lib/clan';

const ICONS: Record<string, Icon> = {
  shield: Shield,
  sword: Sword,
  lightning: Lightning,
  flame: Flame,
  crown: Crown,
  star: Star,
  rocket: Rocket,
  atom: Atom,
  brain: Brain,
  planet: Planet,
  book: BookOpen,
  trophy: Trophy,
};

/** ตราแคลน: ไอคอนขาวบนพื้นสี (รหัส <ไอคอน>.<สี>) */
export function ClanEmblem({ emblem, size = 44 }: { emblem: string; size?: number }) {
  const [icon, color] = emblem.split('.');
  const C = ICONS[icon] ?? Shield;
  return (
    <span className="clan-emblem" style={{ width: size, height: size, background: EMBLEM_COLORS[color] ?? EMBLEM_COLORS.purple }} aria-hidden>
      <C weight="fill" size={Math.round(size * 0.58)} color="#fff" />
    </span>
  );
}
