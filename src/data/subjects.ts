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

export const SUBJECTS: Record<Subject, { name: string; icon: Icon; color: string; topics: string }> = {
  math: { name: 'คณิตศาสตร์', icon: SUBJECT_ICON.math, color: '#ff5d73', topics: 'พีชคณิต · แคลคูลัส · เรขาคณิต' },
  science: { name: 'วิทยาศาสตร์', icon: SUBJECT_ICON.science, color: '#14b8c4', topics: 'สิ่งมีชีวิต · สาร · แรงและพลังงาน' },
  physics: { name: 'ฟิสิกส์', icon: SUBJECT_ICON.physics, color: '#3d8bff', topics: 'กลศาสตร์ · ไฟฟ้า · คลื่น' },
  chemistry: { name: 'เคมี', icon: SUBJECT_ICON.chemistry, color: '#22c58b', topics: 'ปริมาณสาร · กรด-เบส · พันธะ' },
  biology: { name: 'ชีววิทยา', icon: SUBJECT_ICON.biology, color: '#ff9f1c', topics: 'เซลล์ · พันธุกรรม · ร่างกาย' },
  english: { name: 'ภาษาอังกฤษ', icon: SUBJECT_ICON.english, color: '#b05cff', topics: 'Grammar · Vocab · Reading' },
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

const SCHOOL = { value: 'school' as const, label: 'สอบปกติ', icon: Chalkboard };

export const LEVELS: Record<Level, LevelInfo> = {
  primary: {
    name: 'ประถม',
    short: 'ป.1-6',
    icon: Backpack,
    subjects: ['math', 'science', 'english'],
    tracks: [SCHOOL, { value: 'entrance', label: 'สอบเข้า ม.1', icon: Target }],
    subjectOverride: {
      math: { name: 'คณิตศาสตร์', topics: 'จำนวน · เศษส่วน · รูปทรง' },
      english: { name: 'ภาษาอังกฤษ', topics: 'Vocab · Grammar พื้นฐาน' },
    },
  },
  lower: {
    name: 'ม.ต้น',
    short: 'ม.1-3',
    icon: BookOpenText,
    subjects: ['math', 'science', 'english'],
    tracks: [SCHOOL, { value: 'entrance', label: 'สอบเข้า ม.4', icon: Target }],
    subjectOverride: { math: { name: 'คณิตศาสตร์', topics: 'สมการ · เรขาคณิต · สถิติ' } },
  },
  upper: {
    name: 'ม.ปลาย',
    short: 'ม.4-6',
    icon: Books,
    subjects: ['math', 'physics', 'chemistry', 'biology', 'english'],
    tracks: [SCHOOL, { value: 'entrance', label: 'สอบเข้ามหาลัย', icon: GraduationCap }],
  },
  uni: {
    name: 'มหาลัย',
    short: 'ปี 1-2',
    icon: GraduationCap,
    subjects: ['math', 'physics', 'chemistry', 'biology', 'english'],
    tracks: [{ value: 'school', label: 'สอบในคณะ', icon: Bank }],
    subjectOverride: { math: { name: 'แคลคูลัส', topics: 'ลิมิต · อนุพันธ์ · อินทิกรัล · เมทริกซ์' } },
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS) as Level[];

/** ชื่อ/หัวข้อ/สี ของวิชาในระดับที่เลือก */
export const subjectInfo = (subject: Subject, level: Level = 'upper') => ({
  ...SUBJECTS[subject],
  ...LEVELS[level].subjectOverride?.[subject],
});

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'ง่าย',
  medium: 'กลาง',
  hard: 'ยาก',
  challenge: 'ท้าทาย',
};

/** ตัวเลือกความยาก (ใช้ทุกหน้าที่ให้เลือก) */
export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; icon: Icon }[] = [
  { value: 'easy', label: 'ง่าย', icon: Plant },
  { value: 'medium', label: 'กลาง', icon: Fire },
  { value: 'hard', label: 'ยาก', icon: Skull },
  { value: 'challenge', label: 'ท้าทาย', icon: Brain },
];

/** ชื่อความยาก เช่น "กลาง" */
export const difficultyText = (d: Difficulty) => DIFFICULTY_OPTIONS.find((x) => x.value === d)!.label;

export const DIFFICULTY_STARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, challenge: 4 };

export const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง'] as const;

/** ตัวเลือกวิชาของระดับชั้น (รวม "ทุกวิชา") สำหรับ <select> */
export const subjectOptions = (level: Level): { value: Subject | 'all'; label: string }[] => [
  { value: 'all', label: 'ทุกวิชา' },
  ...LEVELS[level].subjects.map((s) => ({ value: s, label: subjectInfo(s, level).name })),
];

/** ป้ายสรุปค่าตั้ง เช่น "ประถม · วิทยาศาสตร์" (ไม่มี level = ม.ปลาย) */
export function settingsLabel(s: { level?: Level; subject: Subject | 'all' }): string {
  const level = s.level ?? 'upper';
  const sub = s.subject === 'all' ? 'ทุกวิชา' : subjectInfo(s.subject, level).name;
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
