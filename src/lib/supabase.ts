import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null เมื่อยังไม่ได้ตั้งค่า .env.local (แอพจะใช้โจทย์ตัวอย่างแทน) */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** ให้ผู้เล่นมี session เสมอ: ถ้ายังไม่ล็อกอินจะเข้าแบบแขก (anonymous sign-in) */
export async function ensureSession(): Promise<SupabaseClient> {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase (.env.local)');
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`เข้าสู่ระบบแบบแขกไม่สำเร็จ: ${error.message}`);
  }
  return supabase;
}
