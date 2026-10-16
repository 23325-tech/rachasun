/**
 * วันสอบ TCAS70 (เวลาเริ่ม เวลาไทย) ใช้ร่วมกันระหว่างหน้าเว็บ (src/data/tcas.ts) กับ Edge Function push-send
 * แหล่งที่ผู้ดูแลให้มา: meddentgat.com/posts/tcas-calendar (TGAT/TPAT), dreamnesthub.com (A-Level)
 * ต้องเป็นโค้ดล้วน ไม่ import อะไร / ปีถัดไปแก้ที่นี่ที่เดียว
 */
export const TCAS_EXAM_AT: Record<string, string> = {
  tgat: '2027-01-30T13:00:00+07:00',
  tgat1: '2027-01-30T13:00:00+07:00',
  tgat2: '2027-01-30T13:00:00+07:00',
  tgat3: '2027-01-30T13:00:00+07:00',
  tpat1: '2027-02-13T08:30:00+07:00',
  tpat2: '2027-01-31T13:00:00+07:00',
  tpat3: '2027-01-30T09:00:00+07:00',
  tpat4: '2027-02-01T09:00:00+07:00',
  tpat5: '2027-01-31T09:00:00+07:00',
  a_math1: '2027-03-14T08:30:00+07:00',
  a_math2: '2027-03-15T08:30:00+07:00',
  a_phy: '2027-03-13T11:00:00+07:00',
  a_chem: '2027-03-14T13:30:00+07:00',
  a_bio: '2027-03-13T08:30:00+07:00',
  a_eng: '2027-03-14T11:00:00+07:00',
  a_thai: '2027-03-13T13:30:00+07:00',
  a_soc: '2027-03-13T15:30:00+07:00',
  a_sci: '2027-03-15T11:00:00+07:00',
  a_lang: '2027-03-15T13:30:00+07:00',
};

/** ชื่อวิชาสำหรับข้อความแจ้งเตือน */
export const TCAS_NAME: Record<string, { th: string; en: string }> = {
  tgat: { th: 'TGAT', en: 'TGAT' },
  tgat1: { th: 'TGAT1', en: 'TGAT1' },
  tgat2: { th: 'TGAT2', en: 'TGAT2' },
  tgat3: { th: 'TGAT3', en: 'TGAT3' },
  tpat1: { th: 'TPAT1', en: 'TPAT1' },
  tpat2: { th: 'TPAT2', en: 'TPAT2' },
  tpat3: { th: 'TPAT3', en: 'TPAT3' },
  tpat4: { th: 'TPAT4', en: 'TPAT4' },
  tpat5: { th: 'TPAT5', en: 'TPAT5' },
  a_math1: { th: 'คณิตศาสตร์ประยุกต์ 1', en: 'Applied Math 1' },
  a_math2: { th: 'คณิตศาสตร์ประยุกต์ 2', en: 'Applied Math 2' },
  a_phy: { th: 'ฟิสิกส์', en: 'Physics' },
  a_chem: { th: 'เคมี', en: 'Chemistry' },
  a_bio: { th: 'ชีววิทยา', en: 'Biology' },
  a_eng: { th: 'ภาษาอังกฤษ', en: 'English' },
  a_thai: { th: 'ภาษาไทย', en: 'Thai' },
  a_soc: { th: 'สังคมศึกษา', en: 'Social studies' },
  a_sci: { th: 'วิทยาศาสตร์ประยุกต์', en: 'Applied science' },
  a_lang: { th: 'ภาษาต่างประเทศอื่น', en: 'Other language' },
};
