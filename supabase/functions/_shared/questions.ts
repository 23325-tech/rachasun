// โจทย์ที่ Edge Functions ใช้ร่วมกัน (room-game, async-play): ชนิดข้อมูล + เลือกโจทย์จากคลัง / ให้ AI สร้างเพิ่ม
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { getTimeLimitSec, type FillAnswer } from './rules.ts';

export const ALL_SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'english'];
const GENERATE_BATCH = 10;

/** โจทย์เต็ม (มีเฉลย) เก็บฝั่งเซิร์ฟเวอร์เท่านั้น */
export interface StoredQuestion {
  id: string;
  subject: 'math' | 'physics' | 'chemistry' | 'biology' | 'english';
  difficulty: 'easy' | 'medium' | 'hard';
  track: string;
  type: 'mcq' | 'fill';
  prompt: string;
  choices: string[] | null;
  answer_index: number | null;
  answer: FillAnswer | null;
  explanation: string;
  time_limit_sec: number | null;
}

/** โจทย์ที่ส่งให้ผู้เล่น (ไม่มีเฉลย) */
export interface PublicQuestion {
  type: 'mcq' | 'fill';
  subject: StoredQuestion['subject'];
  difficulty: StoredQuestion['difficulty'];
  prompt: string;
  choices?: string[];
  answerKind?: 'number' | 'text';
  unit?: string;
}

export interface QuestionSettings {
  subject: string;
  difficulty: string;
  track: string;
}

export const toPublic = (q: StoredQuestion): PublicQuestion => ({
  type: q.type,
  subject: q.subject,
  difficulty: q.difficulty,
  prompt: q.prompt,
  ...(q.type === 'mcq'
    ? { choices: q.choices ?? [] }
    : { answerKind: q.answer?.kind, unit: q.answer?.kind === 'number' ? q.answer.unit : undefined }),
});

export const limitMsOf = (q: StoredQuestion) =>
  getTimeLimitSec({ type: q.type, difficulty: q.difficulty, subject: q.subject, timeLimitSec: q.time_limit_sec }) * 1000;

/** หยิบโจทย์จากคลังแบบสุ่ม ถ้าไม่พอให้ AI สร้างเพิ่ม แล้วสุ่มลำดับ */
export async function pickQuestions(admin: SupabaseClient, settings: QuestionSettings, need: number): Promise<StoredQuestion[]> {
  const subjects = settings.subject === 'all' ? ALL_SUBJECTS : [settings.subject];
  const { data, error } = await admin.rpc('get_random_questions', {
    p_subjects: subjects,
    p_difficulty: settings.difficulty,
    p_track: settings.track,
    p_limit: need,
  });
  if (error) throw error;
  const picked = (data ?? []) as StoredQuestion[];

  const missing = need - picked.length;
  if (missing > 0) {
    const batches: number[] = [];
    for (let left = missing; left > 0; left -= GENERATE_BATCH) batches.push(Math.min(left, GENERATE_BATCH));
    const results = await Promise.allSettled(
      batches.map((count) =>
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-questions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subjects, difficulty: settings.difficulty, track: settings.track, count }),
        }).then((r) => r.json()),
      ),
    );
    for (const r of results) if (r.status === 'fulfilled' && r.value.questions) picked.push(...r.value.questions);
  }
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}
