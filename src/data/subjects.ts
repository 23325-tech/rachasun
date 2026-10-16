import {
  Backpack,
  Bank,
  BookOpenText,
  Books,
  Brain,
  Chalkboard,
  Fire,
  GraduationCap,
  Plant,
  Skull,
  Target,
  type Icon,
} from '@phosphor-icons/react';
import type { Difficulty, Level, Subject, Track } from '../types';
import { SUBJECT_ICON } from '../components/subjectIcons';
import { t } from '../lib/i18n';

export const SUBJECTS: Record<Subject, { name: string; icon: Icon; color: string; topics: string }> = {
  math: { get name() { return t('คณิตศาสตร์', 'Math'); }, icon: SUBJECT_ICON.math, color: '#ff5d73', get topics() { return t('พีชคณิต · แคลคูลัส · เรขาคณิต', 'Algebra · Calculus · Geometry'); } },
  science: { get name() { return t('วิทยาศาสตร์', 'Science'); }, icon: SUBJECT_ICON.science, color: '#14b8c4', get topics() { return t('สิ่งมีชีวิต · สาร · แรงและพลังงาน', 'Living things · Matter · Forces & energy'); } },
  physics: { get name() { return t('ฟิสิกส์', 'Physics'); }, icon: SUBJECT_ICON.physics, color: '#3d8bff', get topics() { return t('กลศาสตร์ · ไฟฟ้า · คลื่น', 'Mechanics · Electricity · Waves'); } },
  chemistry: { get name() { return t('เคมี', 'Chemistry'); }, icon: SUBJECT_ICON.chemistry, color: '#22c58b', get topics() { return t('ปริมาณสาร · กรด-เบส · พันธะ', 'Stoichiometry · Acids & bases · Bonding'); } },
  biology: { get name() { return t('ชีววิทยา', 'Biology'); }, icon: SUBJECT_ICON.biology, color: '#ff9f1c', get topics() { return t('เซลล์ · พันธุกรรม · ร่างกาย', 'Cells · Genetics · Human body'); } },
  english: { get name() { return t('ภาษาอังกฤษ', 'English'); }, icon: SUBJECT_ICON.english, color: '#b05cff', get topics() { return 'Grammar · Vocab · Reading'; } },
};

export interface LevelInfo {
  name: string;
  short: string;
  icon: Icon;
  subjects: Subject[];
  /** แนวข้อสอบที่มีในระดับนี้ (ตัวแรก = ค่าเริ่มต้น) */
  tracks: { value: Track; label: string; icon: Icon }[];
  /** ชื่อ/หัวข้อวิชาที่ต่างจากค่าปกติในระดับนี้ */
  subjectOverride?: Partial<Record<Subject, { name: string; topics: string }>>;
}

const SCHOOL = { value: 'school' as const, get label() { return t('สอบปกติ', 'School exam'); }, icon: Chalkboard };

export const LEVELS: Record<Level, LevelInfo> = {
  primary: {
    get name() { return t('ประถม', 'Primary'); },
    get short() { return t('ป.1-6', 'Grade 1-6'); },
    icon: Backpack,
    subjects: ['math', 'science', 'english'],
    tracks: [SCHOOL, { value: 'entrance', get label() { return t('สอบเข้า ม.1', 'Grade 7 entrance'); }, icon: Target }],
    subjectOverride: {
      math: { get name() { return t('คณิตศาสตร์', 'Math'); }, get topics() { return t('จำนวน · เศษส่วน · รูปทรง', 'Numbers · Fractions · Shapes'); } },
      english: { get name() { return t('ภาษาอังกฤษ', 'English'); }, get topics() { return t('Vocab · Grammar พื้นฐาน', 'Vocab · Basic grammar'); } },
    },
  },
  lower: {
    get name() { return t('ม.ต้น', 'Lower sec.'); },
    get short() { return t('ม.1-3', 'Grade 7-9'); },
    icon: BookOpenText,
    subjects: ['math', 'science', 'english'],
    tracks: [SCHOOL, { value: 'entrance', get label() { return t('สอบเข้า ม.4', 'Grade 10 entrance'); }, icon: Target }],
    subjectOverride: { math: { get name() { return t('คณิตศาสตร์', 'Math'); }, get topics() { return t('สมการ · เรขาคณิต · สถิติ', 'Equations · Geometry · Statistics'); } } },
  },
  upper: {
    get name() { return t('ม.ปลาย', 'Upper sec.'); },
    get short() { return t('ม.4-6', 'Grade 10-12'); },
    icon: Books,
    subjects: ['math', 'physics', 'chemistry', 'biology', 'english'],
    tracks: [SCHOOL, { value: 'entrance', get label() { return t('สอบเข้ามหาลัย', 'University entrance'); }, icon: GraduationCap }],
  },
  uni: {
    get name() { return t('มหาลัย', 'University'); },
    get short() { return t('ปี 1-2', 'Year 1-2'); },
    icon: GraduationCap,
    subjects: ['math', 'physics', 'chemistry', 'biology', 'english'],
    tracks: [{ value: 'school', get label() { return t('สอบในคณะ', 'Faculty exam'); }, icon: Bank }],
    subjectOverride: { math: { get name() { return t('แคลคูลัส', 'Calculus'); }, get topics() { return t('ลิมิต · อนุพันธ์ · อินทิกรัล · เมทริกซ์', 'Limits · Derivatives · Integrals · Matrices'); } } },
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS) as Level[];

/** ชื่อ/หัวข้อ/สี ของวิชาในระดับที่เลือก */
export const subjectInfo = (subject: Subject, level: Level = 'upper') => ({
  ...SUBJECTS[subject],
  ...LEVELS[level].subjectOverride?.[subject],
});

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  get easy() { return t('ง่าย', 'Easy'); },
  get medium() { return t('กลาง', 'Medium'); },
  get hard() { return t('ยาก', 'Hard'); },
  get challenge() { return t('ท้าทาย', 'Challenge'); },
};

/** ตัวเลือกความยาก (ใช้ทุกหน้าที่ให้เลือก) */
export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; icon: Icon }[] = [
  { value: 'easy', get label() { return t('ง่าย', 'Easy'); }, icon: Plant },
  { value: 'medium', get label() { return t('กลาง', 'Medium'); }, icon: Fire },
  { value: 'hard', get label() { return t('ยาก', 'Hard'); }, icon: Skull },
  { value: 'challenge', get label() { return t('ท้าทาย', 'Challenge'); }, icon: Brain },
];

/** ชื่อความยาก เช่น "กลาง" */
export const difficultyText = (d: Difficulty) => DIFFICULTY_OPTIONS.find((x) => x.value === d)!.label;

export const DIFFICULTY_STARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, challenge: 4 };

export const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง'] as const;

/** ตัวเลือกวิชาของระดับชั้น (รวม "ทุกวิชา") สำหรับ <select> */
export const subjectOptions = (level: Level): { value: Subject | 'all'; label: string }[] => [
  { value: 'all', label: t('ทุกวิชา', 'All subjects') },
  ...LEVELS[level].subjects.map((s) => ({ value: s, label: subjectInfo(s, level).name })),
];

/** ป้ายสรุปค่าตั้ง เช่น "ประถม · วิทยาศาสตร์" (ไม่มี level = ม.ปลาย) */
export function settingsLabel(s: { level?: Level; subject: Subject | 'all' }): string {
  const level = s.level ?? 'upper';
  const sub = s.subject === 'all' ? t('ทุกวิชา', 'All subjects') : subjectInfo(s.subject, level).name;
  return `${LEVELS[level].name} · ${sub}`;
}

/** ชื่อแนวข้อสอบตามระดับ เช่น "สอบเข้า ม.4" */
export const trackLabel = (level: Level | undefined, track: Track) =>
  LEVELS[level ?? 'upper'].tracks.find((t) => t.value === track)?.label ?? track;

/** เปลี่ยนระดับ: วิชา/แนวข้อสอบที่ไม่มีในระดับใหม่กลับเป็นค่าเริ่มต้น */
export function adjustForLevel<T extends { subject: Subject | 'all'; track: Track; level?: Level }>(s: T, level: Level): T {
  const info = LEVELS[level];
  return {
    ...s,
    level,
    subject: s.subject === 'all' || info.subjects.includes(s.subject) ? s.subject : 'all',
    track: info.tracks.some((t) => t.value === s.track) ? s.track : info.tracks[0].value,
  };
}
