export function LoadingScreen({ message, onCancel }: { message: string; onCancel: () => void }) {
  return (
    <div className="screen loading">
      <div className="loading__brain" aria-hidden>
        🧠
      </div>
      <p className="loading__msg" role="status">
        {message}
      </p>
      <div className="loading__dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        ยกเลิก
      </button>
    </div>
  );
}
