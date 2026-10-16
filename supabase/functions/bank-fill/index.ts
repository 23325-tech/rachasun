// Edge Function: เติมคลังโจทย์อัตโนมัติ (pg_cron เรียกทุก 10 นาที ช่วงตี 2 - ตี 5 เวลาไทย)
// 1) คืนวันจันทร์: เปิดชุดข้อสอบจำลอง A-Level ใหม่ครบทุกวิชา
// 2) มีชุดที่กำลังสร้าง: ให้ mock-build เติมอีก 2 ช่วง
// 3) ยังไม่ครบโควตาวันนี้: ให้ AI สร้างโจทย์ให้ช่องที่มีโจทย์น้อยที่สุด
// เรียกได้เฉพาะเมื่อมี header x-cron-secret ตรงกับ secret BANK_FILL_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chaptersOf } from '../_shared/chapters.ts';
import { LEVEL_SUBJECTS } from '../_shared/questions.ts';

const DAILY_QUOTA = 100;
const PER_CELL = 5;
const CELLS_PER_RUN = 2;
const MOCK_STEPS_PER_RUN = 2;

const LEVEL_TRACKS: Record<string, string[]> = {
  primary: ['school', 'entrance'],
  lower: ['school', 'entrance'],
  upper: ['school', 'entrance'],
  uni: ['school'],
};
const DIFFICULTIES = ['easy', 'medium', 'hard', 'challenge'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey);

const callFn = (name: string, body: unknown) =>
  fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/** วันที่และวันในสัปดาห์แบบเวลาไทย (จันทร์ = 0) และเวลาเริ่มวันจันทร์ของสัปดาห์นี้ */
function bangkok(now = Date.now()) {
  const bkk = new Date(now + 7 * 3600_000);
  const weekday = (bkk.getUTCDay() + 6) % 7;
  const day = bkk.toISOString().slice(0, 10);
  const mondayMs = Date.parse(day) - weekday * 86_400_000 - 7 * 3600_000;
  return { day, weekday, mondayIso: new Date(mondayMs).toISOString() };
}

interface Cell {
  level: string;
  subject: string;
  chapter: string;
  difficulty: string;
  track: string;
  n: number;
}

async function emptiestCells(k: number): Promise<Cell[]> {
  const { data, error } = await admin.rpc('bank_counts');
  if (error) throw error;
  const have = new Map((data ?? []).map((r: { chapter: string; difficulty: string; track: string; n: number }) => [`${r.chapter}|${r.difficulty}|${r.track}`, r.n]));
  const cells: Cell[] = [];
  for (const [level, subjects] of Object.entries(LEVEL_SUBJECTS))
    for (const subject of subjects)
      for (const c of chaptersOf(level, subject))
        for (const difficulty of DIFFICULTIES)
          for (const track of LEVEL_TRACKS[level])
            cells.push({ level, subject, chapter: c.id, difficulty, track, n: have.get(`${c.id}|${difficulty}|${track}`) ?? 0 });
  // น้อยสุดก่อน ช่องที่เท่ากันสุ่มลำดับ และไม่เอาบทซ้ำในรอบเดียว
  cells.sort((a, b) => a.n - b.n || Math.random() - 0.5);
  const picked: Cell[] = [];
  for (const c of cells) {
    if (picked.length >= k) break;
    if (!picked.some((p) => p.chapter === c.chapter)) picked.push(c);
  }
  return picked;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('BANK_FILL_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403);

  const report: Record<string, unknown> = {};
  try {
    const { day, weekday, mondayIso } = bangkok();

    // 1) ชุดข้อสอบจำลองใหม่ประจำสัปดาห์ (คืนวันจันทร์ ครั้งเดียว)
    if (weekday === 0) {
      const { count } = await admin.from('mock_papers').select('id', { count: 'exact', head: true }).gte('created_at', mondayIso);
      if (!count) report.mockCreate = (await callFn('mock-build', { action: 'create' })).body;
    }

    // 2) เติมชุดข้อสอบที่ยังสร้างไม่เสร็จ
    const steps = [];
    for (let i = 0; i < MOCK_STEPS_PER_RUN; i++) {
      const r = await callFn('mock-build', { action: 'step' });
      if (r.body.idle) break;
      steps.push(r.body);
    }
    if (steps.length) report.mockSteps = steps;

    // 3) เติมคลังโจทย์ฝึก
    const { data: log } = await admin.from('bank_fill_log').select('questions').eq('day', day).maybeSingle();
    const done = log?.questions ?? 0;
    if (done >= DAILY_QUOTA) {
      report.bank = `quota reached (${done})`;
      return json(report);
    }
    const cells = await emptiestCells(CELLS_PER_RUN);
    const results = await Promise.all(
      cells.map((c) =>
        callFn('generate-questions', {
          subjects: [c.subject],
          difficulty: c.difficulty,
          track: c.track,
          level: c.level,
          chapters: [c.chapter],
          count: Math.min(PER_CELL, DAILY_QUOTA - done),
        }),
      ),
    );
    const added = results.reduce((n, r) => n + (r.body.questions?.length ?? 0), 0);
    const total = added ? (await admin.rpc('bank_fill_add', { p_day: day, p_n: added })).data : done;
    report.bank = {
      cells: cells.map((c, i) => ({ ...c, added: results[i].body.questions?.length ?? 0, error: results[i].body.error })),
      today: total,
    };
    return json(report);
  } catch (e) {
    console.error(e);
    return json({ ...report, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
