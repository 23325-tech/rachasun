import { useEffect } from 'react';
import { fxBus, type CardFx } from './bus';
import type { FxEngine, Pt, Rect } from './engine';

/** จุดกลางรูปผู้เล่นบนจอ (การ์ดผู้เล่นมี data-pid) */
function centerOf(id: string): Pt | null {
  const el = document.querySelector(`[data-pid="${CSS.escape(id)}"] .pcard__avatar`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** กรอบขององค์ประกอบบนจอ */
function rectOf(sel: string): Rect | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** เล่นเอฟเฟกต์การ์ดตามตำแหน่งบนจอ */
function playCard(e: FxEngine, fx: CardFx) {
  switch (fx.type) {
    case 'fifty': {
      const rects = fx.choices.map((i) => rectOf(`.choice--${i}`)).filter((r): r is Rect => !!r);
      if (rects.length) e.slash(rects);
      break;
    }
    case 'skip': {
      const r = rectOf('.question-card');
      if (r) e.whoosh(r);
      break;
    }
    case 'extra': {
      const at = centerOf(fx.who);
      if (at) e.goldAura(at, rectOf('.timer__track') ?? undefined);
      break;
    }
    case 'slow': {
      const from = centerOf(fx.from);
      const to = centerOf(fx.to);
      if (from && to)
        e.iceShot(from, to, () => {
          const bar = fx.frostMe ? rectOf('.timer__track') : null;
          if (bar) e.frost(bar);
        });
      break;
    }
    case 'counter': {
      const at = centerOf(fx.who);
      if (at) e.reticle(at);
      break;
    }
    case 'cast': {
      const at = centerOf(fx.who);
      if (at) e.cast(at);
      break;
    }
    case 'dealt': {
      const at = centerOf(fx.who);
      if (at) e.dealt(at);
      break;
    }
  }
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
    }, (fx) => {
      if (engine) playCard(engine, fx);
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
