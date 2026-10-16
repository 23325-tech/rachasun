import { useCallback, useEffect, useState } from 'react';
import { CloudArrowUp, DownloadSimple, Package, Play, Trash, WifiHigh, WifiSlash } from '@phosphor-icons/react';
import type { Level, Question, Subject } from '../types';
import { LEVELS, subjectInfo } from '../data/subjects';
import { chapterName, chaptersOf } from '../data/chapters';
import { t } from '../lib/i18n';
import { PACK_SIZE, deletePack, downloadPack, listPacks, pendingAnswers, pickFromPack, syncPending, type OfflinePack } from '../lib/offline';

interface Props {
  level: Level;
  online: boolean;
  onBack: () => void;
  onPlay: (questions: Question[], pack: OfflinePack) => void;
}

const kb = (b: number) => `${Math.max(1, Math.round(b / 1024))} KB`;

/** แพ็กโจทย์ออฟไลน์: ดาวน์โหลดตอนมีเน็ต ฝึกได้ตอนไม่มีเน็ต แล้วซิงก์ผลภายหลัง */
export function OfflinePacksScreen({ level: initialLevel, online, onBack, onPlay }: Props) {
  const [packs, setPacks] = useState<OfflinePack[] | null>(null);
  const [pending, setPending] = useState(0);
  const [level, setLevel] = useState<Level>(initialLevel);
  const [subject, setSubject] = useState<Subject>(LEVELS[initialLevel].subjects[0]);
  const [chapter, setChapter] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setPacks((await listPacks()).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      setPending((await pendingAnswers()).length);
    } catch {
      setError(t('เครื่องนี้เก็บข้อมูลออฟไลน์ไม่ได้ (อาจเป็นโหมดไม่ระบุตัวตน)', "This device can't store offline data (private browsing?)"));
      setPacks([]);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const total = (packs ?? []).reduce((n, p) => n + p.bytes, 0);

  return (
    <div className="screen offline-packs">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Package weight="fill" className="ico" /> {t('แพ็กโจทย์ออฟไลน์', 'Offline packs')}
        </div>
      </header>

      <p className={`offline-packs__status ${online ? 'is-on' : 'is-off'}`}>
        {online ? <WifiHigh weight="bold" /> : <WifiSlash weight="bold" />}{' '}
        {online ? t('ออนไลน์: ดาวน์โหลดแพ็กเก็บไว้ได้', 'Online: download packs to keep') : t('ออฟไลน์: ฝึกจากแพ็กที่โหลดไว้ได้เลย', 'Offline: practise from saved packs')}
      </p>
      <p className="muted offline-packs__rule">
        {t('ฝึกออฟไลน์ไม่ได้ XP เหรียญ หรือคะแนนลีก แต่ผลจะนับในสถิติรายบทและสมุดข้อผิดเมื่อต่อเน็ต', "Offline practice doesn't earn XP, coins or league points, but results count in your chapter stats and mistake notebook once you're back online.")}
      </p>

      {pending > 0 && (
        <section className="settings-card offline-packs__sync">
          <CloudArrowUp weight="fill" size={22} />
          <span>{t(`มีผลฝึก ${pending} ข้อรอซิงก์`, `${pending} answers waiting to sync`)}</span>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !online}
            onClick={() =>
              run(async () => {
                const n = await syncPending();
                return t(`ซิงก์แล้ว ${n} ข้อ`, `Synced ${n}`);
              })
            }
          >
            {t('ซิงก์ตอนนี้', 'Sync now')}
          </button>
        </section>
      )}

      {online && (
        <section className="settings-card offline-packs__get">
          <h2 className="section-title section-title--dark">
            <DownloadSimple weight="bold" className="ico" /> {t('ดาวน์โหลดแพ็กใหม่', 'Download a pack')}
          </h2>
          <div className="offline-packs__row">
            <select
              value={level}
              onChange={(e) => {
                const l = e.target.value as Level;
                setLevel(l);
                setSubject(LEVELS[l].subjects[0]);
                setChapter('all');
              }}
              aria-label={t('ระดับชั้น', 'Level')}
            >
              {(Object.keys(LEVELS) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVELS[l].name}
                </option>
              ))}
            </select>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value as Subject);
                setChapter('all');
              }}
              aria-label={t('วิชา', 'Subject')}
            >
              {LEVELS[level].subjects.map((s) => (
                <option key={s} value={s}>
                  {subjectInfo(s, level).name}
                </option>
              ))}
            </select>
          </div>
          <select value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label={t('บท', 'Chapter')}>
            <option value="all">{t('ทุกบท (คละ)', 'All chapters (mixed)')}</option>
            {chaptersOf(level, subject).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const p = await downloadPack(level, subject, chapter === 'all' ? null : chapter);
                if (!p.questions.length) {
                  await deletePack(p.id);
                  throw new Error(t('บทนี้ยังไม่มีโจทย์ในคลัง', 'No questions for this chapter yet'));
                }
                return t(`โหลดแล้ว ${p.questions.length} ข้อ (${kb(p.bytes)})`, `Saved ${p.questions.length} questions (${kb(p.bytes)})`);
              })
            }
          >
            {busy ? t('กำลังโหลด...', 'Downloading...') : t(`ดาวน์โหลด ${PACK_SIZE} ข้อ (ประมาณ 30-60 KB)`, `Download ${PACK_SIZE} questions (~30-60 KB)`)}
          </button>
        </section>
      )}

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <Package weight="fill" className="ico" /> {t('แพ็กในเครื่อง', 'Saved packs')}
          {total > 0 && <small className="muted offline-packs__total"> · {kb(total)}</small>}
        </h2>
        {packs?.length === 0 && <p className="muted">{t('ยังไม่มีแพ็ก ดาวน์โหลดไว้ตอนมีเน็ตนะ', 'No packs yet. Download some while online.')}</p>}
        <ul className="offline-packs__list">
          {packs?.map((p) => {
            const info = subjectInfo(p.subject, p.level);
            return (
              <li key={p.id}>
                <span className="offline-packs__name">
                  <strong>
                    <info.icon weight="fill" size={15} color={info.color} /> {info.name}
                  </strong>
                  <small>
                    {LEVELS[p.level].name} · {p.chapter ? chapterName(p.chapter) : t('ทุกบท', 'All chapters')} · {p.questions.length} {t('ข้อ', 'Qs')} · {kb(p.bytes)}
                  </small>
                </span>
                <button type="button" className="btn btn--primary" onClick={() => onPlay(pickFromPack(p), p)}>
                  <Play weight="fill" className="ico" /> {t('ฝึก', 'Play')}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('ลบแพ็ก', 'Delete pack')}
                  onClick={() => run(async () => void (await deletePack(p.id)))}
                >
                  <Trash weight="bold" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {msg && <p className="dream__saved">{msg}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
