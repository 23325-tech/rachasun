import type { User } from '@supabase/supabase-js';
import { ensureSession, supabase } from './supabase';

export interface Profile {
  id: string;
  nickname: string;
  tag: number;
  avatar: string;
  xp: number;
  games_played: number;
  correct_answers: number;
  wins: number;
  /** แต้มแรงค์จากห้องสุ่มจับคู่ */
  rp: number;
}

export const AVATARS = ['😎', '🤓', '🦊', '🐼', '🐸', '🦄', '🐯', '🐙', '🦖', '🐧', '🤖', '👻', '🐱', '🐶', '🦉', '🐵'];

export const displayName = (p: Pick<Profile, 'nickname' | 'tag'>) => `${p.nickname}#${p.tag}`;

/** แขก = บัญชี anonymous ที่ยังไม่ได้ผูกอีเมลหรือ Google */
export const isGuest = (user: User | null) => !user || user.is_anonymous === true;

function client() {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase (.env.local)');
  return supabase;
}

/**
 * ให้มี session เสมอ (ถ้ายังไม่มีจะเข้าแบบแขก) แล้วคืน user กับโปรไฟล์ (null ถ้ายังไม่ได้ตั้งชื่อ)
 * needsPassword = ผูกอีเมลแล้วแต่ยังไม่ได้ตั้งรหัสผ่าน (กรณีเปิด Confirm email)
 */
export async function loadMe(): Promise<{ user: User; profile: Profile | null; needsPassword: boolean }> {
  const sb = await ensureSession();
  const { data } = await sb.auth.getUser();
  const user = data.user!;
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new Error(`โหลดโปรไฟล์ไม่สำเร็จ: ${error.message}`);
  let needsPassword = false;
  if (!isGuest(user) && user.email) {
    const { data: st } = await sb.rpc('my_account_status');
    needsPassword = (st as { has_password: boolean }[] | null)?.[0]?.has_password === false;
  }
  return { user, profile: profile as Profile | null, needsPassword };
}

function friendlyDbError(message: string): string {
  if (message.includes('nickname_allowed')) return 'ชื่อนี้ใช้ไม่ได้ ลองชื่ออื่นนะ 🙏';
  return message;
}

export async function createProfile(nickname: string, avatar: string): Promise<Profile> {
  const sb = await ensureSession();
  const { data: u } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('profiles')
    .insert({ id: u.user!.id, nickname: nickname.trim(), avatar })
    .select()
    .single();
  if (error) throw new Error(friendlyDbError(error.message));
  return data as Profile;
}

export async function updateProfile(id: string, changes: { nickname?: string; avatar?: string }): Promise<Profile> {
  const { data, error } = await client()
    .from('profiles')
    .update({ ...changes, nickname: changes.nickname?.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(friendlyDbError(error.message));
  return data as Profile;
}

export interface GameRecord {
  mode: 'solo' | 'bots';
  questions: number;
  correctEasy: number;
  correctMedium: number;
  correctHard: number;
  rank?: number;
  players?: number;
}

export interface XpResult {
  xpGained: number;
  xpTotal: number;
}

/** บันทึกผลเกม ฐานข้อมูลเป็นคนคำนวณ XP (กันการโกง) */
export async function recordGame(g: GameRecord): Promise<XpResult> {
  const { data, error } = await client().rpc('record_game', {
    p_mode: g.mode,
    p_questions: g.questions,
    p_correct_easy: g.correctEasy,
    p_correct_medium: g.correctMedium,
    p_correct_hard: g.correctHard,
    p_rank: g.rank ?? null,
    p_players: g.players ?? null,
  });
  if (error) throw new Error(error.message);
  const row = (data as { xp_gained: number; xp_total: number }[])[0];
  return { xpGained: row.xp_gained, xpTotal: row.xp_total };
}

// ---------- บัญชี ----------

const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/already (been )?registered|already exists|email_exists/i, 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน'],
  [/password should be at least/i, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'],
  [/invalid.*email|unable to validate email/i, 'รูปแบบอีเมลไม่ถูกต้อง'],
  [/rate limit|too many/i, 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่'],
  [/already linked|identity_already_exists|identity is already/i, 'บัญชี Google นี้มีอยู่แล้ว กด "เข้าสู่ระบบด้วย Google" แทน'],
  [/manual linking is disabled/i, 'ยังไม่ได้เปิด Manual linking ใน Supabase'],
  [/provider is not enabled|unsupported provider/i, 'ยังไม่ได้เปิดล็อกอินด้วย Google ใน Supabase'],
];

function friendlyAuthError(message: string): string {
  return AUTH_ERRORS.find(([re]) => re.test(message))?.[1] ?? message;
}

export type RegisterResult = 'done' | 'confirm_email';

/**
 * สมัครสมาชิกโดยผูกอีเมลกับบัญชีแขกเดิม -> XP และโปรไฟล์ติดไปด้วย (id เดิม)
 * ถ้า Supabase เปิด "Confirm email" ไว้ ต้องยืนยันอีเมลก่อนจึงตั้งรหัสผ่านได้
 */
export async function registerWithEmail(email: string, password: string): Promise<RegisterResult> {
  if (password.length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  const sb = await ensureSession();
  const { data, error } = await sb.auth.updateUser({ email: email.trim() });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (data.user?.email !== email.trim()) return 'confirm_email';
  const { error: pwError } = await sb.auth.updateUser({ password });
  if (pwError) throw new Error(friendlyAuthError(pwError.message));
  return 'done';
}

/** ตั้งรหัสผ่านหลังยืนยันอีเมลแล้ว (กรณีเปิด Confirm email) */
export async function setPassword(password: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** เข้าสู่ระบบบัญชีที่มีอยู่ (ความก้าวหน้าของแขกในเครื่องนี้จะไม่ถูกรวม) */
export async function loginWithEmail(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล กดแล้วจะกลับมาที่แอพในสถานะล็อกอิน (event PASSWORD_RECOVERY) */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** ผูก Google กับบัญชีแขกเดิม (XP ติดไปด้วย) */
export async function linkGoogle(): Promise<void> {
  const { error } = await client().auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** เข้าสู่ระบบด้วย Google ที่เคยผูกไว้แล้ว */
export async function loginWithGoogle(): Promise<void> {
  const { error } = await client().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function logout(): Promise<void> {
  await client().auth.signOut();
}
