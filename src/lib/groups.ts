import type { Difficulty, Level, Subject, Track } from '../types';
import { ensureSession, PUBLIC_URL } from './supabase';
import { t } from './i18n';

export interface GroupSettings {
  subject: Subject | 'all';
  difficulty: Difficulty;
  track: Track;
  /** ไม่มี = ม.ปลาย */
  level?: Level;
  count: number;
}

export interface MyGroup {
  id: string;
  code: string;
  name: string;
  settings: GroupSettings;
  members: number;
  playedToday: boolean;
  todayScore: number | null;
}

export interface GroupBoard {
  group: { id: string; code: string; name: string; settings: GroupSettings; isOwner: boolean };
  period: 'day' | 'week';
  from: string;
  today: string;
  rows: { nickname: string; tag: number; avatar: string; isMe: boolean; score: number; played: number }[];
}

const ERRORS: Record<string, string> = {
  get group_not_found() { return t('ไม่พบกลุ่มนี้ ตรวจรหัสอีกครั้งนะ', 'Group not found, check the code'); },
  get group_full() { return t('กลุ่มนี้เต็มแล้ว (สูงสุด 50 คน)', 'Group is full (max 50)'); },
  get too_many_groups() { return t('คุณอยู่ครบ 5 กลุ่มแล้ว ออกจากกลุ่มเดิมก่อนนะ', 'You\'re in 5 groups already — leave one first'); },
  get bad_group_name() { return t('ชื่อกลุ่มใช้ไม่ได้ (2-30 ตัวอักษร และต้องเหมาะสม)', 'Invalid group name (2-30 characters, appropriate)'); },
  get not_member() { return t('คุณไม่ได้อยู่ในกลุ่มนี้', 'You\'re not in this group'); },
  get profile_required() { return t('ตั้งชื่อเล่นก่อนนะ', 'Set a nickname first'); },
  get invalid_settings() { return t('ค่าที่เลือกไม่ถูกต้อง', 'Invalid settings'); },
};

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    throw new Error(key ? ERRORS[key] : error.message);
  }
  return data as T;
}

export const myGroups = () => rpc<MyGroup[]>('my_groups');
export const createGroup = (name: string, s: Omit<GroupSettings, 'count'>) =>
  rpc<{ id: string; code: string }>('create_group', {
    p_name: name.trim(),
    p_subject: s.subject,
    p_difficulty: s.difficulty,
    p_track: s.track,
    p_level: s.level ?? 'upper',
  });
export const joinGroup = (code: string) => rpc<{ id: string; code: string }>('join_group', { p_code: code });
export const leaveGroup = (groupId: string) => rpc<void>('leave_group', { p_group: groupId });
export const groupBoard = (groupId: string, period: 'day' | 'week') =>
  rpc<GroupBoard>('group_board', { p_group: groupId, p_period: period });

/** ลิงก์ชวนเข้ากลุ่ม เช่น https://.../?group=ABC123 */
export const groupLink = (code: string) => `${PUBLIC_URL}/?group=${code}`;
