import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Difficulty, Subject, Track } from '../types';
import { ensureSession } from './supabase';

export interface RoomSettings {
  subject: Subject | 'all';
  difficulty: Difficulty;
  track: Track;
  count: 5 | 10 | 20;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  /** private = สร้างเองด้วยรหัส, public = ห้องจากการสุ่มจับคู่ */
  kind: 'private' | 'public';
  mode: 'classic' | 'items';
  created_at: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  state: unknown;
}

export interface RoomPlayer {
  room_id: string;
  user_id: string;
  nickname: string;
  tag: number;
  avatar: string;
  joined_at: string;
}

const ROOM_ERRORS: Record<string, string> = {
  room_not_found: 'ไม่พบห้องนี้ ตรวจรหัสอีกครั้งนะ',
  room_in_game: 'ห้องนี้กำลังเล่นอยู่ รอจบรอบแล้วค่อยเข้าใหม่',
  room_full: 'ห้องเต็มแล้ว (สูงสุด 8 คน)',
  profile_required: 'ตั้งชื่อเล่นก่อนเข้าห้อง',
  not_host: 'เฉพาะเจ้าของห้องเท่านั้น',
  invalid_settings: 'ค่าตั้งห้องไม่ถูกต้อง',
  not_ready: 'ยังไม่ถึงเวลาเริ่ม',
};

function friendly(message: string): string {
  const key = Object.keys(ROOM_ERRORS).find((k) => message.includes(k));
  return key ? ROOM_ERRORS[key] : message;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

/** เงื่อนไขจับคู่ห้องสุ่ม (จำนวนข้อคงที่ 10 ข้อ) */
export interface MatchSettings {
  subject: Subject | 'all';
  difficulty: Difficulty;
  track: Track;
  mode: 'classic' | 'items';
}

/** หาห้องสาธารณะที่ตั้งค่าตรงกัน ถ้าไม่มีจะสร้างใหม่ */
export const findMatch = (m: MatchSettings) =>
  rpc<Room>('find_match', { p_subject: m.subject, p_difficulty: m.difficulty, p_track: m.track, p_mode: m.mode });

export const createRoom = (settings: RoomSettings) => rpc<Room>('create_room', { p_settings: settings });
export const joinRoom = (code: string) => rpc<Room>('join_room', { p_code: code });
export const leaveRoom = (roomId: string) => rpc<void>('leave_room', { p_room: roomId });
export const updateRoomMode = (roomId: string, mode: Room['mode']) =>
  rpc<Room>('update_room_mode', { p_room: roomId, p_mode: mode });
export const updateRoomSettings = (roomId: string, settings: RoomSettings) =>
  rpc<Room>('update_room_settings', { p_room: roomId, p_settings: settings });

export async function fetchRoom(roomId: string): Promise<{ room: Room | null; players: RoomPlayer[] }> {
  const sb = await ensureSession();
  const [{ data: room }, { data: players }] = await Promise.all([
    sb.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    sb.from('room_players').select('*').eq('room_id', roomId).order('joined_at'),
  ]);
  return { room: room as Room | null, players: (players ?? []) as RoomPlayer[] };
}

/**
 * ติดตามห้องแบบเรียลไทม์
 * - onChange: มีการเปลี่ยนแปลงในห้องหรือรายชื่อ (ให้โหลดข้อมูลใหม่)
 * - onPresence: รายชื่อ user_id ที่เปิดแอพอยู่ตอนนี้
 */
export async function subscribeRoom(
  roomId: string,
  myId: string,
  onChange: () => void,
  onPresence: (onlineIds: string[]) => void,
): Promise<() => void> {
  const sb = await ensureSession();
  // supabase-js ใช้ช่องชื่อเดิมซ้ำ ถ้ามีช่องเก่าค้างอยู่ (เช่น React StrictMode เปิดหน้าซ้ำ) ต้องปิดก่อน
  const topic = `room:${roomId}`;
  for (const old of sb.getChannels().filter((c) => c.topic === `realtime:${topic}`)) await sb.removeChannel(old);
  const channel: RealtimeChannel = sb
    .channel(topic, { config: { presence: { key: myId } } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
    // เฉพาะคนเข้า/ออก (ไม่ฟัง UPDATE เพราะทุกคนส่งสัญญาณ "ยังอยู่" ทุก 5 วินาที)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, onChange)
    // Realtime กรอง DELETE ด้วย filter ไม่ได้ จึงรับทุก DELETE แล้วโหลดห้องตัวเองใหม่
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_players' }, onChange)
    .on('presence', { event: 'sync' }, () => onPresence(Object.keys(channel.presenceState())))
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ at: Date.now() });
        // เผื่อพลาดการเปลี่ยนแปลงระหว่างเชื่อมต่อ
        onChange();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('room realtime', status, err?.message);
      }
    });
  return () => {
    sb.removeChannel(channel);
  };
}

/** ลิงก์ชวนเพื่อนเข้าห้อง เช่น https://.../?room=K7P2Q */
export const inviteLink = (code: string) => `${window.location.origin}/?room=${code}`;
