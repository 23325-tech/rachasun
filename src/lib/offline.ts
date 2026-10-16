import type { Level, Question, Subject } from '../types';
import { ensureSession } from './supabase';
import { fromRow, type QuestionRow } from './questionBank';

/** แพ็กโจทย์ที่เก็บไว้ในเครื่อง (IndexedDB) */
export interface OfflinePack {
  id: string;
  level: Level;
  subject: Subject;
  /** null = ทุกบทของวิชา */
  chapter: string | null;
  questions: Question[];
  savedAt: string;
  bytes: number;
}

/** คำตอบที่ทำตอนออฟไลน์ รอซิงก์ */
export interface PendingAnswer {
  key: string;
  questionId: string;
  given: number | string | null;
  correct: boolean;
  timeMs: number;
  at: string;
}

export const PACK_SIZE = 40;
const DB = 'brain-gym-offline';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('packs', { keyPath: 'id' });
      req.result.createObjectStore('queue', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: 'packs' | 'queue', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => {
      resolve((req ? req.result : undefined) as T);
      db.close();
    };
    t.onerror = () => reject(t.error);
  });
}

export const listPacks = () => tx<OfflinePack[]>('packs', 'readonly', (s) => s.getAll());
export const deletePack = (id: string) => tx<void>('packs', 'readwrite', (s) => void s.delete(id));
export const pendingAnswers = () => tx<PendingAnswer[]>('queue', 'readonly', (s) => s.getAll());

/** ดาวน์โหลดแพ็กใหม่ (ทับแพ็กเดิมของบท/วิชาเดียวกัน) */
export async function downloadPack(level: Level, subject: Subject, chapter: string | null): Promise<OfflinePack> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc('offline_pack', { p_level: level, p_subject: subject, p_chapter: chapter, p_count: PACK_SIZE });
  if (error) throw new Error(error.message);
  const questions = (data as QuestionRow[]).map(fromRow);
  const pack: OfflinePack = {
    id: `${level}:${subject}:${chapter ?? 'all'}`,
    level,
    subject,
    chapter,
    questions,
    savedAt: new Date().toISOString(),
    bytes: new Blob([JSON.stringify(questions)]).size,
  };
  await tx<void>('packs', 'readwrite', (s) => void s.put(pack));
  return pack;
}

/** สุ่มโจทย์จากแพ็ก */
export function pickFromPack(pack: OfflinePack, n = 10): Question[] {
  const a = [...pack.questions];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export async function queueAnswers(items: PendingAnswer[]): Promise<void> {
  await tx<void>('queue', 'readwrite', (s) => {
    for (const it of items) s.put(it);
  });
}

let syncing: Promise<number> | null = null;

/** ส่งคำตอบที่ค้างขึ้นเซิร์ฟเวอร์ (ทีละ 100) คืนจำนวนที่ส่งสำเร็จ */
export function syncPending(): Promise<number> {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!navigator.onLine) return 0;
    const all = await pendingAnswers();
    if (!all.length) return 0;
    const sb = await ensureSession();
    let done = 0;
    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100);
      const { error } = await sb.rpc('sync_offline_answers', { p_items: batch });
      if (error) throw new Error(error.message);
      // บันทึกแล้ว (หรือเคยบันทึก) ลบออกจากคิว
      await tx<void>('queue', 'readwrite', (s) => {
        for (const it of batch) s.delete(it.key);
      });
      done += batch.length;
    }
    return done;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
