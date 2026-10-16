import { useCallback, useEffect, useState } from 'react';
import { Chalkboard, ChalkboardTeacher, CheckCircle, Clock, Megaphone, NotePencil, ShareNetwork, ShieldCheck, Trash, UserMinus, Users, Books } from '@phosphor-icons/react';
import type { Difficulty, Level, Subject, Track } from '../types';
import { DIFFICULTY_OPTIONS, LEVEL_KEYS, LEVELS, difficultyText, settingsLabel, subjectInfo, subjectOptions } from '../data/subjects';
import { chapterName } from '../data/chapters';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { AsyncPlayScreen } from './AsyncPlayScreen';
import { createHomework, startHomework } from '../lib/asyncPlay';
import { fetchMyQuestions, type TeacherQuestion } from '../lib/teacherBank';
import { TeacherBankScreen } from './TeacherBankScreen';
import { MathText } from '../components/MathText';
import { t } from '../lib/i18n';
import {
  createClass,
  deleteClass,
  deleteHomework,
  fetchClass,
  fetchMyClasses,
  fetchStudent,
  joinClass,
  leaveClass,
  setAnnouncement,
  type ClassListing,
  type StudentClassView,
  type StudentDetail,
  type TeacherClassView,
} from '../lib/classroom';

interface Props {
  onBack: () => void;
  onXpAwarded: () => void;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(t('th-TH', 'en-GB'), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const pct = (x: number | null) => (x === null ? '-' : `${Math.round(x * 100)}%`);

function dueText(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  if (ms < 0) return t('เลยกำหนดแล้ว', 'Past due');
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? t(`เหลือ ${Math.round(h / 24)} วัน`, `${Math.round(h / 24)}d left`) : t(`เหลือ ${Math.max(1, h)} ชม.`, `${Math.max(1, h)}h left`);
}

/** ห้องเรียนครู: นักเรียนเข้าด้วยรหัส + ยินยอม, ครูสั่งการบ้านและดูสถิติ */
export function ClassroomScreen({ onBack, onXpAwarded }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [bank, setBank] = useState(false);
  if (bank) return <TeacherBankScreen onBack={() => setBank(false)} />;
  return openId ? (
    <ClassView id={openId} onBack={() => setOpenId(null)} onXpAwarded={onXpAwarded} onOpenBank={() => setBank(true)} />
  ) : (
    <ClassList onBack={onBack} onOpen={setOpenId} onOpenBank={() => setBank(true)} />
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="quiz__top">
      <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
        ←
      </button>
      <div className="quiz__progress">
        <Chalkboard weight="fill" className="ico" /> {title}
      </div>
    </header>
  );
}

function ClassList({ onBack, onOpen, onOpenBank }: { onBack: () => void; onOpen: (id: string) => void; onOpenBank: () => void }) {
  const [list, setList] = useState<ClassListing | null>(null);
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyClasses().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError('');
    try {
      onOpen(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen classroom">
      <Header onBack={onBack} title={t('ห้องเรียน', 'Classroom')} />
      {list && list.joined.length > 0 && (
        <section className="settings-card">
          <h2 className="section-title section-title--dark">{t('ห้องที่เรียนอยู่', 'My classes')}</h2>
          <ul className="class-list">
            {list.joined.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(c.id)}>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{t(`ครู ${c.teacher ?? '-'}`, `Teacher ${c.teacher ?? '-'}`)}</small>
                  </span>
                  {c.pending > 0 && <b className="class-list__badge">{t(`การบ้าน ${c.pending}`, `${c.pending} due`)}</b>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="settings-card class-join"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => joinClass(code, consent));
        }}
      >
        <h2 className="section-title section-title--dark">{t('เข้าห้องเรียน', 'Join a class')}</h2>
        <input className="field__input" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('รหัสห้องจากครู', 'Code from your teacher')} />
        <label className="class-join__consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            <ShieldCheck weight="fill" className="ico" />{' '}
            {t(
              'ยินยอมให้ครูของห้องนี้เห็นสถิติการฝึกรายบทและผลการบ้านของฉัน (นับเฉพาะหลังเข้าห้อง) ออกจากห้องเมื่อไหร่ ครูจะเห็นไม่ได้อีก',
              "I allow this class's teacher to see my chapter practice stats and homework results (only from when I join). If I leave, the teacher loses access.",
            )}
          </span>
        </label>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || code.trim().length < 6 || !consent}>
          {t('เข้าห้อง', 'Join')}
        </button>
      </form>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <ChalkboardTeacher weight="fill" className="ico" /> {t('สำหรับครู', 'For teachers')}
        </h2>
        <button type="button" className="btn btn--ghost btn--block class-bank-btn" onClick={onOpenBank}>
          <Books weight="fill" className="ico" /> {t('คลังโจทย์ของฉัน (เขียนเอง / ให้ AI ช่วย)', 'My question bank (write / ask AI)')}
        </button>
        {list && list.teaching.length > 0 && (
          <ul className="class-list">
            {list.teaching.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(c.id)}>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {t('รหัส', 'Code')} {c.code} · {c.students} {t('คน', 'students')}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="class-create"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => createClass(name.trim()));
          }}
        >
          <input className="field__input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t('ชื่อห้อง เช่น ม.5/2 คณิต', 'Class name, e.g. Grade 11 Math')} />
          <button type="submit" className="btn btn--ghost" disabled={busy || name.trim().length < 2}>
            {t('สร้างห้อง', 'Create')}
          </button>
        </form>
      </section>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function ClassView({ id, onBack, onXpAwarded, onOpenBank }: { id: string; onBack: () => void; onXpAwarded: () => void; onOpenBank: () => void }) {
  const [view, setView] = useState<StudentClassView | TeacherClassView | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => fetchClass(id).then(setView).catch((e) => setError(e instanceof Error ? e.message : String(e))), [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!view)
    return (
      <div className="screen classroom">
        <Header onBack={onBack} title={t('ห้องเรียน', 'Classroom')} />
        {error ? <p className="form-error">{error}</p> : <p className="muted analysis__loading">{t('กำลังโหลด...', 'Loading...')}</p>}
      </div>
    );
  return view.role === 'teacher' ? (
    <TeacherView view={view} onBack={onBack} reload={reload} onOpenBank={onOpenBank} />
  ) : (
    <StudentView view={view} onBack={onBack} reload={reload} onXpAwarded={onXpAwarded} />
  );
}

function Announcement({ text, at }: { text: string; at: string | null }) {
  if (!text) return null;
  return (
    <section className="settings-card class-ann">
      <Megaphone weight="fill" size={22} />
      <div>
        <p>{text}</p>
        {at && <small className="muted">{fmt(at)}</small>}
      </div>
    </section>
  );
}

function StudentView({ view, onBack, reload, onXpAwarded }: { view: StudentClassView; onBack: () => void; reload: () => void; onXpAwarded: () => void }) {
  const [play, setPlay] = useState<{ playId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (play)
    return (
      <AsyncPlayScreen
        playId={play.playId}
        title={play.title}
        onQuit={() => {
          setPlay(null);
          reload();
        }}
        onDone={(r) => {
          setPlay(null);
          if (r.xp) onXpAwarded();
          reload();
        }}
      />
    );

  const start = async (hwId: string, title: string) => {
    setBusy(true);
    setError('');
    try {
      setPlay({ playId: (await startHomework(hwId)).playId, title });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen classroom">
      <Header onBack={onBack} title={view.name} />
      <p className="muted class-sub">{t(`ครู ${view.teacher ?? '-'}`, `Teacher ${view.teacher ?? '-'}`)}</p>
      <Announcement text={view.announcement} at={view.announcedAt} />
      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <NotePencil weight="fill" className="ico" /> {t('การบ้าน', 'Homework')}
        </h2>
        {view.homework.length === 0 && <p className="muted">{t('ยังไม่มีการบ้าน', 'No homework yet')}</p>}
        <ul className="hw-list">
          {view.homework.map((h) => {
            const late = Date.parse(h.dueAt) < Date.now();
            return (
              <li key={h.id} className={h.done ? 'is-done' : late ? 'is-late' : ''}>
                <span className="hw-list__text">
                  <strong>{h.title}</strong>
                  <small>
                    {h.settings.custom ? t('โจทย์ของครู', "Teacher's questions") : `${settingsLabel(h.settings)} · ${difficultyText(h.settings.difficulty)}`} · {h.count} {t('ข้อ', 'Qs')}
                  </small>
                  <small>
                    <Clock weight="bold" size={12} /> {fmt(h.dueAt)} · {dueText(h.dueAt)}
                  </small>
                </span>
                {h.done ? (
                  <b className="hw-list__score">
                    <CheckCircle weight="fill" /> {h.correct}/{h.count}
                  </b>
                ) : late && !h.started ? (
                  <span className="muted">{t('ไม่ได้ส่ง', 'Missed')}</span>
                ) : (
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={() => start(h.id, h.title)}>
                    {h.started ? t('ทำต่อ', 'Resume') : t('ทำเลย', 'Start')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="muted class-consent">
        <ShieldCheck weight="fill" className="ico" /> {t(`ยินยอมให้ครูเห็นสถิติเมื่อ ${fmt(view.consentedAt)}`, `Consented to share stats on ${fmt(view.consentedAt)}`)}
      </p>
      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={async () => {
          if (!window.confirm(t('ออกจากห้องนี้? ครูจะเห็นสถิติของคุณไม่ได้อีก', 'Leave this class? The teacher will no longer see your stats.'))) return;
          try {
            await leaveClass(view.id);
            onBack();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        {t('ออกจากห้อง', 'Leave class')}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

const inDays = (d: number) => {
  const x = new Date(Date.now() + d * 86_400_000);
  x.setHours(20, 0, 0, 0);
  const local = new Date(x.getTime() - x.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function TeacherView({ view, onBack, reload, onOpenBank }: { view: TeacherClassView; onBack: () => void; reload: () => void; onOpenBank: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ann, setAnn] = useState(view.announcement);
  const [hwOpen, setHwOpen] = useState(false);
  const [student, setStudent] = useState<{ id: string; name: string; detail: StudentDetail | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = t(`เข้าห้องเรียน "${view.name}" ใน Brain Gym รหัสห้อง: ${view.code}`, `Join my class "${view.name}" on Brain Gym. Class code: ${view.code}`);
    try {
      if (navigator.share) await navigator.share({ title: 'Brain Gym', text, url: location.origin });
      else {
        await navigator.clipboard.writeText(`${text}\n${location.origin}`);
        setCopied(true);
      }
    } catch {
      /* ผู้ใช้ยกเลิก */
    }
  };

  if (student)
    return (
      <div className="screen classroom">
        <Header onBack={() => setStudent(null)} title={student.name} />
        {!student.detail && <p className="muted analysis__loading">{t('กำลังโหลด...', 'Loading...')}</p>}
        {student.detail && (
          <>
            <section className="settings-card">
              <h2 className="section-title section-title--dark">{t('รายบท (หลังเข้าห้อง)', 'By chapter (since joining)')}</h2>
              {student.detail.chapters.length === 0 && <p className="muted">{t('ยังไม่ได้ฝึกหลังเข้าห้อง', 'No practice since joining')}</p>}
              <ul className="class-stats">
                {student.detail.chapters.map((c) => (
                  <li key={c.chapter}>
                    <span>{chapterName(c.chapter) ?? c.chapter}</span>
                    <span className={`class-stats__acc ${c.accuracy < 0.5 ? 'is-low' : c.accuracy >= 0.8 ? 'is-high' : ''}`}>
                      {pct(c.accuracy)} <small>({c.answers})</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="settings-card">
              <h2 className="section-title section-title--dark">{t('การบ้าน', 'Homework')}</h2>
              <ul className="class-stats">
                {student.detail.homework.map((h, i) => (
                  <li key={i}>
                    <span>{h.title}</span>
                    <span>{h.done ? `${h.correct}/${h.count}` : t('ยังไม่ส่ง', 'Not done')}</span>
                  </li>
                ))}
              </ul>
            </section>
            <button
              type="button"
              className="btn btn--ghost btn--block class-remove"
              disabled={busy}
              onClick={() =>
                window.confirm(t(`เชิญ ${student.name} ออกจากห้อง?`, `Remove ${student.name} from the class?`)) &&
                act(async () => {
                  await leaveClass(view.id, student.id);
                  setStudent(null);
                })
              }
            >
              <UserMinus weight="bold" className="ico" /> {t('เชิญออกจากห้อง', 'Remove from class')}
            </button>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    );

  return (
    <div className="screen classroom">
      <Header onBack={onBack} title={view.name} />
      <section className="settings-card clan-head__code class-code">
        <span>{t('รหัสห้อง', 'Class code')}</span>
        <b>{view.code}</b>
        <button type="button" className="btn btn--primary" onClick={share}>
          <ShareNetwork weight="bold" className="ico" /> {copied ? t('คัดลอกแล้ว', 'Copied') : t('แชร์', 'Share')}
        </button>
      </section>

      <section className="settings-card class-ann-edit">
        <h2 className="section-title section-title--dark">
          <Megaphone weight="fill" className="ico" /> {t('ประกาศถึงนักเรียน', 'Announcement')}
        </h2>
        <textarea value={ann} maxLength={300} rows={3} onChange={(e) => setAnn(e.target.value)} placeholder={t('เช่น ส่งการบ้านภายในวันศุกร์นะ', 'e.g. Homework due Friday')} />
        <button type="button" className="btn btn--ghost btn--block" disabled={busy || ann === view.announcement} onClick={() => act(() => setAnnouncement(view.id, ann))}>
          {t('บันทึกประกาศ', 'Save announcement')}
        </button>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <NotePencil weight="fill" className="ico" /> {t('การบ้าน', 'Homework')}
        </h2>
        {hwOpen ? (
          <HomeworkForm
            busy={busy}
            onCancel={() => setHwOpen(false)}
            onOpenBank={onOpenBank}
            onSubmit={(title, settings, dueAt, questionIds) =>
              act(async () => {
                await createHomework(view.id, title, settings, dueAt, questionIds);
                setHwOpen(false);
              })
            }
          />
        ) : (
          <button type="button" className="btn btn--primary btn--block" onClick={() => setHwOpen(true)}>
            {t('สั่งการบ้านใหม่', 'New homework')}
          </button>
        )}
        <ul className="hw-list">
          {view.homework.map((h) => (
            <li key={h.id}>
              <span className="hw-list__text">
                <strong>{h.title}</strong>
                <small>
                  {h.settings.custom ? t('โจทย์ของครู', "Teacher's questions") : `${settingsLabel(h.settings)} · ${difficultyText(h.settings.difficulty)}`} · {h.count} {t('ข้อ', 'Qs')}
                </small>
                <small>
                  <Clock weight="bold" size={12} /> {fmt(h.dueAt)} · {dueText(h.dueAt)}
                </small>
              </span>
              <span className="hw-list__stat">
                <b>
                  {h.done}/{view.students.length}
                </b>
                <small>{h.avgCorrect !== null ? t(`เฉลี่ย ${h.avgCorrect}/${h.count}`, `avg ${h.avgCorrect}/${h.count}`) : t('ส่งแล้ว', 'done')}</small>
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={busy}
                aria-label={t('ลบการบ้าน', 'Delete homework')}
                onClick={() => window.confirm(t(`ลบการบ้าน "${h.title}"? ผลของนักเรียนจะหายด้วย`, `Delete "${h.title}"? Student results will be lost.`)) && act(() => deleteHomework(h.id))}
              >
                <Trash weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {view.weakChapters.length > 0 && (
        <section className="settings-card">
          <h2 className="section-title section-title--dark">{t('บทที่ทั้งห้องยังอ่อน', 'Weakest chapters for the class')}</h2>
          <ul className="class-stats">
            {view.weakChapters.map((c) => (
              <li key={c.chapter}>
                <span>{chapterName(c.chapter) ?? c.chapter}</span>
                <span className={`class-stats__acc ${c.accuracy < 0.5 ? 'is-low' : ''}`}>
                  {pct(c.accuracy)} <small>({c.answers})</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <Users weight="fill" className="ico" /> {t(`นักเรียน ${view.students.length} คน`, `${view.students.length} students`)}
        </h2>
        {view.students.length === 0 && <p className="muted">{t('ยังไม่มีนักเรียน แชร์รหัสห้องให้นักเรียนได้เลย', 'No students yet. Share the class code.')}</p>}
        <ul className="class-students">
          {view.students.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setStudent({ id: s.id, name: s.nickname, detail: null });
                  fetchStudent(view.id, s.id)
                    .then((detail) => setStudent((x) => (x && x.id === s.id ? { ...x, detail } : x)))
                    .catch((e) => setError(e instanceof Error ? e.message : String(e)));
                }}
              >
                <PlayerAvatar code={s.avatar} size={36} />
                <span className="class-students__name">
                  <strong>
                    {s.nickname}
                    <small>#{s.tag}</small>
                  </strong>
                  <small>
                    {t(`ฝึก ${s.answers} ข้อ`, `${s.answers} answers`)} · {t('ถูก', 'acc')} {pct(s.accuracy)} · {t(`การบ้าน ${s.hwDone}/${view.homework.length}`, `hw ${s.hwDone}/${view.homework.length}`)}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="btn btn--ghost btn--block class-remove"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(t('ลบห้องเรียนนี้? การบ้านและผลทั้งหมดจะหายไป', 'Delete this class? All homework and results will be lost.'))) return;
          try {
            await deleteClass(view.id);
            onBack();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        <Trash weight="bold" className="ico" /> {t('ลบห้องเรียน', 'Delete class')}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function HomeworkForm({
  busy,
  onCancel,
  onSubmit,
  onOpenBank,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (
    title: string,
    settings: { subject: Subject | 'all'; difficulty: Difficulty; track: Track; level: Level; count: number },
    dueAt: string,
    questionIds: string[],
  ) => void;
  onOpenBank: () => void;
}) {
  const [source, setSource] = useState<'bank' | 'mine'>('bank');
  const [mine, setMine] = useState<TeacherQuestion[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [mineFilter, setMineFilter] = useState<Subject | 'all'>('all');
  useEffect(() => {
    if (source === 'mine' && mine === null) fetchMyQuestions().then(setMine).catch(() => setMine([]));
  }, [source, mine]);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<Level>('upper');
  const [subject, setSubject] = useState<Subject | 'all'>('all');
  const [track, setTrack] = useState<Track>('school');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(10);
  const [due, setDue] = useState(inDays(3));

  return (
    <form
      className="hw-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(title.trim(), { subject, difficulty, track, level, count }, new Date(due).toISOString(), source === 'mine' ? picked : []);
      }}
    >
      <input className="field__input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t('ชื่อการบ้าน เช่น ทบทวนตรรกศาสตร์', 'Title, e.g. Logic review')} />
      <div className="segmented">
        <button type="button" className={`segmented__opt ${source === 'bank' ? 'is-active' : ''}`} onClick={() => setSource('bank')}>
          {t('สุ่มจากคลังกลาง', 'Random from app bank')}
        </button>
        <button type="button" className={`segmented__opt ${source === 'mine' ? 'is-active' : ''}`} onClick={() => setSource('mine')}>
          {t('เลือกจากคลังของฉัน', 'Pick from my bank')}
        </button>
      </div>
      {source === 'mine' ? (
        <div className="hw-pick">
          {mine === null && <p className="muted">{t('กำลังโหลด...', 'Loading...')}</p>}
          {mine?.length === 0 && (
            <p className="muted">
              {t('คลังของคุณยังว่าง', 'Your bank is empty.')}{' '}
              <button type="button" className="dream-goal__toggle" onClick={onOpenBank}>
                {t('ไปสร้างโจทย์', 'Create questions')}
              </button>
            </p>
          )}
          {mine && mine.length > 0 && (
            <>
              <div className="hw-pick__bar">
                <select value={mineFilter} onChange={(e) => setMineFilter(e.target.value as Subject | 'all')} aria-label={t('กรองวิชา', 'Filter subject')}>
                  <option value="all">{t('ทุกวิชา', 'All subjects')}</option>
                  {[...new Set(mine.map((q) => q.subject))].map((sub) => (
                    <option key={sub} value={sub}>
                      {subjectInfo(sub).name}
                    </option>
                  ))}
                </select>
                <b>{t(`เลือกแล้ว ${picked.length}/30`, `${picked.length}/30 picked`)}</b>
              </div>
              <ul className="hw-pick__list">
                {mine
                  .filter((q) => mineFilter === 'all' || q.subject === mineFilter)
                  .map((q) => {
                    const on = picked.includes(q.id!);
                    return (
                      <li key={q.id}>
                        <label className={on ? 'is-on' : ''}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!on && picked.length >= 30}
                            onChange={() => setPicked((p) => (on ? p.filter((x) => x !== q.id) : [...p, q.id!]))}
                          />
                          <MathText className="hw-pick__prompt" text={q.prompt} />
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
        </div>
      ) : (
      <>
      <div className="hw-form__row">
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as Level);
            setSubject('all');
            setTrack('school');
          }}
          aria-label={t('ระดับชั้น', 'Level')}
        >
          {LEVEL_KEYS.map((l) => (
            <option key={l} value={l}>
              {LEVELS[l].name}
            </option>
          ))}
        </select>
        <select value={subject} onChange={(e) => setSubject(e.target.value as Subject | 'all')} aria-label={t('วิชา', 'Subject')}>
          {subjectOptions(level).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="hw-form__row">
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} aria-label={t('ความยาก', 'Difficulty')}>
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select value={track} onChange={(e) => setTrack(e.target.value as Track)} aria-label={t('แนวข้อสอบ', 'Track')}>
          {LEVELS[level].tracks.map((tr) => (
            <option key={tr.value} value={tr.value}>
              {tr.label}
            </option>
          ))}
        </select>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label={t('จำนวนข้อ', 'Questions')}>
          {[5, 10, 20].map((n) => (
            <option key={n} value={n}>
              {t(`${n} ข้อ`, `${n} Qs`)}
            </option>
          ))}
        </select>
      </div>
      </>
      )}
      <label className="hw-form__due">
        <span>{t('กำหนดส่ง', 'Due')}</span>
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="hw-form__row">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('ยกเลิก', 'Cancel')}
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy || !title.trim() || !due || (source === 'mine' && picked.length === 0)}>
          {busy ? t('กำลังเตรียมโจทย์...', 'Preparing...') : t('สั่งการบ้าน', 'Assign')}
        </button>
      </div>
    </form>
  );
}
