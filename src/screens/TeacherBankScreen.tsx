import { useEffect, useMemo, useState } from 'react';
import { Books, MagicWand, PencilSimple, Plus, Sparkle, Trash } from '@phosphor-icons/react';
import type { Level, Subject } from '../types';
import { LEVELS, difficultyText, subjectInfo } from '../data/subjects';
import { chapterName } from '../data/chapters';
import { MathText } from '../components/MathText';
import { QuestionEditor } from '../components/QuestionEditor';
import { t } from '../lib/i18n';
import {
  blankQuestion,
  checkQuestion,
  deleteQuestion,
  fetchAiQuota,
  fetchMyQuestions,
  generateDrafts,
  saveQuestion,
  type TeacherQuestion,
} from '../lib/teacherBank';

interface Props {
  onBack: () => void;
}

type Tab = 'bank' | 'ai';

/** คลังโจทย์ของครู: เขียนเอง / ให้ AI ร่าง (ตรวจแก้ก่อนบันทึก) ใช้สั่งการบ้านในห้องของตัวเอง */
export function TeacherBankScreen({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('bank');
  const [list, setList] = useState<TeacherQuestion[] | null>(null);
  const [editing, setEditing] = useState<TeacherQuestion | null>(null);
  const [filter, setFilter] = useState<Subject | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const reload = () =>
    fetchMyQuestions()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void reload();
  }, []);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => (list ?? []).filter((q) => filter === 'all' || q.subject === filter), [list, filter]);
  const subjects = useMemo(() => [...new Set((list ?? []).map((q) => q.subject))], [list]);

  if (editing) {
    return (
      <div className="screen teacher-bank">
        <Header onBack={() => setEditing(null)} title={editing.id ? t('แก้โจทย์', 'Edit question') : t('เขียนโจทย์ใหม่', 'New question')} />
        <section className="settings-card">
          <QuestionEditor value={editing} onChange={setEditing} />
        </section>
        <button
          type="button"
          className="btn btn--primary btn--block btn--big"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await saveQuestion(editing);
              setEditing(null);
              await reload();
              return t('บันทึกแล้ว', 'Saved');
            })
          }
        >
          {t('บันทึกเข้าคลัง', 'Save to my bank')}
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="screen teacher-bank">
      <Header onBack={onBack} title={t('คลังโจทย์ของฉัน', 'My question bank')} />
      <div className="segmented teacher-bank__tabs">
        <button type="button" className={`segmented__opt ${tab === 'bank' ? 'is-active' : ''}`} onClick={() => setTab('bank')}>
          <Books weight="fill" className="ico" /> {t(`คลัง (${list?.length ?? 0})`, `Bank (${list?.length ?? 0})`)}
        </button>
        <button type="button" className={`segmented__opt ${tab === 'ai' ? 'is-active' : ''}`} onClick={() => setTab('ai')}>
          <MagicWand weight="fill" className="ico" /> {t('ให้ AI ช่วย', 'Ask AI')}
        </button>
      </div>

      {tab === 'bank' ? (
        <>
          <button type="button" className="btn btn--primary btn--block" onClick={() => setEditing(blankQuestion('upper', 'math'))}>
            <Plus weight="bold" className="ico" /> {t('เขียนโจทย์เอง', 'Write a question')}
          </button>
          {subjects.length > 1 && (
            <div className="chapter-picker teacher-bank__filter">
              <button type="button" className={`chapter-chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
                {t('ทั้งหมด', 'All')}
              </button>
              {subjects.map((s) => (
                <button key={s} type="button" className={`chapter-chip ${filter === s ? 'is-active' : ''}`} onClick={() => setFilter(s)}>
                  {subjectInfo(s).name}
                </button>
              ))}
            </div>
          )}
          {list?.length === 0 && (
            <p className="muted teacher-bank__empty">
              {t('ยังไม่มีโจทย์ เขียนเอง หรือไปที่แท็บ "ให้ AI ช่วย" เพื่อร่างโจทย์ทีละหลายข้อ', 'No questions yet. Write one, or use "Ask AI" to draft several at once.')}
            </p>
          )}
          <ul className="teacher-bank__list">
            {shown.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                actions={
                  <>
                    <button type="button" className="icon-btn" onClick={() => setEditing(q)} aria-label={t('แก้ไข', 'Edit')}>
                      <PencilSimple weight="bold" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={busy}
                      aria-label={t('ลบ', 'Delete')}
                      onClick={() =>
                        window.confirm(t('ลบโจทย์ข้อนี้?', 'Delete this question?')) &&
                        run(async () => {
                          await deleteQuestion(q.id!);
                          await reload();
                        })
                      }
                    >
                      <Trash weight="bold" />
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <AiPanel
          busy={busy}
          run={run}
          onSaved={async () => {
            await reload();
          }}
        />
      )}
      {msg && <p className="dream__saved">{msg}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="quiz__top">
      <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
        ←
      </button>
      <div className="quiz__progress">
        <Books weight="fill" className="ico" /> {title}
      </div>
    </header>
  );
}

const CHOICE = ['ก', 'ข', 'ค', 'ง'];

/** การ์ดแสดงโจทย์ + เฉลย */
function QuestionCard({ q, actions }: { q: TeacherQuestion; actions: React.ReactNode }) {
  const info = subjectInfo(q.subject, q.level);
  return (
    <li className="tq-card">
      <div className="tq-card__head">
        <span className="tq-card__tags">
          <info.icon weight="fill" size={14} color={info.color} /> {info.name} · {LEVELS[q.level].short} · {difficultyText(q.difficulty)}
          {q.chapter && ` · ${chapterName(q.chapter)}`}
          {q.source === 'ai' && (
            <b className="tq-card__ai">
              <Sparkle weight="fill" size={11} /> AI
            </b>
          )}
        </span>
        <span className="tq-card__actions">{actions}</span>
      </div>
      <MathText className="tq-card__prompt" text={q.prompt} />
      {q.type === 'mcq' ? (
        <ol className="tq-card__choices">
          {q.choices.map((c, i) => (
            <li key={i} className={i === q.answerIndex ? 'is-answer' : ''}>
              <b>{CHOICE[i]}.</b> <MathText text={c} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="tq-card__fill">
          {t('เฉลย', 'Answer')}:{' '}
          <b>
            {q.answer.kind === 'number'
              ? `${q.answer.value}${q.answer.unit ? ` ${q.answer.unit}` : ''}${q.answer.tolerance ? ` (±${q.answer.tolerance})` : ''}`
              : q.answer.accepted.join(' / ')}
          </b>
        </p>
      )}
    </li>
  );
}

function AiPanel({ busy, run, onSaved }: { busy: boolean; run: (fn: () => Promise<string | void>) => Promise<void>; onSaved: () => Promise<void> }) {
  const [level, setLevel] = useState<Level>('upper');
  const [subject, setSubject] = useState<Subject>('math');
  const [request, setRequest] = useState('');
  const [count, setCount] = useState(5);
  const [type, setType] = useState<'mix' | 'mcq' | 'fill'>('mix');
  const [drafts, setDrafts] = useState<TeacherQuestion[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    fetchAiQuota().then(setQuota).catch(() => {});
  }, []);

  const saveOne = async (i: number) => {
    await saveQuestion(drafts[i]);
    setDrafts((d) => d.filter((_, k) => k !== i));
    setOpen(null);
    await onSaved();
  };

  return (
    <>
      <section className="settings-card ai-panel">
        <div className="q-edit__row">
          <select
            value={level}
            onChange={(e) => {
              const l = e.target.value as Level;
              setLevel(l);
              setSubject(LEVELS[l].subjects[0]);
            }}
            aria-label={t('ระดับชั้น', 'Level')}
          >
            {(Object.keys(LEVELS) as Level[]).map((l) => (
              <option key={l} value={l}>
                {LEVELS[l].name}
              </option>
            ))}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} aria-label={t('วิชา', 'Subject')}>
            {LEVELS[level].subjects.map((s) => (
              <option key={s} value={s}>
                {subjectInfo(s, level).name}
              </option>
            ))}
          </select>
        </div>
        <label className="q-edit__field">
          <span>{t('อยากได้โจทย์แบบไหน', 'What questions do you want?')}</span>
          <textarea
            value={request}
            rows={3}
            maxLength={500}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t('เช่น โจทย์ปัญหาตรีโกณมิติ ม.5 ระดับยาก เน้นการหาความสูงตึกด้วยมุมเงย', 'e.g. Grade 11 trigonometry word problems, hard, using angles of elevation')}
          />
        </label>
        <div className="q-edit__row">
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label={t('จำนวนข้อ', 'Number of questions')}>
            {[3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {t(`${n} ข้อ`, `${n} questions`)}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as 'mix' | 'mcq' | 'fill')} aria-label={t('ชนิดโจทย์', 'Question type')}>
            <option value="mix">{t('ผสม', 'Mixed')}</option>
            <option value="mcq">{t('ปรนัยทั้งหมด', 'All multiple choice')}</option>
            <option value="fill">{t('เติมคำทั้งหมด', 'All fill-in')}</option>
          </select>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy || request.trim().length < 3 || (quota !== null && quota.used >= quota.limit)}
          onClick={() =>
            run(async () => {
              const r = await generateDrafts({ level, subject, request: request.trim(), count, type });
              setDrafts(r.drafts);
              setQuota({ used: r.used, limit: r.limit });
              setOpen(null);
              return t(`AI ร่างมา ${r.drafts.length} ข้อ ตรวจแล้วกดบันทึกข้อที่ใช้ได้`, `AI drafted ${r.drafts.length}. Check them, then save the good ones.`);
            })
          }
        >
          <MagicWand weight="fill" className="ico" /> {busy ? t('AI กำลังคิดโจทย์...', 'AI is writing...') : t('ให้ AI ร่างโจทย์', 'Draft with AI')}
        </button>
        {quota && (
          <p className="muted ai-panel__quota">
            {t(`เหลือ ${Math.max(0, quota.limit - quota.used)}/${quota.limit} ครั้งวันนี้ · AI อาจผิดได้ ตรวจเฉลยทุกข้อก่อนใช้`, `${Math.max(0, quota.limit - quota.used)}/${quota.limit} left today · AI can be wrong, check every answer`)}
          </p>
        )}
      </section>

      {drafts.length > 0 && (
        <>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const bad = drafts.findIndex((d) => checkQuestion(d));
                if (bad >= 0) {
                  setOpen(bad);
                  throw new Error(t(`ข้อ ${bad + 1}: ${checkQuestion(drafts[bad])}`, `Draft ${bad + 1}: ${checkQuestion(drafts[bad])}`));
                }
                for (const d of drafts) await saveQuestion(d);
                const n = drafts.length;
                setDrafts([]);
                await onSaved();
                return t(`บันทึกทั้งหมด ${n} ข้อแล้ว`, `Saved all ${n}`);
              })
            }
          >
            {t(`บันทึกทั้งหมด ${drafts.length} ข้อ`, `Save all ${drafts.length}`)}
          </button>
          <ul className="teacher-bank__list">
            {drafts.map((d, i) =>
              open === i ? (
                <li key={i} className="tq-card tq-card--edit">
                  <QuestionEditor value={d} onChange={(q) => setDrafts((all) => all.map((x, k) => (k === i ? q : x)))} />
                  <div className="q-edit__row">
                    <button type="button" className="btn btn--ghost" onClick={() => setOpen(null)}>
                      {t('เสร็จ', 'Done')}
                    </button>
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => run(async () => void (await saveOne(i)))}>
                      {t('บันทึกข้อนี้', 'Save this one')}
                    </button>
                  </div>
                </li>
              ) : (
                <QuestionCard
                  key={i}
                  q={d}
                  actions={
                    <>
                      <button type="button" className="icon-btn" onClick={() => setOpen(i)} aria-label={t('แก้ไข', 'Edit')}>
                        <PencilSimple weight="bold" />
                      </button>
                      <button type="button" className="icon-btn" aria-label={t('ทิ้ง', 'Discard')} onClick={() => setDrafts((all) => all.filter((_, k) => k !== i))}>
                        <Trash weight="bold" />
                      </button>
                    </>
                  }
                />
              ),
            )}
          </ul>
        </>
      )}
    </>
  );
}
