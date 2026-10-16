// Edge Function: ทำข้อสอบจำลอง A-Level (เซิร์ฟเวอร์จับเวลาและตรวจ เฉลยไม่ถูกส่งก่อนส่งข้อสอบ)
// actions: list / start / save / submit / review
import { createClient } from 'npm:@supabase/supabase-js@2';
import { formatFillAnswer } from '../_shared/rules.ts';
import {
  BLUEPRINTS,
  FULL_MINUTES,
  indicesOf,
  isCorrect,
  toPublicMock,
  type MockExam,
  type MockQuestion,
} from '../_shared/mock.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** เผื่อเน็ตช้าตอนส่งคำตอบข้อสุดท้าย */
const GRACE_MS = 60_000;

class MockError extends Error {}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface Paper {
  id: string;
  exam: MockExam;
  no: number;
  status: string;
  questions: MockQuestion[];
}
interface Attempt {
  id: string;
  user_id: string;
  paper_id: string;
  half: boolean;
  started_at: string;
  deadline_at: string;
  answers: Record<string, unknown>;
  submitted_at: string | null;
  score: number | null;
  result: GradeResult | null;
}
interface GradeResult {
  earned: number;
  max: number;
  correct: number;
  total: number;
  items: { i: number; correct: boolean }[];
  byChapter: Record<string, { n: number; ok: number }>;
}

async function loadPaper(id: string): Promise<Paper> {
  const { data } = await admin.from('mock_papers').select('*').eq('id', id).maybeSingle();
  if (!data || data.status !== 'ready') throw new MockError('paper_not_found');
  return data as Paper;
}

async function loadAttempt(id: string, uid: string): Promise<Attempt> {
  const { data } = await admin.from('mock_attempts').select('*').eq('id', id).maybeSingle();
  if (!data || data.user_id !== uid) throw new MockError('attempt_not_found');
  return data as Attempt;
}

const expired = (a: Attempt) => Date.now() > Date.parse(a.deadline_at) + GRACE_MS;

/** ตรวจข้อสอบ บันทึกผล ประวัติรายบท และ XP (เรียกซ้ำได้ ตรวจครั้งเดียว) */
async function grade(a: Attempt, paper: Paper): Promise<Attempt> {
  if (a.submitted_at) return a;
  const bp = BLUEPRINTS[paper.exam];
  const idx = indicesOf(paper.questions.length, a.half);
  const items = idx.map((i) => ({ i, correct: isCorrect(paper.questions[i], a.answers[String(i)]) }));
  let earned = 0;
  let max = 0;
  const byChapter: GradeResult['byChapter'] = {};
  const byDiff = { easy: 0, medium: 0, hard: 0, challenge: 0 };
  for (const { i, correct } of items) {
    const q = paper.questions[i];
    max += bp.points[q.type];
    if (correct) {
      earned += bp.points[q.type];
      byDiff[q.difficulty]++;
    }
    byChapter[q.chapter] ??= { n: 0, ok: 0 };
    byChapter[q.chapter].n++;
    if (correct) byChapter[q.chapter].ok++;
  }
  const result: GradeResult = { earned, max, correct: items.filter((x) => x.correct).length, total: items.length, items, byChapter };
  const score = Math.round((10000 * earned) / max) / 100;
  const submittedAt = new Date(Math.min(Date.now(), Date.parse(a.deadline_at) + GRACE_MS)).toISOString();

  // กันส่งซ้ำพร้อมกัน: อัปเดตเฉพาะตอนยังไม่ได้ส่ง
  const { data: saved } = await admin
    .from('mock_attempts')
    .update({ submitted_at: submittedAt, score, result })
    .eq('id', a.id)
    .is('submitted_at', null)
    .select('*')
    .maybeSingle();
  if (!saved) return (await admin.from('mock_attempts').select('*').eq('id', a.id).single()).data as Attempt;

  // ประวัติรายบท (เวลาต่อข้อใช้ค่าเฉลี่ยของทั้งชุด)
  const avgMs = Math.round((Date.parse(submittedAt) - Date.parse(a.started_at)) / Math.max(1, items.length));
  await admin.from('answer_log').upsert(
    items.map(({ i, correct }) => {
      const q = paper.questions[i];
      return {
        user_id: a.user_id,
        question_id: null,
        level: 'upper',
        subject: bp.subject,
        chapter: q.chapter,
        difficulty: q.difficulty,
        correct,
        time_ms: avgMs,
        mode: 'mock',
        source_key: `mock:${a.id}:${i}`,
      };
    }),
    { onConflict: 'user_id,source_key', ignoreDuplicates: true },
  );
  // XP เหมือนเล่นจบ 1 เกม (ไม่มีโบนัสอันดับ)
  await admin.rpc('record_online_game', {
    p_user: a.user_id,
    p_questions: items.length,
    p_correct_easy: byDiff.easy,
    p_correct_medium: byDiff.medium,
    p_correct_hard: byDiff.hard,
    p_correct_challenge: byDiff.challenge,
    p_rank: 2,
    p_players: 2,
  });
  return saved as Attempt;
}

/** สถิติของชุดนี้ (เฉพาะคนที่ส่งแล้ว ความยากเดียวกัน) */
async function paperStats(paperId: string, half: boolean, myScore?: number | null) {
  const { data } = await admin
    .from('mock_attempts')
    .select('score')
    .eq('paper_id', paperId)
    .eq('half', half)
    .not('submitted_at', 'is', null);
  const scores = (data ?? []).map((r) => Number(r.score));
  const takers = scores.length;
  const avg = takers ? scores.reduce((n, s) => n + s, 0) / takers : 0;
  const below = myScore == null ? 0 : scores.filter((s) => s < myScore).length;
  return {
    takers,
    avg: Math.round(avg * 100) / 100,
    top: takers ? Math.max(...scores) : 0,
    // เปอร์เซ็นไทล์: เก่งกว่ากี่ % ของคนที่ทำชุดนี้
    percentile: myScore == null || takers <= 1 ? null : Math.round((100 * below) / (takers - 1)),
  };
}

function minutesOf(half: boolean) {
  return half ? FULL_MINUTES / 2 : FULL_MINUTES;
}

async function list(uid: string) {
  const { data: papers } = await admin.from('mock_papers').select('id,exam,no,target').eq('status', 'ready').order('no');
  const { data: attempts } = await admin
    .from('mock_attempts')
    .select('id,paper_id,half,deadline_at,submitted_at,score,started_at,answers,user_id,result')
    .eq('user_id', uid);
  // ข้อสอบที่หมดเวลาแต่ยังไม่ได้ส่ง -> ตรวจให้เลย
  const mine: Attempt[] = [];
  for (const a of (attempts ?? []) as Attempt[]) {
    if (!a.submitted_at && expired(a)) mine.push(await grade(a, await loadPaper(a.paper_id)));
    else mine.push(a);
  }
  return {
    papers: (papers ?? []).map((p) => ({
      id: p.id,
      exam: p.exam,
      no: p.no,
      title: BLUEPRINTS[p.exam as MockExam].title,
      count: p.target,
      minutes: FULL_MINUTES,
    })),
    attempts: mine.map((a) => ({
      id: a.id,
      paperId: a.paper_id,
      half: a.half,
      deadlineAt: a.deadline_at,
      submitted: !!a.submitted_at,
      score: a.score,
    })),
  };
}

async function start(uid: string, paperId: string, half: boolean) {
  const paper = await loadPaper(paperId);
  const { data: existing } = await admin
    .from('mock_attempts')
    .select('*')
    .eq('user_id', uid)
    .eq('paper_id', paperId)
    .eq('half', half)
    .maybeSingle();
  let a = existing as Attempt | null;
  if (a && (a.submitted_at || expired(a))) {
    a = await grade(a, paper);
    return { attemptId: a.id, submitted: true };
  }
  if (!a) {
    const deadline = new Date(Date.now() + minutesOf(half) * 60_000).toISOString();
    const { data, error } = await admin
      .from('mock_attempts')
      .insert({ user_id: uid, paper_id: paperId, half, deadline_at: deadline })
      .select('*')
      .single();
    if (error?.code === '23505') return start(uid, paperId, half);
    if (error) throw error;
    a = data as Attempt;
  }
  const idx = indicesOf(paper.questions.length, half);
  return {
    attemptId: a.id,
    submitted: false,
    exam: paper.exam,
    no: paper.no,
    title: BLUEPRINTS[paper.exam].title,
    half,
    deadlineAt: a.deadline_at,
    serverNow: Date.now(),
    questions: idx.map((i) => ({ i, ...toPublicMock(paper.questions[i]) })),
    answers: a.answers,
  };
}

function validGiven(q: MockQuestion, given: unknown): boolean {
  if (given === null) return true;
  if (q.type === 'mcq5') return Number.isInteger(given) && (given as number) >= 0 && (given as number) <= 4;
  if (q.type === 'fill') return typeof given === 'string' && given.length <= 20;
  return Array.isArray(given) && given.length === 3 && given.every((g) => g === true || g === false || g === null);
}

async function save(uid: string, attemptId: string, i: number, given: unknown) {
  const a = await loadAttempt(attemptId, uid);
  if (a.submitted_at || expired(a)) throw new MockError('time_up');
  const paper = await loadPaper(a.paper_id);
  if (!indicesOf(paper.questions.length, a.half).includes(i) || !validGiven(paper.questions[i], given)) {
    throw new MockError('invalid_answer');
  }
  const answers = { ...a.answers, [String(i)]: given };
  await admin.from('mock_attempts').update({ answers }).eq('id', a.id).is('submitted_at', null);
  return { ok: true };
}

async function review(uid: string, attemptId: string, submitNow: boolean) {
  let a = await loadAttempt(attemptId, uid);
  const paper = await loadPaper(a.paper_id);
  if (!a.submitted_at) {
    if (!submitNow && !expired(a)) throw new MockError('not_submitted');
    a = await grade(a, paper);
  }
  const r = a.result!;
  return {
    attemptId: a.id,
    exam: paper.exam,
    no: paper.no,
    title: BLUEPRINTS[paper.exam].title,
    half: a.half,
    score: Number(a.score),
    correct: r.correct,
    total: r.total,
    byChapter: r.byChapter,
    stats: await paperStats(paper.id, a.half, Number(a.score)),
    questions: r.items.map(({ i, correct }) => {
      const q = paper.questions[i];
      return {
        i,
        ...toPublicMock(q),
        correct,
        given: a.answers[String(i)] ?? null,
        answerIndex: q.answer_index,
        answerText: q.answer ? formatFillAnswer(q.answer) : undefined,
        truths: q.truths,
        explanation: q.explanation,
      };
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (!uid) return json({ error: 'not_signed_in' }, 401);
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'list':
        return json(await list(uid));
      case 'start':
        return json(await start(uid, String(body.paperId), body.half === true));
      case 'save':
        return json(await save(uid, String(body.attemptId), Number(body.index), body.given ?? null));
      case 'submit':
        return json(await review(uid, String(body.attemptId), true));
      case 'review':
        return json(await review(uid, String(body.attemptId), false));
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    if (e instanceof MockError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
