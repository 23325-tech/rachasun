import { useState } from 'react';
import type { Level, Subject } from '../types';
import { chaptersOf } from '../data/chapters';

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
        บท {value.length ? `(เลือก ${value.length} บท)` : '(ไม่เลือก = ทุกบท)'}
        {value.length > 0 && (
          <button type="button" className="link-btn chapter-picker__clear" onClick={() => onChange([])}>
            ล้าง
          </button>
        )}
      </span>
      <div className="chapter-picker" role="group" aria-label="เลือกบท">
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
          {expanded ? 'ย่อ ▲' : `ดูทั้งหมด ${chapters.length} บท ▼`}
        </button>
      )}
    </div>
  );
}
