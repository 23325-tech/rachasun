import { useEffect, useState } from 'react';
import type { Difficulty, Subject, Track } from '../types';
import { SUBJECTS } from '../data/subjects';
import { createGroup, joinGroup, myGroups, type MyGroup } from '../lib/groups';

interface Props {
  initialCode?: string;
  onOpen: (groupId: string) => void;
  onBack: () => void;
}

const SUBJECT_OPTIONS: { value: Subject | 'all'; label: string }[] = [
  { value: 'all', label: '🌈 ทุกวิชา' },
  ...(Object.keys(SUBJECTS) as Subject[]).map((s) => ({ value: s, label: `${SUBJECTS[s].emoji} ${SUBJECTS[s].name}` })),
];
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: '🌱 ง่าย' },
  { value: 'medium', label: '🔥 กลาง' },
  { value: 'hard', label: '💀 ยาก' },
];
const TRACKS: { value: Track; label: string }[] = [
  { value: 'school', label: '🏫 สอบปกติ' },
  { value: 'entrance', label: '🎓 สอบเข้า' },
];

export function subjectLabel(subject: Subject | 'all') {
  return subject === 'all' ? '🌈 ทุกวิชา' : `${SUBJECTS[subject].emoji} ${SUBJECTS[subject].name}`;
}

/** กลุ่มของฉัน + สร้างกลุ่ม + เข้ากลุ่มด้วยรหัส */
export function GroupsScreen({ initialCode = '', onOpen, onBack }: Props) {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [code, setCode] = useState(initialCode);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState<Subject | 'all'>('all');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [track, setTrack] = useState<Track>('school');
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
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">🏆 กลุ่มเพื่อน</div>
      </header>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">กลุ่มของฉัน {groups && `(${groups.length}/5)`}</h2>
        {groups === null ? (
          <p className="muted">กำลังโหลด...</p>
        ) : groups.length === 0 ? (
          <p className="muted">ยังไม่มีกลุ่ม สร้างกลุ่มหรือขอรหัสจากเพื่อนได้เลย 👇</p>
        ) : (
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g.id}>
                <button type="button" className="group-item" onClick={() => onOpen(g.id)}>
                  <span className="group-item__body">
                    <span className="group-item__name">{g.name}</span>
                    <span className="group-item__meta">
                      {subjectLabel(g.settings.subject)} · 👥 {g.members}
                    </span>
                  </span>
                  <span className={`group-item__today ${g.playedToday ? 'is-done' : ''}`}>
                    {g.playedToday ? `✅ ⭐${g.todayScore}` : '🎯 เล่นวันนี้'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">🔑 เข้ากลุ่มด้วยรหัส</h2>
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
            aria-label="รหัสกลุ่ม 6 ตัว"
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={cleanCode.length !== 6 || busy}>
            เข้ากลุ่ม 🚪
          </button>
        </form>
      </section>

      <section className="settings-card">
        {!creating ? (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setCreating(true)}>
            ➕ สร้างกลุ่มใหม่
          </button>
        ) : (
          <form
            className="account__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) run(async () => onOpen((await createGroup(name, { subject, difficulty, track })).id));
            }}
          >
            <h2 className="section-title section-title--dark">➕ สร้างกลุ่มใหม่</h2>
            <label className="field">
              <span className="field__label">ชื่อกลุ่ม</span>
              <input
                className="field__input"
                value={name}
                maxLength={30}
                placeholder="เช่น ติวฟิสิกส์ ม.6/2"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">วิชาของโจทย์ประจำวัน</span>
              <select className="field__input" value={subject} onChange={(e) => setSubject(e.target.value as Subject | 'all')}>
                {SUBJECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`segmented__opt ${difficulty === d.value ? 'is-active' : ''}`}
                  onClick={() => setDifficulty(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="segmented">
              {TRACKS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`segmented__opt ${track === t.value ? 'is-active' : ''}`}
                  onClick={() => setTrack(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="muted">โจทย์ประจำวัน 10 ข้อ เล่นได้วันละครั้ง วันใหม่เริ่มเที่ยงคืน</p>
            <button type="submit" className="btn btn--primary btn--block" disabled={busy || name.trim().length < 2}>
              {busy ? 'กำลังสร้าง...' : 'สร้างกลุ่ม ✨'}
            </button>
          </form>
        )}
      </section>

      {error && <p className="form-error">😵 {error}</p>}
    </div>
  );
}
