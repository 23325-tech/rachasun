// LINE Messaging API (OA): ตรวจลายเซ็น webhook, ตอบกลับ, ส่งข้อความ, ชื่อโปรไฟล์ + ข้อความสรุปรายสัปดาห์
// secrets: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET (ห้ามใส่ในโค้ด)
import { chapterName } from './chapters.ts';

const API = 'https://api.line.me/v2/bot';
const token = () => (Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '').trim();
export const lineConfigured = () => !!token() && !!(Deno.env.get('LINE_CHANNEL_SECRET') ?? '').trim();

/** ตรวจ x-line-signature = base64(HMAC-SHA256(body, channel secret)) */
export async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  const secret = (Deno.env.get('LINE_CHANNEL_SECRET') ?? '').trim();
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function call(path: string, body: unknown): Promise<Response> {
  return await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
}

const text = (t: string) => ({ type: 'text', text: t.slice(0, 4900) });

/** ตอบกลับ (ไม่นับโควตาข้อความ) */
export async function reply(replyToken: string, messages: string[]) {
  const res = await call('/message/reply', { replyToken, messages: messages.slice(0, 5).map(text) });
  if (!res.ok) console.error('line reply failed', res.status);
}

/** ส่งหา (นับโควตาข้อความรายเดือนของ OA) คืน status code */
export async function push(to: string, message: string): Promise<number> {
  const res = await call('/message/push', { to, messages: [text(message)] });
  if (!res.ok) console.error('line push failed', res.status);
  return res.status;
}

export async function displayName(userId: string): Promise<string> {
  const res = await fetch(`${API}/profile/${userId}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) return '';
  const p = await res.json().catch(() => ({}));
  return String(p.displayName ?? '').slice(0, 60);
}

export interface WeeklySummary {
  nickname: string;
  days: number;
  answers: number;
  correct: number;
  lastAnswers: number;
  lastCorrect: number;
  xp: number;
  weak: { chapter: string; answers: number; accuracy: number }[];
  homeworkDone: number;
  homeworkTotal: number;
  mistakesDue: number;
}

const MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pct = (c: number, n: number) => (n > 0 ? Math.round((100 * c) / n) : 0);

/** ข้อความสรุปถึงผู้ปกครอง (week = วันจันทร์ YYYY-MM-DD) */
export function summaryText(s: WeeklySummary, week: string, appUrl: string): string {
  const mon = new Date(`${week}T00:00:00Z`);
  const sun = new Date(mon.getTime() + 6 * 86_400_000);
  const range = `จ. ${mon.getUTCDate()} ${MONTH[mon.getUTCMonth()]} - อา. ${sun.getUTCDate()} ${MONTH[sun.getUTCMonth()]}`;
  const lines = [`สรุปการฝึกของ ${s.nickname}`, `(${range})`, ''];
  if (s.answers === 0) {
    lines.push(`สัปดาห์นี้ ${s.nickname} ยังไม่ได้ฝึกใน Brain Gym`, 'ลองชวนฝึกวันละ 10 ข้อ ใช้เวลาแค่ 5-10 นาทีนะ');
  } else {
    lines.push(`ฝึก ${s.days}/7 วัน รวม ${s.answers} ข้อ`);
    const now = pct(s.correct, s.answers);
    if (s.lastAnswers > 0) {
      const before = pct(s.lastCorrect, s.lastAnswers);
      const diff = now - before;
      lines.push(`ตอบถูก ${now}% (สัปดาห์ก่อน ${before}%${diff > 0 ? ` ดีขึ้น ${diff}%` : diff < 0 ? ` ลดลง ${-diff}%` : ''})`);
    } else {
      lines.push(`ตอบถูก ${now}%`);
    }
    if (s.xp > 0) lines.push(`ได้ ${s.xp} XP`);
  }
  if (s.homeworkTotal > 0) lines.push(`การบ้านที่ครบกำหนดสัปดาห์นี้: ส่ง ${s.homeworkDone}/${s.homeworkTotal} ชิ้น`);
  if (s.weak.length) {
    lines.push('', 'บทที่ควรทบทวน:');
    for (const w of s.weak) lines.push(`- ${chapterName(w.chapter) ?? w.chapter} (ถูก ${Math.round(w.accuracy * 100)}%)`);
  }
  if (s.mistakesDue > 0) lines.push(`ข้อที่เคยผิดและถึงรอบทบทวน: ${s.mistakesDue} ข้อ`);
  if (s.answers > 0) {
    lines.push('', s.days >= 5 ? 'ฝึกสม่ำเสมอมาก ชมเขาหน่อยนะ' : s.days >= 3 ? 'ทำได้ดี ถ้าฝึกเพิ่มอีก 1-2 วันจะยิ่งดีขึ้น' : 'ลองชวนฝึกให้ได้อย่างน้อย 3 วันต่อสัปดาห์นะ');
  }
  lines.push('', `Brain Gym: ${appUrl}`, 'พิมพ์ "สรุป" เพื่อดูสรุปล่าสุด หรือ "ยกเลิก" เพื่อหยุดรับ');
  return lines.join('\n');
}
