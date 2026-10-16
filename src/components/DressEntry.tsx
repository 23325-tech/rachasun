import { CaretRight, Sparkle, TShirt } from '@phosphor-icons/react';
import { PlayerAvatar } from './PlayerAvatar';
import { t } from '../lib/i18n';

const SEEN_KEY = 'bg_dressing_seen';

export function markDressingSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* โหมดส่วนตัว: ไม่เป็นไร */
  }
}

export function isDressingSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** ทางเข้าห้องแต่งตัว: ครั้งแรกเป็นป้ายชวนแต่งตัว หลังจากนั้นเป็นปุ่มเล็ก */
export function DressEntry({ code, onOpen }: { code: string; onOpen: () => void }) {
  const isNew = !isDressingSeen();
  return (
    <button type="button" className={`dress-entry ${isNew ? 'is-new' : ''}`} onClick={onOpen}>
      <PlayerAvatar code={code} size={isNew ? 58 : 40} framing="full" className="is-bare" />
      <span className="dress-entry__text">
        <strong>
          {isNew && <Sparkle weight="fill" size={16} />} {isNew ? t('แต่งตัวละครของคุณ!', 'Dress up your character!') : t('ห้องแต่งตัว', 'Dressing room')}
        </strong>
        <small>{isNew ? t('เลือกทรงผม ชุด หมวก ของในมือ และลองของในร้านได้', 'Pick hair, outfits, hats, held items and try on shop items') : t('เปลี่ยนชุด ทรงผม และลองของใหม่', 'Change outfits, hair and try new items')}</small>
      </span>
      {isNew ? <CaretRight weight="bold" size={20} /> : <TShirt weight="fill" size={22} />}
    </button>
  );
}
