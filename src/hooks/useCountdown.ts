import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * นับถอยหลัง durationMs เริ่มใหม่ทุกครั้งที่ resetKey เปลี่ยน
 * หยุดเมื่อ running = false และเรียก onExpire เมื่อเวลาหมด
 */
export function useCountdown(durationMs: number, running: boolean, resetKey: unknown, onExpire: () => void) {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const deadlineRef = useRef(0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    deadlineRef.current = performance.now() + durationMs;
    setRemainingMs(durationMs);
  }, [resetKey, durationMs]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - performance.now());
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(id);
        onExpireRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, resetKey]);

  /** เวลาที่เหลือแบบแม่นยำ ณ ตอนที่เรียก (ใช้ตอนกดตอบ) */
  const getRemainingMs = useCallback(() => Math.max(0, deadlineRef.current - performance.now()), []);

  return { remainingMs, getRemainingMs };
}
