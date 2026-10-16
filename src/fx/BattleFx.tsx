import { useEffect } from 'react';
import { fxBus } from './bus';
import type { FxEngine, Pt } from './engine';

/** จุดกลางรูปผู้เล่นบนจอ (การ์ดผู้เล่นมี data-pid) */
function centerOf(id: string): Pt | null {
  const el = document.querySelector(`[data-pid="${CSS.escape(id)}"] .pcard__avatar`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** ฉากเอฟเฟกต์ 3D เต็มจอ ฟังคำสั่งจาก fxBus (โหลด three.js เฉพาะตอนเปิดหน้าเกม) */
export default function BattleFx() {
  useEffect(() => {
    let engine: FxEngine | null = null;
    let alive = true;
    const host = document.body;
    const unsub = fxBus.subscribe((shots, flightMs) => {
      if (!engine) return;
      for (const s of shots) {
        const to = centerOf(s.to);
        if (!to) continue;
        const from = s.from ? centerOf(s.from) : null;
        const counterTo = s.counterTo ? centerOf(s.counterTo) ?? undefined : undefined;
        engine.shoot(from, to, s.kind, s.lethal, flightMs / 1000, counterTo);
      }
    });
    import('./engine').then(({ FxEngine }) => {
      if (!alive) return;
      engine = new FxEngine(host);
      // สั่นทั้งจอเกม
      engine.onShake = (px) => {
        const el = document.querySelector<HTMLElement>('.screen.battle');
        if (!el) return;
        el.style.setProperty('--shake', `${px}px`);
        el.classList.remove('fx-shake');
        void el.offsetWidth;
        el.classList.add('fx-shake');
      };
    });
    return () => {
      alive = false;
      unsub();
      engine?.dispose();
    };
  }, []);
  return null;
}
