import { useEffect, useState, type CSSProperties } from 'react';
import { Cake, Coin, Cookie, Fish, Info, PuzzlePiece, Sparkle, Star } from '@phosphor-icons/react';
import { PetImage, PlayerAvatar } from '../components/PlayerAvatar';
import { t } from '../lib/i18n';
import { encodeLook, lookOf, petKind, WARDROBE } from '../lib/look';
import { FOOD_NAME } from '../lib/petCare';
import { drawGacha, exchangeShards, fetchGacha, GACHA_COST, GACHA_ODDS, PITY_AT, SHARD_PRICE, type GachaResult, type GachaState } from '../lib/gacha';
import type { Rarity, WardrobeItem } from '../../supabase/functions/_shared/wardrobe';

const RARITY_TEXT: Record<Rarity | 'food', () => string> = {
  common: () => t('ธรรมดา', 'Common'),
  rare: () => t('หายาก', 'Rare'),
  epic: () => t('เอพิก', 'Epic'),
  legend: () => t('ตำนาน', 'Legend'),
  mythic: () => t('มิธิก', 'Mythic'),
  food: () => t('อาหารสัตว์', 'Pet food'),
};
const FOOD_ICON = { biscuit: Cookie, fish: Fish, cake: Cake } as const;
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legend: 3, mythic: 4 };
const SWATCH = ['skin', 'hair', 'eyes'];

/** รูปของรางวัล */
function Art({ it, code }: { it: WardrobeItem; code: string }) {
  if (it.slot === 'pet') return <PetImage kind={petKind(it.value)} size={64} />;
  if (SWATCH.includes(it.slot)) return <span className="ward-item__swatch" style={{ '--sw': `#${it.value}` } as CSSProperties} />;
  const full = ['outfit', 'item', 'aura'].includes(it.slot);
  return <PlayerAvatar code={encodeLook({ ...lookOf(code), [it.slot]: it.value })} size={64} framing={full ? 'full' : 'bust'} className="is-bare" />;
}

interface Props {
  code: string;
  onBack: () => void;
  /** ได้ของ/ใช้เหรียญแล้ว (โหลดยอดใหม่) */
  onChanged: () => void;
}

/** ตู้สุ่มด้วยเหรียญ: สุ่ม 1/10 ครั้ง อัตราออกเปิดเผย การันตี และแลกเศษชิ้นส่วน */
export function GachaScreen({ code, onBack, onChanged }: Props) {
  const [state, setState] = useState<GachaState | null>(null);
  const [results, setResults] = useState<GachaResult[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'draw' | 'shards'>('draw');

  useEffect(() => {
    fetchGacha().then(setState).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // เปิดทีละใบ
  useEffect(() => {
    if (!results || revealed >= results.length) return;
    const id = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 700 : 260);
    return () => clearTimeout(id);
  }, [results, revealed]);

  const draw = async (count: 1 | 10) => {
    if (busy || !state) return;
    setBusy(true);
    setError('');
    setResults(null);
    setRevealed(0);
    setShaking(true);
    try {
      const [r] = await Promise.all([drawGacha(count), new Promise((ok) => setTimeout(ok, 900))]);
      const owned = new Set(state.owned);
      r.results.forEach((x) => x.type === 'item' && owned.add(x.id));
      setState({ coins: r.coins, shards: r.shards, pity: r.pity, owned: [...owned] });
      setResults(r.results);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setShaking(false);
      setBusy(false);
    }
  };

  const exchange = async (it: WardrobeItem) => {
    if (busy || !state) return;
    setBusy(true);
    setError('');
    try {
      const shards = await exchangeShards(it.id);
      setState({ ...state, shards, owned: [...state.owned, it.id] });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const best = results?.reduce<Rarity>((b, r) => (r.type === 'item' && RANK[r.rarity] > RANK[b] ? r.rarity : b), 'common') ?? 'common';
  const allShown = !!results && revealed >= results.length;
  const exchangeable = WARDROBE.filter((w) => (w.coin || w.gem || w.gacha) && !state?.owned.includes(w.id)).sort((a, b) => RANK[b.rarity] - RANK[a.rarity]);

  return (
    <div className="screen gacha">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Sparkle weight="fill" className="ico" /> {t('ตู้สุ่ม', 'Gacha')}
        </div>
        {state && (
          <span className="shop__wallet">
            <span className="coin-pill">
              <Coin weight="fill" size={18} /> {state.coins.toLocaleString()}
            </span>
            <span className="coin-pill shard-pill">
              <PuzzlePiece weight="fill" size={16} /> {state.shards}
            </span>
          </span>
        )}
      </header>

      <div className="dressing__tabs gacha__tabs">
        <button type="button" className={tab === 'draw' ? 'is-active' : ''} onClick={() => setTab('draw')}>
          <Sparkle weight="fill" size={18} /> {t('สุ่ม', 'Draw')}
        </button>
        <button type="button" className={tab === 'shards' ? 'is-active' : ''} onClick={() => setTab('shards')}>
          <PuzzlePiece weight="fill" size={18} /> {t('แลกเศษชิ้นส่วน', 'Shard exchange')}
        </button>
      </div>

      {tab === 'draw' && (
        <>
          <section className={`gacha__machine ${shaking ? 'is-shaking' : ''} ${allShown ? `is-${best}` : ''}`}>
            <div className="gacha__dome">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={`gacha__ball gacha__ball--${i % 5}`} style={{ '--i': i, left: 8 + ((i * 47) % 136), bottom: 6 + Math.floor(i / 3) * 34 + (i % 2) * 6 } as CSSProperties} />
              ))}
            </div>
            <div className="gacha__base">
              <span className="gacha__knob" />
            </div>
          </section>

          {state && (
            <p className="gacha__pity">
              <Star weight="fill" className="ico" />{' '}
              {t(`อีก ${PITY_AT - state.pity} ครั้ง การันตีได้ตำนานขึ้นไป`, `${PITY_AT - state.pity} draws until a guaranteed Legend+`)}
            </p>
          )}

          <div className="gacha__buttons">
            <button type="button" className="btn btn--ghost gacha__btn" disabled={busy || !state || state.coins < GACHA_COST[1]} onClick={() => draw(1)}>
              {t('สุ่ม 1 ครั้ง', 'Draw x1')}
              <small>
                <Coin weight="fill" size={13} /> {GACHA_COST[1]}
              </small>
            </button>
            <button type="button" className="btn btn--primary gacha__btn" disabled={busy || !state || state.coins < GACHA_COST[10]} onClick={() => draw(10)}>
              {t('สุ่ม 10 ครั้ง', 'Draw x10')}
              <small>
                <Coin weight="fill" size={13} /> {GACHA_COST[10]} · {t('ลด 10%', '10% off')}
              </small>
            </button>
          </div>

          {results && (
            <section className={`gacha__results gacha__results--${results.length}`}>
              {results.map((r, i) => {
                const shown = i < revealed;
                if (r.type === 'food') {
                  const Icon = FOOD_ICON[r.id];
                  return (
                    <div key={i} className={`gacha-card gacha-card--food ${shown ? 'is-shown' : ''}`}>
                      <span className="gacha-card__rarity">{RARITY_TEXT.food()}</span>
                      <Icon weight="fill" size={40} />
                      <strong>
                        {FOOD_NAME[r.id]()} x{r.qty}
                      </strong>
                    </div>
                  );
                }
                const it = WARDROBE.find((w) => w.id === r.id);
                if (!it) return null;
                return (
                  <div key={i} className={`gacha-card gacha-card--${r.rarity} ${shown ? 'is-shown' : ''}`}>
                    <span className="gacha-card__rarity">{RARITY_TEXT[r.rarity]()}</span>
                    <Art it={it} code={code} />
                    <strong>{it.name}</strong>
                    {r.duplicate ? (
                      <small className="gacha-card__dup">
                        <PuzzlePiece weight="fill" size={12} /> {t(`ซ้ำ +${r.shards} เศษ`, `Dup +${r.shards}`)}
                      </small>
                    ) : (
                      <small className="gacha-card__new">{t('ใหม่!', 'New!')}</small>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <details className="settings-card gacha__odds">
            <summary>
              <Info weight="fill" className="ico" /> {t('อัตราออกของรางวัล', 'Drop rates')}
            </summary>
            <ul>
              {GACHA_ODDS.map((o) => (
                <li key={o.rarity} className={`odds--${o.rarity}`}>
                  <span>{RARITY_TEXT[o.rarity]()}</span>
                  <b>{o.pct}</b>
                </li>
              ))}
            </ul>
            <p className="muted">
              {t(
                `สุ่ม 10 ครั้งได้หายากขึ้นไปอย่างน้อย 1 ชิ้น · ไม่ได้ตำนานขึ้นไปครบ ${PITY_AT} ครั้ง ครั้งถัดไปได้แน่นอน · ของซ้ำได้เศษชิ้นส่วนไปแลกของที่อยากได้ · ใช้เหรียญจากการเล่นเท่านั้น ไม่ใช้เงินจริง`,
                `Every 10-draw has at least 1 Rare+ · no Legend+ in ${PITY_AT} draws guarantees the next · duplicates become shards for the exchange · coins only, never real money`,
              )}
            </p>
          </details>
        </>
      )}

      {tab === 'shards' && state && (
        <section>
          <p className="gacha__shard-note">
            {t('แลกเศษชิ้นส่วนเป็นของที่ยังไม่มี (รวมตำนาน/มิธิก)', 'Trade shards for items you don’t own yet (incl. Legend/Mythic)')}
          </p>
          <div className="dressing__items">
            {exchangeable.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`ward-item ward-item--${it.rarity}`}
                disabled={busy || state.shards < SHARD_PRICE[it.rarity]}
                onClick={() => exchange(it)}
              >
                <span className="ward-item__rarity">{RARITY_TEXT[it.rarity]()}</span>
                <span className="ward-item__art">
                  <Art it={it} code={code} />
                </span>
                <span className="ward-item__name">{it.name}</span>
                <span className="ward-item__price">
                  <PuzzlePiece weight="fill" size={13} /> {SHARD_PRICE[it.rarity]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
