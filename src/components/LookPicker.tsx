import { lazy, Suspense, type ReactNode } from 'react';
import { Shuffle } from '@phosphor-icons/react';
import { encodeLook, lookOf, randomLook, toChibi, WARDROBE, type Look } from '../lib/look';
import type { Slot, WardrobeItem } from '../../supabase/functions/_shared/wardrobe';
import { t } from '../lib/i18n';

// โหลด three.js แยกไฟล์ หน้าอื่นไม่ต้องโหลด
const Avatar3D = lazy(() => import('./Avatar3D').then((m) => ({ default: m.Avatar3D })));

interface Props {
  code: string;
  onChange: (code: string) => void;
}

const freeOf = (slot: Slot) => WARDROBE.filter((i) => i.slot === slot && !i.coin && !i.gem);

/** ออกแบบตัวละครด้วยของฟรี (ตอนสร้างโปรไฟล์) */
export function LookPicker({ code, onChange }: Props) {
  const look = lookOf(code);
  const set = (slot: Slot, value: string) => onChange(encodeLook({ ...look, [slot]: value } as Look));

  const row = (label: string, slot: Slot, render: (it: WardrobeItem) => ReactNode) => (
    <div className="look-row">
      <span className="look-row__label">{label}</span>
      <div className="look-row__opts">
        {freeOf(slot).map((it) => (
          <button
            key={it.id}
            type="button"
            title={it.name}
            aria-label={it.name}
            aria-pressed={look[slot] === it.value}
            className={`look-opt ${look[slot] === it.value ? 'is-active' : ''}`}
            onClick={() => set(slot, it.value)}
          >
            {render(it)}
          </button>
        ))}
      </div>
    </div>
  );
  const swatch = (hex: string) => <span className="look-opt__swatch" style={{ background: `#${hex}` }} />;

  return (
    <div className="look-picker">
      <div className="look-picker__stage">
        <Suspense fallback={null}>
          <Avatar3D look={toChibi(look)} interactive className="look-picker__canvas" />
        </Suspense>
        <button type="button" className="look-picker__shuffle" onClick={() => onChange(encodeLook(randomLook()))}>
          <Shuffle weight="bold" size={18} />
          {t('สุ่ม', 'Shuffle')}
        </button>
      </div>
      {row(t('สีผิว', 'Skin'), 'skin', (it) => swatch(it.value))}
      {row(t('สีผม', 'Hair color'), 'hair', (it) => swatch(it.value))}
      {row(t('ทรงผม', 'Hairstyle'), 'style', (it) => <span className="look-opt__text">{it.name.replace('ผม', '')}</span>)}
      {row(t('ชุด', 'Outfit'), 'outfit', (it) => swatch(it.value.split('-')[1]))}
      <p className="muted look-picker__note">{t('แต่งตัวเพิ่มได้ทีหลังในห้องแต่งตัว', 'More outfits later in the dressing room')}</p>
    </div>
  );
}
