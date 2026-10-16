import { lazy, Suspense, useMemo, useState, type CSSProperties } from 'react';
import { CheckCircle, Clock, Coin, Diamond, PawPrint, Plus, Sparkle, Storefront, TShirt } from '@phosphor-icons/react';
import { PetImage, PlayerAvatar } from '../components/PlayerAvatar';
import { encodeLook, lookOf, petKind, toChibi, WARDROBE, type Look } from '../lib/look';
import { buyItem, timeLeft, type ShopState } from '../lib/shop';
import { isFree, SPECIAL_SLOTS, type Rarity, type Slot, type WardrobeItem } from '../../supabase/functions/_shared/wardrobe';
import { t } from '../lib/i18n';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));

interface Props {
  code: string;
  state: ShopState;
  onBack: () => void;
  /** ซื้อสำเร็จ: ยอดเหรียญใหม่ + รหัสสินค้า */
  onBought: (coins: number, itemId: string) => void;
  /** ใส่ชิ้นที่ซื้อแล้วทันที */
  onWear: (code: string) => Promise<void>;
  /** ไปหน้าเติมเพชร */
  onTopup: () => void;
  onGacha: () => void;
}

const RARITY_TEXT: Record<Rarity, string> = {
  get common() { return t('ธรรมดา', 'Common'); },
  get rare() { return t('หายาก', 'Rare'); },
  get epic() { return t('เอพิก', 'Epic'); },
  get legend() { return t('ตำนาน', 'Legend'); },
  get mythic() { return t('มิธิก', 'Mythic'); },
};
const SWATCH_SLOTS: Slot[] = ['skin', 'hair', 'eyes'];
const FULL_SLOTS: Slot[] = ['outfit', 'item', 'aura', 'set'];

/** ร้านค้า: ของประจำ (ธรรมดา) + ของหมุนเวียน 8 ชิ้น (หายากขึ้นไป) ลองสวมก่อนซื้อได้ */
export function ShopScreen({ code, state, onBack, onBought, onWear, onTopup, onGacha }: Props) {
  const saved = lookOf(code);
  const [picked, setPicked] = useState<WardrobeItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justBought, setJustBought] = useState<string | null>(null);
  const [cheer, setCheer] = useState(0);

  const draft: Look = picked ? { ...saved, [picked.slot]: picked.value } : saved;
  const chibi = useMemo(() => toChibi(draft), [encodeLook(draft)]); // eslint-disable-line react-hooks/exhaustive-deps
  const owned = new Set(state.owned);
  const rotation = state.rotation.map((id) => WARDROBE.find((w) => w.id === id)).filter((w): w is WardrobeItem => !!w);
  const regular = WARDROBE.filter((w) => w.rarity === 'common' && !isFree(w) && !SPECIAL_SLOTS.includes(w.slot));
  const specials = WARDROBE.filter((w) => SPECIAL_SLOTS.includes(w.slot) && !isFree(w) && !w.gacha);

  const pick = (it: WardrobeItem) => {
    setPicked(it);
    setError('');
    setJustBought(null);
    setCheer(1);
    setTimeout(() => setCheer(0), 700);
  };

  const buy = async () => {
    if (!picked) return;
    setBusy(true);
    setError('');
    try {
      const coins = await buyItem(picked.id);
      onBought(coins, picked.id);
      setJustBought(picked.id);
      setCheer(1);
      setTimeout(() => setCheer(0), 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const wear = async () => {
    setBusy(true);
    try {
      await onWear(encodeLook(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const card = (it: WardrobeItem) => {
    const has = owned.has(it.id);
    const thumb = encodeLook({ ...saved, [it.slot]: it.value });
    return (
      <button
        key={it.id}
        type="button"
        className={`ward-item ward-item--${it.rarity} ${picked?.id === it.id ? 'is-wearing' : ''}`}
        onClick={() => pick(it)}
      >
        <span className="ward-item__rarity">{RARITY_TEXT[it.rarity]}</span>
        <span className="ward-item__art">
          {it.slot === 'pet' ? (
            <PetImage kind={petKind(it.value)} size={64} />
          ) : SWATCH_SLOTS.includes(it.slot) ? (
            <span className="ward-item__swatch" style={{ '--sw': `#${it.value}` } as CSSProperties} />
          ) : (
            <PlayerAvatar code={thumb} size={64} framing={FULL_SLOTS.includes(it.slot) ? 'full' : 'bust'} className="is-bare" />
          )}
        </span>
        <span className="ward-item__name">{it.name}</span>
        <span className={`ward-item__price ${has ? 'is-free' : ''}`}>
          {has ? (
            t('มีแล้ว', 'Owned')
          ) : it.gem ? (
            <>
              <Diamond weight="fill" size={13} /> {it.gem}
            </>
          ) : (
            <>
              <Coin weight="fill" size={13} /> {it.coin}
            </>
          )}
        </span>
      </button>
    );
  };

  const has = picked ? owned.has(picked.id) : false;
  const short = picked?.coin ? picked.coin - state.coins : 0;

  return (
    <div className="screen shop">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Storefront weight="fill" className="ico" /> {t('ร้านค้า', 'Shop')}
        </div>
        <span className="shop__wallet">
          <span className="coin-pill">
            <Coin weight="fill" size={18} /> {state.coins.toLocaleString()}
          </span>
          <button type="button" className="coin-pill gem-pill" onClick={onTopup} aria-label={t('เพชร เติมเพชร', 'Gems, top up')}>
            <Diamond weight="fill" size={16} /> {state.gems.toLocaleString()} <Plus weight="bold" size={12} />
          </button>
        </span>
      </header>

      <section className="dressing__stage shop__stage">
        <Suspense fallback={null}>
          <Avatar3D look={chibi} interactive cheer={cheer} className="dressing__canvas" />
        </Suspense>
        <div className="dressing__podium" />
        {picked && !has && <span className="shop__trying">{t('กำลังลองสวม:', 'Trying on:')} {picked.name}</span>}
      </section>

      <button type="button" className="gacha-banner" onClick={onGacha}>
        <Sparkle weight="fill" size={26} />
        <span>
          <strong>{t('ตู้สุ่มด้วยเหรียญ', 'Coin gacha')}</strong>
          <small>{t('ลุ้นสัตว์เลี้ยงตำนาน/มิธิก · การันตีทุก 60 ครั้ง', 'Win Legend/Mythic pets · guaranteed every 60 draws')}</small>
        </span>
      </button>

      <section>
        <h2 className="section-title">
          <PawPrint weight="fill" className="ico" /> {t('พิเศษ (ขายตลอด)', 'Specials (always on sale)')}
        </h2>
        <div className="dressing__items">{specials.map(card)}</div>
      </section>

      <section>
        <div className="shop__head">
          <h2 className="section-title">
            <Sparkle weight="fill" className="ico" /> {t('ของหายากรอบนี้', 'Rare items this round')}
          </h2>
          <span className="shop__timer">
            <Clock weight="bold" className="ico" /> {t('เปลี่ยนใน', 'Changes in')} {timeLeft(state.rotationEndsAt)}
          </span>
        </div>
        <div className="dressing__items">{rotation.map(card)}</div>
      </section>

      <section>
        <h2 className="section-title">{t('ขายประจำ', 'Always in stock')}</h2>
        <div className="dressing__items">{regular.map(card)}</div>
      </section>

      <p className="shop__earn">
        <Coin weight="fill" className="ico" /> {t(`ได้เหรียญเท่ากับ XP ที่เล่นได้ (วันนี้ ${state.playCoinsToday}/${state.playCap}) + เช็กอินรายวัน`, `Earn coins equal to your XP (today ${state.playCoinsToday}/${state.playCap}) + daily check-in`)}
      </p>

      {picked && (
        <div className="cta-bar dressing__bar">
          {justBought === picked.id ? (
            <>
              <p className="cta-bar__summary dressing__locked">
                <CheckCircle weight="fill" size={18} /> {t(`ได้ ${picked.name} แล้ว!`, `Got ${picked.name}!`)}
              </p>
              <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={wear}>
                <TShirt weight="fill" className="ico" /> {t('ใส่เลย', 'Wear it')}
              </button>
            </>
          ) : has ? (
            <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={wear}>
              <TShirt weight="fill" className="ico" /> {t(`ใส่ ${picked.name}`, `Wear ${picked.name}`)}
            </button>
          ) : picked.gem ? (
            state.gems >= picked.gem ? (
              <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy} onClick={buy}>
                {busy ? t('กำลังซื้อ...', 'Buying...') : <>{t('ซื้อ', 'Buy')} <Diamond weight="fill" className="ico" /> {picked.gem}</>}
              </button>
            ) : (
              <button type="button" className="btn btn--primary btn--block btn--big" onClick={onTopup}>
                <Diamond weight="fill" className="ico" /> {t(`เพชรไม่พอ (ขาดอีก ${picked.gem - state.gems}) · เติมเพชร`, `Need ${picked.gem - state.gems} more gems · Top up`)}
              </button>
            )
          ) : (
            <button type="button" className="btn btn--primary btn--block btn--big" disabled={busy || short > 0} onClick={buy}>
              {short > 0 ? (
                <>{t(`เหรียญไม่พอ (ขาดอีก ${short})`, `Not enough coins (need ${short} more)`)}</>
              ) : busy ? (
                t('กำลังซื้อ...', 'Buying...')
              ) : (
                <>
                  {t('ซื้อ', 'Buy')} <Coin weight="fill" className="ico" /> {picked.coin}
                </>
              )}
            </button>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
