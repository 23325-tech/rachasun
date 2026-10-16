import { lazy, Suspense, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowCounterClockwise,
  BaseballCap,
  Coin,
  Diamond,
  Eye,
  HandGrabbing,
  LockSimple,
  PaintBrush,
  Scissors,
  Smiley,
  Storefront,
  TShirt,
  Sunglasses,
  PawPrint,
  Sparkle,
  MaskHappy,
  ShootingStar,
  type Icon,
} from '@phosphor-icons/react';
import { PetImage, PlayerAvatar } from '../components/PlayerAvatar';
import { ShotIcon, ShotPreview } from '../fx/ShotPreview';
import { encodeLook, lookOf, toChibi, WARDROBE, type Look, petKind, shotKind } from '../lib/look';
import { isFree, type Rarity, type Slot, type WardrobeItem } from '../../supabase/functions/_shared/wardrobe';
import { t } from '../lib/i18n';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));

interface Props {
  code: string;
  /** รหัสสินค้าที่ซื้อแล้ว */
  owned: string[];
  onShop: () => void;
  onBack: () => void;
  onSave: (code: string) => Promise<void>;
}

const TABS: { slot: Slot; label: string; icon: Icon; thumb: 'swatch' | 'bust' | 'full' | 'pet' | 'shot' }[] = [
  { slot: 'outfit', get label() { return t('ชุด', 'Outfit'); }, icon: TShirt, thumb: 'full' },
  { slot: 'hat', get label() { return t('หมวก', 'Hat'); }, icon: BaseballCap, thumb: 'bust' },
  { slot: 'pet', get label() { return t('สัตว์เลี้ยง', 'Pet'); }, icon: PawPrint, thumb: 'pet' },
  { slot: 'aura', get label() { return t('ออร่า', 'Aura'); }, icon: Sparkle, thumb: 'full' },
  { slot: 'set', get label() { return t('ชุดพิเศษ', 'Costume'); }, icon: MaskHappy, thumb: 'full' },
  { slot: 'shot', get label() { return t('เอฟเฟกต์ยิง', 'Shot FX'); }, icon: ShootingStar, thumb: 'shot' },
  { slot: 'item', get label() { return t('ของในมือ', 'Held item'); }, icon: HandGrabbing, thumb: 'full' },
  { slot: 'face', get label() { return t('ใบหน้า', 'Face'); }, icon: Sunglasses, thumb: 'bust' },
  { slot: 'style', get label() { return t('ทรงผม', 'Hairstyle'); }, icon: Scissors, thumb: 'bust' },
  { slot: 'hair', get label() { return t('สีผม', 'Hair color'); }, icon: PaintBrush, thumb: 'swatch' },
  { slot: 'skin', get label() { return t('สีผิว', 'Skin'); }, icon: Smiley, thumb: 'swatch' },
  { slot: 'eyes', get label() { return t('สีตา', 'Eyes'); }, icon: Eye, thumb: 'swatch' },
];

const RARITY_TEXT: Record<Rarity, string> = {
  get common() { return t('ธรรมดา', 'Common'); },
  get rare() { return t('หายาก', 'Rare'); },
  get epic() { return t('เอพิก', 'Epic'); },
  get legend() { return t('ตำนาน', 'Legend'); },
  get mythic() { return t('มิธิก', 'Mythic'); },
};

const itemOf = (slot: Slot, value: string) => WARDROBE.find((i) => i.slot === slot && i.value === value);

/** ห้องแต่งตัว: ลองสวมได้ทุกชิ้น บันทึกได้เฉพาะของที่มี (ตอนนี้ = ของฟรี จนกว่าร้านค้าจะเปิด) */
export function DressingRoomScreen({ code, owned, onShop, onBack, onSave }: Props) {
  const saved = lookOf(code);
  const [draft, setDraft] = useState<Look>(saved);
  const [tab, setTab] = useState<Slot>('outfit');
  const [cheer, setCheer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const draftCode = encodeLook(draft);
  const changed = draftCode !== encodeLook(saved);
  // ของที่ยังไม่มี (มีราคา) ที่ลองสวมอยู่
  const locked = useMemo(
    () =>
      (Object.keys(draft) as Slot[])
        .map((s) => itemOf(s, draft[s]))
        .filter((i): i is WardrobeItem => !!i && !isFree(i) && !owned.includes(i.id)),
    [draft, owned],
  );
  const chibi = useMemo(() => toChibi(draft), [draft]);
  const current = TABS.find((t) => t.slot === tab)!;

  const [fireShot, setFireShot] = useState(0);
  const tryOn = (it: WardrobeItem) => {
    if (it.slot === 'shot') setFireShot((n) => n + 1);
    setDraft((d) => ({ ...d, [it.slot]: it.value }));
    setCheer(1);
    setTimeout(() => setCheer(0), 800);
  };
  const removeLocked = () =>
    setDraft((d) => {
      const next = { ...d };
      for (const it of locked) next[it.slot] = saved[it.slot];
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(draftCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen dressing">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">{t('ห้องแต่งตัว', 'Dressing room')}</div>
      </header>

      <section className="dressing__stage">
        <Suspense fallback={null}>
          <Avatar3D look={chibi} interactive cheer={cheer} className="dressing__canvas" />
        </Suspense>
        <div className="dressing__podium" />
        {changed && (
          <button type="button" className="dressing__reset" onClick={() => setDraft(saved)}>
            <ArrowCounterClockwise weight="bold" size={16} /> {t('ชุดเดิม', 'Reset')}
          </button>
        )}
        {tab === 'shot' && <ShotPreview skin={shotKind(draft.shot)} fire={fireShot} target=".dressing__stage" />}
        <p className="dressing__hint">{t('ลากเพื่อหมุนดูตัวละคร', 'Drag to rotate')}</p>
      </section>

      <div className="dressing__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.slot}
            type="button"
            role="tab"
            aria-selected={t.slot === tab}
            className={t.slot === tab ? 'is-active' : ''}
            onClick={() => setTab(t.slot)}
          >
            <t.icon weight="fill" size={18} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="dressing__items">
        {WARDROBE.filter((i) => i.slot === tab).map((it) => {
          const wearing = draft[it.slot] === it.value;
          const free = isFree(it) || owned.includes(it.id);
          const thumbCode = encodeLook({ ...draft, [it.slot]: it.value });
          return (
            <button
              key={it.id}
              type="button"
              className={`ward-item ward-item--${it.rarity} ${wearing ? 'is-wearing' : ''}`}
              aria-pressed={wearing}
              onClick={() => tryOn(it)}
            >
              <span className="ward-item__rarity">{RARITY_TEXT[it.rarity]}</span>
              <span className="ward-item__art">
                {current.thumb === 'swatch' ? (
                  <span className="ward-item__swatch" style={{ '--sw': `#${it.value}` } as CSSProperties} />
                ) : current.thumb === 'shot' ? (
                  <ShotIcon skin={shotKind(it.value)} />
                ) : current.thumb === 'pet' ? (
                  it.value === 'n' ? <span className="ward-item__none">—</span> : <PetImage kind={petKind(it.value)} size={64} />
                ) : (
                  <PlayerAvatar code={thumbCode} size={64} framing={current.thumb} className="is-bare" />
                )}
              </span>
              <span className="ward-item__name">{it.name}</span>
              <span className={`ward-item__price ${free ? 'is-free' : ''}`}>
                {wearing ? (
                  t('สวมอยู่', 'Wearing')
                ) : free ? (
                  t('ใช้ได้', 'Owned')
                ) : (
                  <>
                    <LockSimple weight="bold" size={12} />
                    {it.gacha ? (
                      t('ตู้สุ่ม', 'Gacha')
                    ) : (
                      <>
                        {it.gem ? <Diamond weight="fill" size={13} /> : <Coin weight="fill" size={13} />}
                        {it.gem ?? it.coin}
                      </>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cta-bar dressing__bar">
        {locked.length > 0 ? (
          <>
            <p className="cta-bar__summary dressing__locked">
              <Storefront weight="fill" size={18} /> {t(`ลองสวมของที่ยังไม่มี ${locked.length} ชิ้น`, `Trying on ${locked.length} item(s) you don't own`)}
            </p>
            {locked.some((i) => i.gacha) && (
              <p className="dressing__gacha-note">{t('ของระดับตำนาน/มิธิก ได้จากตู้สุ่มเท่านั้น', 'Legend/Mythic items come only from the gacha')}</p>
            )}
            {locked.some((i) => !i.gacha) && (
              <button type="button" className="btn btn--primary btn--block" onClick={onShop}>
                <Storefront weight="fill" className="ico" /> {t('ไปซื้อที่ร้านค้า', 'Buy in the shop')}
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--block" onClick={removeLocked}>
              {t('ถอดของที่ยังไม่มีออก', 'Remove items you don\'t own')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled={!changed || busy} onClick={save}>
            {busy ? t('กำลังบันทึก...', 'Saving...') : changed ? t('บันทึกการแต่งตัว', 'Save look') : t('แต่งแบบนี้อยู่แล้ว', 'Already wearing this')}
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
