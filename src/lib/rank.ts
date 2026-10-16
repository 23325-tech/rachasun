// โค้ดจริงอยู่ที่ supabase/functions/_shared/rank.ts (เซิร์ฟเวอร์ใช้คิดแต้มแรงค์ด้วย)
import { TIERS, type Tier } from '../../supabase/functions/_shared/rank';
import { t } from './i18n';

export { RP_FIRST, RP_LAST, TIERS, nextTier, rpDelta, tierOf, type Tier } from '../../supabase/functions/_shared/rank';

// ชื่อยศตามภาษาที่เลือก (ฝั่งหน้าเว็บเท่านั้น)
const EN: Record<Tier['key'], string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  legend: 'Legend',
};
for (const tier of TIERS) {
  const th = tier.name;
  Object.defineProperty(tier, 'name', { get: () => t(th, EN[tier.key]), enumerable: true });
}
