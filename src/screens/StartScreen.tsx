import { useState, type CSSProperties } from 'react';
import type { Subject } from '../types';
import { SUBJECTS } from '../data/subjects';
import { SAMPLE_QUESTIONS } from '../data/sampleQuestions';

export type SubjectFilter = Subject | 'all';

const COUNT_OPTIONS = [5, 10, 20];

export function StartScreen({ onStart }: { onStart: (subject: SubjectFilter, count: number) => void }) {
  const [subject, setSubject] = useState<SubjectFilter>('all');
  const [count, setCount] = useState(10);

  const available = SAMPLE_QUESTIONS.filter((q) => subject === 'all' || q.subject === subject).length;
  const actualCount = Math.min(count, available);

  return (
    <div className="screen start">
      <header className="start__hero">
        <div className="start__logo" aria-hidden>
          🧠
        </div>
        <h1 className="start__title">Brain Gym</h1>
        <p className="start__subtitle">ฝึกโจทย์ให้ไว แล้วไปแข่งกับเพื่อน!</p>
      </header>

      <section className="panel">
        <h2 className="panel__title">เลือกวิชา</h2>
        <div className="chips">
          <button
            type="button"
            className={`chip ${subject === 'all' ? 'is-active' : ''}`}
            onClick={() => setSubject('all')}
          >
            🌈 ทุกวิชา
          </button>
          {(Object.keys(SUBJECTS) as Subject[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${subject === s ? 'is-active' : ''}`}
              style={{ '--chip-color': SUBJECTS[s].color } as CSSProperties}
              onClick={() => setSubject(s)}
            >
              {SUBJECTS[s].emoji} {SUBJECTS[s].name}
            </button>
          ))}
        </div>

        <h2 className="panel__title">จำนวนข้อ</h2>
        <div className="chips">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${count === n ? 'is-active' : ''}`}
              onClick={() => setCount(n)}
            >
              {n} ข้อ
            </button>
          ))}
        </div>
        {actualCount < count && <p className="hint">วิชานี้มีโจทย์ตัวอย่าง {available} ข้อ จะเล่นทั้งหมด {available} ข้อ</p>}
      </section>

      <div className="bottom-bar">
        <button type="button" className="btn btn--primary btn--block btn--big" onClick={() => onStart(subject, actualCount)}>
          เริ่มเลย! ▶
        </button>
      </div>
    </div>
  );
}
