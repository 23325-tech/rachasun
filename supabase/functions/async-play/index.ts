// Edge Function: เล่นชุดโจทย์ล็อกแบบแยกเวลา (ลิงก์ท้าเพื่อน / โจทย์ประจำวันของกลุ่ม)
// เซิร์ฟเวอร์ส่งโจทย์ทีละข้อ จับเวลาเอง ตรวจคำตอบเอง และเฉลยหลังตอบเท่านั้น
// action: create_challenge | start | start_daily | next | answer
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { calcPoints, checkFillAnswer, formatFillAnswer } from '../_shared/rules.ts';
import { limitMsOf, pickQuestions, toPublic, type StoredQuestion } from '../_shared/questions.ts';

const CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000;
const ANSWER_GRACE_MS = 800;
const COUNTS = [5, 10, 20];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DAILY_COUNT = 10;
/** วันที่ตามเวลาไทย (UTC+7) เช่น 2026-10-16 ต้องตรงกับ public.today_th() */
const todayTh = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ ...(body as object), serverNow: Date.now() }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

class PlayError extends Error {}

const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface PlayRow {
  id: string;
  set_id: string;
  user_id: string;
  idx: number;
  served_at: string | null;
  score: number;
  correct: number;
  finished_at: string | null;
}

const randomCode = (len: number) =>
  Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

async function loadSet(setId: string): Promise<StoredQuestion[]> {
  const { data, error } = await admin.from('quiz_sets').select('questions').eq('id', setId).single();
  if (error) throw error;
  return data.questions as StoredQuestion[];
}

async function loadPlay(playId: string, uid: string): Promise<PlayRow> {
  const { data } = await admin.from('quiz_plays').select('*').eq('id', playId).maybeSingle();
  if (!data || data.user_id !== uid) throw new PlayError('play_not_found');
  return data as PlayRow;
}

// ---------- สร้างคำท้า ----------

async function createChallenge(uid: string, settings: Record<string, unknown>) {
  const s = {
    subject: String(settings.subject ?? 'all'),
    difficulty: String(settings.difficulty ?? 'medium'),
    track: String(settings.track ?? 'school'),
    count: Number(settings.count ?? 10),
  };
  if (!COUNTS.includes(s.count)) throw new PlayError('invalid_settings');
  const { data: valid } = await admin.rpc('valid_room_settings', { s });
  if (!valid) throw new PlayError('invalid_settings');

  const questions = (await pickQuestions(admin, s, s.count)).slice(0, s.count);
  if (questions.length < Math.min(5, s.count)) throw new PlayError('no_questions');

  const { data: set, error } = await admin
    .from('quiz_sets')
    .insert({ kind: 'challenge', settings: { ...s, count: questions.length }, questions, created_by: uid })
    .select('id')
    .single();
  if (error) throw error;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode(6);
    const { error: e2 } = await admin.from('challenges').insert({
      code,
      set_id: set.id,
      creator_id: uid,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    });
    if (!e2) return { code };
    if (e2.code !== '23505') throw e2;
  }
  throw new Error('could not allocate challenge code');
}

// ---------- เริ่มเล่น ----------

/** สร้าง play ใหม่ หรือกลับเข้า play เดิมที่ยังเล่นไม่จบ (เล่นได้ชุดละครั้ง) */
async function startPlay(uid: string, setId: string, closed: boolean): Promise<{ playId: string; total: number }> {
  const { data: existing } = await admin
    .from('quiz_plays')
    .select('id,finished_at')
    .eq('set_id', setId)
    .eq('user_id', uid)
    .maybeSingle();
  if (existing?.finished_at) throw new PlayError('already_played');
  const total = (await loadSet(setId)).length;
  if (existing) return { playId: existing.id, total };
  if (closed) throw new PlayError('challenge_expired');
  const { data: play, error } = await admin.from('quiz_plays').insert({ set_id: setId, user_id: uid }).select('id').single();
  if (error?.code === '23505') return startPlay(uid, setId, closed);
  if (error) throw error;
  return { playId: play.id, total };
}

/** โจทย์ประจำวันของกลุ่ม: คนแรกของวันที่กดเล่นเป็นคนสร้างชุด */
async function startDaily(uid: string, groupId: string) {
  const { data: member } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', uid)
    .maybeSingle();
  if (!member) throw new PlayError('not_member');

  const day = todayTh();
  const readDaily = async () =>
    (await admin.from('group_daily').select('set_id').eq('group_id', groupId).eq('day', day).maybeSingle()).data;
  let daily = await readDaily();
  if (!daily) {
    const { data: group } = await admin.from('groups').select('settings').eq('id', groupId).single();
    const questions = (await pickQuestions(admin, group!.settings, DAILY_COUNT)).slice(0, DAILY_COUNT);
    if (questions.length < 5) throw new PlayError('no_questions');
    const { data: set, error } = await admin
      .from('quiz_sets')
      .insert({ kind: 'daily', settings: { ...group!.settings, count: questions.length }, questions, created_by: uid })
      .select('id')
      .single();
    if (error) throw error;
    const { error: e2 } = await admin.from('group_daily').insert({ group_id: groupId, day, set_id: set.id });
    if (e2?.code === '23505') {
      // มีคนในกลุ่มสร้างชุดของวันนี้พร้อมกันพอดี -> ใช้ชุดของเขา
      await admin.from('quiz_sets').delete().eq('id', set.id);
    } else if (e2) {
      throw e2;
    }
    daily = await readDaily();
  }
  return startPlay(uid, daily!.set_id, false);
}

async function startChallenge(uid: string, code: string) {
  const { data: ch } = await admin
    .from('challenges')
    .select('set_id,expires_at')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();
  if (!ch) throw new PlayError('challenge_not_found');
  return startPlay(uid, ch.set_id, new Date(ch.expires_at).getTime() < Date.now());
}

// ---------- ส่งโจทย์ทีละข้อ ----------

/** บันทึกคำตอบ (หรือหมดเวลา) แล้วเลื่อนไปข้อถัดไป; คืน false ถ้ามีคำขออื่นบันทึกข้อนี้ไปแล้ว */
async function record(play: PlayRow, total: number, given: unknown, correct: boolean, timeMs: number, points: number) {
  const { error } = await admin
    .from('quiz_play_answers')
    .insert({ play_id: play.id, idx: play.idx, given: given ?? null, correct, time_ms: timeMs, points });
  if (error?.code === '23505') return false;
  if (error) throw error;
  const done = play.idx + 1 >= total;
  const { error: e2 } = await admin
    .from('quiz_plays')
    .update({
      idx: play.idx + 1,
      served_at: null,
      score: play.score + points,
      correct: play.correct + (correct ? 1 : 0),
      ...(done ? { finished_at: new Date().toISOString() } : {}),
    })
    .eq('id', play.id)
    .eq('idx', play.idx);
  if (e2) throw e2;
  return true;
}

async function next(uid: string, playId: string): Promise<Record<string, unknown>> {
  for (let guard = 0; guard < 50; guard++) {
    const play = await loadPlay(playId, uid);
    const questions = await loadSet(play.set_id);
    if (play.finished_at || play.idx >= questions.length) return { done: true, score: play.score };

    const q = questions[play.idx];
    const limitMs = limitMsOf(q);
    if (!play.served_at) {
      const servedAt = new Date().toISOString();
      const { data: upd } = await admin
        .from('quiz_plays')
        .update({ served_at: servedAt })
        .eq('id', play.id)
        .eq('idx', play.idx)
        .is('served_at', null)
        .select('id');
      if (!upd?.length) continue; // มีคำขออื่นส่งข้อนี้ไปแล้ว อ่านใหม่
      const start = new Date(servedAt).getTime();
      return { index: play.idx, total: questions.length, question: toPublic(q), limitMs, deadline: start + limitMs, score: play.score };
    }

    const start = new Date(play.served_at).getTime();
    if (Date.now() > start + limitMs + ANSWER_GRACE_MS) {
      // ปิดแอพไปกลางข้อจนหมดเวลา -> นับเป็นหมดเวลา แล้วไปข้อถัดไป
      await record(play, questions.length, null, false, limitMs, 0);
      continue;
    }
    return { index: play.idx, total: questions.length, question: toPublic(q), limitMs, deadline: start + limitMs, score: play.score };
  }
  throw new Error('next loop guard');
}

async function answer(uid: string, playId: string, index: number, given: unknown) {
  const play = await loadPlay(playId, uid);
  if (play.finished_at || play.idx !== index || !play.served_at) throw new PlayError('question_closed');
  const questions = await loadSet(play.set_id);
  const q = questions[play.idx];
  const limitMs = limitMsOf(q);
  const elapsed = Date.now() - new Date(play.served_at).getTime();
  const timedOut = given === null || given === undefined || elapsed > limitMs + ANSWER_GRACE_MS;

  const correct =
    !timedOut &&
    (q.type === 'mcq' ? Number(given) === q.answer_index : q.answer ? checkFillAnswer(q.answer, String(given)) : false);
  const timeMs = Math.min(limitMs, Math.max(0, elapsed));
  const points = calcPoints(correct, limitMs - timeMs, limitMs);

  if (!(await record(play, questions.length, timedOut ? null : given, correct, timeMs, points))) {
    throw new PlayError('question_closed');
  }

  const done = play.idx + 1 >= questions.length;
  let xp: { gained: number; total: number } | undefined;
  if (done) xp = await awardXp(play, questions);

  return {
    correct,
    timedOut,
    points,
    score: play.score + points,
    done,
    xp,
    ...(q.type === 'mcq' ? { answerIndex: q.answer_index } : { answerText: q.answer ? formatFillAnswer(q.answer) : '' }),
    explanation: q.explanation,
  };
}

async function awardXp(play: PlayRow, questions: StoredQuestion[]) {
  const { data: answers } = await admin.from('quiz_play_answers').select('idx,correct').eq('play_id', play.id);
  const c = { easy: 0, medium: 0, hard: 0 };
  for (const a of answers ?? []) if (a.correct) c[questions[a.idx].difficulty]++;
  const { data } = await admin.rpc('record_online_game', {
    p_user: play.user_id,
    p_questions: questions.length,
    p_correct_easy: c.easy,
    p_correct_medium: c.medium,
    p_correct_hard: c.hard,
    p_rank: 0, // ไม่มีอันดับในเกม -> ไม่มีโบนัสชนะ
    p_players: 1,
  });
  const row = (data as { xp_gained: number; xp_total: number }[] | null)?.[0];
  return row ? { gained: row.xp_gained, total: row.xp_total } : undefined;
}

// ---------- รับคำขอ ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (!uid) return json({ error: 'not_signed_in' }, 401);
    const { data: profile } = await admin.from('profiles').select('id').eq('id', uid).maybeSingle();
    if (!profile) return json({ error: 'profile_required' }, 400);

    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'create_challenge':
        return json(await createChallenge(uid, body.settings ?? {}));
      case 'start':
        return json(await startChallenge(uid, String(body.code ?? '')));
      case 'start_daily':
        return json(await startDaily(uid, String(body.groupId ?? '')));
      case 'next':
        return json(await next(uid, String(body.playId ?? '')));
      case 'answer':
        return json(await answer(uid, String(body.playId ?? ''), Number(body.index), body.given ?? null));
      default:
        throw new PlayError('unknown_action');
    }
  } catch (e) {
    if (e instanceof PlayError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
