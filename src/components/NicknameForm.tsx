import { useState } from 'react';
import { checkNickname, NICKNAME_PROBLEM_TEXT } from '../lib/nameFilter';

interface Props {
  initialNickname?: string;
  submitLabel: string;
  onSubmit: (nickname: string) => Promise<void>;
}

/** ฟอร์มตั้งชื่อเล่น ใช้ทั้งตอนเข้าเล่นครั้งแรกและตอนแก้โปรไฟล์ */
export function NicknameForm({ initialNickname = '', submitLabel, onSubmit }: Props) {
  const [nickname, setNickname] = useState(initialNickname);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const problem = checkNickname(nickname);
  const showProblem = touched && problem;

  return (
    <form
      className="nick-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setTouched(true);
        if (problem || busy) return;
        setBusy(true);
        setError('');
        try {
          await onSubmit(nickname);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span className="field__label">ชื่อเล่น</span>
        <input
          className={`field__input ${showProblem ? 'is-invalid' : ''}`}
          value={nickname}
          maxLength={20}
          autoComplete="nickname"
          placeholder="เช่น ฟ้าใส, Somchai"
          onChange={(e) => setNickname(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <span className={`field__hint ${showProblem ? 'is-error' : ''}`}>
          {showProblem ? NICKNAME_PROBLEM_TEXT[problem] : 'ชื่อซ้ำกับคนอื่นได้ ระบบจะเติมเลขท้ายให้ เช่น ฟ้าใส#4821'}
        </span>
      </label>
      {error && <p className="form-error">😵 {error}</p>}
      <button type="submit" className="btn btn--primary btn--block btn--big" disabled={busy}>
        {busy ? 'กำลังบันทึก...' : submitLabel}
      </button>
    </form>
  );
}
