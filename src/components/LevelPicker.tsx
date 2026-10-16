import type { Level } from '../types';
import { LEVEL_KEYS, LEVELS } from '../data/subjects';

interface Props {
  value: Level;
  onChange: (level: Level) => void;
  label?: string;
}

/** เลือกระดับชั้น ประถม / ม.ต้น / ม.ปลาย / มหาลัย */
export function LevelPicker({ value, onChange, label = 'ระดับชั้น' }: Props) {
  return (
    <div className="setting">
      <span className="setting__label">{label}</span>
      <div className="level-picker" role="radiogroup" aria-label={label}>
        {LEVEL_KEYS.map((key) => {
          const lv = LEVELS[key];
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              className={`level-picker__opt ${value === key ? 'is-active' : ''}`}
              onClick={() => onChange(key)}
            >
              <span className="level-picker__emoji" aria-hidden>
                {lv.emoji}
              </span>
              <span className="level-picker__name">{lv.name}</span>
              <span className="level-picker__short">{lv.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
