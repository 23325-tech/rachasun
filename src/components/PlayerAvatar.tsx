import { useEffect, useState } from 'react';

interface Props {
  /** รหัสหน้าตา (คอลัมน์ avatar) หรือว่าง = ช่องว่างรอผู้เล่น */
  code?: string | null;
  size?: number;
  className?: string;
}

/** ภาพหน้าตัวละครแบบวงกลม (วาดจากโมเดล 3D ครั้งเดียวแล้วแคช) */
export function PlayerAvatar({ code, size = 40, className = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    // โหลด three.js เฉพาะตอนต้องวาดจริง
    import('../three/portrait')
      .then((m) => m.portraitOf(code))
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <span className={`player-avatar ${code ? '' : 'is-empty'} ${className}`} style={{ width: size, height: size }} aria-hidden>
      {url && <img src={url} alt="" draggable={false} />}
    </span>
  );
}
