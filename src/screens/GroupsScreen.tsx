import { useEffect, useState } from 'react';
import type { Difficulty, Level, Subject, Track } from '../types';
import { settingsLabel, DIFFICULTY_OPTIONS } from '../data/subjects';
import { LevelSubjectFields } from '../components/LevelSubjectFields';
import { createGroup, joinGroup, myGroups, type MyGroup } from '../lib/groups';
import { CheckCircle,DoorOpen,HandPointing,Key,Plus,Target,Trophy,Users,WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

interface Props {
  initialCode?: string;
  onOpen: (groupId: string) => void;
  onBack: () => void;
}

const DIFFICULTIES = DIFFICULTY_OPTIONS;


/** กลุ่มของฉัน + สร้างกลุ่ม + เข้ากลุ่มด้วยรหัส */
export function GroupsScreen({ initialCode = '', onOpen, onBack }: Props) {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [code, setCode] = useState(initialCode);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [pick, setPick] = useState<{ level: Level; subject: Subject | 'all'; track: Track }>({
    level: 'upper',
    subject: 'all',
    track: 'school',
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    myGroups()
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  return (
    <div className="screen groups">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress"><Trophy weight="fill" className="ico" /> {t('กลุ่มเพื่อน', 'Friend groups')}</div>
      </header>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">{t('กลุ่มของฉัน', 'My groups')} {groups && `(${groups.length}/5)`}</h2>
        {groups === null ? (
          <p className="muted">{t('กำลังโหลด...', 'Loading...')}</p>
        ) : groups.length === 0 ? (
          <p className="muted">{t('ยังไม่มีกลุ่ม สร้างกลุ่มหรือขอรหัสจากเพื่อนได้เลย', 'No groups yet — create one or ask a friend for a code')} <HandPointing weight="fill" className="ico" /></p>
        ) : (
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g.id}>
                <button type="button" className="group-item" onClick={() => onOpen(g.id)}>
                  <span className="group-item__body">
                    <span className="group-item__name">{g.name}</span>
                    <span className="group-item__meta">
                      {settingsLabel(g.settings)} · <Users weight="fill" className="ico" /> {g.members}
                    </span>
                  </span>
                  <span className={`group-item__today ${g.playedToday ? 'is-done' : ''}`}>
                    {g.playedToday ? (
                      <>
                        <CheckCircle weight="fill" className="ico" /> {g.todayScore} {t('คะแนน', 'pts')}
                      </>
                    ) : (
                      <>
                        <Target weight="fill" className="ico" /> {t('เล่นวันนี้', 'Play today')}
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark"><Key weight="fill" className="ico" /> {t('เข้ากลุ่มด้วยรหัส', 'Join with a code')}</h2>
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode.length === 6 && !busy) run(async () => onOpen((await joinGroup(cleanCode)).id));
          }}
        >
          <input
            className="code-input"
            value={cleanCode}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label={t('รหัสกลุ่ม 6 ตัว', '6-character group code')}
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={cleanCode.length !== 6 || busy}>
            {t('เข้ากลุ่ม', 'Join')} <DoorOpen weight="fill" className="ico" />
          </button>
        </form>
      </section>

      <section className="settings-card">
        {!creating ? (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setCreating(true)}>
            <Plus weight="fill" className="ico" /> {t('สร้างกลุ่มใหม่', 'Create a new group')}
          </button>
        ) : (
          <form
            className="account__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) run(async () => onOpen((await createGroup(name, { ...pick, difficulty })).id));
            }}
          >
            <h2 className="section-title section-title--dark"><Plus weight="fill" className="ico" /> {t('สร้างกลุ่มใหม่', 'Create a new group')}</h2>
            <label className="field">
              <span className="field__label">{t('ชื่อกลุ่ม', 'Group name')}</span>
              <input
                className="field__input"
                value={name}
                maxLength={30}
                placeholder={t('เช่น ติวฟิสิกส์ ม.6/2', 'e.g. Physics study group')}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <LevelSubjectFields value={pick} onChange={setPick} subjectLabel={t('วิชาของโจทย์ประจำวัน', 'Daily question subject')} />
            <div className="segmented">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`segmented__opt ${difficulty === d.value ? 'is-active' : ''}`}
                  onClick={() => setDifficulty(d.value)}
                >
                  <d.icon weight="fill" className="ico" /> {d.label}
                </button>
              ))}
            </div>
            <p className="muted">{t('โจทย์ประจำวัน 10 ข้อ เล่นได้วันละครั้ง วันใหม่เริ่มเที่ยงคืน', '10 daily questions, once a day · new day starts at midnight')}</p>
            <button type="submit" className="btn btn--primary btn--block" disabled={busy || name.trim().length < 2}>
              {busy ? t('กำลังสร้าง...', 'Creating...') : t('สร้างกลุ่ม', 'Create group')}
            </button>
          </form>
        )}
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
    </div>
  );
}
