import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Coin, Confetti, Crown, Fish, Cookie, Cake, PawPrint, Plus, Sparkle, Storefront } from '@phosphor-icons/react';
import { PetImage } from '../components/PlayerAvatar';
import { t } from '../lib/i18n';
import { encodeLook, lookOf, petKind, toChibi, WARDROBE } from '../lib/look';
import { buyFood, feedPet, fetchPetCare, FOOD_NAME, isHungry, type FoodStock, type PetCareState } from '../lib/petCare';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));

const FOOD_ICON = { biscuit: Cookie, fish: Fish, cake: Cake } as const;

interface Props {
  code: string;
  onBack: () => void;
  onShop: () => void;
  /** ใส่สัตว์เลี้ยงตัวนี้ (บันทึกหน้าตาใหม่) */
  onEquip: (code: string) => Promise<void>;
}

/** สัตว์เลี้ยงของฉัน: ดูเลเวล ป้อนอาหาร ซื้ออาหาร เลือกตัวที่จะพาไปด้วย */
export function PetScreen({ code, onBack, onShop, onEquip }: Props) {
  const [state, setState] = useState<PetCareState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [toast, setToast] = useState('');
  const look = lookOf(code);
  const equippedId = WARDROBE.find((w) => w.slot === 'pet' && w.value === look.pet)?.id;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetchPetCare()
      .then((s) => {
        setState(s);
        setSelected((cur) => cur ?? (s.pets.find((p) => p.id === equippedId)?.id ?? s.pets[0]?.id ?? null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [equippedId]);

  const pet = state?.pets.find((p) => p.id === selected) ?? null;
  const item = pet ? WARDROBE.find((w) => w.id === pet.id) : undefined;
  const hungry = pet ? isHungry(pet) : false;
  const chibi = useMemo(
    () => ({ ...toChibi({ ...look, pet: item?.value ?? 'n' }), petLevel: pet?.level ?? 1, petHungry: hungry }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, item?.value, pet?.level, hungry],
  );

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const feed = async (food: FoodStock) => {
    if (!pet || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await feedPet(pet.id, food.id);
      setState((s) =>
        s && {
          ...s,
          foods: s.foods.map((f) => (f.id === food.id ? { ...f, qty: f.qty - 1 } : f)),
          pets: s.pets.map((p) => (p.id === pet.id ? { ...p, level: r.level, growth: r.growth, need: r.need, fedAt: new Date().toISOString() } : p)),
        },
      );
      setCheer(1);
      setTimeout(() => setCheer(0), 1200);
      flash(r.levelsUp ? t(`เลเวลอัป! Lv ${r.level}`, `Level up! Lv ${r.level}`) : t(`+${food.growth} ค่าเติบโต`, `+${food.growth} growth`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const buy = async (food: FoodStock) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const coins = await buyFood(food.id, 1);
      setState((s) => s && { ...s, coins, foods: s.foods.map((f) => (f.id === food.id ? { ...f, qty: f.qty + 1 } : f)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const equip = async () => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await onEquip(encodeLook({ ...look, pet: item.value }));
      flash(t('พาตัวนี้ไปด้วยแล้ว!', 'Now following you!'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen pets">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <PawPrint weight="fill" className="ico" /> {t('สัตว์เลี้ยงของฉัน', 'My pets')}
        </div>
        {state && (
          <span className="coin-pill">
            <Coin weight="fill" size={18} /> {state.coins.toLocaleString()}
          </span>
        )}
      </header>

      {!state && !error && <p className="muted analysis__loading">{t('กำลังโหลด...', 'Loading...')}</p>}

      {state && state.pets.length === 0 && (
        <section className="settings-card pets__empty">
          <PawPrint weight="fill" size={44} />
          <p>{t('ยังไม่มีสัตว์เลี้ยง ไปเลือกตัวแรกในร้านค้าได้เลย (เริ่มต้น 600 เหรียญ)', 'No pets yet — pick your first one in the shop (from 600 coins)')}</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onShop}>
            <Storefront weight="fill" className="ico" /> {t('ไปร้านค้า', 'Go to shop')}
          </button>
        </section>
      )}

      {state && pet && item && (
        <>
          <section className="dressing__stage pets__stage">
            <Suspense fallback={null}>
              <Avatar3D look={chibi} interactive cheer={cheer} className="dressing__canvas" />
            </Suspense>
            <div className="dressing__podium" />
            {toast && (
              <span className="pets__toast pop-in">
                <Confetti weight="fill" className="ico" /> {toast}
              </span>
            )}
          </section>

          <section className="settings-card pets__info">
            <div className="pets__title">
              <strong>{item.name}</strong>
              <span className={`pets__lv ${pet.level >= 10 ? 'is-max' : ''}`}>
                {pet.level >= 10 && <Crown weight="fill" size={14} />} Lv {pet.level}
              </span>
            </div>
            {pet.level < 10 ? (
              <>
                <span className="analysis__bar pets__bar" aria-hidden>
                  <span style={{ width: `${(100 * pet.growth) / pet.need}%` }} />
                </span>
                <small className="muted">
                  {t(`ค่าเติบโต ${pet.growth}/${pet.need} · Lv 5 มีประกาย · Lv 10 ได้มงกุฎ`, `Growth ${pet.growth}/${pet.need} · Lv 5 sparkles · Lv 10 crown`)}
                </small>
              </>
            ) : (
              <small className="pets__max">
                <Sparkle weight="fill" className="ico" /> {t('เลเวลสูงสุดแล้ว! ตัวใหญ่ที่สุด มีมงกุฎ', 'Max level! Biggest size with a crown')}
              </small>
            )}
            {hungry && <p className="pets__hungry">{t('หิวแล้ว... งอนนิดหน่อย ป้อนอาหารหน่อยนะ', "I'm hungry... feed me please")}</p>}
            {item.id !== equippedId && (
              <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={equip}>
                <PawPrint weight="fill" className="ico" /> {t('พาตัวนี้ไปด้วย', 'Take this pet along')}
              </button>
            )}
          </section>

          <section className="settings-card">
            <h2 className="section-title section-title--dark">{t('ป้อนอาหาร', 'Feed')}</h2>
            <div className="pets__foods">
              {state.foods.map((f) => {
                const Icon = FOOD_ICON[f.id];
                return (
                  <div key={f.id} className={`food food--${f.id}`}>
                    <button type="button" className="food__feed" disabled={busy || f.qty < 1 || pet.level >= 10} onClick={() => feed(f)}>
                      <Icon weight="fill" size={30} />
                      <strong>{FOOD_NAME[f.id]()}</strong>
                      <small>+{f.growth}</small>
                      <span className="food__qty">x{f.qty}</span>
                    </button>
                    <button type="button" className="food__buy" disabled={busy || state.coins < f.coin} onClick={() => buy(f)}>
                      <Plus weight="bold" size={12} /> <Coin weight="fill" size={13} /> {f.coin}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="muted pets__free">
              {t('ได้อาหารฟรี: จบเกมที่ได้ 30 XP ขึ้นไป ได้บิสกิต (วันละ 5) · เช็กอินรายวัน ได้ปลาย่าง', 'Free food: finish a game with 30+ XP for a biscuit (5/day) · daily check-in gives grilled fish')}
            </p>
          </section>

          {state.pets.length > 1 && (
            <section>
              <h2 className="section-title">{t('สัตว์เลี้ยงทั้งหมด', 'All pets')}</h2>
              <div className="pets__list">
                {state.pets.map((p) => {
                  const it = WARDROBE.find((w) => w.id === p.id)!;
                  return (
                    <button key={p.id} type="button" className={`pets__chip ${p.id === selected ? 'is-active' : ''}`} onClick={() => setSelected(p.id)}>
                      <PetImage kind={petKind(it.value)} level={p.level} size={52} />
                      <small>
                        Lv {p.level}
                        {isHungry(p) ? ' · ' + t('หิว', 'hungry') : ''}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
