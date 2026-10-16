import { ensureSession } from './supabase';
import { t } from './i18n';

export type ClanRole = 'leader' | 'officer' | 'member';

export interface ClanMember {
  id: string;
  nickname: string;
  tag: number;
  avatar: string;
  xp: number;
  role: ClanRole;
  joinedAt: string;
}

export interface ClanFeedItem {
  id: number;
  kind: 'cheer' | 'create' | 'join' | 'leave' | 'kick' | 'role';
  payload: string;
  at: string;
  nickname: string | null;
}

export interface MyClan {
  id: string;
  code: string;
  name: string;
  emblem: string;
  description: string;
  open: boolean;
  myRole: ClanRole;
  members: ClanMember[];
  feed: ClanFeedItem[];
}

export interface ClanListing {
  id: string;
  name: string;
  emblem: string;
  description: string;
  members: number;
}

export const CLAN_MAX = 30;
export const EMBLEM_ICONS = ['shield', 'sword', 'lightning', 'flame', 'crown', 'star', 'rocket', 'atom', 'brain', 'planet', 'book', 'trophy'] as const;
export const EMBLEM_COLORS: Record<string, string> = {
  purple: '#7c5cff',
  blue: '#2f7bff',
  teal: '#14b8a6',
  green: '#22c55e',
  yellow: '#f5b400',
  orange: '#ff7a2f',
  red: '#ef4444',
  pink: '#ec4899',
};

/** ข้อความสำเร็จรูป (ไม่มีแชทพิมพ์อิสระ) รหัสต้องตรงกับ clan_cheer ใน SQL */
export const CHEERS: Record<string, () => string> = {
  go: () => t('สู้ๆ!', 'You got this!'),
  push: () => t('ช่วยกันทำคะแนน!', "Let's score together!"),
  great: () => t('เก่งมาก!', 'Great job!'),
  thanks: () => t('ขอบคุณนะ', 'Thank you!'),
  gg: () => t('GG เล่นดีมาก', 'GG, well played'),
  study: () => t('ไปฝึกกันเถอะ', "Let's practise"),
  welcome: () => t('ยินดีต้อนรับ!', 'Welcome!'),
  fire: () => t('ไฟลุก!', 'On fire!'),
};

const ERRORS: Record<string, () => string> = {
  already_in_clan: () => t('คุณอยู่ในแคลนอยู่แล้ว ออกจากแคลนเดิมก่อนนะ', "You're already in a clan — leave it first"),
  clan_not_found: () => t('ไม่พบแคลนนี้ ตรวจรหัสอีกครั้งนะ', 'Clan not found, check the code'),
  clan_full: () => t(`แคลนนี้เต็มแล้ว (สูงสุด ${CLAN_MAX} คน)`, `Clan is full (max ${CLAN_MAX})`),
  clan_closed: () => t('แคลนนี้รับเฉพาะคนที่มีรหัสเชิญ', 'This clan is invite-only'),
  bad_clan_name: () => t('ชื่อแคลนใช้ไม่ได้ (2-30 ตัวอักษร และต้องเหมาะสม)', 'Invalid clan name (2-30 characters, appropriate)'),
  bad_description: () => t('คำอธิบายมีคำไม่เหมาะสม', 'Description contains inappropriate words'),
  too_fast: () => t('ส่งถี่ไป รอสักครู่นะ', 'Too fast, wait a moment'),
  not_allowed: () => t('คุณไม่มีสิทธิ์ทำแบบนี้', "You're not allowed to do that"),
  profile_required: () => t('ตั้งชื่อเล่นก่อนนะ', 'Set a nickname first'),
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const sb = await ensureSession();
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    throw new Error(code ? ERRORS[code]() : t('ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง', 'Something went wrong, please try again'));
  }
  return data as T;
}

export const fetchMyClan = () => rpc<MyClan | null>('my_clan');
export const browseClans = (query = '') => rpc<ClanListing[]>('browse_clans', { p_query: query });
export const createClan = (name: string, emblem: string, description: string, open: boolean) =>
  rpc<string>('create_clan', { p_name: name, p_emblem: emblem, p_description: description, p_open: open });
export const joinClanByCode = (code: string) => rpc<string>('join_clan', { p_code: code, p_clan: null });
export const joinOpenClan = (id: string) => rpc<string>('join_clan', { p_code: null, p_clan: id });
export const leaveClan = () => rpc<void>('leave_clan');
export const kickMember = (id: string) => rpc<void>('kick_clan_member', { p_user: id });
export const setRole = (id: string, role: ClanRole) => rpc<void>('set_clan_role', { p_user: id, p_role: role });
export const updateClan = (name: string, emblem: string, description: string, open: boolean) =>
  rpc<void>('update_clan', { p_name: name, p_emblem: emblem, p_description: description, p_open: open });
export const sendCheer = (key: string) => rpc<void>('clan_cheer', { p_key: key });

export const ROLE_TEXT: Record<ClanRole, () => string> = {
  leader: () => t('หัวหน้า', 'Leader'),
  officer: () => t('รองหัวหน้า', 'Officer'),
  member: () => t('สมาชิก', 'Member'),
};

// ---------- ลีกแคลนรายสัปดาห์ ----------

/** นับคะแนนจากสมาชิกที่ได้ XP มากสุดกี่คน (ตรงกับ clan_week_score ใน SQL) */
export const LEAGUE_TOP = 20;

export const TIERS: { name: () => string; color: string }[] = [
  { name: () => t('บรอนซ์', 'Bronze'), color: '#d08a4e' },
  { name: () => t('ซิลเวอร์', 'Silver'), color: '#a9b4c4' },
  { name: () => t('โกลด์', 'Gold'), color: '#f5b400' },
  { name: () => t('แพลทินัม', 'Platinum'), color: '#4fd1c5' },
  { name: () => t('เพชร', 'Diamond'), color: '#7c9cff' },
];

export interface LeagueView {
  week: string;
  endsAt: string;
  tier: number;
  groupNo: number;
  myClanId: string;
  standings: { clanId: string; name: string; emblem: string; members: number; score: number }[];
  contributors: { nickname: string; avatar: string; xp: number; isMe: boolean }[];
  lastResult: { week: string; tier: number; rank: number | null; score: number; move: -1 | 0 | 1 } | null;
  reward: { week: string; coins: number; rank: number; tier: number } | null;
}

export const fetchLeague = () => rpc<LeagueView | null>('league_view');
export const markRewardSeen = (week: string) => rpc<void>('league_reward_seen', { p_week: week });
