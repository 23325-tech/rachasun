// Edge Function: ตัดสินเกมในห้องออนไลน์ (เซิร์ฟเวอร์เป็นคนตัดสินทั้งหมด)
// action: start | answer | tick | rematch
// - เฉลยอยู่ใน room_rounds (ลับ) ส่งออกไปเฉพาะตอนเฉลย
// - เวลาตอบวัดจากนาฬิกาเซิร์ฟเวอร์
// - rooms.state.seq ใช้กันสองคำขอเขียนทับกัน (optimistic locking)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  alivePlayers,
  createPlayers,
  isAlive,
  type CardKind,
  resolveRound,
  type BattlePlayer,
  type RoundAnswer,
  type RoundOutcome,
} from '../_shared/battle.ts';
import { rpDelta } from '../_shared/rank.ts';
import { calcPoints, checkFillAnswer, formatFillAnswer } from '../_shared/rules.ts';
import {
  limitMsOf,
  logAnswers,
  pickQuestions as pickFromBank,
  toPublic,
  type PublicQuestion,
  type StoredQuestion,
} from '../_shared/questions.ts';

const COUNTDOWN_MS = 3000;
const REVEAL_MS = 7000;
/** ยอมรับคำตอบที่มาช้ากว่าหมดเวลาเล็กน้อย (เผื่อเน็ตช้า) */
const ANSWER_GRACE_MS = 800;
/** ไม่ส่งสัญญาณนานเกินนี้ = หลุด (หัวใจหมดตอนสรุปข้อ) */
const DISCONNECT_MS = 15000;
const SUDDEN_DEATH_SPARE = 5;
/** การ์ดพลัง: แจกทุกกี่ข้อ (แจกตอนเริ่มข้อ 1, 4, 7, ...) และถือได้สูงสุดกี่ใบ */
const DEAL_EVERY = 3;
const HAND_LIMIT = 3;
const CARD_KINDS: CardKind[] = ['shield', 'fifty', 'slow', 'extra', 'counter'];
/** การ์ดที่กดใช้ได้ (โล่ทำงานเอง) */
const ACTIVE_CARDS = ['fifty', 'slow', 'extra', 'counter'] as const;
type ActiveCard = (typeof ACTIVE_CARDS)[number];
/** ลดเวลาเพื่อนแล้วต้องเหลืออย่างน้อยเท่านี้ */
const SLOW_MIN_MS = 5000;
/** เพิ่มเวลาตัวเอง = สัดส่วนของเวลาเต็ม */
const EXTRA_RATIO = 0.5;
/** ห้องสาธารณะ: เริ่มเมื่อครบ 8 คน หรือมี 2 คนขึ้นไปและผ่านไปเท่านี้นับจากคนแรกเข้าห้อง */
const MATCH_FULL = 8;
const MATCH_WAIT_MS = 30_000;

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

interface Reveal {
  round: number;
  answerIndex?: number;
  answerText?: string;
  explanation: string;
  outcome: RoundOutcome;
  results: Record<string, { correct: boolean; timedOut: boolean; timeMs: number; skipped?: boolean }>;
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
  xp?: Record<string, { gained: number; total: number; rpDelta?: number; rp?: number }>;
  preparingSince?: number;
  /** โหมดการ์ดพลัง */
  items?: boolean;
  /** การ์ดที่แจกตอนเริ่มข้อนี้ (ไว้แสดงแจ้งเตือน) */
  dealt?: { round: number; cards: Record<string, CardKind> };
  /** ใครใช้การ์ดอะไรในข้อนี้ (ไม่บอกผลของ 50/50 และเป้าของยิงสวน) */
  cardUsed?: Record<string, CardKind>;
  /** เส้นตายรายคนที่ถูกปรับด้วยการ์ดเวลา (ไม่มี = ใช้ deadline ปกติ) */
  deadlines?: Record<string, number>;
  /** ใครโดนลดเวลาโดยใคร (ไว้แจ้งเตือน) */
  slowed?: Record<string, string>;
}

interface RoomRow {
  id: string;
  host_id: string;
  kind: 'private' | 'public';
  mode: 'classic' | 'items';
  created_at: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: { subject: string; difficulty: string; track: string; count: number };
  state: GameState | null;
}

// ---------- ฐานข้อมูล ----------

const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function loadRoom(roomId: string): Promise<RoomRow> {
  const { data, error } = await admin.from('rooms').select('id,host_id,kind,mode,created_at,status,settings,state').eq('id', roomId).maybeSingle();
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

const pickQuestions = (settings: RoomRow['settings'], need: number) => pickFromBank(admin, settings, need);

// ---------- ลำดับเกม ----------

async function questionState(room: RoomRow, base: GameState, round: number, startsAt: number): Promise<GameState> {
  const q = await getRoundQuestion(room.id, round, base.totalQuestions);
  const limitMs = limitMsOf(q);

  // แจกการ์ดสุ่มให้คนที่ยังอยู่ ทุก DEAL_EVERY ข้อ
  let players = base.players;
  let dealt = base.dealt;
  if (base.items && round % DEAL_EVERY === 0) {
    const cards: Record<string, CardKind> = {};
    players = players.map((p) => {
      const hand = p.cards ?? {};
      const held = Object.values(hand).reduce((a, b) => a + (b ?? 0), 0);
      if (!isAlive(p) || held >= HAND_LIMIT) return p;
      const card = CARD_KINDS[Math.floor(Math.random() * CARD_KINDS.length)];
      cards[p.id] = card;
      return { ...p, cards: { ...hand, [card]: (hand[card] ?? 0) + 1 } };
    });
    dealt = { round, cards };
  }

  return {
    ...base,
    players,
    dealt,
    cardUsed: {},
    deadlines: {},
    slowed: {},
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

async function start(room: RoomRow, uid: string, auto = false) {
  if (!auto && (room.kind !== 'private' || room.host_id !== uid)) throw new GameError('not_host');
  if (room.status === 'playing') throw new GameError('already_playing');
  const members = await roomPlayers(room.id);
  if (members.length < 2) throw new GameError('need_two_players');
  if (auto) {
    // ห้องสาธารณะ: เซิร์ฟเวอร์ตรวจเงื่อนไขเริ่มเกมเอง
    if (room.kind !== 'public' || room.status !== 'lobby') throw new GameError('not_public_lobby');
    const waited = Date.now() - new Date(room.created_at).getTime();
    if (members.length < MATCH_FULL && waited < MATCH_WAIT_MS) throw new GameError('not_ready');
  }

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
    const items = room.mode === 'items';
    const players = createPlayers(
      members.map((m) => ({ id: m.user_id, name: `${m.nickname}#${m.tag}`, avatar: m.avatar, isBot: false })),
      questionCount,
    ).map((p) => (items ? { ...p, cards: {} } : p));
    const next = await questionState(
      room,
      { ...preparing, questionCount, totalQuestions: questions.length, players, items, dealt: undefined },
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

/** เส้นตายของผู้เล่นคนนี้ (รวมผลการ์ดเวลา) */
const deadlineOf = (s: GameState, uid: string) => s.deadlines?.[uid] ?? s.deadline!;
/** เส้นตายช้าสุดของคนที่ยังอยู่ = เวลาที่ข้อนี้ปิดจริง */
const roundEnd = (s: GameState) => Math.max(s.deadline!, ...alivePlayers(s.players).map((p) => deadlineOf(s, p.id)));

async function answer(room: RoomRow, uid: string, round: number, given: unknown) {
  const s = room.state;
  if (!s || s.phase !== 'question' || s.round !== round) throw new GameError('round_closed');
  const me = s.players.find((p) => p.id === uid);
  if (!me || me.hearts <= 0 || me.rank !== null) throw new GameError('not_alive');
  const now = Date.now();
  if (now < s.startsAt! - 300) throw new GameError('not_started');
  if (now > deadlineOf(s, uid) + ANSWER_GRACE_MS) throw new GameError('too_late');

  const q = await getRoundQuestion(room.id, round, s.totalQuestions);
  const correct =
    q.type === 'mcq' ? Number(given) === q.answer_index : q.answer ? checkFillAnswer(q.answer, String(given ?? '')) : false;
  const timeMs = Math.max(0, Math.min(deadlineOf(s, uid) - s.startsAt!, now - s.startsAt!));

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
        if (everyone || now > roundEnd(s) + ANSWER_GRACE_MS) {
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
    .select('user_id,correct,time_ms,skipped')
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
    const limit = deadlineOf(s, p.id) - s.startsAt!;
    if (!r) return { playerId: p.id, correct: false, timeMs: limit, timedOut: true, points: 0 };
    if (r.skipped) return { playerId: p.id, correct: false, timeMs: limit, timedOut: false, points: 0, skipped: true };
    return {
      playerId: p.id,
      correct: r.correct,
      timeMs: r.time_ms,
      timedOut: false,
      points: calcPoints(r.correct, limit - r.time_ms, limit),
    };
  });

  // ประวัติสำหรับวิเคราะห์จุดอ่อน (ไม่นับข้อที่ข้ามด้วยการ์ด)
  await logAnswers(
    admin,
    q,
    'room',
    answers
      .filter((a) => !a.skipped)
      .map((a) => ({ userId: a.playerId, correct: a.correct, timeMs: a.timeMs, key: `room:${room.id}:${s.startsAt}` })),
  );

  // ยิงสวน: อ่านเป้าจากตารางลับ
  const { data: counters } = await admin
    .from('room_card_uses')
    .select('user_id,payload')
    .eq('room_id', room.id)
    .eq('round', s.round)
    .eq('card', 'counter');
  const redirects = Object.fromEntries(
    (counters ?? []).map((c) => [c.user_id as string, (c.payload as { target: string }).target]),
  );

  const { players, outcome } = resolveRound(before, answers, s.round, s.questionCount, redirects);
  const reveal: Reveal = {
    round: s.round,
    ...(q.type === 'mcq' ? { answerIndex: q.answer_index ?? undefined } : { answerText: q.answer ? formatFillAnswer(q.answer) : '' }),
    explanation: q.explanation,
    outcome: { ...outcome, eliminated: [...new Set([...outcome.eliminated, ...disconnected])] },
    results: Object.fromEntries(
      answers.map((a) => [a.playerId, { correct: a.correct, timedOut: a.timedOut, timeMs: a.timeMs, skipped: !!a.skipped }]),
    ),
    disconnected,
  };

  const next: GameState = { ...s, seq: s.seq + 1, phase: 'reveal', players, reveal, nextAt: now + REVEAL_MS };
  if (outcome.gameOver) {
    await saveState(room, { ...next, phase: 'finished', xp: await awardXp(room, players, s.round + 1) }, 'finished');
  } else {
    await saveState(room, next);
  }
}

/**
 * ใช้การ์ด (ข้อละ 1 ใบต่อคน)
 * - fifty: ข้อปรนัย = ตัด 2 ตัวเลือกผิด (บอกเฉพาะเจ้าตัว) / ข้อเติม = ข้ามข้อ
 * - slow: เวลาที่เหลือของเป้าเหลือครึ่งหนึ่ง (อย่างน้อย 5 วิ) เป้าต้องยังไม่ตอบ
 * - extra: เพิ่มเวลาตัวเอง 50% ของเวลาเต็ม
 * - counter: ถ้าข้อนี้โดนยิง ดาเมจไปตกที่เป้า (เป้าเป็นความลับจนเฉลย)
 */
async function useCard(room: RoomRow, uid: string, round: number, card: string, target?: string): Promise<Record<string, unknown>> {
  const s = room.state;
  if (!(ACTIVE_CARDS as readonly string[]).includes(card)) throw new GameError('unknown_card');
  const kind = card as ActiveCard;
  if (!s || !s.items) throw new GameError('no_items');
  if (s.phase !== 'question' || s.round !== round) throw new GameError('round_closed');
  const me = s.players.find((p) => p.id === uid);
  if (!me || !isAlive(me)) throw new GameError('not_alive');
  const now = Date.now();
  if (now < s.startsAt! - 300 || now > deadlineOf(s, uid)) throw new GameError('round_closed');

  // ใช้ไปแล้วในข้อนี้ -> ส่งผลเดิมกลับไป (เช่น รีเฟรชหน้า)
  const { data: used } = await admin
    .from('room_card_uses')
    .select('card,payload')
    .eq('room_id', room.id)
    .eq('round', round)
    .eq('user_id', uid)
    .maybeSingle();
  if (used) return { card: used.card, ...(used.payload as Record<string, unknown>) };

  if ((me.cards?.[kind] ?? 0) < 1) throw new GameError('no_card');
  if (s.answered.includes(uid) && kind !== 'counter') throw new GameError('already_answered');

  const targetPlayer = target ? s.players.find((p) => p.id === target) : undefined;
  if (kind === 'slow' || kind === 'counter') {
    if (!targetPlayer || targetPlayer.id === uid || !isAlive(targetPlayer)) throw new GameError('bad_target');
  }

  let payload: Record<string, unknown>;
  let deadlinePatch: Record<string, number> = {};
  if (kind === 'fifty') {
    const q = await getRoundQuestion(room.id, round, s.totalQuestions);
    if (q.type === 'mcq') {
      const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer_index);
      for (let i = wrong.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
      }
      payload = { removed: wrong.slice(0, 2).sort() };
    } else {
      payload = { skipped: true };
    }
  } else if (kind === 'slow') {
    if (s.answered.includes(target!)) throw new GameError('target_answered');
    const left = deadlineOf(s, target!) - now;
    if (left <= SLOW_MIN_MS) throw new GameError('target_low_time');
    const newDeadline = Math.round(now + Math.max(left / 2, SLOW_MIN_MS));
    deadlinePatch = { [target!]: newDeadline };
    payload = { target, deadline: newDeadline };
  } else if (kind === 'extra') {
    const newDeadline = Math.round(deadlineOf(s, uid) + s.limitMs! * EXTRA_RATIO);
    deadlinePatch = { [uid]: newDeadline };
    payload = { deadline: newDeadline };
  } else {
    payload = { target };
  }

  const { error } = await admin.from('room_card_uses').insert({ room_id: room.id, round, user_id: uid, card: kind, payload });
  if (error?.code === '23505') return useCard(await loadRoom(room.id), uid, round, card, target);
  if (error) throw error;

  if (payload.skipped) {
    await admin.from('room_answers').insert({
      room_id: room.id,
      round,
      user_id: uid,
      given: null,
      correct: false,
      time_ms: s.limitMs,
      skipped: true,
    });
  }

  // หักการ์ด + ปรับเส้นตาย (ลองใหม่ถ้ามีคนอัปเดต state พร้อมกัน)
  for (let attempt = 0; attempt < 5; attempt++) {
    const fresh = await loadRoom(room.id);
    const st = fresh.state!;
    if (st.round !== round || st.phase !== 'question') break;
    const players = st.players.map((p) =>
      p.id === uid && p.cards ? { ...p, cards: { ...p.cards, [kind]: Math.max(0, (p.cards[kind] ?? 0) - 1) } } : p,
    );
    try {
      await saveState(fresh, {
        ...st,
        seq: st.seq + 1,
        players,
        cardUsed: { ...(st.cardUsed ?? {}), [uid]: kind },
        deadlines: { ...(st.deadlines ?? {}), ...deadlinePatch },
        ...(kind === 'slow' ? { slowed: { ...(st.slowed ?? {}), [target!]: uid } } : {}),
      });
      break;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  if (payload.skipped) await progress(room.id);
  return { card: kind, ...payload };
}

/** XP ให้ทุกห้อง / แต้มแรงค์ (RP) เฉพาะห้องสุ่มจับคู่ */
async function awardXp(room: RoomRow, players: BattlePlayer[], roundsPlayed: number) {
  const roomId = room.id;
  const { data: rounds } = await admin.from('room_rounds').select('round,question').eq('room_id', roomId);
  const { data: answers } = await admin.from('room_answers').select('user_id,round,correct').eq('room_id', roomId);
  const total = rounds?.length ?? 1;
  const diffOf = (round: number) =>
    ((rounds ?? []).find((r) => r.round === round % total)?.question as StoredQuestion | undefined)?.difficulty ?? 'medium';

  const xp: Record<string, { gained: number; total: number; rpDelta?: number; rp?: number }> = {};
  for (const p of players) {
    const c = { easy: 0, medium: 0, hard: 0, challenge: 0 };
    for (const a of answers ?? []) if (a.user_id === p.id && a.correct) c[diffOf(a.round)]++;
    const { data, error } = await admin.rpc('record_online_game', {
      p_user: p.id,
      p_questions: Math.max(1, roundsPlayed),
      p_correct_easy: c.easy,
      p_correct_medium: c.medium,
      p_correct_hard: c.hard,
      p_correct_challenge: c.challenge,
      p_rank: p.rank ?? players.length,
      p_players: players.length,
    });
    const row = (data as { xp_gained: number; xp_total: number }[] | null)?.[0];
    if (!error && row) xp[p.id] = { gained: row.xp_gained, total: row.xp_total };
    if (room.kind === 'public' && xp[p.id]) {
      const { data: rpRow } = await admin.rpc('apply_rank_points', {
        p_user: p.id,
        p_delta: rpDelta(p.rank ?? players.length, players.length),
      });
      const r = (rpRow as { rp_delta: number; rp_total: number }[] | null)?.[0];
      if (r) xp[p.id] = { ...xp[p.id], rpDelta: r.rp_delta, rp: r.rp_total };
    }
  }
  return xp;
}

async function rematch(room: RoomRow, uid: string) {
  if (room.kind !== 'private' || room.host_id !== uid) throw new GameError('not_host');
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
      case 'auto_start':
        // สมาชิกคนไหนก็เรียกได้ เมื่อเห็นว่าน่าจะถึงเวลาเริ่ม
        await start(room, uid, true);
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
      case 'use_card':
        return json({
          ok: true,
          serverNow: Date.now(),
          ...(await useCard(room, uid, Number(body.round), String(body.card), body.target ? String(body.target) : undefined)),
        });
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
