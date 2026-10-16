import type { Difficulty, Level, Subject, Track } from '../types';

export const SUBJECTS: Record<Subject, { name: string; emoji: string; color: string; topics: string }> = {
  math: { name: 'คณิตศาสตร์', emoji: '📐', color: '#ff5d73', topics: 'พีชคณิต · แคลคูลัส · เรขาคณิต' },
  science: { name: 'วิทยาศาสตร์', emoji: '🔬', color: '#14b8c4', topics: 'สิ่งมีชีวิต · สาร · แรงและพลังงาน' },
  physics: { name: 'ฟิสิกส์', emoji: '⚡', color: '#3d8bff', topics: 'กลศาสตร์ · ไฟฟ้า · คลื่น' },
  chemistry: { name: 'เคมี', emoji: '🧪', color: '#22c58b', topics: 'ปริมาณสาร · กรด-เบส · พันธะ' },
  biology: { name: 'ชีววิทยา', emoji: '🧬', color: '#ff9f1c', topics: 'เซลล์ · พันธุกรรม · ร่างกาย' },
  english: { name: 'ภาษาอังกฤษ', emoji: '🔤', color: '#b05cff', topics: 'Grammar · Vocab · Reading' },
};

export interface LevelInfo {
  name: string;
  short: string;
  emoji: string;
  subjects: Subject[];
  /** แนวข้อสอบที่มีในระดับนี้ (ตัวแรก = ค่าเริ่มต้น) */
  tracks: { value: Track; label: string; icon: string }[];
  /** ชื่อ/หัวข้อวิชาที่ต่างจากค่าปกติในระดับนี้ */
  subjectOverride?: Partial<Record<Subject, { name: string; topics: string }>>;
}

const SCHOOL = { value: 'school' as const, label: 'สอบปกติ', icon: '🏫' };

export const LEVELS: Record<Level, LevelInfo> = {
  primary: {
    name: 'ประถม',
    short: 'ป.1-6',
    emoji: '🎒',
    subjects: ['math', 'science', 'english'],
    tracks: [SCHOOL, { value: 'entrance', label: 'สอบเข้า ม.1', icon: '🎯' }],
    subjectOverride: {
      math: { name: 'คณิตศาสตร์', topics: 'จำนวน · เศษส่วน · รูปทรง' },
      english: { name: 'ภาษาอังกฤษ', topics: 'Vocab · Grammar พื้นฐาน' },
    },
  },
  lower: {
    name: 'ม.ต้น',
    short: 'ม.1-3',
    emoji: '📘',
    subjects: ['math', 'science', 'english'],
    tracks: [SCHOOL, { value: 'entrance', label: 'สอบเข้า ม.4', icon: '🎯' }],
    subjectOverride: { math: { name: 'คณิตศาสตร์', topics: 'สมการ · เรขาคณิต · สถิติ' } },
  },
  upper: {
    name: 'ม.ปลาย',
    short: 'ม.4-6',
    emoji: '📗',
    subjects: ['math', 'physics', 'chemistry', 'biology', 'english'],
    tracks: [SCHOOL, { value: 'entrance', label: 'สอบเข้ามหาลัย', icon: '🎓' }],
  },
  uni: {
    name: 'มหาลัย',
    short: 'ปี 1-2',
    emoji: '🎓',
    subjects: ['math', 'physics', 'chemistry', 'biology', 'english'],
    tracks: [{ value: 'school', label: 'สอบในคณะ', icon: '🏛️' }],
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
};

export const DIFFICULTY_STARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

export const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง'] as const;
