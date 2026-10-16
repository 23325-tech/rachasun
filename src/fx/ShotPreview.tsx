import { useEffect, useRef } from 'react';
import { Heart, Lightning, Planet, Flower, ShootingStar, Crosshair, type Icon } from '@phosphor-icons/react';
import type { FxEngine, ShotSkin } from './engine';

/** ไอคอน + สีของแต่ละเอฟเฟกต์ยิง (ใช้เป็นรูปสินค้า) */
export const SHOT_ICON: Record<ShotSkin, { icon: Icon; grad: string }> = {
  default: { icon: Crosshair, grad: 'linear-gradient(135deg,#ff9a3c,#ff5d73)' },
  star: { icon: ShootingStar, grad: 'linear-gradient(135deg,#ffe066,#ffa400)' },
  heart: { icon: Heart, grad: 'linear-gradient(135deg,#ff8fc0,#ff3b7a)' },
  sakura: { icon: Flower, grad: 'linear-gradient(135deg,#ffe3ee,#ff9ac0)' },
  lightning: { icon: Lightning, grad: 'linear-gradient(135deg,#8fe0ff,#3d8bff)' },
  galaxy: { icon: Planet, grad: 'linear-gradient(135deg,#8a5cf6,#4fb6ff)' },
};

export function ShotIcon({ skin, size = 56 }: { skin: ShotSkin; size?: number }) {
  const s = SHOT_ICON[skin];
  return (
    <span className="shot-icon" style={{ width: size, height: size, background: s.grad }}>
      <s.icon weight="fill" size={size * 0.55} />
    </span>
  );
}

/** ทดลองยิง: เมื่อ fire เปลี่ยน จะยิงเอฟเฟกต์ข้ามกรอบ target (เลือกจาก selector) */
export function ShotPreview({ skin, fire, target }: { skin: ShotSkin; fire: number; target: string }) {
  const engineRef = useRef<FxEngine | null>(null);
  const latest = useRef({ skin, target });
  latest.current = { skin, target };
  const play = () => {
    const el = document.querySelector(latest.current.target);
    const e = engineRef.current;
    if (!el || !e) return;
    const r = el.getBoundingClientRect();
    e.shoot({ x: r.left + r.width * 0.12, y: r.top + r.height * 0.7 }, { x: r.left + r.width * 0.82, y: r.top + r.height * 0.35 }, 'hit', false, 0.55, undefined, latest.current.skin);
  };
  useEffect(() => {
    let alive = true;
    import('./engine').then(({ FxEngine }) => {
      if (!alive) return;
      engineRef.current = new FxEngine(document.body);
      // กดครั้งแรกระหว่างโหลด: ยิงทันทีที่พร้อม
      play();
    });
    return () => {
      alive = false;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (fire) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, skin]);
  return null;
}
