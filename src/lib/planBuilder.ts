// สูตรจัดแผนการฝึกรายสัปดาห์ (ไม่แตะเซิร์ฟเวอร์ ทดสอบได้)
import { ArrowsClockwise, Plant, Target, TrendUp, type Icon } from '@phosphor-icons/react';
import type { Difficulty, Level, Subject } from '../types';
import { chaptersOf } from '../data/chapters';
import { accuracyOf, statusOf, type ChapterStat } from './analysis';
import { t } from './i18n';

export type PlanReason = 'weak' | 'new' | 'ok' | 'review';

export interface PlanItem {
  /** จันทร์ = 0 ... อาทิตย์ = 6 */
  day: number;
  chapter: string;
  difficulty: Difficulty;
  reason: PlanReason;
  done: boolean;
}

export interface PlanPrefs {
  sessionsPerDay: 1 | 2 | 3;
  daysPerWeek: 3 | 4 | 5 | 6 | 7;
  subjects: Subject[];
}

/** วันที่ฝึกตามจำนวนวันต่อสัปดาห์ (เว้นวันพักให้กระจาย) */
export const PLAN_DAYS: Record<PlanPrefs['daysPerWeek'], number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** สัดส่วนรอบฝึก: เน้นบทอ่อน แทรกบทใหม่ และทวนบทที่ถนัดกันลืม */
const SHARE: Record<PlanReason, number> = { weak: 0.5, new: 0.25, ok: 0.15, review: 0.1 };

interface Pick {
  chapter: string;
  difficulty: Difficulty;
  reason: PlanReason;
}

/** เรียงสลับวิชา เช่น คณิต1 ฟิสิกส์1 คณิต2 ฟิสิกส์2 ... */
function interleaveBySubject<T extends { chapter: string }>(list: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const x of list) {
    const s = x.chapter.split('.')[1];
    groups.set(s, [...(groups.get(s) ?? []), x]);
  }
  const out: T[] = [];
  const queues = [...groups.values()];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  return out;
}

/** หยิบ n ตัวจาก pool วนซ้ำได้ถ้าไม่พอ */
function take<T>(pool: T[], n: number): T[] {
  if (!pool.length) return [];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

/** สัดส่วนรอบฝึกต่อวิชา (เช่น จากเป้าคณะในฝัน) ค่าใดๆ ที่ > 0 ระบบปรับเป็นสัดส่วนเอง */
export type SubjectFocus = Partial<Record<Subject, number>>;

/** แบ่ง total รอบตามน้ำหนัก (เศษมากได้ก่อน) ทุกวิชาได้อย่างน้อย 1 รอบถ้าพอ */
export function splitSessions(focus: SubjectFocus, total: number): [Subject, number][] {
  const entries = (Object.entries(focus) as [Subject, number][]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return [];
  const sum = entries.reduce((n, [, w]) => n + w, 0);
  const out = entries.map(([s, w]) => {
    const exact = (total * w) / sum;
    return { s, n: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = total - out.reduce((n, r) => n + r.n, 0);
  for (const r of [...out].sort((a, b) => b.frac - a.frac)) {
    if (left <= 0) break;
    r.n += 1;
    left -= 1;
  }
  // วิชาที่ได้ 0 รอบ ยืมจากวิชาที่ได้มากสุด (ถ้ารอบพอ)
  if (total >= out.length)
    for (const r of out)
      if (r.n === 0) {
        const top = out.reduce((m, x) => (x.n > m.n ? x : m));
        top.n -= 1;
        r.n = 1;
      }
  return out.filter((r) => r.n > 0).map((r) => [r.s, r.n]);
}

export function buildPlan(level: Level, prefs: PlanPrefs, stats: ChapterStat[], focus?: SubjectFocus): PlanItem[] {
  const days = PLAN_DAYS[prefs.daysPerWeek];
  const total = days.length * prefs.sessionsPerDay;
  let seq: Pick[];
  const split = focus ? splitSessions(focus, total).filter(([s]) => chaptersOf(level, s).length) : [];
  if (split.length) {
    // แต่ละวิชาจัดบทของตัวเองตามจำนวนรอบที่ได้ แล้วเกลี่ยสลับวิชาให้ทั่วสัปดาห์
    const parts = split.map(([s, n]) => pickChapters(level, [s], stats, n).map((pick, i) => ({ pick, at: (i + 0.5) / n })));
    seq = parts.flat().sort((a, b) => a.at - b.at).map((x) => x.pick);
  } else {
    seq = pickChapters(level, prefs.subjects, stats, total);
  }
  return seq.slice(0, total).map((p, i) => ({ ...p, day: days[Math.floor(i / prefs.sessionsPerDay)], done: false }));
}

/** เลือกบทสำหรับ total รอบ จากวิชาที่ให้มา (เน้นบทอ่อน แทรกบทใหม่ ทวนบทที่ถนัด) */
function pickChapters(level: Level, subjects: Subject[], stats: ChapterStat[], total: number): Pick[] {
  const byChapter = new Map(stats.map((s) => [s.chapter, s]));
  const chapters = subjects.flatMap((s) => chaptersOf(level, s).map((c) => c.id));
  if (!chapters.length || total <= 0) return [];

  const pools: Record<PlanReason, Pick[]> = { weak: [], new: [], ok: [], review: [] };
  for (const id of chapters) {
    const st = byChapter.get(id);
    const status = statusOf(st);
    if (status === 'weak') pools.weak.push({ chapter: id, difficulty: accuracyOf(st!) < 0.4 ? 'easy' : 'medium', reason: 'weak' });
    else if (status === 'ok') pools.ok.push({ chapter: id, difficulty: 'hard', reason: 'ok' });
    else if (status === 'strong') pools.review.push({ chapter: id, difficulty: 'challenge', reason: 'review' });
    else pools.new.push({ chapter: id, difficulty: status === 'few' ? 'medium' : 'easy', reason: 'new' });
  }
  const acc = (id: string) => (byChapter.get(id) ? accuracyOf(byChapter.get(id)!) : 0);
  pools.weak.sort((a, b) => acc(a.chapter) - acc(b.chapter));
  pools.ok.sort((a, b) => acc(a.chapter) - acc(b.chapter));
  // ทวนบทที่ไม่ได้แตะนานที่สุดก่อน
  pools.review.sort((a, b) => (byChapter.get(a.chapter)!.lastAt < byChapter.get(b.chapter)!.lastAt ? -1 : 1));
  // บทใหม่: บทที่เริ่มทำแล้วก่อน แล้วไล่ตามลำดับในหลักสูตร สลับวิชา
  pools.new = [
    ...pools.new.filter((p) => byChapter.has(p.chapter)),
    ...interleaveBySubject(pools.new.filter((p) => !byChapter.has(p.chapter))),
  ];

  const order: PlanReason[] = ['weak', 'new', 'ok', 'review'];

  // โควตาตามสัดส่วน (เฉพาะกลุ่มที่มีบท) แล้วเติมส่วนที่ขาดด้วยกลุ่มที่มี เรียงตามความสำคัญ
  const quota: Record<PlanReason, number> = { weak: 0, new: 0, ok: 0, review: 0 };
  const available = order.filter((r) => pools[r].length);
  const shareSum = available.reduce((n, r) => n + SHARE[r], 0);
  // บทอ่อนฝึกซ้ำได้สูงสุด 3 รอบต่อสัปดาห์ กลุ่มอื่นบทละรอบ
  const cap = (r: PlanReason) => pools[r].length * (r === 'weak' ? 3 : 1);
  for (const r of available) quota[r] = Math.min(cap(r), Math.floor((total * SHARE[r]) / shareSum));
  let left = total - order.reduce((n, r) => n + quota[r], 0);
  // เติมแบบไม่ซ้ำบทก่อน แล้วค่อยวนซ้ำบทอ่อน
  for (const r of available) {
    const room = Math.max(0, Math.min(left, pools[r].length - quota[r]));
    quota[r] += room;
    left -= room;
  }
  if (left > 0) quota[available[0]] += left;

  // สลับกลุ่มกันไป ไม่ให้วันเดียวมีแต่บทอ่อน
  const lists = order.map((r) => take(pools[r], quota[r]));
  const seq: Pick[] = [];
  while (lists.some((l) => l.length)) for (const l of lists) if (l.length) seq.push(l.shift()!);
  return seq.slice(0, total);
}

/** วันจันทร์ของสัปดาห์นี้ (เวลาไทย) เป็น YYYY-MM-DD และวันนี้เป็นวันที่เท่าไหร่ของสัปดาห์ (จันทร์ = 0) */
export function bangkokWeek(now = Date.now()): { weekStart: string; today: number } {
  const bkk = new Date(now + 7 * 3600_000);
  const today = (bkk.getUTCDay() + 6) % 7;
  const monday = new Date(bkk.getTime() - today * 86_400_000);
  return { weekStart: monday.toISOString().slice(0, 10), today };
}

const DAY_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const DAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** ชื่อวัน (จันทร์ = 0) ตามภาษาที่เลือก */
export const DAY_NAMES: string[] = DAY_TH.map(() => '');
DAY_TH.forEach((th, i) => Object.defineProperty(DAY_NAMES, i, { get: () => t(th, DAY_EN[i]), enumerable: true }));

export const REASON_TEXT: Record<PlanReason, string> = {
  get weak() { return t('เก็บจุดอ่อน', 'Fix weak spot'); },
  get new() { return t('บทใหม่', 'New chapter'); },
  get ok() { return t('ดันให้ถนัด', 'Level up'); },
  get review() { return t('ทวนกันลืม', 'Review'); },
};

export const REASON_ICON: Record<PlanReason, Icon> = { weak: Target, new: Plant, ok: TrendUp, review: ArrowsClockwise };
