import { lazy, Suspense, useMemo, type CSSProperties, type ReactNode } from 'react';
import { ChartLineUp, Coin, Crown, Exam, FloppyDisk, GlobeHemisphereEast, Heart, type Icon, Key, LinkSimple, Robot, Sparkle, Storefront, Target, TShirt, UsersThree, WifiSlash } from '@phosphor-icons/react';
import type { Level, Subject } from '../types';
import { LEVEL_KEYS, LEVELS, subjectInfo } from '../data/subjects';
import { displayName, type Profile } from '../lib/profile';
import { levelFromXp } from '../lib/level';
import { tierOf } from '../lib/rank';
import { chibiOf, DEFAULT_LOOK_CODE } from '../lib/look';
import { IconTile, SUBJECT_ICON, TierIcon } from '../components/icons';
import { PlayerAvatar } from '../components/PlayerAvatar';
import type { GameMode } from './StartScreen';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));

export type HomeAction = GameMode | 'online' | 'groups' | 'analysis' | 'mock';

interface Props {
  profile: Profile | null;
  guest: boolean;
  needsPassword: boolean;
  level: Level;
  onLevelChange: (level: Level) => void;
  onAction: (a: HomeAction) => void;
  /** กดวิชา = เปิดฝึกเดี่ยววิชานั้น */
  onSubject: (s: Subject) => void;
  onAccount: () => void;
  onDress: () => void;
  /** ยังไม่เคยเข้าห้องแต่งตัว: แสดงป้ายชวน */
  dressNew: boolean;
  offline: boolean;
  error: string | null;
  onDismissError: () => void;
  installSlot?: ReactNode;
  /** ยอดเหรียญ (ยังไม่โหลด = ไม่แสดง) */
  coins?: number;
  onShop: () => void;
  /** การ์ดเช็กอินรายวัน */
  checkinSlot?: ReactNode;
}

const MODES: { key: HomeAction; title: string; desc: string; icon: Icon; grad: string }[] = [
  { key: 'solo', title: 'ฝึกเดี่ยว', desc: 'เลือกบท เลือกความยาก', icon: Target, grad: 'linear-gradient(135deg,#7c5cff,#b65cff)' },
  { key: 'bots', title: 'ดวลกับบอท', desc: 'ยิงหัวใจ อยู่รอดคนสุดท้าย', icon: Robot, grad: 'linear-gradient(135deg,#ff5d73,#ff9a62)' },
  { key: 'online', title: 'ออนไลน์', desc: 'สุ่มหาคู่ · ห้องเพื่อน', icon: GlobeHemisphereEast, grad: 'linear-gradient(135deg,#2fa8ff,#4fe0d0)' },
  { key: 'challenge', title: 'ท้าเพื่อน', desc: 'ส่งลิงก์ ทำชุดเดียวกัน', icon: LinkSimple, grad: 'linear-gradient(135deg,#ffb020,#ffd65c)' },
  { key: 'groups', title: 'กลุ่มเพื่อน', desc: 'โจทย์ประจำวัน + อันดับ', icon: UsersThree, grad: 'linear-gradient(135deg,#22c58b,#7be08f)' },
  { key: 'analysis', title: 'วิเคราะห์ของฉัน', desc: 'แผนฝึก + AI โค้ช', icon: ChartLineUp, grad: 'linear-gradient(135deg,#5a6bff,#8f9dff)' },
];

const SUBJECT_GRAD: Record<Subject, string> = {
  math: 'linear-gradient(135deg,#ff5d73,#ff8a65)',
  science: 'linear-gradient(135deg,#14b8c4,#5ee0e8)',
  physics: 'linear-gradient(135deg,#2f7bff,#4fc3ff)',
  chemistry: 'linear-gradient(135deg,#1fbf86,#6fe3a5)',
  biology: 'linear-gradient(135deg,#ff9f1c,#ffcf5c)',
  english: 'linear-gradient(135deg,#a45cff,#d68bff)',
};

/** หน้าแรก: ตัวละคร 3D + เลือกระดับ + การ์ดโหมด */
export function HomeScreen(p: Props) {
  const { profile } = p;
  const code = profile?.avatar ?? DEFAULT_LOOK_CODE;
  const chibi = useMemo(() => chibiOf(code), [code]);
  const lv = levelFromXp(profile?.xp ?? 0);
  const tier = tierOf(profile?.rp ?? 0);

  return (
    <div className="screen hm">
      <header className="hm-top">
        <button type="button" className="hm-me" onClick={p.onAccount} aria-label="เปิดหน้าบัญชี">
          <PlayerAvatar code={code} size={34} />
          <span className="hm-me__text">
            <strong>{profile ? displayName(profile) : 'ผู้เล่น'}</strong>
            <small>
              Lv {lv.level} · {lv.current}/{lv.needed} XP
            </small>
          </span>
        </button>
        {p.coins !== undefined && (
          <button type="button" className="coin-pill" onClick={p.onShop} aria-label="เหรียญ เปิดร้านค้า">
            <Coin weight="fill" size={18} /> {p.coins.toLocaleString()}
          </button>
        )}
        {profile && (p.guest || p.needsPassword) && (
          <button type="button" className="hm-chip hm-chip--save" onClick={p.onAccount}>
            {p.guest ? <FloppyDisk weight="fill" size={16} /> : <Key weight="fill" size={16} />}
            {p.guest ? 'สมัครเก็บ XP' : 'ตั้งรหัส'}
          </button>
        )}
      </header>

      {p.offline && (
        <div className="offline-banner" role="status">
          <WifiSlash weight="bold" size={16} /> ออฟไลน์อยู่ — เล่นฝึกเดี่ยว/ดวลบอทด้วยโจทย์ตัวอย่างได้ (ไม่ได้ XP)
        </div>
      )}
      {p.installSlot}

      <section className="hm-hero">
        <div className="hm-hero__podium" />
        <Suspense fallback={null}>
          <Avatar3D look={chibi} interactive className="hm-hero__canvas" />
        </Suspense>
        <div className="hm-hero__info">
          <span className="hm-rank">
            <TierIcon tier={tier.key} size={22} />
            <span>
              <strong>{tier.name}</strong>
              <small>{profile?.rp ?? 0} RP</small>
            </span>
          </span>
          <span className="hm-stats">
            <span>
              <Heart weight="fill" size={13} /> ชนะ {profile?.wins ?? 0}
            </span>
            <span>
              <Sparkle weight="fill" size={13} /> {(profile?.xp ?? 0).toLocaleString()} XP
            </span>
          </span>
        </div>
        {profile && (
          <button type="button" className={`hm-dress ${p.dressNew ? 'is-new' : ''}`} onClick={p.onDress}>
            <TShirt weight="fill" size={18} />
            {p.dressNew ? 'แต่งตัวละครของคุณ!' : 'แต่งตัว'}
          </button>
        )}
        {profile && (
          <button type="button" className="hm-shop" onClick={p.onShop}>
            <Storefront weight="fill" size={18} /> ร้านค้า
          </button>
        )}
      </section>

      {p.checkinSlot}

      <div className="hm-levels" role="radiogroup" aria-label="ระดับชั้น">
        {LEVEL_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={p.level === k}
            className={p.level === k ? 'is-active' : ''}
            onClick={() => p.onLevelChange(k)}
          >
            {LEVELS[k].name}
          </button>
        ))}
      </div>

      {p.error && (
        <div className="alert" role="alert">
          <p className="alert__msg">{p.error}</p>
          <button type="button" className="btn btn--ghost btn--block" onClick={p.onDismissError}>
            ตกลง
          </button>
        </div>
      )}

      <section>
        <h2 className="section-title">วันนี้เล่นอะไรดี</h2>
        <div className="hm-modes">
          {MODES.map((m) => (
            <button key={m.key} type="button" className="hm-mode" onClick={() => p.onAction(m.key)}>
              <IconTile icon={m.icon} grad={m.grad} />
              <span className="hm-mode__text">
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </button>
          ))}
          {p.level === 'upper' && (
            <button type="button" className="hm-mode hm-mode--mock" onClick={() => p.onAction('mock')}>
              <IconTile icon={Exam} grad="linear-gradient(135deg,#6a3df0,#8f6bff)" size={52} iconSize={30} />
              <span className="hm-mode__text">
                <strong>จำลองสอบ A-Level</strong>
                <small>เต็มชุด 90 นาที · เทียบคะแนนกับคนอื่น</small>
              </span>
              <Crown weight="fill" size={20} className="hm-mode__badge" />
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">ฝึกตามวิชา</h2>
        <div className="hm-subjects" style={{ '--n': LEVELS[p.level].subjects.length } as CSSProperties}>
          {LEVELS[p.level].subjects.map((s) => (
            <button key={s} type="button" className="hm-subject" onClick={() => p.onSubject(s)}>
              <IconTile icon={SUBJECT_ICON[s]} grad={SUBJECT_GRAD[s]} size={54} iconSize={28} />
              <span>{subjectInfo(s, p.level).name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
