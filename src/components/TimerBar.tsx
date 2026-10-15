export function TimerBar({ remainingMs, limitMs }: { remainingMs: number; limitMs: number }) {
  const ratio = Math.max(0, Math.min(1, remainingMs / limitMs));
  const seconds = Math.ceil(remainingMs / 1000);
  const level = ratio > 0.5 ? 'ok' : ratio > 0.2 ? 'warn' : 'danger';
  return (
    <div className={`timer timer--${level}`} role="timer" aria-label={`เหลือเวลา ${seconds} วินาที`}>
      <span className="timer__icon" aria-hidden>
        ⏱️
      </span>
      <div className="timer__track">
        <div className="timer__fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <span className="timer__num">{seconds}</span>
    </div>
  );
}
