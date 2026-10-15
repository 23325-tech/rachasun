# Brain Gym

เว็บแอพ PWA ฝึกทำโจทย์และแข่งกับเพื่อน (Vite + React + TypeScript)

## รันบนเครื่อง

```bash
npm install
npm run dev
```

เปิด http://localhost:5173 บนคอม หรือเปิดลิงก์ `Network:` ที่แสดงในเทอร์มินัลบนมือถือ (ต้องต่อ Wi-Fi เดียวกัน)

## โครงสร้าง

- `src/data/sampleQuestions.ts` — โจทย์ตัวอย่าง (LaTeX ใช้ `$...$` / `$$...$$`, เคมีใช้ `\ce{...}`)
- `src/lib/timing.ts` — ตารางเวลาต่อข้อตามรูปแบบ/ความยาก/วิชา
- `src/lib/scoring.ts` — คะแนน 100 + โบนัสความเร็วสูงสุด 100
- `src/lib/checkAnswer.ts` — ตรวจคำตอบแบบเติม (ตัวเลข/ข้อความ)
- `src/screens/` — หน้าแรก, หน้าเล่น, หน้าสรุปผล
