import { lazy, Suspense, useMemo, type CSSProperties, type ReactNode } from 'react';
import { ChartLineUp, Coin, Crown, Exam, FloppyDisk, GlobeHemisphereEast, Heart, type Icon, Key, LinkSimple, Robot, Sparkle, Storefront, Target, Trophy, TShirt, PawPrint, UsersThree, WifiSlash, CaretRight, BookBookmark, Camera, GraduationCap, ShieldStar, Chalkboard, Package } from '@phosphor-icons/react';
import type { Level, Subject } from '../types';
import { LEVEL_KEYS, LEVELS, subjectInfo } from '../data/subjects';
import { displayName, type Profile } from '../lib/profile';
import { levelFromXp } from '../lib/level';
import { tierOf } from '../lib/rank';
import { seasonLeft } from '../lib/season';
import { chibiOf, DEFAULT_LOOK_CODE } from '../lib/look';
import { IconTile, SUBJECT_ICON, TierIcon } from '../components/icons';
import { PlayerAvatar } from '../components/PlayerAvatar';
import type { GameMode } from './StartScreen';
import { getLang, setLang, t } from '../lib/i18n';
import { use3D } from '../lib/perf';

const Avatar3D = lazy(() => import('../components/Avatar3D').then((m) => ({ default: m.Avatar3D })));

export type HomeAction = GameMode | 'online' | 'groups' | 'analysis' | 'mock' | 'mistakes' | 'photo' | 'clan' | 'classroom' | 'offline';

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
  onPets: () => void;
  onGacha: () => void;
  /** ข้อผิดที่ครบกำหนดทบทวน */
  mistakesDue?: number;
  /** สัตว์เลี้ยงที่พาอยู่: เลเวล + หิวไหม (ยังไม่โหลด = ไม่มี) */
  pet?: { level: number; hungry: boolean };
  /** การ์ดเช็กอินรายวัน */
  checkinSlot?: ReactNode;
  /** ฤดูกาลแรงค์ (ยังไม่โหลด = ไม่แสดงป้าย) */
  season?: { no: number; endsAt: string; rank: number | null };
  onSeason: () => void;
  /** นับถอยหลังคณะในฝัน (null = ยังไม่ตั้งเป้า, undefined = ยังไม่โหลด) */
  dream?: { faculty: string; days: number | null; subject: string } | null;
  onDream: () => void;
  /** ป๊อปอัปทับหน้าแรก (เช่น ผลฤดูกาล) */
  modalSlot?: ReactNode;
}

const modes = (): { key: HomeAction; title: string; desc: string; icon: Icon; grad: string }[] => [
  { key: 'solo', title: t('ฝึกเดี่ยว', 'Solo practice'), desc: t('เลือกบท เลือกความยาก', 'Pick chapters and difficulty'), icon: Target, grad: 'linear-gradient(135deg,#7c5cff,#b65cff)' },
  { key: 'bots', title: t('ดวลกับบอท', 'Bot battle'), desc: t('ยิงหัวใจ อยู่รอดคนสุดท้าย', 'Shoot hearts, be the last one standing'), icon: Robot, grad: 'linear-gradient(135deg,#ff5d73,#ff9a62)' },
  { key: 'online', title: t('ออนไลน์', 'Online'), desc: t('สุ่มหาคู่ · ห้องเพื่อน', 'Matchmaking · Friend rooms'), icon: GlobeHemisphereEast, grad: 'linear-gradient(135deg,#2fa8ff,#4fe0d0)' },
  { key: 'challenge', title: t('ท้าเพื่อน', 'Challenge a friend'), desc: t('ส่งลิงก์ ทำชุดเดียวกัน', 'Share a link, same question set'), icon: LinkSimple, grad: 'linear-gradient(135deg,#ffb020,#ffd65c)' },
  { key: 'groups', title: t('กลุ่มเพื่อน', 'Friend groups'), desc: t('โจทย์ประจำวัน + อันดับ', 'Daily questions + leaderboard'), icon: UsersThree, grad: 'linear-gradient(135deg,#22c58b,#7be08f)' },
  { key: 'clan', title: t('แคลน', 'Clan'), desc: t('รวมทีมแข่งลีกรายสัปดาห์', 'Team up for the weekly league'), icon: ShieldStar, grad: 'linear-gradient(135deg,#5a3df0,#2fa8ff)' },
  { key: 'classroom', title: t('ห้องเรียน', 'Classroom'), desc: t('การบ้านจากครู · ครูสั่งงานได้', 'Homework from your teacher'), icon: Chalkboard, grad: 'linear-gradient(135deg,#22a06b,#7be08f)' },
  { key: 'photo', title: t('ถ่ายรูปโจทย์', 'Snap a problem'), desc: t('AI ใบ้ทีละขั้นจากรูปโจทย์', 'AI hints from a photo'), icon: Camera, grad: 'linear-gradient(135deg,#2bb3ff,#6be0c8)' },
  { key: 'mistakes', title: t('สมุดข้อผิด', 'Mistake notebook'), desc: t('ทบทวนข้อที่เคยผิดตามรอบ', 'Review past mistakes on schedule'), icon: BookBookmark, grad: 'linear-gradient(135deg,#ff7a59,#ffb36b)' },
  { key: 'offline', title: t('ฝึกออฟไลน์', 'Offline packs'), desc: t('โหลดโจทย์ไว้ฝึกตอนไม่มีเน็ต', 'Save questions for no-signal times'), icon: Package, grad: 'linear-gradient(135deg,#64748b,#94a3b8)' },
  { key: 'analysis', title: t('วิเคราะห์ของฉัน', 'My analysis'), desc: t('แผนฝึก + AI โค้ช', 'Study plan + AI coach'), icon: ChartLineUp, grad: 'linear-gradient(135deg,#5a6bff,#8f9dff)' },
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
  const chibi = useMemo(() => ({ ...chibiOf(code), petLevel: p.pet?.level, petHungry: p.pet?.hungry }), [code, p.pet?.level, p.pet?.hungry]);
  const lv = levelFromXp(profile?.xp ?? 0);
  const tier = tierOf(profile?.rp ?? 0);

  return (
    <div className="screen hm">
      <header className="hm-top">
        <button type="button" className="hm-me" onClick={p.onAccount} aria-label={t('เปิดหน้าบัญชี', 'Open account')}>
          <PlayerAvatar code={code} size={34} />
          <span className="hm-me__text">
            <strong>{profile ? displayName(profile) : t('ผู้เล่น', 'Player')}</strong>
            <small>
              Lv {lv.level} · {lv.current}/{lv.needed} XP
            </small>
          </span>
        </button>
        <button
          type="button"
          className="lang-pill"
          onClick={() => setLang(getLang() === 'th' ? 'en' : 'th')}
          aria-label={t('เปลี่ยนเป็นภาษาอังกฤษ', 'Switch to Thai')}
        >
          <span className={getLang() === 'th' ? 'is-on' : ''}>TH</span>
          <span className={getLang() === 'en' ? 'is-on' : ''}>EN</span>
        </button>
        {p.coins !== undefined && (
          <button type="button" className="coin-pill" onClick={p.onShop} aria-label={t('เหรียญ เปิดร้านค้า', 'Coins, open shop')}>
            <Coin weight="fill" size={18} /> {p.coins.toLocaleString()}
          </button>
        )}
        {profile && (p.guest || p.needsPassword) && (
          <button
            type="button"
            className="hm-chip hm-chip--save"
            onClick={p.onAccount}
            aria-label={p.guest ? t('สมัครเก็บ XP', 'Save XP') : t('ตั้งรหัส', 'Set password')}
          >
            {p.guest ? <FloppyDisk weight="fill" size={16} /> : <Key weight="fill" size={16} />}
            <span className="hm-chip__text">{p.guest ? t('สมัครเก็บ XP', 'Save XP') : t('ตั้งรหัส', 'Set password')}</span>
          </button>
        )}
      </header>

      {p.offline && (
        <div className="offline-banner" role="status">
          <WifiSlash weight="bold" size={16} /> {t('ออฟไลน์อยู่ — เล่นฝึกเดี่ยว/ดวลบอทด้วยโจทย์ตัวอย่างได้ (ไม่ได้ XP)', 'You\'re offline — play solo/bot battles with sample questions (no XP)')}
          <button type="button" className="offline-banner__btn" onClick={() => p.onAction('offline')}>
            {t('เปิดแพ็กออฟไลน์', 'Open offline packs')}
          </button>
        </div>
      )}
      {p.installSlot}

      <section className="hm-hero">
        <div className="hm-hero__podium" />
        {/* ปิด 3D / ประหยัดเน็ต: ไม่โหลด three.js เลย ใช้รูปนิ่งแทน */}
        {use3D() ? (
          <Suspense fallback={null}>
            <Avatar3D look={chibi} interactive className="hm-hero__canvas" />
          </Suspense>
        ) : (
          <div className="hm-hero__canvas avatar3d--static">
            <PlayerAvatar code={code} size={150} framing="full" className="is-bare" />
          </div>
        )}
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
              <Heart weight="fill" size={13} /> {t('ชนะ', 'Wins')} {profile?.wins ?? 0}
            </span>
            <span>
              <Sparkle weight="fill" size={13} /> {(profile?.xp ?? 0).toLocaleString()} XP
            </span>
          </span>
        </div>
        {profile && (
          <button type="button" className={`hm-dress ${p.dressNew ? 'is-new' : ''}`} onClick={p.onDress}>
            <TShirt weight="fill" size={18} />
            {p.dressNew ? t('แต่งตัวละครของคุณ!', 'Dress up your character!') : t('แต่งตัว', 'Dress up')}
          </button>
        )}
        {profile && (
          <button type="button" className="hm-gacha" onClick={p.onGacha}>
            <Sparkle weight="fill" size={18} /> {t('ตู้สุ่ม', 'Gacha')}
          </button>
        )}
        {profile && (
          <button type="button" className={`hm-pets ${p.pet?.hungry ? 'is-hungry' : ''}`} onClick={p.onPets}>
            <PawPrint weight="fill" size={18} /> {t('สัตว์เลี้ยง', 'Pets')}
            {p.pet?.hungry && <span className="hm-pets__dot">{t('หิว!', 'Hungry!')}</span>}
          </button>
        )}
        {profile && (
          <button type="button" className="hm-shop" onClick={p.onShop}>
            <Storefront weight="fill" size={18} /> {t('ร้านค้า', 'Shop')}
          </button>
        )}
      </section>

      {p.season && (
        <button type="button" className="season-banner" onClick={p.onSeason}>
          <Trophy weight="fill" size={20} />
          <span className="season-banner__text">
            <strong>{t(`ฤดูกาล ${p.season.no}`, `Season ${p.season.no}`)}</strong>
            <small>
              {t('เหลือ', 'Ends in')} {seasonLeft(p.season.endsAt)} · {p.season.rank ? t(`อันดับ ${p.season.rank}`, `Rank #${p.season.rank}`) : t('ดูอันดับ', 'Leaderboard')}
            </small>
          </span>
          <CaretRight weight="bold" size={16} />
        </button>
      )}

      {p.dream ? (
        <button type="button" className="dream-banner" onClick={p.onDream}>
          <span className="dream-banner__days">
            <b>{p.dream.days ?? '-'}</b>
            <small>{t('วัน', 'days')}</small>
          </span>
          <span className="season-banner__text">
            <strong>{p.dream.faculty}</strong>
            <small>{p.dream.days === null ? t('ไม่มีวันสอบที่ใกล้ถึง', 'No upcoming exam') : t(`ถึงวันสอบ ${p.dream.subject}`, `until ${p.dream.subject}`)}</small>
          </span>
          <CaretRight weight="bold" size={16} />
        </button>
      ) : (
        p.dream === null &&
        p.level === 'upper' && (
          <button type="button" className="dream-banner dream-banner--invite" onClick={p.onDream}>
            <GraduationCap weight="fill" size={22} />
            <span className="season-banner__text">
              <strong>{t('ตั้งเป้าคณะในฝัน', 'Set your dream faculty')}</strong>
              <small>{t('ดูว่าคะแนนห่างเป้าแค่ไหน + นับถอยหลังวันสอบ', 'See your gap to the target + exam countdown')}</small>
            </span>
            <CaretRight weight="bold" size={16} />
          </button>
        )
      )}

      {p.checkinSlot}

      <div className="hm-levels" role="radiogroup" aria-label={t('ระดับชั้น', 'Level')}>
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
            {t('ตกลง', 'OK')}
          </button>
        </div>
      )}

      <section>
        <h2 className="section-title">{t('วันนี้เล่นอะไรดี', 'What to play today')}</h2>
        <div className="hm-modes">
          {modes().map((m) => (
            <button key={m.key} type="button" className="hm-mode" onClick={() => p.onAction(m.key)}>
              {m.key === 'mistakes' && !!p.mistakesDue && <span className="hm-mode__count">{p.mistakesDue}</span>}
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
                <strong>{t('จำลองสอบ A-Level', 'A-Level mock exam')}</strong>
                <small>{t('เต็มชุด 90 นาที · เทียบคะแนนกับคนอื่น', 'Full set, 90 min · compare with others')}</small>
              </span>
              <Crown weight="fill" size={20} className="hm-mode__badge" />
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('ฝึกตามวิชา', 'Practice by subject')}</h2>
        <div className="hm-subjects" style={{ '--n': LEVELS[p.level].subjects.length } as CSSProperties}>
          {LEVELS[p.level].subjects.map((s) => (
            <button key={s} type="button" className="hm-subject" onClick={() => p.onSubject(s)}>
              <IconTile icon={SUBJECT_ICON[s]} grad={SUBJECT_GRAD[s]} size={54} iconSize={28} />
              <span>{subjectInfo(s, p.level).name}</span>
            </button>
          ))}
        </div>
      </section>
      {p.modalSlot}
    </div>
  );
}
