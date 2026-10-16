import { useState, createElement } from 'react';
import type { CardCounts, CardKind } from '../game/battle';
import { PlayerAvatar } from './PlayerAvatar';
import { Cards, Crosshair, Hourglass, HourglassHigh, Scissors, ShieldCheck, SkipForward, type Icon } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

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

const INFO: Record<CardKind, { icon: Icon; name: string; hint: string }> = {
  shield: { icon: ShieldCheck, get name() { return t('โล่', 'Shield'); }, get hint() { return t('กันอัตโนมัติ', 'Blocks a hit'); } },
  fifty: { icon: Scissors, name: '50/50', get hint() { return t('ตัดตัวเลือกผิด 2 ข้อ', 'Remove 2 wrong choices'); } },
  slow: { icon: Hourglass, get name() { return t('ลดเวลา', 'Slow'); }, get hint() { return t('เวลาเพื่อนเหลือครึ่ง', "Halve a rival's time"); } },
  extra: { icon: HourglassHigh, get name() { return t('เพิ่มเวลา', 'Extra time'); }, get hint() { return t('+50% ให้ตัวเอง', '+50% for you'); } },
  counter: { icon: Crosshair, get name() { return t('ยิงสวน', 'Counter'); }, get hint() { return t('โดนยิงแล้วเด้งไปหาเพื่อน', 'Bounce a hit to a rival'); } },
};

const ORDER: CardKind[] = ['shield', 'fifty', 'slow', 'extra', 'counter'];

export function CardBar({ cards, questionType, opponents, answered, open, usedCard, busy, onUse }: Props) {
  const [picking, setPicking] = useState<'slow' | 'counter' | null>(null);
  const owned = ORDER.filter((k) => (cards[k] ?? 0) > 0);

  if (!owned.length) {
    return <p className="card-bar__empty">
        <Cards weight="fill" size={16} /> {t('ยังไม่มีการ์ด · ได้การ์ดสุ่มทุก 3 ข้อ', 'No cards yet · get a random card every 3 questions')}</p>;
  }

  const canUse = (k: ActiveCard) => {
    if (!open || busy || usedCard) return false;
    if (k === 'counter') return true;
    if (answered) return false;
    if (k === 'slow') return opponents.some((o) => !o.answered);
    return true;
  };

  const info = (k: CardKind) =>
    k === 'fifty' && questionType === 'fill' ? { icon: SkipForward, name: t('ข้ามข้อ', 'Skip'), hint: t('ไม่เสียหัวใจ ไม่ได้คะแนน', 'No heart lost, no points') } : INFO[k];

  return (
    <>
      <div className="card-bar">
        {owned.map((k) => {
          const i = info(k);
          const count = cards[k] ?? 0;
          if (k === 'shield') {
            return (
              <div key={k} className="power-card power-card--passive" title={i.hint}>
                <span className="power-card__icon">
                  <i.icon weight="fill" size={26} />
                </span>
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
              <span className="power-card__icon">
                  <i.icon weight="fill" size={26} />
                </span>
              <span className="power-card__name">{i.name}</span>
              <span className="power-card__count">x{count}</span>
              <span className="power-card__hint">{used ? t('ใช้แล้ว ✓', 'Used ✓') : i.hint}</span>
            </button>
          );
        })}
      </div>
      {usedCard && <p className="card-bar__note">{t('ใช้การ์ดได้ข้อละ 1 ใบ', '1 card per question')}</p>}

      {picking && (
        <div className="overlay" onClick={() => setPicking(null)}>
          <div className="overlay__card pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="overlay__emoji">{createElement(INFO[picking].icon, { weight: 'fill', size: 56 })}</div>
            <h2>{picking === 'slow' ? t('ลดเวลาใคร?', 'Slow down who?') : t('ยิงสวนไปหาใคร?', 'Counter toward who?')}</h2>
            <p className="muted">
              {picking === 'slow'
                ? t('เวลาที่เหลือของเพื่อนจะเหลือครึ่งหนึ่ง (อย่างน้อย 5 วิ)', 'Their remaining time is halved (min 5 s)')
                : t('ถ้าข้อนี้คุณโดนยิง ดาเมจจะเด้งไปหาเพื่อนคนนี้แทน', 'If you get hit this round, the damage goes to them instead')}
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
                    <span className="target-btn__avatar">
                      <PlayerAvatar code={o.avatar} size={28} />
                    </span>
                    <span className="target-btn__name">{o.name}</span>
                    {disabled && <span className="muted">{t('ตอบแล้ว', 'Answered')}</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setPicking(null)}>
              {t('ยกเลิก', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
