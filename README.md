# Brain Gym

เว็บแอพ PWA ฝึกทำโจทย์และแข่งกับเพื่อน (Vite + React + TypeScript + Supabase)

## โหมดในแอพ

- 🎯 **ฝึกเดี่ยว**: โจทย์จากคลัง (AI สร้างเพิ่มเมื่อไม่พอ) มีตัวจับเวลาและคะแนนความเร็ว
- ⚔️ **ดวลกับบอท**: กติกาหัวใจ ยิงหัวใจ Sudden Death
- 🌐 **ออนไลน์**: สร้างห้องด้วยรหัส / สุ่มหาคู่แข่ง (นับแต้มแรงค์) / โหมดการ์ดพลัง
- 🔗 **ท้าเพื่อน**: ชุดโจทย์เดียวกัน เล่นภายใน 24 ชม.
- 🏆 **กลุ่มเพื่อน**: โจทย์ประจำวัน + ตารางอันดับรายวัน/รายสัปดาห์

## รันบนเครื่อง

```bash
npm install
npm run dev
```

ต้องมีไฟล์ `.env.local` (ดูตัวอย่างใน `.env.example`) เปิด http://localhost:5173

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm test` | รันเทสต์กติกา (Vitest) |
| `npm run build` | ตรวจ TypeScript + build ไปที่ `dist/` |
| `npm run preview` | เปิดเวอร์ชัน build (ทดสอบ PWA/ออฟไลน์) |
| `npm run icons` | สร้างไอคอน PNG ใหม่จาก `public/icon.svg` |

## โครงสร้าง

- `src/` หน้าเว็บ
  - `screens/` หน้าจอทั้งหมด, `components/` ชิ้นส่วน UI, `lib/` เชื่อม Supabase
- `supabase/migrations/` SQL ทั้งหมด (รันตามลำดับชื่อไฟล์)
- `supabase/functions/` Edge Functions
  - `generate-questions` ให้ Gemini สร้างโจทย์ (จำกัด 40 ข้อ/ชม./คน)
  - `room-game` ตัดสินเกมห้องออนไลน์ (คำตอบ, เวลา, หัวใจ, การ์ด, XP, RP)
  - `async-play` เล่นชุดโจทย์ล็อก (คำท้า, โจทย์ประจำวันของกลุ่ม)
  - `_shared/` กติกาที่หน้าเว็บกับเซิร์ฟเวอร์ใช้ร่วมกัน (หัวใจ, คะแนน, เวลา, แรงค์)

## Deploy

- หน้าเว็บ: Vercel (ตั้งค่าใน `vercel.json`) ต้องใส่ Environment Variables `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`
- Edge Functions:

```bash
npx supabase functions deploy <ชื่อฟังก์ชัน> --project-ref <PROJECT_REF> --use-api
```

- Secrets ของ Supabase: `GEMINI_API_KEY` (และ `GEMINI_MODEL` ถ้าต้องการเปลี่ยนโมเดล)
