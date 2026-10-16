import type { Difficulty, Level, Subject } from '../types';
import { DIFFICULTY_OPTIONS, LEVEL_KEYS, LEVELS, subjectInfo } from '../data/subjects';
import { chaptersOf } from '../data/chapters';
import { MathText } from './MathText';
import { t } from '../lib/i18n';
import type { TeacherQuestion } from '../lib/teacherBank';

interface Props {
  value: TeacherQuestion;
  onChange: (q: TeacherQuestion) => void;
}

const CHOICE = ['ก', 'ข', 'ค', 'ง'];

/** ฟอร์มเขียน/แก้โจทย์: ปรนัย 4 ตัวเลือก หรือเติมคำ (ตัวเลข/ข้อความ) พร้อมพรีวิวสูตร LaTeX */
export function QuestionEditor({ value: q, onChange }: Props) {
  const set = (patch: Partial<TeacherQuestion>) => onChange({ ...q, ...patch });
  const num = q.answer.kind === 'number' ? q.answer : null;
  const txt = q.answer.kind === 'text' ? q.answer : null;

  return (
    <div className="q-edit">
      <div className="q-edit__row">
        <select
          value={q.level}
          onChange={(e) => {
            const level = e.target.value as Level;
            set({ level, subject: LEVELS[level].subjects.includes(q.subject) ? q.subject : LEVELS[level].subjects[0], chapter: null });
          }}
          aria-label={t('ระดับชั้น', 'Level')}
        >
          {LEVEL_KEYS.map((l) => (
            <option key={l} value={l}>
              {LEVELS[l].name}
            </option>
          ))}
        </select>
        <select value={q.subject} onChange={(e) => set({ subject: e.target.value as Subject, chapter: null })} aria-label={t('วิชา', 'Subject')}>
          {LEVELS[q.level].subjects.map((s) => (
            <option key={s} value={s}>
              {subjectInfo(s, q.level).name}
            </option>
          ))}
        </select>
        <select value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })} aria-label={t('ความยาก', 'Difficulty')}>
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <select value={q.chapter ?? ''} onChange={(e) => set({ chapter: e.target.value || null })} aria-label={t('บท', 'Chapter')}>
        <option value="">{t('ไม่ระบุบท', 'No chapter')}</option>
        {chaptersOf(q.level, q.subject).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="segmented q-edit__type">
        <button type="button" className={`segmented__opt ${q.type === 'mcq' ? 'is-active' : ''}`} onClick={() => set({ type: 'mcq' })}>
          {t('ปรนัย 4 ตัวเลือก', 'Multiple choice')}
        </button>
        <button type="button" className={`segmented__opt ${q.type === 'fill' ? 'is-active' : ''}`} onClick={() => set({ type: 'fill' })}>
          {t('เติมคำตอบ', 'Fill in')}
        </button>
      </div>

      <label className="q-edit__field">
        <span>{t('โจทย์ (ใส่สูตรด้วย $...$ เช่น $x^2+1$)', 'Question (math in $...$, e.g. $x^2+1$)')}</span>
        <textarea value={q.prompt} rows={3} maxLength={2000} onChange={(e) => set({ prompt: e.target.value })} />
      </label>
      {q.prompt.includes('$') && <MathText className="q-edit__preview" text={q.prompt} />}

      {q.type === 'mcq' ? (
        <div className="q-edit__choices" role="radiogroup" aria-label={t('ตัวเลือก', 'Choices')}>
          {q.choices.map((c, i) => (
            <label key={i} className={`q-edit__choice ${q.answerIndex === i ? 'is-answer' : ''}`}>
              <input type="radio" name={`ans-${q.id ?? 'new'}-${q.prompt.length}`} checked={q.answerIndex === i} onChange={() => set({ answerIndex: i })} aria-label={t(`ข้อ ${CHOICE[i]} ถูก`, `Choice ${i + 1} is correct`)} />
              <b>{CHOICE[i]}</b>
              <input
                value={c}
                maxLength={500}
                onChange={(e) => set({ choices: q.choices.map((x, k) => (k === i ? e.target.value : x)) })}
                placeholder={t(`ตัวเลือก ${CHOICE[i]}`, `Choice ${i + 1}`)}
              />
            </label>
          ))}
          <small className="muted">{t('แตะวงกลมหน้าตัวเลือกที่ถูก', 'Tap the circle next to the correct choice')}</small>
        </div>
      ) : (
        <div className="q-edit__fill">
          <div className="segmented">
            <button type="button" className={`segmented__opt ${num ? 'is-active' : ''}`} onClick={() => set({ answer: { kind: 'number', value: 0 } })}>
              {t('ตอบเป็นตัวเลข', 'Number')}
            </button>
            <button type="button" className={`segmented__opt ${txt ? 'is-active' : ''}`} onClick={() => set({ answer: { kind: 'text', accepted: [''] } })}>
              {t('ตอบเป็นคำ', 'Text')}
            </button>
          </div>
          {num && (
            <div className="q-edit__row">
              <label className="q-edit__field">
                <span>{t('เฉลย', 'Answer')}</span>
                <input type="number" step="any" value={Number.isFinite(num.value) ? num.value : ''} onChange={(e) => set({ answer: { ...num, value: e.target.value === '' ? NaN : Number(e.target.value) } })} />
              </label>
              <label className="q-edit__field">
                <span>{t('หน่วย (ถ้ามี)', 'Unit (optional)')}</span>
                <input value={num.unit ?? ''} maxLength={20} onChange={(e) => set({ answer: { ...num, unit: e.target.value || undefined } })} />
              </label>
              <label className="q-edit__field">
                <span>{t('คลาดเคลื่อนได้', 'Tolerance')}</span>
                <input type="number" step="any" min={0} value={num.tolerance ?? ''} onChange={(e) => set({ answer: { ...num, tolerance: e.target.value === '' ? undefined : Math.abs(Number(e.target.value)) } })} placeholder="0" />
              </label>
            </div>
          )}
          {txt && (
            <label className="q-edit__field">
              <span>{t('คำตอบที่ยอมรับ (คั่นด้วย , ถ้ามีหลายแบบ)', 'Accepted answers (separate with commas)')}</span>
              <input value={txt.accepted.join(', ')} onChange={(e) => set({ answer: { kind: 'text', accepted: e.target.value.split(',').map((s) => s.trimStart()).slice(0, 10) } })} />
            </label>
          )}
        </div>
      )}

      <label className="q-edit__field">
        <span>{t('คำอธิบายเฉลย (ไม่บังคับ)', 'Explanation (optional)')}</span>
        <textarea value={q.explanation} rows={2} maxLength={2000} onChange={(e) => set({ explanation: e.target.value })} />
      </label>
    </div>
  );
}
