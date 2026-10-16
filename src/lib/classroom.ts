import type { Difficulty, Level, Subject, Track } from '../types';
import { ensureSession } from './supabase';
import { t } from './i18n';

export interface ClassListing {
  teaching: { id: string; name: string; code: string; students: number }[];
  joined: { id: string; name: string; teacher: string | null; pending: number }[];
}

export interface HomeworkSettings {
  subject: Subject | 'all';
  difficulty: Difficulty;
  track: Track;
  level: Level;
  count: number;
  /** การบ้านจากคลังโจทย์ของครู */
  custom?: boolean;
}

export interface StudentClassView {
  id: string;
  name: string;
  role: 'student';
  teacher: string | null;
  announcement: string;
  announcedAt: string | null;
  consentedAt: string;
  homework: {
    id: string;
    title: string;
    dueAt: string;
    settings: HomeworkSettings;
    count: number;
    done: boolean;
    started: boolean;
    correct: number | null;
    score: number | null;
  }[];
}

export interface TeacherClassView {
  id: string;
  name: string;
  code: string;
  role: 'teacher';
  announcement: string;
  announcedAt: string | null;
  students: { id: string; nickname: string; tag: number; avatar: string; joinedAt: string; answers: number; accuracy: number | null; hwDone: number }[];
  homework: { id: string; title: string; dueAt: string; settings: HomeworkSettings; count: number; done: number; avgCorrect: number | null }[];
  weakChapters: { chapter: string; answers: number; accuracy: number }[];
}

export interface StudentDetail {
  chapters: { chapter: string; answers: number; accuracy: number; avgMs: number }[];
  homework: { title: string; dueAt: string; count: number; done: boolean; correct: number | null; finishedAt: string | null }[];
}

const ERRORS: Record<string, () => string> = {
  class_not_found: () => t('ไม่พบห้องเรียนนี้ ตรวจรหัสอีกครั้งนะ', 'Classroom not found, check the code'),
  consent_required: () => t('ต้องกดยินยอมก่อนเข้าห้องเรียน', 'Please give consent before joining'),
  own_class: () => t('นี่เป็นห้องที่คุณสอนอยู่', 'This is a class you teach'),
  too_many_joined: () => t('อยู่ได้สูงสุด 5 ห้อง ออกจากห้องเดิมก่อนนะ', 'Up to 5 classes — leave one first'),
  too_many_classes: () => t('สร้างได้สูงสุด 10 ห้อง', 'You can create up to 10 classes'),
  class_full: () => t('ห้องนี้เต็มแล้ว (สูงสุด 60 คน)', 'This class is full (max 60)'),
  bad_class_name: () => t('ชื่อห้องใช้ไม่ได้ (2-30 ตัวอักษร และต้องเหมาะสม)', 'Invalid class name (2-30 characters, appropriate)'),
  bad_text: () => t('ประกาศมีคำไม่เหมาะสม', 'Announcement contains inappropriate words'),
  not_allowed: () => t('คุณไม่มีสิทธิ์ทำแบบนี้', "You're not allowed to do that"),
  profile_required: () => t('ตั้งชื่อเล่นก่อนนะ', 'Set a nickname first'),
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    throw new Error(code ? ERRORS[code]() : t('ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง', 'Something went wrong, please try again'));
  }
  return data as T;
}

export const fetchMyClasses = () => rpc<ClassListing>('my_classrooms');
export const fetchClass = (id: string) => rpc<StudentClassView | TeacherClassView>('classroom_view', { p_class: id });
export const fetchStudent = (classId: string, userId: string) => rpc<StudentDetail>('classroom_student', { p_class: classId, p_user: userId });
export const createClass = (name: string) => rpc<string>('create_classroom', { p_name: name });
export const joinClass = (code: string, consent: boolean) => rpc<string>('join_classroom', { p_code: code, p_consent: consent });
export const leaveClass = (id: string, userId?: string) => rpc<void>('leave_classroom', { p_class: id, p_user: userId ?? null });
export const deleteClass = (id: string) => rpc<void>('delete_classroom', { p_class: id });
export const setAnnouncement = (id: string, text: string) => rpc<void>('set_class_announcement', { p_class: id, p_text: text });
export const deleteHomework = (id: string) => rpc<void>('delete_homework', { p_homework: id });
