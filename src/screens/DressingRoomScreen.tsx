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
  type Icon,
} from '@phosphor-icons/react';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { encodeLook, lookOf, toChibi, WARDROBE, type Look } from '../lib/look';
import { isFree, type Rarity, type Slot, type WardrobeItem } from '../../supabase/functions/_shared/wardrobe';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));

interface Props {
  code: string;
  onBack: () => void;
  onSave: (code: string) => Promise<void>;
}

const TABS: { slot: Slot; label: string; icon: Icon; thumb: 'swatch' | 'bust' | 'full' }[] = [
  { slot: 'outfit', label: 'ชุด', icon: TShirt, thumb: 'full' },
  { slot: 'hat', label: 'หมวก', icon: BaseballCap, thumb: 'bust' },
  { slot: 'item', label: 'ของในมือ', icon: HandGrabbing, thumb: 'full' },
  { slot: 'style', label: 'ทรงผม', icon: Scissors, thumb: 'bust' },
  { slot: 'hair', label: 'สีผม', icon: PaintBrush, thumb: 'swatch' },
  { slot: 'skin', label: 'สีผิว', icon: Smiley, thumb: 'swatch' },
  { slot: 'eyes', label: 'สีตา', icon: Eye, thumb: 'swatch' },
];

const RARITY_TEXT: Record<Rarity, string> = { common: 'ธรรมดา', rare: 'หายาก', epic: 'เอพิก', legend: 'ตำนาน' };

const itemOf = (slot: Slot, value: string) => WARDROBE.find((i) => i.slot === slot && i.value === value);

/** ห้องแต่งตัว: ลองสวมได้ทุกชิ้น บันทึกได้เฉพาะของที่มี (ตอนนี้ = ของฟรี จนกว่าร้านค้าจะเปิด) */
export function DressingRoomScreen({ code, onBack, onSave }: Props) {
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
    () => (Object.keys(draft) as Slot[]).map((s) => itemOf(s, draft[s])).filter((i): i is WardrobeItem => !!i && !isFree(i)),
    [draft],
  );
  const chibi = useMemo(() => toChibi(draft), [draft]);
  const current = TABS.find((t) => t.slot === tab)!;

  const tryOn = (it: WardrobeItem) => {
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
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">ห้องแต่งตัว</div>
      </header>

      <section className="dressing__stage">
        <Suspense fallback={null}>
          <Avatar3D look={chibi} interactive cheer={cheer} className="dressing__canvas" />
        </Suspense>
        <div className="dressing__podium" />
        {changed && (
          <button type="button" className="dressing__reset" onClick={() => setDraft(saved)}>
            <ArrowCounterClockwise weight="bold" size={16} /> ชุดเดิม
          </button>
        )}
        <p className="dressing__hint">ลากเพื่อหมุนดูตัวละคร</p>
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
          const free = isFree(it);
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
                ) : (
                  <PlayerAvatar code={thumbCode} size={64} framing={current.thumb} className="is-bare" />
                )}
              </span>
              <span className="ward-item__name">{it.name}</span>
              <span className={`ward-item__price ${free ? 'is-free' : ''}`}>
                {wearing ? (
                  'สวมอยู่'
                ) : free ? (
                  'ใช้ได้'
                ) : (
                  <>
                    <LockSimple weight="bold" size={12} />
                    {it.gem ? <Diamond weight="fill" size={13} /> : <Coin weight="fill" size={13} />}
                    {it.gem ?? it.coin}
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
              <Storefront weight="fill" size={18} /> ลองสวมของที่ยังไม่มี {locked.length} ชิ้น · ร้านค้าเปิดเร็วๆ นี้
            </p>
            <button type="button" className="btn btn--ghost btn--block" onClick={removeLocked}>
              ถอดของที่ยังไม่มีออก
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--big" disabled={!changed || busy} onClick={save}>
            {busy ? 'กำลังบันทึก...' : changed ? 'บันทึกการแต่งตัว' : 'แต่งแบบนี้อยู่แล้ว'}
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
