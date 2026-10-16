import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const SECRET = 'test-channel-secret';
beforeAll(() => {
  (globalThis as { Deno?: unknown }).Deno = { env: { get: (k: string) => (k === 'LINE_CHANNEL_SECRET' ? SECRET : k === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'x' : undefined) } };
});

describe('LINE webhook signature', () => {
  it('accepts a correct signature and rejects tampering', async () => {
    const { verifySignature } = await import('./line');
    const body = JSON.stringify({ events: [{ type: 'follow' }] });
    const sig = createHmac('sha256', SECRET).update(body).digest('base64');
    expect(await verifySignature(body, sig)).toBe(true);
    expect(await verifySignature(body + ' ', sig)).toBe(false);
    expect(await verifySignature(body, null)).toBe(false);
  });
});

describe('parent summary text', () => {
  it('shows progress vs last week, homework and weak chapters', async () => {
    const { summaryText } = await import('./line');
    const text = summaryText(
      { nickname: 'ฟ้าใส', days: 4, answers: 50, correct: 35, lastAnswers: 40, lastCorrect: 24, xp: 320,
        weak: [{ chapter: 'upper.math.7', answers: 8, accuracy: 0.38 }], homeworkDone: 1, homeworkTotal: 2, mistakesDue: 6 },
      '2026-10-12', 'https://example.app',
    );
    expect(text).toContain('สรุปการฝึกของ ฟ้าใส');
    expect(text).toContain('จ. 12 ต.ค. - อา. 18 ต.ค.');
    expect(text).toContain('ฝึก 4/7 วัน รวม 50 ข้อ');
    expect(text).toContain('ตอบถูก 70% (สัปดาห์ก่อน 60% ดีขึ้น 10%)');
    expect(text).toContain('ส่ง 1/2 ชิ้น');
    expect(text).toContain('(ถูก 38%)');
    expect(text).toContain('6 ข้อ');
  });

  it('nudges gently when there was no practice', async () => {
    const { summaryText } = await import('./line');
    const text = summaryText(
      { nickname: 'ต้น', days: 0, answers: 0, correct: 0, lastAnswers: 0, lastCorrect: 0, xp: 0, weak: [], homeworkDone: 0, homeworkTotal: 0, mistakesDue: 0 },
      '2026-10-12', 'https://example.app',
    );
    expect(text).toContain('ยังไม่ได้ฝึก');
    expect(text).not.toContain('ตอบถูก');
  });
});
