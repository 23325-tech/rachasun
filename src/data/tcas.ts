import { t } from '../lib/i18n';
import { TCAS_EXAM_AT } from '../../supabase/functions/_shared/tcasDates';

/**
 * ตารางสอบ TCAS70 (ปีการศึกษา 2570) ใช้เป็นวันสอบเริ่มต้นสำหรับนับถอยหลัง นักเรียนแก้เป็นวันของตัวเองได้
 * แหล่งที่ผู้ดูแลให้มา: meddentgat.com/posts/tcas-calendar (TGAT/TPAT), dreamnesthub.com (A-Level)
 * ปีถัดไปแก้ไฟล์นี้ที่เดียว (รหัสวิชาต้องตรงกับ dream_subjects() ใน SQL)
 */
export const TCAS_YEAR = 2570;

export interface TcasSubject {
  key: string;
  group: 'TGAT' | 'TPAT' | 'A-Level';
  name: () => string;
  /** เวลาเริ่มสอบ (เวลาไทย) */
  examAt: string;
  /** วิชาที่มีจำลองสอบในเว็บ (ดึงคะแนนให้อัตโนมัติ) */
  mock?: 'math1' | 'math2' | 'physics' | 'chemistry' | 'biology' | 'english';
}

export const TCAS_SUBJECTS: TcasSubject[] = [
  { key: 'tgat', group: 'TGAT', name: () => t('TGAT รวม', 'TGAT (total)'), examAt: TCAS_EXAM_AT.tgat },
  { key: 'tgat1', group: 'TGAT', name: () => t('TGAT1 สื่อสารภาษาอังกฤษ', 'TGAT1 English'), examAt: TCAS_EXAM_AT.tgat1 },
  { key: 'tgat2', group: 'TGAT', name: () => t('TGAT2 การคิดอย่างมีเหตุผล', 'TGAT2 Critical thinking'), examAt: TCAS_EXAM_AT.tgat2 },
  { key: 'tgat3', group: 'TGAT', name: () => t('TGAT3 สมรรถนะการทำงาน', 'TGAT3 Future workforce'), examAt: TCAS_EXAM_AT.tgat3 },
  { key: 'tpat1', group: 'TPAT', name: () => t('TPAT1 ความถนัดแพทย์ (กสพท)', 'TPAT1 Medicine'), examAt: TCAS_EXAM_AT.tpat1 },
  { key: 'tpat2', group: 'TPAT', name: () => t('TPAT2 ศิลปกรรมศาสตร์', 'TPAT2 Fine arts'), examAt: TCAS_EXAM_AT.tpat2 },
  { key: 'tpat3', group: 'TPAT', name: () => t('TPAT3 วิทย์ เทคโนโลยี วิศวะ', 'TPAT3 Science & engineering'), examAt: TCAS_EXAM_AT.tpat3 },
  { key: 'tpat4', group: 'TPAT', name: () => t('TPAT4 สถาปัตยกรรมศาสตร์', 'TPAT4 Architecture'), examAt: TCAS_EXAM_AT.tpat4 },
  { key: 'tpat5', group: 'TPAT', name: () => t('TPAT5 ครุศาสตร์/ศึกษาศาสตร์', 'TPAT5 Education'), examAt: TCAS_EXAM_AT.tpat5 },
  { key: 'a_math1', group: 'A-Level', name: () => t('คณิตศาสตร์ประยุกต์ 1', 'Applied Math 1'), examAt: TCAS_EXAM_AT.a_math1, mock: 'math1' },
  { key: 'a_math2', group: 'A-Level', name: () => t('คณิตศาสตร์ประยุกต์ 2', 'Applied Math 2'), examAt: TCAS_EXAM_AT.a_math2, mock: 'math2' },
  { key: 'a_phy', group: 'A-Level', name: () => t('ฟิสิกส์', 'Physics'), examAt: TCAS_EXAM_AT.a_phy, mock: 'physics' },
  { key: 'a_chem', group: 'A-Level', name: () => t('เคมี', 'Chemistry'), examAt: TCAS_EXAM_AT.a_chem, mock: 'chemistry' },
  { key: 'a_bio', group: 'A-Level', name: () => t('ชีววิทยา', 'Biology'), examAt: TCAS_EXAM_AT.a_bio, mock: 'biology' },
  { key: 'a_eng', group: 'A-Level', name: () => t('ภาษาอังกฤษ', 'English'), examAt: TCAS_EXAM_AT.a_eng, mock: 'english' },
  { key: 'a_thai', group: 'A-Level', name: () => t('ภาษาไทย', 'Thai'), examAt: TCAS_EXAM_AT.a_thai },
  { key: 'a_soc', group: 'A-Level', name: () => t('สังคมศึกษา', 'Social studies'), examAt: TCAS_EXAM_AT.a_soc },
  { key: 'a_sci', group: 'A-Level', name: () => t('วิทยาศาสตร์ประยุกต์', 'Applied science'), examAt: TCAS_EXAM_AT.a_sci },
  { key: 'a_lang', group: 'A-Level', name: () => t('ภาษาต่างประเทศอื่น', 'Other foreign language'), examAt: TCAS_EXAM_AT.a_lang },
];

export const TCAS_BY_KEY: Record<string, TcasSubject> = Object.fromEntries(TCAS_SUBJECTS.map((s) => [s.key, s]));
