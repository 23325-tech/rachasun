import { useState } from 'react';
import { DIFFICULTY_OPTIONS } from '../data/subjects';
import { LevelSubjectFields } from '../components/LevelSubjectFields';
import type { MatchSettings } from '../lib/rooms';
import { Cards, DiceFive, GlobeHemisphereEast, House, Key, Medal, Sword, WarningCircle } from '@phosphor-icons/react';

const DIFFICULTIES = DIFFICULTY_OPTIONS.map((d) => ({ value: d.value, label: `${d.icon} ${d.label}` }));

interface Props {
  initialMatch: MatchSettings;
  onFind: (m: MatchSettings) => Promise<void>;
  onCreate: () => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onBack: () => void;
  initialCode?: string;
}

export function OnlineMenuScreen({ initialMatch, onFind, onCreate, onJoin, onBack, initialCode = '' }: Props) {
  const [code, setCode] = useState(initialCode);
  const [match, setMatch] = useState<MatchSettings>(initialMatch);
  const [busy, setBusy] = useState<'find' | 'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  const run = async (kind: 'find' | 'create' | 'join', fn: () => Promise<void>) => {
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
        <div className="quiz__progress"><GlobeHemisphereEast weight="fill" className="ico" /> ออนไลน์</div>
      </header>

      <section className="settings-card online-card online-card--match">
        <div className="online-card__icon"><DiceFive weight="fill" className="ico" /></div>
        <h2 className="online-card__title">สุ่มหาคู่แข่ง</h2>
        <p className="online-card__desc">จับคู่กับผู้เล่นจริงที่เลือกเหมือนกัน · 10 ข้อ · 2-8 คน · <Medal weight="fill" className="ico" /> นับแต้มแรงค์</p>
        <div className="match-settings">
          <LevelSubjectFields value={match} onChange={setMatch} />
          <div className="segmented">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`segmented__opt ${match.difficulty === d.value ? 'is-active' : ''}`}
                onClick={() => setMatch({ ...match, difficulty: d.value })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__opt ${match.mode === 'classic' ? 'is-active' : ''}`}
              onClick={() => setMatch({ ...match, mode: 'classic' })}
            >
              <Sword weight="fill" className="ico" /> ไม่มีไอเทม
            </button>
            <button
              type="button"
              className={`segmented__opt ${match.mode === 'items' ? 'is-active' : ''}`}
              onClick={() => setMatch({ ...match, mode: 'items' })}
            >
              <Cards weight="fill" className="ico" /> การ์ดพลัง
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy !== null}
          onClick={() => run('find', () => onFind(match))}
        >
          {busy === 'find' ? 'กำลังหา...' : 'หาเกม!'}
        </button>
      </section>

      <div className="divider divider--light">หรือเล่นกับเพื่อน</div>

      <section className="settings-card online-card">
        <div className="online-card__icon"><House weight="fill" className="ico" /></div>
        <h2 className="online-card__title">สร้างห้องใหม่</h2>
        <p className="online-card__desc">ได้รหัสห้องไปส่งให้เพื่อน เล่นได้ 2-8 คน</p>
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy !== null}
          onClick={() => run('create', onCreate)}
        >
          {busy === 'create' ? 'กำลังสร้างห้อง...' : 'สร้างห้อง'}
        </button>
      </section>

      <section className="settings-card online-card">
        <div className="online-card__icon"><Key weight="fill" className="ico" /></div>
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
            {busy === 'join' ? 'กำลังเข้าห้อง...' : 'เข้าห้อง'}
          </button>
        </form>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
    </div>
  );
}
