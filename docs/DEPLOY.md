# นำ Brain Gym ขึ้นออนไลน์ (ทำตามทีละข้อ)

> ทุกขั้นใช้บัญชีของคุณเอง **ห้ามส่งรหัสผ่านหรือ secret key ในแชท**
> ค่าที่ส่งในแชทได้: ลิงก์ repo GitHub, ลิงก์เว็บ Vercel, Project ID ของ Supabase

---

## 1) GitHub: เก็บโค้ดขึ้นคลาวด์

1. เข้า https://github.com แล้วล็อกอิน (ยังไม่มีบัญชีให้กด **Sign up**)
2. มุมขวาบน กดปุ่ม **+** → **New repository**
3. กรอก
   - **Repository name:** `brain-gym`
   - เลือก **Private** (แนะนำ โค้ดไม่เปิดสาธารณะ)
   - **ไม่ต้อง**ติ๊ก Add a README / .gitignore / license (โปรเจคมีอยู่แล้ว)
4. กด **Create repository**
5. คัดลอกลิงก์ที่ขึ้นต้นด้วย `https://github.com/.../brain-gym.git` แล้วส่งให้ Claude ในแชท
6. Claude จะรันคำสั่ง push ให้ ระหว่างนั้นจะมีหน้าต่าง **Git Credential Manager / Sign in to GitHub** เด้งขึ้นมา → กด **Sign in with your browser** → **Authorize** (ทำครั้งเดียว)

✅ เช็ก: รีเฟรชหน้า repo บน GitHub ต้องเห็นไฟล์ `src/`, `supabase/`, `README.md`

> ไฟล์ `.env.local` จะ **ไม่** ถูกส่งขึ้น GitHub (อยู่ใน `.gitignore`)

---

## 2) Vercel: เปิดเว็บให้คนอื่นเข้าได้

1. เข้า https://vercel.com → **Sign Up** → เลือก **Continue with GitHub** (แผน **Hobby** ฟรี)
2. ในหน้า Dashboard กด **Add New…** → **Project**
3. หา `brain-gym` ในรายการ → กด **Import**
   - ถ้าไม่เห็น ให้กด **Adjust GitHub App Permissions** แล้วอนุญาตให้ Vercel เห็น repo `brain-gym`
4. หน้า Configure Project
   - **Framework Preset:** Vite (ขึ้นอัตโนมัติ)
   - เปิดหัวข้อ **Environment Variables** แล้วเพิ่ม 2 ตัว (คัดลอกค่าจากไฟล์ `.env.local` ในเครื่อง)

     | Key | Value |
     |---|---|
     | `VITE_SUPABASE_URL` | ค่าเดียวกับใน `.env.local` |
     | `VITE_SUPABASE_PUBLISHABLE_KEY` | ค่าเดียวกับใน `.env.local` |

5. กด **Deploy** รอ 1-2 นาที
6. ได้ลิงก์เว็บ เช่น `https://brain-gym-xxxx.vercel.app` → ส่งลิงก์ให้ Claude

✅ เช็ก: เปิดลิงก์บนมือถือ ต้องเห็นหน้าตั้งชื่อเล่น / หน้าแรก

> ต่อจากนี้ทุกครั้งที่ push โค้ดขึ้น GitHub เว็บบน Vercel จะอัปเดตเอง

---

## 3) Supabase: บอกให้รู้จักเว็บจริง

1. https://supabase.com/dashboard → โปรเจค **brain-gym**
2. **Authentication → URL Configuration**
   - **Site URL:** เปลี่ยนเป็นลิงก์ Vercel (เช่น `https://brain-gym-xxxx.vercel.app`)
   - **Redirect URLs:** กด **Add URL** เพิ่มลิงก์ Vercel และ**เก็บ** `http://localhost:5173` ไว้ (ใช้ตอนพัฒนา)
3. กด **Save**

✅ เช็ก: กด "ลืมรหัสผ่าน" บนเว็บจริง ลิงก์ในอีเมลต้องพากลับมาที่ลิงก์ Vercel

---

## 4) อีเมลยืนยัน (Resend) — ต้องมีโดเมนของตัวเอง

ระบบอีเมลฟรีของ Supabase ส่งได้แค่ไม่กี่ฉบับ/ชั่วโมง ถ้ามีผู้ใช้จริงจะติดลิมิตเร็ว

**ข้อควรรู้:** Resend (และบริการส่งอีเมลส่วนใหญ่) **ส่งหาคนทั่วไปได้ต่อเมื่อยืนยันโดเมนของเราเอง** เช่น `braingym.app`
ลิงก์ `xxx.vercel.app` ใช้ยืนยันไม่ได้ ถ้ายังไม่มีโดเมน Resend จะส่งได้แค่หาอีเมลของเจ้าของบัญชีเอง

ขั้นตอน (เมื่อมีโดเมนแล้ว):

1. ซื้อโดเมน (เช่น ที่ Cloudflare Registrar / Namecheap ราว 300-500 บาท/ปี)
2. https://resend.com → Sign up → **Domains → Add Domain** → ใส่โดเมน
3. นำค่า DNS (MX / TXT / DKIM) ที่ Resend ให้ ไปใส่ในหน้า DNS ของที่ซื้อโดเมน → รอสถานะ **Verified**
4. Resend → **API Keys → Create API Key** (สิทธิ์ Sending access) → คัดลอกเก็บไว้ (ห้ามส่งในแชท)
5. Supabase → **Authentication → Emails → SMTP Settings** → เปิด **Enable Custom SMTP**
   - **Sender email:** `no-reply@<โดเมนของคุณ>` · **Sender name:** `Brain Gym`
   - **Host:** `smtp.resend.com` · **Port:** `465` · **Username:** `resend` · **Password:** API Key จากข้อ 4
   - กด **Save**
6. Supabase → **Authentication → Sign In / Providers → Email** → เปิด **Confirm email** อีกครั้ง → Save

✅ เช็ก: สมัครด้วยอีเมลใหม่ ต้องได้อีเมลยืนยันจาก `no-reply@<โดเมน>`

(ถ้ามีโดเมนแล้ว ผูกกับ Vercel ได้ด้วย: Vercel → Project → **Settings → Domains → Add** แล้วอย่าลืมแก้ Site URL ในข้อ 3 เป็นโดเมนใหม่)

---

## 5) (ไม่บังคับ) ล็อกอินด้วย Google

ทำทีหลังได้ บอก Claude เมื่อพร้อม จะเขียนขั้นตอนตั้ง OAuth ใน Google Cloud Console ให้
