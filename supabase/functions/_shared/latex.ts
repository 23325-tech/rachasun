// ซ่อม LaTeX ที่ AI ส่งมาเพี้ยน (ใช้ทั้งโจทย์ทั่วไปและข้อสอบจำลอง)
// โมเดลบางครั้งเขียน "\text" ใน JSON โดยไม่ escape -> JSON แปลง "\t" เป็นอักขระ Tab
// ซ่อมกลับเป็นคำสั่ง LaTeX: \t \f \b \r \v ไม่ควรมีในโจทย์อยู่แล้ว ส่วน \n ซ่อมเฉพาะในวงเล็บ $...$
const CONTROL_TO_LETTER: Record<string, string> = { '\t': 't', '\f': 'f', '\b': 'b', '\r': 'r', '\v': 'v' };

export function repairLatex(s: string): string {
  const fixed = s.replace(/[\t\f\b\v]|\r(?=[a-zA-Z])/g, (c) => '\\' + CONTROL_TO_LETTER[c]);
  return fixed.replace(/\$\$[\s\S]+?\$\$|\$[^$]+?\$/g, (m) => m.replace(/\n(?=[a-zA-Z])/g, '\\n'));
}

/** ตัวเลือกที่มีคำสั่ง LaTeX แต่ลืมครอบ $...$ เช่น "\text{50 J}" */
export function wrapBareLatex(s: string): string {
  return !s.includes('$') && /\\[a-zA-Z]+|[\^_]\{/.test(s) ? `$${s}$` : s;
}
