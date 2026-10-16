import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  displayName,
  isGuest,
  linkGoogle,
  loginWithEmail,
  loginWithGoogle,
  logout,
  registerWithEmail,
  sendPasswordReset,
  setPassword,
  updateProfile,
  type Profile,
} from '../lib/profile';
import { levelFromXp } from '../lib/level';
import { nextTier, tierOf } from '../lib/rank';
import { NicknameForm } from '../components/NicknameForm';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TierIcon } from '../components/icons';
import { SeasonFrames } from '../components/SeasonFrames';
import { Cube, DoorOpen, Key, WarningCircle } from '@phosphor-icons/react';
import { isLowEnd, reduce3DSetting, setReduce3D } from '../lib/perf';
import { t } from '../lib/i18n';

interface Props {
  user: User | null;
  profile: Profile | null;
  needsPassword: boolean;
  onBack: () => void;
  /** โหลดข้อมูลผู้ใช้ใหม่หลังสมัคร/ล็อกอิน/แก้โปรไฟล์ */
  onChanged: () => Promise<void>;
}

type Tab = 'register' | 'login';

export function AccountScreen({ user, profile, needsPassword, onBack, onChanged }: Props) {
  const guest = isGuest(user);
  const [tab, setTab] = useState<Tab>(profile ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [reduce3D, setReduce] = useState(reduce3DSetting);
  const lowEnd = isLowEnd();

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () =>
    run(async () => {
      if (tab === 'register') {
        const r = await registerWithEmail(email, password);
        if (r === 'confirm_email') {
          setNotice(t(`ส่งอีเมลยืนยันไปที่ ${email} แล้ว กดลิงก์ในอีเมล แล้วกลับมาตั้งรหัสผ่านที่หน้านี้`, `We sent a confirmation email to ${email}. Open the link, then come back here to set a password.`));
          return;
        }
        setNotice(t('สมัครสำเร็จ! ความก้าวหน้าทั้งหมดถูกบันทึกในบัญชีแล้ว', 'Signed up! All your progress is saved to your account.'));
      } else {
        await loginWithEmail(email, password);
      }
      await onChanged();
    });

  const lv = profile ? levelFromXp(profile.xp) : null;

  return (
    <div className="screen account">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">{t('บัญชีของฉัน', 'My account')}</div>
      </header>

      {profile && lv && (
        <section className="settings-card account__profile">
          <div className="account__avatar">
            <PlayerAvatar code={profile.avatar} size={84} />
          </div>
          <div className="account__name">{displayName(profile)}</div>
          <div className={`tier-badge tier-badge--big tier-badge--${tierOf(profile.rp ?? 0).key}`}>
            <TierIcon tier={tierOf(profile.rp ?? 0).key} size={20} /> {tierOf(profile.rp ?? 0).name} · {profile.rp ?? 0} RP
          </div>
          <div className="account__next-tier">
            {(() => {
              const n = nextTier(profile.rp ?? 0);
              return n ? t(`อีก ${n.needed} RP ถึงยศ${n.tier.name} (ได้ RP จากโหมดสุ่มหาคู่แข่ง)`, `${n.needed} RP to ${n.tier.name} (earn RP from matchmaking)`) : t('ยศสูงสุดแล้ว!', 'Top rank reached!');
            })()}
          </div>
          <div className="account__badge">{guest ? t('แขก', 'Guest') : `${user?.email ?? t('สมาชิก', 'Member')}`}</div>
          <div className="stats">
            <div className="stat">
              <div className="stat__num">Lv {lv.level}</div>
              <div className="stat__label">{profile.xp.toLocaleString()} XP</div>
            </div>
            <div className="stat">
              <div className="stat__num">{profile.games_played}</div>
              <div className="stat__label">{t('เกมที่เล่น', 'Games played')}</div>
            </div>
            <div className="stat">
              <div className="stat__num">{profile.wins}</div>
              <div className="stat__label">{t('ดวลชนะ', 'Battle wins')}</div>
            </div>
          </div>
          {!editing ? (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setEditing(true)}>
              {t('แก้ชื่อเล่น', 'Edit nickname')}
            </button>
          ) : (
            <NicknameForm
              initialNickname={profile.nickname}
              submitLabel={t('บันทึก', 'Save')}
              onSubmit={async (nickname) => {
                await updateProfile(profile.id, { nickname });
                await onChanged();
                setEditing(false);
              }}
            />
          )}
        </section>
      )}

      {guest ? (
        <section className="settings-card">
          <div className="segmented" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={`segmented__opt ${tab === 'register' ? 'is-active' : ''}`}
              onClick={() => setTab('register')}
            >
              {t('สมัครสมาชิก', 'Sign up')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`segmented__opt ${tab === 'login' ? 'is-active' : ''}`}
              onClick={() => setTab('login')}
            >
              {t('เข้าสู่ระบบ', 'Log in')}
            </button>
          </div>

          <p className="account__hint">
            {tab === 'register'
              ? t('สมัครเพื่อเก็บ XP และสถิติไว้ถาวร เล่นต่อได้ทุกเครื่อง (XP ที่เล่นแบบแขกมาแล้วติดไปด้วย)', 'Sign up to keep your XP and stats forever and play on any device (your guest XP comes with you)')
              : t('ถ้าเข้าสู่ระบบบัญชีอื่น XP ที่เล่นแบบแขกในเครื่องนี้จะไม่ถูกรวม', 'If you log in to another account, guest XP on this device won\'t be merged')}
          </p>

          <form
            className="account__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) submitEmail();
            }}
          >
            <label className="field">
              <span className="field__label">{t('อีเมล', 'Email')}</span>
              <input
                className="field__input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">{t('รหัสผ่าน (อย่างน้อย 6 ตัว)', 'Password (at least 6 characters)')}</span>
              <input
                className="field__input"
                type="password"
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPw(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy ? t('กำลังดำเนินการ...', 'Working...') : tab === 'register' ? t('สมัครสมาชิก', 'Sign up') : t('เข้าสู่ระบบ', 'Log in')}
            </button>
          </form>

          {tab === 'login' && (
            <button
              type="button"
              className="link-btn forgot-link"
              disabled={busy}
              onClick={() => {
                if (!email.trim()) {
                  setError(t('ใส่อีเมลก่อน แล้วกด "ลืมรหัสผ่าน" อีกครั้ง', 'Enter your email first, then tap "Forgot password" again'));
                  return;
                }
                run(
                  () => sendPasswordReset(email),
                  t(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} แล้ว เปิดลิงก์ในอีเมลบนเครื่องนี้ แล้วตั้งรหัสผ่านใหม่`, `We sent a reset link to ${email}. Open it on this device and set a new password.`),
                );
              }}
            >
              {t('ลืมรหัสผ่าน / ยังไม่ได้ตั้งรหัสผ่าน?', 'Forgot password / haven\'t set one?')}
            </button>
          )}

          <div className="divider">{t('หรือ', 'or')}</div>
          <button
            type="button"
            className="btn btn--ghost btn--block google-btn"
            disabled={busy}
            onClick={() => run(tab === 'register' && profile ? linkGoogle : loginWithGoogle)}
          >
            <span className="google-btn__g">G</span> {tab === 'register' ? t('สมัครด้วย Google', 'Sign up with Google') : t('เข้าสู่ระบบด้วย Google', 'Log in with Google')}
          </button>
        </section>
      ) : (
        <section className="settings-card">
          <form
            className="account__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy)
                run(async () => {
                  await setPassword(password);
                  setPw('');
                  await onChanged();
                }, t('ตั้งรหัสผ่านเรียบร้อย ใช้เข้าสู่ระบบเครื่องอื่นได้แล้ว', 'Password set. You can now log in on other devices.'));
            }}
          >
            {needsPassword && (
              <p className="form-warning">
                <Key weight="fill" className="ico" /> {t('ยืนยันอีเมลแล้ว แต่ยังไม่ได้ตั้งรหัสผ่าน ตั้งตอนนี้เพื่อใช้เข้าสู่ระบบจากเครื่องอื่น', 'Email confirmed but no password yet. Set one now to log in from other devices.')}
              </p>
            )}
            <label className="field">
              <span className="field__label">{needsPassword ? t('ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)', 'Set password (at least 6 characters)') : t('เปลี่ยนรหัสผ่าน', 'Change password')}</span>
              <input
                className="field__input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPw(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className={`btn btn--block ${needsPassword ? 'btn--primary' : 'btn--ghost'}`}
              disabled={busy}
            >
              {t('บันทึกรหัสผ่าน', 'Save password')}
            </button>
          </form>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await logout();
                await onChanged();
              })
            }
          >
            <DoorOpen weight="fill" className="ico" /> {t('ออกจากระบบ', 'Log out')}
          </button>
        </section>
      )}

      <section className="settings-card">
        <label className="toggle-row">
          <span className="toggle-row__icon">
            <Cube weight="fill" />
          </span>
          <span className="toggle-row__text">
            <b>{t('ลดเอฟเฟกต์ 3D', 'Reduce 3D effects')}</b>
            <small>{lowEnd ? t('เครื่องนี้ใช้ภาพนิ่งอัตโนมัติอยู่แล้ว', 'This device already uses still images') : t('ใช้ภาพนิ่งแทนตัวละครเคลื่อนไหว ช่วยประหยัดแบต', 'Use still images instead of animated characters to save battery')}</small>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={reduce3D || lowEnd}
            disabled={lowEnd}
            onChange={(e) => {
              setReduce3D(e.target.checked);
              setReduce(e.target.checked);
            }}
          />
        </label>
      </section>

      {profile && <SeasonFrames avatar={profile.avatar} onChanged={onChanged} />}

      {notice && <p className="form-notice">{notice}</p>}
      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
    </div>
  );
}
