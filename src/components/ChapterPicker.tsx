import { useState } from 'react';
import type { Level, Subject } from '../types';
import { chaptersOf } from '../data/chapters';
import { t } from '../lib/i18n';

interface Props {
  level: Level;
  subject: Subject;
  value: string[];
  onChange: (chapters: string[]) => void;
}

/** จำนวนบทที่แสดงก่อนกด "ดูทั้งหมด" */
const PREVIEW = 8;

/** เลือกบท (หลายบทได้ ไม่เลือก = ทุกบท) */
export function ChapterPicker({ level, subject, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const chapters = chaptersOf(level, subject);
  if (!chapters.length) return null;

  // บทที่เลือกไว้ต้องเห็นเสมอ แม้ยังไม่กดดูทั้งหมด
  const shown = expanded ? chapters : chapters.filter((c, i) => i < PREVIEW || value.includes(c.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="setting">
      <span className="setting__label">
        {t('บท', 'Chapters')} {value.length ? t(`(เลือก ${value.length} บท)`, `(${value.length} selected)`) : t('(ไม่เลือก = ทุกบท)', '(none = all chapters)')}
        {value.length > 0 && (
          <button type="button" className="link-btn chapter-picker__clear" onClick={() => onChange([])}>
            {t('ล้าง', 'Clear')}
          </button>
        )}
      </span>
      <div className="chapter-picker" role="group" aria-label={t('เลือกบท', 'Choose chapters')}>
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={value.includes(c.id)}
            className={`chapter-chip ${value.includes(c.id) ? 'is-active' : ''}`}
            onClick={() => toggle(c.id)}
          >
            <span className="chapter-chip__no">{chapters.indexOf(c) + 1}</span>
            {c.name}
          </button>
        ))}
      </div>
      {chapters.length > PREVIEW && (
        <button type="button" className="link-btn chapter-picker__more" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('ย่อ ▲', 'Less ▲') : t(`ดูทั้งหมด ${chapters.length} บท ▼`, `Show all ${chapters.length} chapters ▼`)}
        </button>
      )}
    </div>
  );
}
