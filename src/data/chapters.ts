// รายชื่อบท ใช้ไฟล์เดียวกับเซิร์ฟเวอร์ (ชื่อภาษาอังกฤษแปลงฝั่งหน้าเว็บ)
import {
  chapterName as chapterNameTh,
  chaptersOf as chaptersOfTh,
  type Chapter,
} from '../../supabase/functions/_shared/chapters';
import { getLang } from '../lib/i18n';
import { CHAPTER_NAMES_EN } from './chaptersEn';

export type { Chapter };

// บทวิชาอังกฤษมีคำอธิบายไทยในวงเล็บ: ตัดออกเมื่อแสดงเป็นภาษาอังกฤษ
const stripThai = (name: string) => name.replace(/\s*\([^)]*[฀-๿][^)]*\)/g, '');

const enName = (id: string): string | undefined => {
  const [level, subject, n] = id.split('.');
  const en = CHAPTER_NAMES_EN[level]?.[subject]?.[Number(n) - 1];
  if (en) return en;
  const th = chapterNameTh(id);
  return th ? stripThai(th) : undefined;
};

/** บททั้งหมดของวิชาในระดับนั้น (ชื่อตามภาษาที่เลือก) */
export function chaptersOf(level: string, subject: string): Chapter[] {
  const list = chaptersOfTh(level, subject);
  return getLang() === 'en' ? list.map((c) => ({ ...c, name: enName(c.id) ?? c.name })) : list;
}

/** ชื่อบทจากรหัส (ไม่พบ = null) */
export function chapterName(id: string): string | null {
  const th = chapterNameTh(id);
  return th && getLang() === 'en' ? (enName(id) ?? th) : th;
}
