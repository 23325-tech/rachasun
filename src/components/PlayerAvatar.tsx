import { useEffect, useState } from 'react';
import { frameOf, lookCode } from '../lib/look';
import type { PetKind } from '../three/pets';

interface Props {
  /** รหัสหน้าตา (คอลัมน์ avatar) หรือว่าง = ช่องว่างรอผู้เล่น */
  code?: string | null;
  size?: number;
  className?: string;
  /** bust = ครึ่งตัว (ค่าเริ่มต้น), full = เต็มตัว */
  framing?: 'bust' | 'full';
}

/** ภาพหน้าตัวละครแบบวงกลม (วาดจากโมเดล 3D ครั้งเดียวแล้วแคช) */
export function PlayerAvatar({ code, size = 40, className = '', framing = 'bust' }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  // กรอบวาดด้วย CSS รูปใช้แคชเดียวกับหน้าตาที่ไม่มีกรอบ
  const base = code ? lookCode(code) : null;
  const frame = frameOf(code);

  useEffect(() => {
    if (!base) return;
    let alive = true;
    // โหลด three.js เฉพาะตอนต้องวาดจริง
    import('../three/portrait')
      .then((m) => m.portraitOf(base, framing))
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [base, framing]);

  return (
    <span className={`player-avatar ${code ? '' : 'is-empty'} ${frame ? `has-frame frame--${frame.tier}` : ''} ${className}`} style={{ width: size, height: size }} aria-hidden>
      {url && <img src={url} alt="" draggable={false} />}
    </span>
  );
}

/** รูปนิ่งสัตว์เลี้ยง (ป้ายในการ์ดผู้เล่น / รูปสินค้า) */
export function PetImage({ kind, size = 24, className = '' }: { kind: PetKind; size?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (kind === 'none') return;
    let alive = true;
    import('../three/portrait')
      .then((m) => m.petPortraitOf(kind))
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind]);
  if (kind === 'none') return null;
  return (
    <span className={`pet-image ${className}`} style={{ width: size, height: size }} aria-hidden>
      {url && <img src={url} alt="" draggable={false} />}
    </span>
  );
}
