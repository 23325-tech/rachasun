import { useEffect, useState } from 'react';
import { chibiOf, frameOf, lookCode } from '../lib/look';
import { dataSaver } from '../lib/perf';
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

  const flat = dataSaver();
  useEffect(() => {
    if (!base || flat) return;
    let alive = true;
    // โหลด three.js เฉพาะตอนต้องวาดจริง
    import('../three/portrait')
      .then((m) => m.portraitOf(base, framing))
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [base, framing, flat]);

  return (
    <span className={`player-avatar ${code ? '' : 'is-empty'} ${frame ? `has-frame frame--${frame.tier}` : ''} ${className}`} style={{ width: size, height: size }} aria-hidden>
      {flat && base ? <FlatFace code={base} bare={className.includes('is-bare')} /> : url && <img src={url} alt="" draggable={false} />}
    </span>
  );
}

/** หน้าตัวละครแบบ 2D เบาๆ สำหรับโหมดประหยัดเน็ต (สีผิว ผม ตา ชุด จากรหัสหน้าตา) */
function FlatFace({ code, bare }: { code: string; bare?: boolean }) {
  const c = chibiOf(code);
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      {!bare && <rect width="40" height="40" fill="#efeaff" />}
      <ellipse cx="20" cy="42" rx="15" ry="10" fill={c.outfitColor} />
      <circle cx="20" cy="20" r="11" fill={c.skin} />
      <path d="M8.6 19 A11.4 11.4 0 0 1 31.4 19 Q26 13.5 20 14.5 Q14 13.5 8.6 19 Z" fill={c.hair} />
      <circle cx="16" cy="21.5" r="1.6" fill={c.eyes} />
      <circle cx="24" cy="21.5" r="1.6" fill={c.eyes} />
      <path d="M17.5 25.5 Q20 27.5 22.5 25.5" stroke="#5a3a2e" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** รูปนิ่งสัตว์เลี้ยง (ป้ายในการ์ดผู้เล่น / รูปสินค้า) */
export function PetImage({ kind, size = 24, className = '', level = 1 }: { kind: PetKind; size?: number; className?: string; level?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const flat = dataSaver();
  useEffect(() => {
    if (kind === 'none' || flat) return;
    let alive = true;
    import('../three/portrait')
      .then((m) => m.petPortraitOf(kind, level))
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind, level, flat]);
  if (kind === 'none') return null;
  return (
    <span className={`pet-image ${className}`} style={{ width: size, height: size }} aria-hidden>
      {url && <img src={url} alt="" draggable={false} />}
    </span>
  );
}
