import { useEffect, useState, type CSSProperties } from 'react';
import type { Difficulty, Level, Subject } from '../types';
import { LEVELS, subjectInfo } from '../data/subjects';
import { chapterName, chaptersOf } from '../data/chapters';
import { LevelPicker } from '../components/LevelPicker';
import { PlanPanel } from '../components/PlanPanel';
import type { PlanItem } from '../lib/planBuilder';
import {
  accuracyOf,
  fetchChapterStats,
  MIN_ANSWERS,
  STATUS_TEXT,
  statusOf,
  type ChapterStat,
} from '../lib/analysis';
import { CalendarBlank, ChartBar, Plant, Target, WarningCircle } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

export interface PracticeRequest {
  level: Level;
  subject: Subject;
  chapter: string;
  difficulty: Difficulty;
}

interface Props {
  initialLevel: Level;
  onBack: () => void;
  onPractice: (p: PracticeRequest) => void;
  /** เริ่มรอบจากแผนการฝึก (ทำเสร็จแล้วจะติ๊กในแผน) */
  onPracticePlan: (level: Level, item: PlanItem, index: number) => void;
}

/** ความยากที่แนะนำให้ฝึกต่อ ตามความแม่นล่าสุดของบท */
function suggestDifficulty(stat: ChapterStat | undefined): Difficulty {
  if (!stat || stat.recent < MIN_ANSWERS) return 'medium';
  const acc = accuracyOf(stat);
  return acc < 0.4 ? 'easy' : acc < 0.6 ? 'medium' : acc < 0.8 ? 'hard' : 'challenge';
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** วิเคราะห์จุดอ่อนรายบท จาก 20 ข้อล่าสุดของแต่ละบท */
export function AnalysisScreen({ initialLevel, onBack, onPractice, onPracticePlan }: Props) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [tab, setTab] = useState<'plan' | 'chapters'>('plan');
  const [stats, setStats] = useState<ChapterStat[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setStats(null);
    setError('');
    fetchChapterStats(level)
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [level]);

  const byChapter = new Map((stats ?? []).map((s) => [s.chapter, s]));
  const recent = (stats ?? []).reduce((n, s) => n + s.recent, 0);
  const recentCorrect = (stats ?? []).reduce((n, s) => n + s.recentCorrect, 0);
  const total = (stats ?? []).reduce((n, s) => n + s.total, 0);
  const weakest = (stats ?? [])
    .filter((s) => statusOf(s) === 'weak' && chapterName(s.chapter))
    .sort((a, b) => accuracyOf(a) - accuracyOf(b))
    .slice(0, 3);
  const strongCount = (stats ?? []).filter((s) => statusOf(s) === 'strong').length;

  const practice = (chapter: string) => {
    const [, subject] = chapter.split('.');
    onPractice({ level, subject: subject as Subject, chapter, difficulty: suggestDifficulty(byChapter.get(chapter)) });
  };

  return (
    <div className="screen analysis">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress"><ChartBar weight="fill" className="ico" /> {t('วิเคราะห์ของฉัน', 'My analysis')}</div>
      </header>

      <section className="settings-card">
        <LevelPicker value={level} onChange={setLevel} />
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plan'}
            className={`segmented__opt ${tab === 'plan' ? 'is-active' : ''}`}
            onClick={() => setTab('plan')}
          >
            <CalendarBlank weight="fill" className="ico" /> {t('แผนฝึก', 'Study plan')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chapters'}
            className={`segmented__opt ${tab === 'chapters' ? 'is-active' : ''}`}
            onClick={() => setTab('chapters')}
          >
            <ChartBar weight="fill" className="ico" /> {t('รายบท', 'By chapter')}
          </button>
        </div>
      </section>

      {tab === 'plan' && stats && (
        <PlanPanel key={level} level={level} stats={stats} onPractice={(item, index) => onPracticePlan(level, item, index)} />
      )}

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
      {!stats && !error && <p className="muted analysis__loading">{t('กำลังโหลดสถิติ...', 'Loading stats...')}</p>}

      {tab === 'chapters' && stats && total === 0 && (
        <section className="settings-card analysis__empty">
          <p className="analysis__big"><Plant weight="fill" className="ico" /></p>
          <p>
            {t(`ยังไม่มีข้อมูลระดับ ${LEVELS[level].name} เลย`, `No ${LEVELS[level].name} data yet`)}
            <br />
            {t('ลองฝึกเดี่ยวสัก 2-3 รอบ แล้วกลับมาดูว่าถนัดบทไหน', 'Play 2-3 solo rounds, then come back to see your strong chapters')}
          </p>
        </section>
      )}

      {tab === 'chapters' && stats && total > 0 && (
        <>
          <section className="settings-card analysis__summary">
            <div>
              <span className="analysis__big">{pct(recent ? recentCorrect / recent : 0)}</span>
              <span className="muted">{t('ความแม่นล่าสุด', 'Recent accuracy')}</span>
            </div>
            <div>
              <span className="analysis__big">{total}</span>
              <span className="muted">{t('ข้อที่เคยทำ', 'Questions done')}</span>
            </div>
            <div>
              <span className="analysis__big">{strongCount}</span>
              <span className="muted">{t('บทที่ถนัด', 'Strong chapters')}</span>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="section-title section-title--dark"><Target weight="fill" className="ico" /> {t('ควรฝึกก่อน', 'Practice first')}</h2>
            {weakest.length === 0 ? (
              <p className="muted">
                {t('ยังไม่มีบทที่ต่ำกว่า 60%', 'No chapters below 60% yet')}{' '}
            {recent < 20 ? t(`(ทำให้ครบบทละ ${MIN_ANSWERS} ข้อขึ้นไปจะวิเคราะห์ได้แม่นขึ้น)`, `(answer ${MIN_ANSWERS}+ per chapter for better analysis)`) : ''}
              </p>
            ) : (
              <ul className="analysis__weak">
                {weakest.map((s) => {
                  const sub = subjectInfo(s.subject as Subject, level);
                  return (
                    <li key={s.chapter} className="analysis__weak-item">
                      <div>
                        <strong>{chapterName(s.chapter)}</strong>
                        <span className="muted">
                          <sub.icon weight="fill" size={14} /> {sub.name} · {t('ถูก', 'correct')} {s.recentCorrect}/{s.recent} ({pct(accuracyOf(s))})
                        </span>
                      </div>
                      <button type="button" className="btn btn--primary" onClick={() => practice(s.chapter)}>
                        {t('ฝึกบทนี้', 'Practice this chapter')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'chapters' &&
        stats &&
        LEVELS[level].subjects.map((subject) => {
          const chapters = chaptersOf(level, subject);
          const done = chapters.filter((c) => byChapter.has(c.id)).length;
          const sub = subjectInfo(subject, level);
          return (
            <details key={subject} className="settings-card analysis__subject" open={done > 0}>
              <summary className="analysis__subject-head" style={{ '--c': sub.color } as CSSProperties}>
                <span>
                  <sub.icon weight="fill" size={18} color={sub.color} /> {sub.name}
                </span>
                <span className="muted">
                  {t(`ทำแล้ว ${done}/${chapters.length} บท`, `${done}/${chapters.length} chapters started`)}
                </span>
              </summary>
              <ul className="analysis__chapters">
                {chapters.map((c, i) => {
                  const st = byChapter.get(c.id);
                  const status = statusOf(st);
                  return (
                    <li key={c.id} className={`analysis__row analysis__row--${status}`}>
                      <button type="button" className="analysis__row-btn" onClick={() => practice(c.id)} title={t('ฝึกบทนี้', 'Practice this chapter')}>
                        <span className="analysis__row-name">
                          {i + 1}. {c.name}
                        </span>
                        <span className="analysis__row-status">
                          {STATUS_TEXT[status]}
                          {st && status !== 'none' && ` · ${st.recentCorrect}/${st.recent}`}
                        </span>
                        <span className="analysis__bar" aria-hidden>
                          <span style={{ width: st ? pct(accuracyOf(st)) : '0%' }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}

      {tab === 'chapters' && stats && <p className="muted analysis__note">{t('ดูจาก 20 ข้อล่าสุดของแต่ละบท · กดชื่อบทเพื่อฝึกบทนั้นได้เลย', 'Based on the last 20 answers per chapter · tap a chapter to practice it')}</p>}
    </div>
  );
}
