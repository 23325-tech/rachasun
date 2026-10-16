import { useEffect, useState } from 'react';
import { ArrowUp, CalendarBlank, GraduationCap, PencilSimple, Plus, Target, Trash, X } from '@phosphor-icons/react';
import { TCAS_BY_KEY, TCAS_SUBJECTS, TCAS_YEAR } from '../data/tcas';
import { t } from '../lib/i18n';
import {
  MAX_GOALS,
  composite,
  daysUntil,
  examDate,
  fetchDream,
  nextExam,
  saveDream,
  type DreamGoal,
  type DreamPlan,
  effectiveScores,
  fetchMockScores,
  scoreValues,
  subjectGaps,
  type MockScore,
} from '../lib/dream';

interface Props {
  onBack: () => void;
}

const subjectName = (key: string) => TCAS_BY_KEY[key]?.name() ?? key;
const fmtDate = (d: Date) => d.toLocaleDateString(t('th-TH', 'en-GB'), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });

/** เป้าหมายคณะในฝัน: ค่าน้ำหนักที่นักเรียนกรอกเอง คะแนนรวมเทียบเป้า และนับถอยหลังถึงวันสอบ */
export function DreamScreen({ onBack }: Props) {
  const [plan, setPlan] = useState<DreamPlan | null>(null);
  const [mock, setMock] = useState<Record<string, MockScore>>({});
  const [open, setOpen] = useState<number | null>(0);
  const [editing, setEditing] = useState<{ index: number; goal: DreamGoal } | null>(null);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    fetchMockScores().then(setMock).catch(() => {});
    fetchDream()
      .then((p) => {
        setPlan(p);
        setScoreDraft(Object.fromEntries(Object.entries(p.scores).map(([k, v]) => [k, String(v)])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const persist = async (next: DreamPlan, okText: string) => {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await saveDream(next);
      setPlan(next);
      setSaved(okText);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!plan) {
    return (
      <div className="screen dream">
        <DreamHeader onBack={onBack} />
        {error ? <p className="form-error">{error}</p> : <p className="muted analysis__loading">{t('กำลังโหลด...', 'Loading...')}</p>}
      </div>
    );
  }

  if (editing) {
    return (
      <GoalEditor
        initial={editing.goal}
        busy={busy}
        error={error}
        onCancel={() => {
          setEditing(null);
          setError('');
        }}
        onSave={async (goal) => {
          const goals = [...plan.goals];
          if (editing.index < 0) goals.push(goal);
          else goals[editing.index] = goal;
          if (await persist({ ...plan, goals }, t('บันทึกเป้าหมายแล้ว', 'Goal saved'))) setEditing(null);
        }}
      />
    );
  }

  const used = [...new Set(plan.goals.flatMap((g) => Object.keys(g.weights)))].sort(
    (a, b) => TCAS_SUBJECTS.findIndex((s) => s.key === a) - TCAS_SUBJECTS.findIndex((s) => s.key === b),
  );

  const move = (i: number) => {
    const goals = [...plan.goals];
    [goals[i - 1], goals[i]] = [goals[i], goals[i - 1]];
    void persist({ ...plan, goals }, t('จัดอันดับใหม่แล้ว', 'Reordered'));
  };
  const remove = (i: number) => {
    if (!window.confirm(t('ลบเป้าหมายนี้?', 'Delete this goal?'))) return;
    void persist({ ...plan, goals: plan.goals.filter((_, k) => k !== i) }, t('ลบแล้ว', 'Deleted'));
  };
  const saveScores = () => {
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(scoreDraft)) {
      if (v.trim() === '') continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError(t(`คะแนน ${subjectName(k)} ต้องอยู่ระหว่าง 0-100`, `${subjectName(k)} must be 0-100`));
        return;
      }
      scores[k] = Math.round(n * 100) / 100;
    }
    void persist({ ...plan, scores }, t('บันทึกคะแนนแล้ว', 'Scores saved'));
  };
  const setOverride = (key: string, value: string) => {
    const examOverrides = { ...plan.examOverrides };
    if (value) examOverrides[key] = value;
    else delete examOverrides[key];
    void persist({ ...plan, examOverrides }, t('บันทึกวันสอบแล้ว', 'Exam date saved'));
  };

  return (
    <div className="screen dream">
      <DreamHeader onBack={onBack} />

      {plan.goals.length === 0 && (
        <section className="settings-card dream__empty">
          <GraduationCap weight="fill" size={48} />
          <p>
            {t(
              'ตั้งคณะที่อยากเข้า ใส่ค่าน้ำหนักวิชาตามประกาศของคณะ แล้วดูว่าคะแนนตอนนี้ห่างเป้าแค่ไหน พร้อมนับถอยหลังถึงวันสอบ',
              'Set the faculty you want, enter its subject weights from the official announcement, and see how far you are from the target with a countdown to exam day.',
            )}
          </p>
        </section>
      )}

      {plan.goals.map((g, i) => {
        const eff = effectiveScores(plan.scores, mock, Object.keys(g.weights));
        const c = composite(g, scoreValues(eff));
        const gaps = subjectGaps(g, scoreValues(eff));
        const next = nextExam(g, plan.examOverrides);
        const gap = Math.round((g.target - c.total) * 100) / 100;
        return (
          <section key={i} className={`settings-card dream-goal ${i === 0 ? 'dream-goal--top' : ''}`}>
            <div className="dream-goal__head">
              <span className="dream-goal__rank">{i + 1}</span>
              <span className="dream-goal__name">
                <strong>{g.faculty}</strong>
                {g.university && <small>{g.university}</small>}
              </span>
              {next && (
                <span className="dream-goal__days">
                  <b>{next.days}</b> {t('วัน', 'days')}
                </span>
              )}
            </div>
            {next && (
              <p className="muted dream-goal__next">
                <CalendarBlank weight="bold" size={13} /> {t('สอบวิชาแรก', 'First exam')}: {subjectName(next.key)} · {fmtDate(next.at)}
              </p>
            )}
            <div className="dream-goal__bar" aria-hidden>
              <span className="dream-goal__fill" style={{ width: `${Math.min(100, c.total)}%` }} />
              <span className="dream-goal__target" style={{ left: `${Math.min(100, g.target)}%` }} />
            </div>
            <p className="dream-goal__score">
              {t('ตอนนี้', 'Now')} <strong>{c.missing.length === Object.keys(g.weights).length ? '-' : c.total.toFixed(2)}</strong> / {t('เป้า', 'target')} <strong>{g.target}</strong>
              {c.missing.length === 0 &&
                (gap > 0 ? (
                  <span className="dream-goal__gap">{t(`ขาดอีก ${gap.toFixed(2)}`, `${gap.toFixed(2)} to go`)}</span>
                ) : (
                  <span className="dream-goal__gap dream-goal__gap--ok">{t('ถึงเป้าแล้ว!', 'On target!')}</span>
                ))}
            </p>
            {c.missing.length > 0 && (
              <p className="dream-goal__missing">
                {t('ยังไม่มีคะแนน', 'No score yet')}: {c.missing.map(subjectName).join(', ')}
                {c.missing.some((k) => TCAS_BY_KEY[k]?.mock) && t(' · วิชาที่มีจำลองสอบในเว็บ ลองทำเพื่อดึงคะแนนอัตโนมัติ', ' · try the in-app mock exam to fill these in')}
              </p>
            )}
            <button type="button" className="dream-goal__toggle" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {open === i ? t('ซ่อนรายวิชา', 'Hide subjects') : t('ดูส่วนที่ขาดรายวิชา', 'See gap by subject')}
            </button>
            {open === i && (
              <ul className="dream-gaps">
                {gaps.map((x, k) => {
                  const e = eff[x.key];
                  return (
                    <li key={x.key} className={k === 0 && x.room > 0 && gap > 0 && c.missing.length === 0 ? 'is-best' : ''}>
                      <div className="dream-gaps__top">
                        <span className="dream-gaps__name">
                          {subjectName(x.key)} <small>{x.weight}%</small>
                        </span>
                        <span className="dream-gaps__score">{x.score === null ? '-' : x.score}</span>
                      </div>
                      <div className="dream-gaps__meta">
                        {e && (
                          <span className={`dream-gaps__src dream-gaps__src--${e.source}`}>
                            {e.source === 'mock' ? t(`จำลองสอบ เฉลี่ย ${e.n} ครั้ง`, `Mock avg of ${e.n}`) : t('กรอกเอง', 'Typed in')}
                          </span>
                        )}
                        <span>
                          {t('ได้', 'Earns')} {x.earned.toFixed(2)}/{x.weight}
                        </span>
                        {x.score !== null && gap > 0 && c.missing.length === 0 && (
                          <b>
                            {x.needAlone !== null
                              ? t(`ถ้าเพิ่มวิชานี้วิชาเดียว ต้อง +${x.needAlone}`, `Alone it needs +${x.needAlone}`)
                              : t('เพิ่มวิชานี้วิชาเดียวไม่พอ', 'Not enough alone')}
                          </b>
                        )}
                        {k === 0 && x.room > 0 && gap > 0 && c.missing.length === 0 && <b className="dream-gaps__best">{t('เพิ่มคะแนนรวมได้มากสุด', 'Biggest upside')}</b>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="dream-goal__tools">
              {i > 0 && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => move(i)}>
                  <ArrowUp weight="bold" className="ico" /> {t('เลื่อนขึ้น', 'Move up')}
                </button>
              )}
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setEditing({ index: i, goal: g })}>
                <PencilSimple weight="bold" className="ico" /> {t('แก้ไข', 'Edit')}
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => remove(i)} aria-label={t('ลบ', 'Delete')}>
                <Trash weight="bold" className="ico" />
              </button>
            </div>
          </section>
        );
      })}

      {plan.goals.length < MAX_GOALS && (
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy}
          onClick={() => setEditing({ index: -1, goal: { university: '', faculty: '', target: 60, weights: {} } })}
        >
          <Plus weight="bold" className="ico" /> {plan.goals.length ? t(`เพิ่มเป้าอันดับ ${plan.goals.length + 1}`, `Add goal #${plan.goals.length + 1}`) : t('ตั้งเป้าแรก', 'Set your first goal')}
        </button>
      )}

      {used.length > 0 && (
        <section className="settings-card">
          <h2 className="section-title section-title--dark">{t('คะแนนของฉัน (เต็ม 100)', 'My scores (out of 100)')}</h2>
          <p className="muted dream__note">{t('ใส่คะแนนที่คาดว่าจะได้ หรือคะแนนสอบจริง วิชาที่มีจำลองสอบเว้นว่างไว้ = ใช้ค่าเฉลี่ย 3 ครั้งล่าสุดอัตโนมัติ', 'Enter expected or real scores. Leave a mock-exam subject blank to use your average of the last 3 mocks.')}</p>
          <div className="dream__scores">
            {used.map((k) => (
              <label key={k} className="dream__score">
                <span>{subjectName(k)}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  max={100}
                  value={scoreDraft[k] ?? ''}
                  onChange={(e) => setScoreDraft((d) => ({ ...d, [k]: e.target.value }))}
                  placeholder={TCAS_BY_KEY[k]?.mock && mock[TCAS_BY_KEY[k].mock!] ? String(mock[TCAS_BY_KEY[k].mock!].avg) : '-'}
                />
                {TCAS_BY_KEY[k]?.mock && mock[TCAS_BY_KEY[k].mock!] && !scoreDraft[k] && (
                  <small className="dream__auto">{t('ใช้คะแนนจำลองสอบ', 'From mock exams')}</small>
                )}
              </label>
            ))}
          </div>
          <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={saveScores}>
            {t('บันทึกคะแนน', 'Save scores')}
          </button>
        </section>
      )}

      {used.length > 0 && (
        <section className="settings-card">
          <h2 className="section-title section-title--dark">
            <CalendarBlank weight="fill" className="ico" /> {t(`วันสอบ TCAS${TCAS_YEAR - 2500}`, `TCAS${TCAS_YEAR - 2500} exam dates`)}
          </h2>
          <p className="muted dream__note">{t('วันสอบเริ่มต้นตามตารางที่ประกาศ แก้เป็นวันของตัวเองได้', 'Default dates from the published schedule. You can change them.')}</p>
          <ul className="dream__dates">
            {used.map((k) => {
              const at = examDate(k, plan.examOverrides);
              const days = at ? daysUntil(at) : null;
              return (
                <li key={k}>
                  <span>
                    {subjectName(k)}
                    <small className="muted">{days === null ? '' : days >= 0 ? t(` · อีก ${days} วัน`, ` · in ${days} days`) : t(' · สอบไปแล้ว', ' · done')}</small>
                  </span>
                  <span className="dream__date">
                    <input
                      type="date"
                      value={plan.examOverrides[k] ?? (TCAS_BY_KEY[k]?.examAt.slice(0, 10) ?? '')}
                      onChange={(e) => setOverride(k, e.target.value === TCAS_BY_KEY[k]?.examAt.slice(0, 10) ? '' : e.target.value)}
                      disabled={busy}
                    />
                    {plan.examOverrides[k] && (
                      <button type="button" className="icon-btn" onClick={() => setOverride(k, '')} aria-label={t('ใช้วันเริ่มต้น', 'Use default')}>
                        <X weight="bold" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {saved && !error && <p className="dream__saved">{saved}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function DreamHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="quiz__top">
      <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
        ←
      </button>
      <div className="quiz__progress">
        <Target weight="fill" className="ico" /> {t('คณะในฝัน', 'Dream faculty')}
      </div>
    </header>
  );
}

function GoalEditor({
  initial,
  busy,
  error,
  onCancel,
  onSave,
}: {
  initial: DreamGoal;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (g: DreamGoal) => void;
}) {
  const [university, setUniversity] = useState(initial.university);
  const [faculty, setFaculty] = useState(initial.faculty);
  const [target, setTarget] = useState(String(initial.target));
  const [rows, setRows] = useState<{ key: string; w: string }[]>(
    Object.keys(initial.weights).length ? Object.entries(initial.weights).map(([key, w]) => ({ key, w: String(w) })) : [{ key: 'tgat', w: '' }],
  );
  const [localError, setLocalError] = useState('');

  const sum = rows.reduce((s, r) => s + (Number(r.w) || 0), 0);
  const free = TCAS_SUBJECTS.filter((s) => !rows.some((r) => r.key === s.key));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const weights: Record<string, number> = {};
    for (const r of rows) {
      const w = Number(r.w);
      if (!Number.isInteger(w) || w < 1 || w > 100) {
        setLocalError(t(`ค่าน้ำหนัก ${subjectName(r.key)} ต้องเป็นจำนวนเต็ม 1-100`, `${subjectName(r.key)} weight must be a whole number 1-100`));
        return;
      }
      weights[r.key] = w;
    }
    if (sum !== 100) {
      setLocalError(t(`ค่าน้ำหนักรวมตอนนี้ ${sum}% ต้องได้ 100%`, `Weights add up to ${sum}%, they must total 100%`));
      return;
    }
    const tg = Number(target);
    if (!faculty.trim() || !Number.isFinite(tg) || tg < 0 || tg > 100) {
      setLocalError(t('กรอกชื่อคณะและคะแนนเป้าหมาย (0-100) ให้ครบ', 'Fill in the faculty and a target score (0-100)'));
      return;
    }
    onSave({ university: university.trim().slice(0, 80), faculty: faculty.trim().slice(0, 80), target: Math.round(tg * 100) / 100, weights });
  };

  return (
    <div className="screen dream">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label={t('ยกเลิก', 'Cancel')}>
          ←
        </button>
        <div className="quiz__progress">
          <GraduationCap weight="fill" className="ico" /> {t('ตั้งเป้าหมาย', 'Set a goal')}
        </div>
      </header>
      <form className="settings-card dream-edit" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field__label">{t('คณะ / สาขา', 'Faculty / major')}</span>
          <input className="field__input" value={faculty} maxLength={80} onChange={(e) => setFaculty(e.target.value)} placeholder={t('เช่น วิศวกรรมศาสตร์ คอมพิวเตอร์', 'e.g. Computer Engineering')} />
        </label>
        <label className="field">
          <span className="field__label">{t('มหาวิทยาลัย', 'University')}</span>
          <input className="field__input" value={university} maxLength={80} onChange={(e) => setUniversity(e.target.value)} placeholder={t('เช่น จุฬาลงกรณ์มหาวิทยาลัย', 'e.g. Chulalongkorn University')} />
        </label>
        <label className="field">
          <span className="field__label">{t('คะแนนรวมที่ต้องการ (เต็ม 100)', 'Target score (out of 100)')}</span>
          <input className="field__input" type="number" inputMode="decimal" step="any" min={0} max={100} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>

        <div className="dream-edit__weights">
          <span className="field__label">{t('ค่าน้ำหนักรายวิชา', 'Subject weights')}</span>
          <p className="muted dream__note">
            {t('ดูจากประกาศเกณฑ์ของคณะ (เช่น ใน mytcas.com) แล้วกรอกเอง ระบบไม่เดาตัวเลขให้', "Copy them from the faculty's official criteria (e.g. on mytcas.com). The app never guesses them.")}
          </p>
          {rows.map((r, i) => (
            <div key={i} className="dream-edit__row">
              <select
                value={r.key}
                onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, key: e.target.value } : x)))}
                aria-label={t('วิชา', 'Subject')}
              >
                {[TCAS_BY_KEY[r.key], ...free].map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.group === 'A-Level' ? 'A-Level ' : ''}
                    {s.name()}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={r.w}
                placeholder="%"
                onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, w: e.target.value } : x)))}
                aria-label={t('ค่าน้ำหนัก %', 'Weight %')}
              />
              <button type="button" className="icon-btn" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} disabled={rows.length === 1} aria-label={t('ลบวิชา', 'Remove subject')}>
                <X weight="bold" />
              </button>
            </div>
          ))}
          {free.length > 0 && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setRows((rs) => [...rs, { key: free[0].key, w: '' }])}>
              <Plus weight="bold" className="ico" /> {t('เพิ่มวิชา', 'Add subject')}
            </button>
          )}
          <p className={`dream-edit__sum ${sum === 100 ? 'is-ok' : ''}`}>
            {t('รวม', 'Total')} {sum}% / 100%
          </p>
        </div>

        {(localError || error) && <p className="form-error">{localError || error}</p>}
        <button type="submit" className="btn btn--primary btn--block btn--big" disabled={busy}>
          {t('บันทึกเป้าหมาย', 'Save goal')}
        </button>
      </form>
    </div>
  );
}

