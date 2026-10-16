import { useEffect, useState } from 'react';
import type { Level, Subject } from '../types';
import { LEVELS, subjectInfo, difficultyText } from '../data/subjects';
import { chapterName } from '../data/chapters';
import type { ChapterStat } from '../lib/analysis';
import { bangkokWeek, DAY_NAMES, PLAN_DAYS, REASON_TEXT, type PlanItem, type PlanPrefs } from '../lib/planBuilder';
import { loadPlan, rebuildPlan, requestAdvice, type StudyPlan } from '../lib/studyPlan';

interface Props {
  level: Level;
  stats: ChapterStat[];
  onPractice: (item: PlanItem, index: number) => void;
}

const DAY_OPTIONS: PlanPrefs['daysPerWeek'][] = [3, 4, 5, 6, 7];
const SESSION_OPTIONS: PlanPrefs['sessionsPerDay'][] = [1, 2, 3];

const bangkokDate = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);

/** แผนการฝึกรายสัปดาห์ + คำแนะนำจาก AI */
export function PlanPanel({ level, stats, onPractice }: Props) {
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = useState<PlanPrefs>({ sessionsPerDay: 1, daysPerWeek: 5, subjects: LEVELS[level].subjects });
  const [busy, setBusy] = useState<'save' | 'advice' | null>(null);
  const [error, setError] = useState('');
  const { weekStart, today } = bangkokWeek();

  useEffect(() => {
    let alive = true;
    setPlan(undefined);
    setError('');
    loadPlan(level)
      .then(async (p) => {
        // ขึ้นสัปดาห์ใหม่: จัดแผนใหม่ให้อัตโนมัติด้วยค่าที่ตั้งไว้เดิม
        if (p && p.weekStart !== weekStart) p = await rebuildPlan(level, p.prefs, stats);
        if (!alive) return;
        setPlan(p);
        setPrefs(p ? p.prefs : { sessionsPerDay: 1, daysPerWeek: 5, subjects: LEVELS[level].subjects });
        setEditing(!p);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // stats มาพร้อมกับ level (หน้าแม่โหลดเสร็จก่อนแสดงแผง)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, weekStart]);

  const run = async (kind: 'save' | 'advice', fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run('save', async () => {
      setPlan(await rebuildPlan(level, prefs, stats));
      setEditing(false);
    });

  const askAi = () =>
    run('advice', async () => {
      const r = await requestAdvice(level);
      setPlan((p) => (p ? { ...p, advice: r.advice, adviceAt: r.adviceAt } : p));
    });

  const toggleSubject = (s: Subject) =>
    setPrefs((p) => ({
      ...p,
      subjects: p.subjects.includes(s) ? (p.subjects.length > 1 ? p.subjects.filter((x) => x !== s) : p.subjects) : [...p.subjects, s],
    }));

  if (plan === undefined && !error) return <p className="muted analysis__loading">กำลังโหลดแผน...</p>;

  const settingsForm = (
    <section className="settings-card plan__settings">
      <h2 className="section-title section-title--dark">⚙️ ตั้งค่าแผนการฝึก</h2>
      <div className="setting">
        <span className="setting__label">วิชาที่จะโฟกัส</span>
        <div className="chapter-picker">
          {LEVELS[level].subjects.map((s) => {
            const info = subjectInfo(s, level);
            const on = prefs.subjects.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} className={`chapter-chip ${on ? 'is-active' : ''}`} onClick={() => toggleSubject(s)}>
                {info.emoji} {info.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting">
        <span className="setting__label">ฝึกกี่วันต่อสัปดาห์</span>
        <div className="segmented">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`segmented__opt ${prefs.daysPerWeek === d ? 'is-active' : ''}`}
              onClick={() => setPrefs({ ...prefs, daysPerWeek: d })}
            >
              {d} วัน
            </button>
          ))}
        </div>
      </div>
      <div className="setting">
        <span className="setting__label">วันละกี่รอบ (รอบละ 10 ข้อ)</span>
        <div className="segmented">
          {SESSION_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`segmented__opt ${prefs.sessionsPerDay === n ? 'is-active' : ''}`}
              onClick={() => setPrefs({ ...prefs, sessionsPerDay: n })}
            >
              {n} รอบ
            </button>
          ))}
        </div>
      </div>
      <p className="muted">
        รวม {PLAN_DAYS[prefs.daysPerWeek].length * prefs.sessionsPerDay} รอบ/สัปดาห์ · เน้นบทที่อ่อนราวครึ่งหนึ่ง แทรกบทใหม่และทวนบทที่ถนัด
      </p>
      <div className="plan__actions">
        {plan && (
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
            ยกเลิก
          </button>
        )}
        <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={save}>
          {busy === 'save' ? 'กำลังจัดแผน...' : plan ? 'บันทึกและจัดแผนใหม่' : 'สร้างแผนการฝึก ✨'}
        </button>
      </div>
    </section>
  );

  if (!plan || editing)
    return (
      <>
        {!plan && (
          <section className="settings-card analysis__empty">
            <p className="analysis__big">📅</p>
            <p>ให้ระบบจัดตารางฝึกรายสัปดาห์จากจุดอ่อนของคุณ</p>
          </section>
        )}
        {settingsForm}
        {error && <p className="form-error">😵 {error}</p>}
      </>
    );

  const indexed = plan.items.map((item, index) => ({ item, index }));
  const todays = indexed.filter((x) => x.item.day === today);
  const doneCount = plan.items.filter((i) => i.done).length;
  const adviceToday = plan.adviceAt && bangkokDate(plan.adviceAt) === bangkokDate(new Date().toISOString());

  const itemRow = ({ item, index }: { item: PlanItem; index: number }, big = false) => {
    const sub = subjectInfo(item.chapter.split('.')[1] as Subject, level);
    return (
      <li key={index} className={`plan__item ${item.done ? 'is-done' : ''} ${big ? 'plan__item--big' : ''}`}>
        <div className="plan__item-body">
          <strong>
            {sub.emoji} {chapterName(item.chapter)}
          </strong>
          <span className="muted">
            {REASON_TEXT[item.reason]} · {difficultyText(item.difficulty)}
          </span>
        </div>
        {item.done ? (
          <span className="plan__check" aria-label="ทำแล้ว">
            ✅
          </span>
        ) : (
          <button type="button" className={`btn ${big ? 'btn--primary' : 'btn--ghost'}`} onClick={() => onPractice(item, index)}>
            เริ่ม
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <section className="settings-card">
        <div className="plan__head">
          <h2 className="section-title section-title--dark">📅 วันนี้ (วัน{DAY_NAMES[today]})</h2>
          <span className="muted">
            สัปดาห์นี้ {doneCount}/{plan.items.length}
          </span>
        </div>
        <span className="analysis__bar plan__progress" aria-hidden>
          <span style={{ width: `${(100 * doneCount) / Math.max(1, plan.items.length)}%` }} />
        </span>
        {todays.length ? (
          <ul className="plan__list">{todays.map((x) => itemRow(x, true))}</ul>
        ) : (
          <p className="muted">วันนี้เป็นวันพัก 😴 อยากฝึกเพิ่มก็เลือกรอบจากวันอื่นด้านล่างได้</p>
        )}
      </section>

      <section className="settings-card plan__advice">
        <h2 className="section-title section-title--dark">✨ คำแนะนำจาก AI</h2>
        {plan.advice ? (
          <p className="plan__advice-text">{plan.advice}</p>
        ) : (
          <p className="muted">ให้ AI ดูสถิติของคุณแล้วแนะนำว่าควรเน้นอะไร (ขอได้วันละ 1 ครั้ง)</p>
        )}
        {!adviceToday && (
          <button type="button" className="btn btn--primary btn--block" disabled={busy !== null} onClick={askAi}>
            {busy === 'advice' ? 'AI กำลังวิเคราะห์...' : plan.advice ? 'ขอคำแนะนำใหม่ของวันนี้' : 'ขอคำแนะนำจาก AI ✨'}
          </button>
        )}
        {adviceToday && <p className="muted">ขอคำแนะนำใหม่ได้พรุ่งนี้</p>}
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">🗓️ ทั้งสัปดาห์</h2>
        {PLAN_DAYS[plan.prefs.daysPerWeek].map((d) => (
          <div key={d} className={`plan__day ${d === today ? 'is-today' : ''}`}>
            <span className="plan__day-name">{DAY_NAMES[d]}</span>
            <ul className="plan__list">{indexed.filter((x) => x.item.day === d).map((x) => itemRow(x))}</ul>
          </div>
        ))}
        <div className="plan__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
            ⚙️ ปรับแผน
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy !== null} onClick={save}>
            🔄 จัดแผนใหม่
          </button>
        </div>
      </section>

      {error && <p className="form-error">😵 {error}</p>}
    </>
  );
}
