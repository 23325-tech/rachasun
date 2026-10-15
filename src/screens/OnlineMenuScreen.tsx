import { useState } from 'react';

interface Props {
  onCreate: () => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onBack: () => void;
  initialCode?: string;
}

export function OnlineMenuScreen({ onCreate, onJoin, onBack, initialCode = '' }: Props) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  const run = async (kind: 'create' | 'join', fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

  return (
    <div className="screen online-menu">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">🌐 เล่นกับเพื่อน</div>
      </header>

      <section className="settings-card online-card">
        <div className="online-card__icon">🏠</div>
        <h2 className="online-card__title">สร้างห้องใหม่</h2>
        <p className="online-card__desc">ได้รหัสห้องไปส่งให้เพื่อน เล่นได้ 2-8 คน</p>
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy !== null}
          onClick={() => run('create', onCreate)}
        >
          {busy === 'create' ? 'กำลังสร้างห้อง...' : 'สร้างห้อง ✨'}
        </button>
      </section>

      <section className="settings-card online-card">
        <div className="online-card__icon">🔑</div>
        <h2 className="online-card__title">มีรหัสห้องแล้ว?</h2>
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode.length === 5 && !busy) run('join', () => onJoin(cleanCode));
          }}
        >
          <input
            className="code-input"
            value={cleanCode}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCDE"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            aria-label="รหัสห้อง 5 ตัว"
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={cleanCode.length !== 5 || busy !== null}>
            {busy === 'join' ? 'กำลังเข้าห้อง...' : 'เข้าห้อง 🚪'}
          </button>
        </form>
      </section>

      {error && <p className="form-error">😵 {error}</p>}
    </div>
  );
}
