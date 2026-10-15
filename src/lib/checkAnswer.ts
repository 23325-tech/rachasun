import type { FillAnswer } from '../types';

/** แปลงข้อความที่ผู้เล่นพิมพ์เป็นตัวเลข รองรับ "2.5", "-3", "1,000", "1/4" และมีหน่วยต่อท้ายได้ เช่น "25 m" */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/,/g, '').replace(/\s+/g, '').replace('−', '-');
  const m = s.match(/^(-?\d*\.?\d+)(?:\/(\d*\.?\d+))?/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (m[2] !== undefined) {
    const den = parseFloat(m[2]);
    return den === 0 ? null : num / den;
  }
  return num;
}

export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?。]+$/, '');
}

export function checkFillAnswer(answer: FillAnswer, input: string): boolean {
  if (answer.kind === 'number') {
    const n = parseNumber(input);
    if (n === null) return false;
    const tol = answer.tolerance ?? Math.max(1e-9, Math.abs(answer.value) * 1e-3);
    return Math.abs(n - answer.value) <= tol;
  }
  const given = normalizeText(input).replace(/\s/g, '');
  return answer.accepted.some((a) => normalizeText(a).replace(/\s/g, '') === given);
}

export function formatFillAnswer(answer: FillAnswer): string {
  if (answer.kind === 'number') return answer.unit ? `${answer.value} ${answer.unit}` : String(answer.value);
  return answer.accepted[0];
}
