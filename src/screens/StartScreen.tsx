import { useEffect, useState, type CSSProperties } from 'react';
import type { Difficulty, Level, Subject, Track } from '../types';
import { adjustForLevel, DIFFICULTY_OPTIONS, LEVELS, subjectInfo } from '../data/subjects';
import { ChapterPicker } from '../components/ChapterPicker';
import { BOT_LEVELS, type BotLevel } from '../game/bots';
import { heartsFor } from '../game/battle';

export type SubjectFilter = Subject | 'all';

export type GameMode = 'solo' | 'bots' | 'challenge';

export interface GameSettings {
  mode: GameMode;
  /** จำนวนบอท (โหมดดวลกับบอท) รวมเราเป็น 2-8 คน */
  botCount: number;
  botLevel: BotLevel;
  level: Level;
  subject: SubjectFilter;
  /** บทที่เลือก (ว่าง = ทุกบท) ใช้กับฝึกเดี่ยว/ดวลบอท เมื่อเลือกวิชาเดียว */
  chapters: string[];
  difficulty: Difficulty;
  track: Track;
  count: number;
}

/** เปลี่ยนระดับชั้น: วิชา/แนวข้อสอบที่ไม่มีในระดับใหม่จะกลับเป็นค่าเริ่มต้น */
export const withLevel = (s: GameSettings, level: Level): GameSettings =>
  s.level === level ? s : { ...adjustForLevel(s, level), chapters: [] };

const DIFFICULTIES = DIFFICULTY_OPTIONS;
const COUNTS = [5, 10, 20];
const BOT_COUNTS = [1, 3, 5, 7];

/** เวลาเฉลี่ยโดยประมาณต่อข้อ (วินาที) ใช้แสดงว่ารอบนี้ใช้เวลาราวกี่นาที */
const AVG_SEC: Record<Difficulty, number> = { easy: 25, medium: 40, hard: 60, challenge: 110 };

interface Props {
  initial: GameSettings;
  error: string | null;
  onStart: (settings: GameSettings) => void;
  onPlaySample: (settings: GameSettings) => void;
  onBack: () => void;
  /** ออฟไลน์อยู่: เล่นได้เฉพาะโจทย์ตัวอย่าง */
  offline?: boolean;
}

const MODE_TITLE: Record<GameMode, string> = { solo: 'ฝึกเดี่ยว', bots: 'ดวลกับบอท', challenge: 'สร้างคำท้า' };

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="setting">
      <span className="setting__label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`segmented__opt ${value === o.value ? 'is-active' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <span aria-hidden>{o.icon}</span>} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StartScreen({
  initial,
  error,
  onStart,
  onPlaySample,
  onBack,
  offline,
}: Props) {
  const [s, setS] = useState<GameSettings>(initial);
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));
  // ระดับในโปรไฟล์โหลดเสร็จทีหลัง -> ตามให้ตรง
  useEffect(() => {
    setS((prev) => (prev.level === initial.level ? prev : withLevel(prev, initial.level)));
  }, [initial.level]);

  const levelInfo = LEVELS[s.level];
  const subjectName =
    s.subject === 'all'
      ? 'ทุกวิชา'
      : subjectInfo(s.subject, s.level).name + (s.chapters.length && s.mode !== 'challenge' ? ` (${s.chapters.length} บท)` : '');
  const difficultyLabel = DIFFICULTIES.find((d) => d.value === s.difficulty)!.label;
  const minutes = Math.max(1, Math.round((s.count * AVG_SEC[s.difficulty]) / 60));

  return (
    <div className="screen home round-setup">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">
          {MODE_TITLE[s.mode]} · {levelInfo.name}
        </div>
      </header>

      {offline && (
        <div className="offline-banner" role="status">
          ออฟไลน์อยู่ — เล่นด้วยโจทย์ตัวอย่างในเครื่อง (ไม่ได้ XP)
        </div>
      )}


      <section aria-labelledby="pick-subject">
        <h2 id="pick-subject" className="section-title">
          วันนี้จะฝึกวิชาอะไรดี?
        </h2>
        <div className="subject-grid">
          <button
            type="button"
            className={`subject-card subject-card--all ${s.subject === 'all' ? 'is-active' : ''}`}
            aria-pressed={s.subject === 'all'}
            onClick={() => setS((prev) => ({ ...prev, subject: 'all', chapters: [] }))}
          >
            <span className="subject-card__emoji" aria-hidden>
              🌈
            </span>
            <span className="subject-card__body">
              <span className="subject-card__name">ทุกวิชา</span>
              <span className="subject-card__topics">คละ {levelInfo.subjects.length} วิชา ท้าทายสุด</span>
            </span>
            <span className="subject-card__check" aria-hidden>
              ✓
            </span>
          </button>
          {levelInfo.subjects.map((key: Subject) => {
            const sub = subjectInfo(key, s.level);
            return (
              <button
                key={key}
                type="button"
                className={`subject-card ${s.subject === key ? 'is-active' : ''}`}
                style={{ '--c': sub.color } as CSSProperties}
                aria-pressed={s.subject === key}
                onClick={() => setS((prev) => (prev.subject === key ? prev : { ...prev, subject: key, chapters: [] }))}
              >
                <span className="subject-card__emoji" aria-hidden>
                  {sub.emoji}
                </span>
                <span className="subject-card__body">
                  <span className="subject-card__name">{sub.name}</span>
                  <span className="subject-card__topics">{sub.topics}</span>
                </span>
                <span className="subject-card__check" aria-hidden>
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-card" aria-label="ตั้งค่ารอบนี้">
        {s.subject !== 'all' && s.mode !== 'challenge' && (
          <ChapterPicker level={s.level} subject={s.subject} value={s.chapters} onChange={(v) => set('chapters', v)} />
        )}
        <Segmented label="ความยาก" options={DIFFICULTIES} value={s.difficulty} onChange={(v) => set('difficulty', v)} />
        {levelInfo.tracks.length > 1 && (
          <Segmented<Track> label="แนวข้อสอบ" options={levelInfo.tracks} value={s.track} onChange={(v) => set('track', v)} />
        )}
        {s.mode === 'bots' && (
          <>
            <Segmented
              label="จำนวนบอท"
              options={BOT_COUNTS.map((n) => ({ value: n, label: `${n} ตัว` }))}
              value={s.botCount}
              onChange={(v) => set('botCount', v)}
            />
            <Segmented label="ความเก่งบอท" options={BOT_LEVELS} value={s.botLevel} onChange={(v) => set('botLevel', v)} />
          </>
        )}
        <Segmented
          label="จำนวนข้อ"
          options={COUNTS.map((n) => ({ value: n, label: `${n} ข้อ` }))}
          value={s.count}
          onChange={(v) => set('count', v)}
        />
      </section>

      {error && (
        <div className="alert" role="alert">
          <p className="alert__msg">😵 {error}</p>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => onPlaySample(s)}>
            เล่นโจทย์ตัวอย่างในเครื่องแทน
          </button>
        </div>
      )}

      <div className="cta-bar">
        <p className="cta-bar__summary">
          {s.mode === 'bots'
            ? `⚔️ ${s.botCount + 1} คน · ${s.count} ข้อ · หัวใจคนละ ${heartsFor(s.count)} ดวง`
            : s.mode === 'challenge'
              ? `🔗 ${levelInfo.name} · ${subjectName} · ${difficultyLabel} · ${s.count} ข้อ · ส่งลิงก์ให้เพื่อนเล่นต่อ`
              : `${levelInfo.emoji} ${levelInfo.name} · ${subjectName} · ${difficultyLabel} · ${s.count} ข้อ · ราว ${minutes} นาที`}
        </p>
        <button type="button" className="btn btn--primary btn--block btn--big cta-bar__btn" onClick={() => onStart(s)}>
          {s.mode === 'bots' ? 'เริ่มดวลเลย! ⚔️' : s.mode === 'challenge' ? 'สร้างคำท้า 🔗' : 'เริ่มฝึกเลย! 🚀'}
        </button>
      </div>
    </div>
  );
}
