import type { Level, Subject } from '../types';
import { ensureSession } from './supabase';
import { bangkokWeek, buildPlan, type PlanItem, type PlanPrefs } from './planBuilder';
import type { ChapterStat } from './analysis';
import { getLang, t } from './i18n';

export interface StudyPlan {
  level: Level;
  weekStart: string;
  prefs: PlanPrefs;
  items: PlanItem[];
  advice: string | null;
  adviceAt: string | null;
}

interface Row {
  level: Level;
  week_start: string;
  sessions_per_day: PlanPrefs['sessionsPerDay'];
  days_per_week: PlanPrefs['daysPerWeek'];
  subjects: Subject[];
  items: PlanItem[];
  advice: string | null;
  advice_at: string | null;
}

const fromRow = (r: Row): StudyPlan => ({
  level: r.level,
  weekStart: r.week_start,
  prefs: { sessionsPerDay: r.sessions_per_day, daysPerWeek: r.days_per_week, subjects: r.subjects },
  items: r.items,
  advice: r.advice,
  adviceAt: r.advice_at,
});

export async function loadPlan(level: Level): Promise<StudyPlan | null> {
  const sb = await ensureSession();
  const { data, error } = await sb.from('study_plans').select('*').eq('level', level).maybeSingle();
  if (error) throw new Error(t(`โหลดแผนไม่สำเร็จ: ${error.message}`, `Couldn't load plan: ${error.message}`));
  return data ? fromRow(data as Row) : null;
}

/** จัดแผนสัปดาห์นี้ใหม่จากสถิติล่าสุด แล้วบันทึก (คำแนะนำ AI เดิมยังอยู่) */
export async function rebuildPlan(level: Level, prefs: PlanPrefs, stats: ChapterStat[]): Promise<StudyPlan> {
  const sb = await ensureSession();
  const { weekStart } = bangkokWeek();
  const fields = {
    week_start: weekStart,
    sessions_per_day: prefs.sessionsPerDay,
    days_per_week: prefs.daysPerWeek,
    subjects: prefs.subjects,
    items: buildPlan(level, prefs, stats),
    updated_at: new Date().toISOString(),
  };
  // มีแผนอยู่แล้ว -> แก้ไข / ยังไม่มี -> สร้าง (คอลัมน์คำแนะนำ AI แก้จากหน้าเว็บไม่ได้)
  const upd = await sb.from('study_plans').update(fields).eq('level', level).select('*');
  if (upd.error) throw new Error(t(`บันทึกแผนไม่สำเร็จ: ${upd.error.message}`, `Couldn't save plan: ${upd.error.message}`));
  if (upd.data?.length) return fromRow(upd.data[0] as Row);
  const ins = await sb.from('study_plans').insert({ level, ...fields }).select('*').single();
  if (ins.error) throw new Error(t(`บันทึกแผนไม่สำเร็จ: ${ins.error.message}`, `Couldn't save plan: ${ins.error.message}`));
  return fromRow(ins.data as Row);
}

/** ติ๊กว่ารอบที่ index ในแผนทำเสร็จแล้ว */
export async function markPlanDone(level: Level, index: number): Promise<void> {
  const plan = await loadPlan(level);
  if (!plan || !plan.items[index] || plan.items[index].done) return;
  const items = plan.items.map((it, i) => (i === index ? { ...it, done: true } : it));
  const sb = await ensureSession();
  await sb.from('study_plans').update({ items, updated_at: new Date().toISOString() }).eq('level', level);
}

/** ขอคำแนะนำจาก AI (วันละครั้ง ถ้าขอซ้ำจะได้อันเดิมของวันนี้) */
export async function requestAdvice(level: Level): Promise<{ advice: string; adviceAt: string }> {
  const sb = await ensureSession();
  const { data, error } = await sb.functions.invoke<{ advice: string; adviceAt: string }>('study-coach', { body: { level, lang: getLang() } });
  if (error || !data) throw new Error(t('ขอคำแนะนำไม่สำเร็จ ลองใหม่อีกครั้งนะ', 'Couldn\'t get advice, please try again'));
  return data;
}
