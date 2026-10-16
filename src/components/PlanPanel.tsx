import { useEffect, useState } from 'react';
import type { Level, Subject } from '../types';
import { LEVELS, subjectInfo, difficultyText } from '../data/subjects';
import { chapterName } from '../data/chapters';
import type { ChapterStat } from '../lib/analysis';
import { bangkokWeek, DAY_NAMES, PLAN_DAYS, REASON_TEXT, type PlanItem, type PlanPrefs } from '../lib/planBuilder';
import { loadPlan, rebuildPlan, requestAdvice, type StudyPlan } from '../lib/studyPlan';
import { ArrowsClockwise,CalendarBlank,CalendarDots,CheckCircle,Gear,Lightbulb,Moon,Sparkle,WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

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

  if (plan === undefined && !error) return <p className="muted analysis__loading">{t('กำลังโหลดแผน...', 'Loading plan...')}</p>;

  const settingsForm = (
    <section className="settings-card plan__settings">
      <h2 className="section-title section-title--dark"><Gear weight="fill" className="ico" /> {t('ตั้งค่าแผนการฝึก', 'Plan settings')}</h2>
      <div className="setting">
        <span className="setting__label">{t('วิชาที่จะโฟกัส', 'Focus subject')}</span>
        <div className="chapter-picker">
          {LEVELS[level].subjects.map((s) => {
            const info = subjectInfo(s, level);
            const on = prefs.subjects.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} className={`chapter-chip ${on ? 'is-active' : ''}`} onClick={() => toggleSubject(s)}>
                <info.icon weight="fill" size={16} /> {info.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting">
        <span className="setting__label">{t('ฝึกกี่วันต่อสัปดาห์', 'Days per week')}</span>
        <div className="segmented">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`segmented__opt ${prefs.daysPerWeek === d ? 'is-active' : ''}`}
              onClick={() => setPrefs({ ...prefs, daysPerWeek: d })}
            >
              {t(`${d} วัน`, `${d} days`)}
            </button>
          ))}
        </div>
      </div>
      <div className="setting">
        <span className="setting__label">{t('วันละกี่รอบ (รอบละ 10 ข้อ)', 'Rounds per day (10 questions each)')}</span>
        <div className="segmented">
          {SESSION_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`segmented__opt ${prefs.sessionsPerDay === n ? 'is-active' : ''}`}
              onClick={() => setPrefs({ ...prefs, sessionsPerDay: n })}
            >
              {t(`${n} รอบ`, `${n}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">
        {t(
          `รวม ${PLAN_DAYS[prefs.daysPerWeek].length * prefs.sessionsPerDay} รอบ/สัปดาห์ · เน้นบทที่อ่อนราวครึ่งหนึ่ง แทรกบทใหม่และทวนบทที่ถนัด`,
          `${PLAN_DAYS[prefs.daysPerWeek].length * prefs.sessionsPerDay} rounds/week · about half on weak chapters, plus new chapters and review`,
        )}
      </p>
      <div className="plan__actions">
        {plan && (
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
            {t('ยกเลิก', 'Cancel')}
          </button>
        )}
        <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={save}>
          {busy === 'save' ? t('กำลังจัดแผน...', 'Planning...') : plan ? t('บันทึกและจัดแผนใหม่', 'Save and re-plan') : t('สร้างแผนการฝึก', 'Create study plan')}
        </button>
      </div>
    </section>
  );

  if (!plan || editing)
    return (
      <>
        {!plan && (
          <section className="settings-card analysis__empty">
            <p className="analysis__big"><CalendarBlank weight="fill" className="ico" /></p>
            <p>{t('ให้ระบบจัดตารางฝึกรายสัปดาห์จากจุดอ่อนของคุณ', 'Get a weekly practice schedule built from your weak spots')}</p>
          </section>
        )}
        {settingsForm}
        {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
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
            <sub.icon weight="fill" size={16} color={sub.color} /> {chapterName(item.chapter)}
          </strong>
          <span className="muted">
            {REASON_TEXT[item.reason]} · {difficultyText(item.difficulty)}
          </span>
        </div>
        {item.done ? (
          <span className="plan__check" aria-label={t('ทำแล้ว', 'Done')}>
            <CheckCircle weight="fill" className="ico" />
          </span>
        ) : (
          <button type="button" className={`btn ${big ? 'btn--primary' : 'btn--ghost'}`} onClick={() => onPractice(item, index)}>
            {t('เริ่ม', 'Start')}
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <section className="settings-card">
        <div className="plan__head">
          <h2 className="section-title section-title--dark"><CalendarBlank weight="fill" className="ico" /> {t(`วันนี้ (วัน${DAY_NAMES[today]})`, `Today (${DAY_NAMES[today]})`)}</h2>
          <span className="muted">
            {t('สัปดาห์นี้', 'This week')} {doneCount}/{plan.items.length}
          </span>
        </div>
        <span className="analysis__bar plan__progress" aria-hidden>
          <span style={{ width: `${(100 * doneCount) / Math.max(1, plan.items.length)}%` }} />
        </span>
        {todays.length ? (
          <ul className="plan__list">{todays.map((x) => itemRow(x, true))}</ul>
        ) : (
          <p className="muted">{t('วันนี้เป็นวันพัก', 'Rest day today')} <Moon weight="fill" className="ico" /> {t('อยากฝึกเพิ่มก็เลือกรอบจากวันอื่นด้านล่างได้', 'Want more? Pick a round from another day below')}</p>
        )}
      </section>

      <section className="settings-card plan__advice">
        <h2 className="section-title section-title--dark"><Sparkle weight="fill" className="ico" /> {t('คำแนะนำจาก AI', 'AI advice')}</h2>
        {plan.advice ? (
          <ul className="plan__advice-list">
            {plan.advice
              .replace(/\p{Extended_Pictographic}️?/gu, '')
              .split('\n')
              .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
              .filter(Boolean)
              .map((l, i) => (
                <li key={i}>
                  <Lightbulb weight="fill" className="ico" />
                  <span>{l}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">{t('ให้ AI ดูสถิติของคุณแล้วแนะนำว่าควรเน้นอะไร (ขอได้วันละ 1 ครั้ง)', 'Let AI review your stats and suggest what to focus on (once a day)')}</p>
        )}
        {!adviceToday && (
          <button type="button" className="btn btn--primary btn--block" disabled={busy !== null} onClick={askAi}>
            {busy === 'advice' ? t('AI กำลังวิเคราะห์...', 'AI is analyzing...') : plan.advice ? t('ขอคำแนะนำใหม่ของวันนี้', 'Get today\'s new advice') : t('ขอคำแนะนำจาก AI', 'Ask AI for advice')}
          </button>
        )}
        {adviceToday && <p className="muted">{t('ขอคำแนะนำใหม่ได้พรุ่งนี้', 'New advice available tomorrow')}</p>}
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark"><CalendarDots weight="fill" className="ico" /> {t('ทั้งสัปดาห์', 'Whole week')}</h2>
        {PLAN_DAYS[plan.prefs.daysPerWeek].map((d) => (
          <div key={d} className={`plan__day ${d === today ? 'is-today' : ''}`}>
            <span className="plan__day-name">{DAY_NAMES[d]}</span>
            <ul className="plan__list">{indexed.filter((x) => x.item.day === d).map((x) => itemRow(x))}</ul>
          </div>
        ))}
        <div className="plan__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
            <Gear weight="fill" className="ico" /> {t('ปรับแผน', 'Edit plan')}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy !== null} onClick={save}>
            <ArrowsClockwise weight="fill" className="ico" /> {t('จัดแผนใหม่', 'Re-plan')}
          </button>
        </div>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
    </>
  );
}
