import { useState } from 'react';
import { DIFFICULTY_OPTIONS } from '../data/subjects';
import { LevelSubjectFields } from '../components/LevelSubjectFields';
import type { MatchSettings } from '../lib/rooms';
import { Cards, DiceFive, GlobeHemisphereEast, House, Key, Medal, Sword, WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

const DIFFICULTIES = DIFFICULTY_OPTIONS;

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
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress"><GlobeHemisphereEast weight="fill" className="ico" /> {t('ออนไลน์', 'Online')}</div>
      </header>

      <section className="settings-card online-card online-card--match">
        <div className="online-card__icon"><DiceFive weight="fill" className="ico" /></div>
        <h2 className="online-card__title">{t('สุ่มหาคู่แข่ง', 'Matchmaking')}</h2>
        <p className="online-card__desc">{t('จับคู่กับผู้เล่นจริงที่เลือกเหมือนกัน · 10 ข้อ · 2-8 คน ·', 'Match with real players who picked the same · 10 questions · 2-8 players ·')} <Medal weight="fill" className="ico" /> {t('นับแต้มแรงค์', 'Ranked')}</p>
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
                <d.icon weight="fill" className="ico" /> {d.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__opt ${match.mode === 'classic' ? 'is-active' : ''}`}
              onClick={() => setMatch({ ...match, mode: 'classic' })}
            >
              <Sword weight="fill" className="ico" /> {t('ไม่มีไอเทม', 'No items')}
            </button>
            <button
              type="button"
              className={`segmented__opt ${match.mode === 'items' ? 'is-active' : ''}`}
              onClick={() => setMatch({ ...match, mode: 'items' })}
            >
              <Cards weight="fill" className="ico" /> {t('การ์ดพลัง', 'Power cards')}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy !== null}
          onClick={() => run('find', () => onFind(match))}
        >
          {busy === 'find' ? t('กำลังหา...', 'Searching...') : t('หาเกม!', 'Find game!')}
        </button>
      </section>

      <div className="divider divider--light">{t('หรือเล่นกับเพื่อน', 'or play with friends')}</div>

      <section className="settings-card online-card">
        <div className="online-card__icon"><House weight="fill" className="ico" /></div>
        <h2 className="online-card__title">{t('สร้างห้องใหม่', 'Create a room')}</h2>
        <p className="online-card__desc">{t('ได้รหัสห้องไปส่งให้เพื่อน เล่นได้ 2-8 คน', 'Get a room code to share — 2-8 players')}</p>
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy !== null}
          onClick={() => run('create', onCreate)}
        >
          {busy === 'create' ? t('กำลังสร้างห้อง...', 'Creating room...') : t('สร้างห้อง', 'Create room')}
        </button>
      </section>

      <section className="settings-card online-card">
        <div className="online-card__icon"><Key weight="fill" className="ico" /></div>
        <h2 className="online-card__title">{t('มีรหัสห้องแล้ว?', 'Have a room code?')}</h2>
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
            aria-label={t('รหัสห้อง 5 ตัว', '5-character room code')}
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={cleanCode.length !== 5 || busy !== null}>
            {busy === 'join' ? t('กำลังเข้าห้อง...', 'Joining...') : t('เข้าห้อง', 'Join')}
          </button>
        </form>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
    </div>
  );
}
