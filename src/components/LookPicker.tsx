import { lazy, Suspense, useState } from 'react';
import { Shuffle } from '@phosphor-icons/react';
import { encodeLook, lookOf, randomLook, toChibi, WARDROBE, type Look } from '../lib/look';
import type { Slot } from '../../supabase/functions/_shared/wardrobe';
import { PlayerAvatar } from './PlayerAvatar';
import { t } from '../lib/i18n';

// โหลด three.js แยกไฟล์ หน้าอื่นไม่ต้องโหลด
const Avatar3D = lazy(() => import('./Avatar3D').then((m) => ({ default: m.Avatar3D })));

interface Props {
  code: string;
  onChange: (code: string) => void;
}

const freeOf = (slot: Slot) => WARDROBE.filter((i) => i.slot === slot && !i.coin && !i.gem);

/** หมวดของฟรีตอนสร้างตัวละคร (swatch = จุดสี / bust,full = รูปตัวอย่าง) */
const TABS: { slot: Slot; label: () => string; view: 'swatch' | 'bust' | 'full' }[] = [
  { slot: 'skin', label: () => t('ผิว', 'Skin'), view: 'swatch' },
  { slot: 'hair', label: () => t('สีผม', 'Hair'), view: 'swatch' },
  { slot: 'style', label: () => t('ทรงผม', 'Style'), view: 'bust' },
  { slot: 'eyes', label: () => t('ตา', 'Eyes'), view: 'swatch' },
  { slot: 'face', label: () => t('ใบหน้า', 'Face'), view: 'bust' },
  { slot: 'outfit', label: () => t('ชุด', 'Outfit'), view: 'full' },
  { slot: 'hat', label: () => t('หมวก', 'Hat'), view: 'bust' },
];

/** ออกแบบตัวละครด้วยของฟรี (ตอนสร้างโปรไฟล์) */
export function LookPicker({ code, onChange }: Props) {
  const look = lookOf(code);
  const [tab, setTab] = useState<Slot>('skin');
  const current = TABS.find((x) => x.slot === tab)!;
  const set = (slot: Slot, value: string) => onChange(encodeLook({ ...look, [slot]: value } as Look));

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

      <div className="look-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.slot} type="button" role="tab" aria-selected={x.slot === tab} className={x.slot === tab ? 'is-active' : ''} onClick={() => setTab(x.slot)}>
            {x.label()}
          </button>
        ))}
      </div>

      <div className={`look-grid look-grid--${current.view}`}>
        {freeOf(tab).map((it) => {
          const on = look[tab] === it.value;
          return (
            <button
              key={it.id}
              type="button"
              title={it.name}
              aria-label={it.name}
              aria-pressed={on}
              className={`look-opt ${current.view !== 'swatch' ? 'look-opt--art' : ''} ${on ? 'is-active' : ''}`}
              onClick={() => set(tab, it.value)}
            >
              {current.view === 'swatch' ? (
                <span className="look-opt__swatch" style={{ background: `#${it.value}` }} />
              ) : (
                <PlayerAvatar code={encodeLook({ ...look, [tab]: it.value } as Look)} size={54} framing={current.view} className="is-bare" />
              )}
            </button>
          );
        })}
      </div>
      <p className="muted look-picker__note">{t('ของพิเศษ สัตว์เลี้ยง และออร่า ซื้อได้ในร้านค้า', 'Special items, pets and auras are in the shop')}</p>
    </div>
  );
}
