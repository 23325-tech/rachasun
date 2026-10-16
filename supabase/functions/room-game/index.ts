// Edge Function: ตัดสินเกมในห้องออนไลน์ (เซิร์ฟเวอร์เป็นคนตัดสินทั้งหมด)
// action: start | answer | tick | rematch
// - เฉลยอยู่ใน room_rounds (ลับ) ส่งออกไปเฉพาะตอนเฉลย
// - เวลาตอบวัดจากนาฬิกาเซิร์ฟเวอร์
// - rooms.state.seq ใช้กันสองคำขอเขียนทับกัน (optimistic locking)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  alivePlayers,
  createPlayers,
  resolveRound,
  type BattlePlayer,
  type RoundAnswer,
  type RoundOutcome,
} from '../_shared/battle.ts';
import { calcPoints, checkFillAnswer, formatFillAnswer, getTimeLimitSec, type FillAnswer } from '../_shared/rules.ts';

const COUNTDOWN_MS = 3000;
const REVEAL_MS = 7000;
/** ยอมรับคำตอบที่มาช้ากว่าหมดเวลาเล็กน้อย (เผื่อเน็ตช้า) */
const ANSWER_GRACE_MS = 800;
/** ไม่ส่งสัญญาณนานเกินนี้ = หลุด (หัวใจหมดตอนสรุปข้อ) */
const DISCONNECT_MS = 15000;
const SUDDEN_DEATH_SPARE = 5;
const GENERATE_BATCH = 10;
const ALL_SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'english'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class GameError extends Error {}
class Conflict extends Error {}

// ---------- ชนิดข้อมูล ----------

interface StoredQuestion {
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
interface PublicQuestion {
  type: 'mcq' | 'fill';
  subject: StoredQuestion['subject'];
  difficulty: StoredQuestion['difficulty'];
  prompt: string;
  choices?: string[];
  answerKind?: 'number' | 'text';
  unit?: string;
}

interface Reveal {
  round: number;
  answerIndex?: number;
  answerText?: string;
  explanation: string;
  outcome: RoundOutcome;
  results: Record<string, { correct: boolean; timedOut: boolean; timeMs: number }>;
  disconnected: string[];
}

interface GameState {
  seq: number;
  phase: 'preparing' | 'question' | 'reveal' | 'finished';
  round: number;
  questionCount: number;
  totalQuestions: number;
  players: BattlePlayer[];
  question?: PublicQuestion;
  startsAt?: number;
  deadline?: number;
  limitMs?: number;
  answered: string[];
  reveal?: Reveal;
  nextAt?: number;
  xp?: Record<string, { gained: number; total: number }>;
  preparingSince?: number;
}

interface RoomRow {
  id: string;
  host_id: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: { subject: string; difficulty: string; track: string; count: number };
  state: GameState | null;
}

// ---------- ฐานข้อมูล ----------

const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function loadRoom(roomId: string): Promise<RoomRow> {
  const { data, error } = await admin.from('rooms').select('id,host_id,status,settings,state').eq('id', roomId).maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError('room_not_found');
  return data as RoomRow;
}

/** บันทึก state ใหม่ ถ้ามีคนอื่นเขียนก่อน (seq ไม่ตรง) จะโยน Conflict ให้ลองใหม่ */
async function saveState(room: RoomRow, next: GameState, status?: RoomRow['status']) {
  let q = admin
    .from('rooms')
    .update({ state: next, ...(status ? { status } : {}) })
    .eq('id', room.id);
  q = room.state ? q.filter('state->>seq', 'eq', String(room.state.seq)) : q.is('state', null).eq('status', room.status);
  const { data, error } = await q.select('id');
  if (error) throw error;
  if (!data?.length) throw new Conflict();
}

async function roomPlayers(roomId: string) {
  const { data, error } = await admin
    .from('room_players')
    .select('user_id,nickname,tag,avatar,last_seen_at,joined_at')
    .eq('room_id', roomId)
    .order('joined_at');
  if (error) throw error;
  return data as { user_id: string; nickname: string; tag: number; avatar: string; last_seen_at: string }[];
}

async function getRoundQuestion(roomId: string, round: number, total: number): Promise<StoredQuestion> {
  const { data, error } = await admin
    .from('room_rounds')
    .select('question')
    .eq('room_id', roomId)
    .eq('round', round % total)
    .single();
  if (error) throw error;
  return data.question as StoredQuestion;
}

const toPublic = (q: StoredQuestion): PublicQuestion => ({
  type: q.type,
  subject: q.subject,
  difficulty: q.difficulty,
  prompt: q.prompt,
  ...(q.type === 'mcq'
    ? { choices: q.choices ?? [] }
    : { answerKind: q.answer?.kind, unit: q.answer?.kind === 'number' ? q.answer.unit : undefined }),
});

const limitMsOf = (q: StoredQuestion) =>
  getTimeLimitSec({ type: q.type, difficulty: q.difficulty, subject: q.subject, timeLimitSec: q.time_limit_sec }) * 1000;

// ---------- โหลดโจทย์ตอนเริ่มเกม ----------

async function pickQuestions(settings: RoomRow['settings'], need: number): Promise<StoredQuestion[]> {
  const subjects = settings.subject === 'all' ? ALL_SUBJECTS : [settings.subject];
  const { data, error } = await admin.rpc('get_random_questions', {
    p_subjects: subjects,
    p_difficulty: settings.difficulty,
    p_track: settings.track,
    p_limit: need,
  });
  if (error) throw error;
  const picked = (data ?? []) as StoredQuestion[];

  // คลังไม่พอ -> ให้ AI สร้างเพิ่ม
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
  // สุ่มลำดับ
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

// ---------- ลำดับเกม ----------

async function questionState(room: RoomRow, base: GameState, round: number, startsAt: number): Promise<GameState> {
  const q = await getRoundQuestion(room.id, round, base.totalQuestions);
  const limitMs = limitMsOf(q);
  return {
    ...base,
    seq: base.seq + 1,
    phase: 'question',
    round,
    question: toPublic(q),
    startsAt,
    limitMs,
    deadline: startsAt + limitMs,
    answered: [],
    nextAt: undefined,
  };
}

async function start(room: RoomRow, uid: string) {
  if (room.host_id !== uid) throw new GameError('not_host');
  if (room.status === 'playing') throw new GameError('already_playing');
  const members = await roomPlayers(room.id);
  if (members.length < 2) throw new GameError('need_two_players');

  const preparing: GameState = {
    seq: (room.state?.seq ?? 0) + 1,
    phase: 'preparing',
    round: 0,
    questionCount: room.settings.count,
    totalQuestions: 0,
    players: [],
    answered: [],
    preparingSince: Date.now(),
  };
  await saveState(room, preparing, 'playing');
  room = { ...room, status: 'playing', state: preparing };

  try {
    const questions = await pickQuestions(room.settings, room.settings.count + SUDDEN_DEATH_SPARE);
    if (questions.length < 2) throw new GameError('no_questions');

    await admin.from('room_rounds').delete().eq('room_id', room.id);
    await admin.from('room_answers').delete().eq('room_id', room.id);
    const { error } = await admin
      .from('room_rounds')
      .insert(questions.map((q, i) => ({ room_id: room.id, round: i, question: q })));
    if (error) throw error;

    const questionCount = Math.min(room.settings.count, questions.length);
    const players = createPlayers(
      members.map((m) => ({ id: m.user_id, name: `${m.nickname}#${m.tag}`, avatar: m.avatar, isBot: false })),
      questionCount,
    );
    const next = await questionState(
      room,
      { ...preparing, questionCount, totalQuestions: questions.length, players },
      0,
      Date.now() + COUNTDOWN_MS,
    );
    await saveState(room, next);
  } catch (e) {
    // เตรียมโจทย์ไม่สำเร็จ -> กลับล็อบบี้
    await admin.from('rooms').update({ status: 'lobby', state: null }).eq('id', room.id);
    throw e;
  }
}

async function answer(room: RoomRow, uid: string, round: number, given: unknown) {
  const s = room.state;
  if (!s || s.phase !== 'question' || s.round !== round) throw new GameError('round_closed');
  const me = s.players.find((p) => p.id === uid);
  if (!me || me.hearts <= 0 || me.rank !== null) throw new GameError('not_alive');
  const now = Date.now();
  if (now < s.startsAt! - 300) throw new GameError('not_started');
  if (now > s.deadline! + ANSWER_GRACE_MS) throw new GameError('too_late');

  const q = await getRoundQuestion(room.id, round, s.totalQuestions);
  const correct =
    q.type === 'mcq' ? Number(given) === q.answer_index : q.answer ? checkFillAnswer(q.answer, String(given ?? '')) : false;
  const timeMs = Math.max(0, Math.min(s.limitMs!, now - s.startsAt!));

  const { error } = await admin
    .from('room_answers')
    .insert({ room_id: room.id, round, user_id: uid, given: given ?? null, correct, time_ms: timeMs });
  if (error && error.code !== '23505') throw error; // 23505 = ตอบไปแล้ว

  await progress(room.id);
}

/** ดูว่าถึงเวลาสรุปข้อ / ขึ้นข้อถัดไปหรือยัง (เรียกซ้ำได้ ปลอดภัย) */
async function progress(roomId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await loadRoom(roomId);
    const s = room.state;
    if (!s || room.status !== 'playing') return;
    const now = Date.now();
    try {
      if (s.phase === 'question') {
        const { data: ans } = await admin
          .from('room_answers')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('round', s.round);
        const answered = (ans ?? []).map((a) => a.user_id as string);
        const alive = alivePlayers(s.players).map((p) => p.id);
        const everyone = alive.every((id) => answered.includes(id));
        if (everyone || now > s.deadline! + ANSWER_GRACE_MS) {
          await resolve(room);
        } else if (answered.length !== s.answered.length) {
          await saveState(room, { ...s, seq: s.seq + 1, answered });
        }
      } else if (s.phase === 'reveal' && now >= s.nextAt!) {
        await saveState(room, await questionState(room, s, s.round + 1, now + 1200));
      } else if (s.phase === 'preparing' && now - (s.preparingSince ?? now) > 90_000) {
        await admin.from('rooms').update({ status: 'lobby', state: null }).eq('id', roomId);
      }
      return;
    } catch (e) {
      if (e instanceof Conflict) continue; // มีคนอัปเดตก่อน ลองอ่านใหม่
      throw e;
    }
  }
}

async function resolve(room: RoomRow) {
  const s = room.state!;
  const now = Date.now();
  const q = await getRoundQuestion(room.id, s.round, s.totalQuestions);
  const { data: rows } = await admin
    .from('room_answers')
    .select('user_id,correct,time_ms')
    .eq('room_id', room.id)
    .eq('round', s.round);
  const byUser = new Map((rows ?? []).map((r) => [r.user_id as string, r]));

  // คนหลุด: ไม่ส่งสัญญาณเกิน 15 วินาที หรือออกจากห้องไปแล้ว -> หัวใจหมด
  const members = await roomPlayers(room.id);
  const seen = new Map(members.map((m) => [m.user_id, new Date(m.last_seen_at).getTime()]));
  const disconnected = alivePlayers(s.players)
    .filter((p) => !byUser.has(p.id))
    .filter((p) => !seen.has(p.id) || now - seen.get(p.id)! > DISCONNECT_MS)
    .map((p) => p.id);
  const before = s.players.map((p) => (disconnected.includes(p.id) ? { ...p, hearts: 0 } : p));

  const answers: RoundAnswer[] = alivePlayers(before).map((p) => {
    const r = byUser.get(p.id);
    if (!r) return { playerId: p.id, correct: false, timeMs: s.limitMs!, timedOut: true, points: 0 };
    return {
      playerId: p.id,
      correct: r.correct,
      timeMs: r.time_ms,
      timedOut: false,
      points: calcPoints(r.correct, s.limitMs! - r.time_ms, s.limitMs!),
    };
  });

  const { players, outcome } = resolveRound(before, answers, s.round, s.questionCount);
  const reveal: Reveal = {
    round: s.round,
    ...(q.type === 'mcq' ? { answerIndex: q.answer_index ?? undefined } : { answerText: q.answer ? formatFillAnswer(q.answer) : '' }),
    explanation: q.explanation,
    outcome: { ...outcome, eliminated: [...new Set([...outcome.eliminated, ...disconnected])] },
    results: Object.fromEntries(answers.map((a) => [a.playerId, { correct: a.correct, timedOut: a.timedOut, timeMs: a.timeMs }])),
    disconnected,
  };

  const next: GameState = { ...s, seq: s.seq + 1, phase: 'reveal', players, reveal, nextAt: now + REVEAL_MS };
  if (outcome.gameOver) {
    await saveState(room, { ...next, phase: 'finished', xp: await awardXp(room.id, players, s.round + 1) }, 'finished');
  } else {
    await saveState(room, next);
  }
}

async function awardXp(roomId: string, players: BattlePlayer[], roundsPlayed: number) {
  const { data: rounds } = await admin.from('room_rounds').select('round,question').eq('room_id', roomId);
  const { data: answers } = await admin.from('room_answers').select('user_id,round,correct').eq('room_id', roomId);
  const total = rounds?.length ?? 1;
  const diffOf = (round: number) =>
    ((rounds ?? []).find((r) => r.round === round % total)?.question as StoredQuestion | undefined)?.difficulty ?? 'medium';

  const xp: Record<string, { gained: number; total: number }> = {};
  for (const p of players) {
    const c = { easy: 0, medium: 0, hard: 0 };
    for (const a of answers ?? []) if (a.user_id === p.id && a.correct) c[diffOf(a.round)]++;
    const { data, error } = await admin.rpc('record_online_game', {
      p_user: p.id,
      p_questions: Math.max(1, roundsPlayed),
      p_correct_easy: c.easy,
      p_correct_medium: c.medium,
      p_correct_hard: c.hard,
      p_rank: p.rank ?? players.length,
      p_players: players.length,
    });
    const row = (data as { xp_gained: number; xp_total: number }[] | null)?.[0];
    if (!error && row) xp[p.id] = { gained: row.xp_gained, total: row.xp_total };
  }
  return xp;
}

async function rematch(room: RoomRow, uid: string) {
  if (room.host_id !== uid) throw new GameError('not_host');
  if (room.status !== 'finished') throw new GameError('not_finished');
  await admin.from('room_rounds').delete().eq('room_id', room.id);
  await admin.from('room_answers').delete().eq('room_id', room.id);
  await admin.from('rooms').update({ status: 'lobby', state: null }).eq('id', room.id).eq('status', 'finished');
}

// ---------- รับคำขอ ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (!uid) return json({ error: 'not_signed_in', serverNow: Date.now() }, 401);

    const body = await req.json().catch(() => ({}));
    const roomId = String(body.roomId ?? '');
    const room = await loadRoom(roomId);

    const { data: member } = await admin
      .from('room_players')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', uid)
      .maybeSingle();
    if (!member) throw new GameError('not_in_room');

    switch (body.action) {
      case 'start':
        await start(room, uid);
        break;
      case 'answer':
        await answer(room, uid, Number(body.round), body.given);
        break;
      case 'tick':
        await progress(roomId);
        break;
      case 'rematch':
        await rematch(room, uid);
        break;
      case 'ping':
        // ใช้วัดส่วนต่างนาฬิกา (คำตอบมี serverNow)
        break;
      default:
        throw new GameError('unknown_action');
    }
    return json({ ok: true, serverNow: Date.now() });
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message, serverNow: Date.now() }, 400);
    if (e instanceof Conflict) return json({ error: 'busy_try_again', serverNow: Date.now() }, 409);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e), serverNow: Date.now() }, 500);
  }
});
