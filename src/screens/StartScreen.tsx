import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Difficulty, Subject, Track } from '../types';
import { SUBJECTS } from '../data/subjects';
import { BOT_LEVELS, type BotLevel } from '../game/bots';
import { heartsFor } from '../game/battle';

export type SubjectFilter = Subject | 'all';

export type GameMode = 'solo' | 'bots' | 'challenge';

export interface GameSettings {
  mode: GameMode;
  /** จำนวนบอท (โหมดดวลกับบอท) รวมเราเป็น 2-8 คน */
  botCount: number;
  botLevel: BotLevel;
  subject: SubjectFilter;
  difficulty: Difficulty;
  track: Track;
  count: number;
}

const SUBJECT_KEYS = Object.keys(SUBJECTS) as Subject[];

const DIFFICULTIES: { value: Difficulty; label: string; icon: string }[] = [
  { value: 'easy', label: 'ง่าย', icon: '🌱' },
  { value: 'medium', label: 'กลาง', icon: '🔥' },
  { value: 'hard', label: 'ยาก', icon: '💀' },
];
const TRACKS: { value: Track; label: string; icon: string }[] = [
  { value: 'school', label: 'สอบปกติ', icon: '🏫' },
  { value: 'entrance', label: 'สอบเข้า', icon: '🎓' },
];
const COUNTS = [5, 10, 20];
const BOT_COUNTS = [1, 3, 5, 7];

/** เวลาเฉลี่ยโดยประมาณต่อข้อ (วินาที) ใช้แสดงว่ารอบนี้ใช้เวลาราวกี่นาที */
const AVG_SEC: Record<Difficulty, number> = { easy: 25, medium: 40, hard: 60 };

interface Props {
  initial: GameSettings;
  error: string | null;
  onStart: (settings: GameSettings) => void;
  onPlaySample: (settings: GameSettings) => void;
  /** การ์ดโปรไฟล์ (ถ้ามี) แสดงใต้ชื่อแอพ */
  profileSlot?: ReactNode;
  onOnline: () => void;
  onGroups: () => void;
  /** ออฟไลน์อยู่: เล่นได้เฉพาะโจทย์ตัวอย่าง */
  offline?: boolean;
  /** แถบชวนติดตั้งแอพ */
  installSlot?: ReactNode;
}

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

export function StartScreen({ initial, error, onStart, onPlaySample, profileSlot, onOnline, onGroups, offline, installSlot }: Props) {
  const [s, setS] = useState<GameSettings>(initial);
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const subjectName = s.subject === 'all' ? 'ทุกวิชา' : SUBJECTS[s.subject].name;
  const difficultyLabel = DIFFICULTIES.find((d) => d.value === s.difficulty)!.label;
  const minutes = Math.max(1, Math.round((s.count * AVG_SEC[s.difficulty]) / 60));

  return (
    <div className="screen home">
      <header className="home__hero">
        <div className="home__logo" aria-hidden>
          <span>🧠</span>
        </div>
        <div>
          <h1 className="home__title">Brain Gym</h1>
          <p className="home__tagline">ฝึกสมองวันละนิด แล้วไปแข่งกับเพื่อน!</p>
        </div>
      </header>

      {offline && (
        <div className="offline-banner" role="status">
          📴 ออฟไลน์อยู่ — เล่นฝึกเดี่ยว/ดวลบอทด้วยโจทย์ตัวอย่างได้ (ไม่ได้ XP)
        </div>
      )}

      {installSlot}

      {profileSlot}

      <div className="mode-switch" role="tablist" aria-label="เลือกโหมด">
        <button
          type="button"
          role="tab"
          aria-selected={s.mode === 'solo'}
          className={`mode-tab ${s.mode === 'solo' ? 'is-active' : ''}`}
          onClick={() => set('mode', 'solo')}
        >
          <span className="mode-tab__icon">🎯</span>
          <span className="mode-tab__name">ฝึกเดี่ยว</span>
          <span className="mode-tab__desc">ทำโจทย์สบายๆ</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={s.mode === 'bots'}
          className={`mode-tab ${s.mode === 'bots' ? 'is-active' : ''}`}
          onClick={() => set('mode', 'bots')}
        >
          <span className="mode-tab__icon">⚔️</span>
          <span className="mode-tab__name">ดวลกับบอท</span>
          <span className="mode-tab__desc">ยิงหัวใจ เหลือรอดคนสุดท้าย</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={s.mode === 'challenge'}
          className={`mode-tab ${s.mode === 'challenge' ? 'is-active' : ''}`}
          onClick={() => set('mode', 'challenge')}
        >
          <span className="mode-tab__icon">🔗</span>
          <span className="mode-tab__name">ท้าเพื่อน</span>
          <span className="mode-tab__desc">ทำชุดเดียวกัน ภายใน 24 ชม.</span>
        </button>
        <button type="button" role="tab" aria-selected={false} className="mode-tab" onClick={onOnline}>
          <span className="mode-tab__icon">🌐</span>
          <span className="mode-tab__name">ออนไลน์</span>
          <span className="mode-tab__desc">สร้างห้องเล่นกับเพื่อน</span>
        </button>
        <button type="button" role="tab" aria-selected={false} className="mode-tab mode-tab--wide" onClick={onGroups}>
          <span className="mode-tab__icon">🏆</span>
          <span className="mode-tab__name">กลุ่มเพื่อน</span>
          <span className="mode-tab__desc">โจทย์ประจำวัน + ตารางอันดับ</span>
        </button>
      </div>

      <div className="ai-badge">
        <span className="ai-badge__spark" aria-hidden>
          ✨
        </span>
        <span>AI สร้างโจทย์ใหม่ให้ทุกรอบ พร้อมเฉลยละเอียด</span>
      </div>

      <section aria-labelledby="pick-subject">
        <h2 id="pick-subject" className="section-title">
          วันนี้จะฝึกวิชาอะไรดี?
        </h2>
        <div className="subject-grid">
          <button
            type="button"
            className={`subject-card subject-card--all ${s.subject === 'all' ? 'is-active' : ''}`}
            aria-pressed={s.subject === 'all'}
            onClick={() => set('subject', 'all')}
          >
            <span className="subject-card__emoji" aria-hidden>
              🌈
            </span>
            <span className="subject-card__body">
              <span className="subject-card__name">ทุกวิชา</span>
              <span className="subject-card__topics">คละ 5 วิชา ท้าทายสุด</span>
            </span>
            <span className="subject-card__check" aria-hidden>
              ✓
            </span>
          </button>
          {SUBJECT_KEYS.map((key) => {
            const sub = SUBJECTS[key];
            return (
              <button
                key={key}
                type="button"
                className={`subject-card ${s.subject === key ? 'is-active' : ''}`}
                style={{ '--c': sub.color } as CSSProperties}
                aria-pressed={s.subject === key}
                onClick={() => set('subject', key)}
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
        <Segmented label="ความยาก" options={DIFFICULTIES} value={s.difficulty} onChange={(v) => set('difficulty', v)} />
        <Segmented label="แนวข้อสอบ" options={TRACKS} value={s.track} onChange={(v) => set('track', v)} />
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
              ? `🔗 ${subjectName} · ${difficultyLabel} · ${s.count} ข้อ · ส่งลิงก์ให้เพื่อนเล่นต่อ`
              : `${subjectName} · ${difficultyLabel} · ${s.count} ข้อ · ราว ${minutes} นาที`}
        </p>
        <button type="button" className="btn btn--primary btn--block btn--big cta-bar__btn" onClick={() => onStart(s)}>
          {s.mode === 'bots' ? 'เริ่มดวลเลย! ⚔️' : s.mode === 'challenge' ? 'สร้างคำท้า 🔗' : 'เริ่มฝึกเลย! 🚀'}
        </button>
      </div>
    </div>
  );
}
