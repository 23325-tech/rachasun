import { useState } from 'react';
import type { CardCounts, CardKind } from '../game/battle';

export type ActiveCard = Exclude<CardKind, 'shield'>;

export interface Opponent {
  id: string;
  name: string;
  avatar: string;
  answered: boolean;
}

interface Props {
  cards: CardCounts;
  questionType: 'mcq' | 'fill';
  opponents: Opponent[];
  /** ตอบไปแล้ว (ยังใช้ยิงสวนได้) */
  answered: boolean;
  /** ช่วงที่กดใช้การ์ดได้ (ระหว่างข้อ ก่อนหมดเวลา) */
  open: boolean;
  /** ใช้การ์ดในข้อนี้ไปแล้ว (ข้อละ 1 ใบ) */
  usedCard: CardKind | null;
  busy: boolean;
  onUse: (card: ActiveCard, target?: string) => void;
}

const INFO: Record<CardKind, { icon: string; name: string; hint: string }> = {
  shield: { icon: '🛡️', name: 'โล่', hint: 'กันอัตโนมัติ' },
  fifty: { icon: '✂️', name: '50/50', hint: 'ตัดตัวเลือกผิด 2 ข้อ' },
  slow: { icon: '⏳', name: 'ลดเวลา', hint: 'เวลาเพื่อนเหลือครึ่ง' },
  extra: { icon: '⌛', name: 'เพิ่มเวลา', hint: '+50% ให้ตัวเอง' },
  counter: { icon: '🔫', name: 'ยิงสวน', hint: 'โดนยิงแล้วเด้งไปหาเพื่อน' },
};

const ORDER: CardKind[] = ['shield', 'fifty', 'slow', 'extra', 'counter'];

export function CardBar({ cards, questionType, opponents, answered, open, usedCard, busy, onUse }: Props) {
  const [picking, setPicking] = useState<'slow' | 'counter' | null>(null);
  const owned = ORDER.filter((k) => (cards[k] ?? 0) > 0);

  if (!owned.length) {
    return <p className="card-bar__empty">🃏 ยังไม่มีการ์ด · ได้การ์ดสุ่มทุก 3 ข้อ</p>;
  }

  const canUse = (k: ActiveCard) => {
    if (!open || busy || usedCard) return false;
    if (k === 'counter') return true;
    if (answered) return false;
    if (k === 'slow') return opponents.some((o) => !o.answered);
    return true;
  };

  const info = (k: CardKind) =>
    k === 'fifty' && questionType === 'fill' ? { icon: '⏭️', name: 'ข้ามข้อ', hint: 'ไม่เสียหัวใจ ไม่ได้คะแนน' } : INFO[k];

  return (
    <>
      <div className="card-bar">
        {owned.map((k) => {
          const i = info(k);
          const count = cards[k] ?? 0;
          if (k === 'shield') {
            return (
              <div key={k} className="power-card power-card--passive" title={i.hint}>
                <span className="power-card__icon">{i.icon}</span>
                <span className="power-card__name">{i.name}</span>
                <span className="power-card__count">x{count}</span>
                <span className="power-card__hint">{i.hint}</span>
              </div>
            );
          }
          const used = usedCard === k;
          return (
            <button
              key={k}
              type="button"
              className={`power-card power-card--${k} ${used ? 'is-used' : ''}`}
              disabled={!canUse(k)}
              onClick={() => (k === 'slow' || k === 'counter' ? setPicking(k) : onUse(k))}
            >
              <span className="power-card__icon">{i.icon}</span>
              <span className="power-card__name">{i.name}</span>
              <span className="power-card__count">x{count}</span>
              <span className="power-card__hint">{used ? 'ใช้แล้ว ✓' : i.hint}</span>
            </button>
          );
        })}
      </div>
      {usedCard && <p className="card-bar__note">ใช้การ์ดได้ข้อละ 1 ใบ</p>}

      {picking && (
        <div className="overlay" onClick={() => setPicking(null)}>
          <div className="overlay__card pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="overlay__emoji">{INFO[picking].icon}</div>
            <h2>{picking === 'slow' ? 'ลดเวลาใคร?' : 'ยิงสวนไปหาใคร?'}</h2>
            <p className="muted">
              {picking === 'slow'
                ? 'เวลาที่เหลือของเพื่อนจะเหลือครึ่งหนึ่ง (อย่างน้อย 5 วิ)'
                : 'ถ้าข้อนี้คุณโดนยิง ดาเมจจะเด้งไปหาเพื่อนคนนี้แทน'}
            </p>
            <div className="target-list">
              {opponents.map((o) => {
                const disabled = picking === 'slow' && o.answered;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className="target-btn"
                    disabled={disabled}
                    onClick={() => {
                      setPicking(null);
                      onUse(picking, o.id);
                    }}
                  >
                    <span className="target-btn__avatar">{o.avatar}</span>
                    <span className="target-btn__name">{o.name}</span>
                    {disabled && <span className="muted">ตอบแล้ว</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setPicking(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </>
  );
}
