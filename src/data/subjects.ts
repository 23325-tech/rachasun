import type { Difficulty, Subject } from '../types';

export const SUBJECTS: Record<Subject, { name: string; emoji: string; color: string; topics: string }> = {
  math: { name: 'คณิตศาสตร์', emoji: '📐', color: '#ff5d73', topics: 'พีชคณิต · แคลคูลัส · เรขาคณิต' },
  physics: { name: 'ฟิสิกส์', emoji: '⚡', color: '#3d8bff', topics: 'กลศาสตร์ · ไฟฟ้า · คลื่น' },
  chemistry: { name: 'เคมี', emoji: '🧪', color: '#22c58b', topics: 'ปริมาณสาร · กรด-เบส · พันธะ' },
  biology: { name: 'ชีววิทยา', emoji: '🧬', color: '#ff9f1c', topics: 'เซลล์ · พันธุกรรม · ร่างกาย' },
  english: { name: 'ภาษาอังกฤษ', emoji: '🔤', color: '#b05cff', topics: 'Grammar · Vocab · Reading' },
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'ง่าย',
  medium: 'กลาง',
  hard: 'ยาก',
};

export const DIFFICULTY_STARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

export const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง'] as const;
