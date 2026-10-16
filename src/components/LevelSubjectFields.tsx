import type { Level, Subject, Track } from '../types';
import { adjustForLevel, LEVEL_KEYS, LEVELS, subjectOptions } from '../data/subjects';

export interface LevelSubjectValue {
  level?: Level;
  subject: Subject | 'all';
  track: Track;
}

interface Props<T extends LevelSubjectValue> {
  value: T;
  onChange: (next: T) => void;
  subjectLabel?: string;
}

/** เลือกระดับชั้น + วิชา + แนวข้อสอบ (ใช้ในห้องออนไลน์ สุ่มจับคู่ และสร้างกลุ่ม) */
export function LevelSubjectFields<T extends LevelSubjectValue>({ value, onChange, subjectLabel = 'วิชา' }: Props<T>) {
  const level = value.level ?? 'upper';
  const tracks = LEVELS[level].tracks;
  return (
    <>
      <div className="field-row">
        <label className="field">
          <span className="field__label">ระดับชั้น</span>
          <select
            className="field__input"
            value={level}
            onChange={(e) => onChange(adjustForLevel(value, e.target.value as Level))}
          >
            {LEVEL_KEYS.map((k) => (
              <option key={k} value={k}>
                {LEVELS[k].emoji} {LEVELS[k].name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{subjectLabel}</span>
          <select
            className="field__input"
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value as Subject | 'all' })}
          >
            {subjectOptions(level).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tracks.length > 1 && (
        <div className="segmented">
          {tracks.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`segmented__opt ${value.track === t.value ? 'is-active' : ''}`}
              onClick={() => onChange({ ...value, track: t.value })}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
