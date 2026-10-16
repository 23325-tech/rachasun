import { useState } from 'react';
import { CalendarCheck, Check, Coin, Gift, LockSimple } from '@phosphor-icons/react';
import { claimCheckin, type ShopState } from '../lib/shop';

interface Props {
  state: ShopState;
  onClaimed: (coins: number) => void;
}

/** เช็กอินรายวัน 7 วัน (ต้องเล่นจบ 1 เกมในวันนั้นก่อน) */
export function CheckinCard({ state, onClaimed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { claimedToday, playedToday, streak, rewards } = state.checkin;
  const reward = rewards[streak - 1];

  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await claimCheckin();
      onClaimed(r.coins);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="checkin">
      <div className="checkin__head">
        <strong>
          <CalendarCheck weight="fill" className="ico" /> เช็กอินรายวัน
        </strong>
        <small>เล่นทุกวันได้เหรียญเพิ่มขึ้น</small>
      </div>
      <ol className="checkin__days">
        {rewards.map((r, i) => {
          const day = i + 1;
          const done = claimedToday ? day <= streak : day < streak;
          const today = day === streak;
          return (
            <li key={day} className={`checkin__day ${done ? 'is-done' : ''} ${today ? 'is-today' : ''} ${day === 7 ? 'is-big' : ''}`}>
              <span className="checkin__label">วัน {day}</span>
              <span className="checkin__reward">
                {done ? <Check weight="bold" size={16} /> : day === 7 ? <Gift weight="fill" size={16} /> : <Coin weight="fill" size={14} />}
                {!done && r}
              </span>
            </li>
          );
        })}
      </ol>
      {claimedToday ? (
        <p className="checkin__note">รับแล้ววันนี้ พรุ่งนี้มารับต่อ (ขาดวันจะเริ่มนับใหม่)</p>
      ) : playedToday ? (
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={claim}>
          <Coin weight="fill" className="ico" /> รับ {reward} เหรียญ
        </button>
      ) : (
        <p className="checkin__note">
          <LockSimple weight="bold" className="ico" /> เล่นจบ 1 เกมวันนี้ แล้วกลับมารับ {reward} เหรียญ
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
