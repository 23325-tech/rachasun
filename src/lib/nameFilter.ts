import { t } from './i18n';
// ต้องตรงกับ public.normalize_nickname / is_nickname_allowed ใน supabase/migrations/20261015010000_profiles_xp.sql
// ฐานข้อมูลตรวจซ้ำอีกชั้นเสมอ ฝั่งนี้มีไว้บอกผู้เล่นทันทีก่อนส่ง

const BANNED = [
  // ไทย
  'ควย', 'เหี้ย', 'เหี้ยะ', 'สัส', 'สัด', 'ไอสัตว์', 'ไอ้สัตว์', 'หี', 'เย็ด', 'แตด', 'ระยำ', 'อีดอก',
  'ดอกทอง', 'กะหรี่', 'ชิบหาย', 'มึง', 'สันดาน', 'จัญไร', 'เงี่ยน', 'ส้นตีน', 'ตอแหล', 'อีห่า', 'พ่อง',
  // อังกฤษ
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigger', 'nigga', 'faggot', 'slut',
  'whore', 'porn', 'sex', 'rape', 'nazi', 'hitler', 'asshole', 'bastard', 'admin', 'moderator',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', $: 's' };

export function normalizeNickname(name: string): string {
  return name
    .toLowerCase()
    .replace(/[01345@$]/g, (c) => LEET[c])
    .replace(/[^a-z฀-๿]/g, '');
}

export type NicknameProblem = 'too_short' | 'too_long' | 'no_letters' | 'inappropriate';

export function checkNickname(name: string): NicknameProblem | null {
  const trimmed = name.trim();
  if ([...trimmed].length < 2) return 'too_short';
  if ([...trimmed].length > 16) return 'too_long';
  const norm = normalizeNickname(trimmed);
  if (!norm) return 'no_letters';
  if (BANNED.some((w) => norm.includes(w))) return 'inappropriate';
  return null;
}

export const NICKNAME_PROBLEM_TEXT: Record<NicknameProblem, string> = {
  get too_short() { return t('ชื่อสั้นไป ต้องมีอย่างน้อย 2 ตัวอักษร', 'Too short — at least 2 characters'); },
  get too_long() { return t('ชื่อยาวไป ไม่เกิน 16 ตัวอักษร', 'Too long — 16 characters max'); },
  get no_letters() { return t('ชื่อต้องมีตัวอักษรไทยหรืออังกฤษ', 'Name needs Thai or English letters'); },
  get inappropriate() { return t('ชื่อนี้ใช้ไม่ได้ ลองชื่ออื่นนะ', "This name isn't allowed, try another"); },
};
