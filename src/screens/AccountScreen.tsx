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
import { Cube, DoorOpen, Key, WarningCircle } from '@phosphor-icons/react';
import { isLowEnd, reduce3DSetting, setReduce3D } from '../lib/perf';

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
          setNotice(`ส่งอีเมลยืนยันไปที่ ${email} แล้ว กดลิงก์ในอีเมล แล้วกลับมาตั้งรหัสผ่านที่หน้านี้`);
          return;
        }
        setNotice('สมัครสำเร็จ! ความก้าวหน้าทั้งหมดถูกบันทึกในบัญชีแล้ว');
      } else {
        await loginWithEmail(email, password);
      }
      await onChanged();
    });

  const lv = profile ? levelFromXp(profile.xp) : null;

  return (
    <div className="screen account">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress">บัญชีของฉัน</div>
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
              return n ? `อีก ${n.needed} RP ถึงยศ${n.tier.name} (ได้ RP จากโหมดสุ่มหาคู่แข่ง)` : 'ยศสูงสุดแล้ว!';
            })()}
          </div>
          <div className="account__badge">{guest ? 'แขก' : `${user?.email ?? 'สมาชิก'}`}</div>
          <div className="stats">
            <div className="stat">
              <div className="stat__num">Lv {lv.level}</div>
              <div className="stat__label">{profile.xp.toLocaleString()} XP</div>
            </div>
            <div className="stat">
              <div className="stat__num">{profile.games_played}</div>
              <div className="stat__label">เกมที่เล่น</div>
            </div>
            <div className="stat">
              <div className="stat__num">{profile.wins}</div>
              <div className="stat__label">ดวลชนะ</div>
            </div>
          </div>
          {!editing ? (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setEditing(true)}>
              แก้ชื่อเล่น
            </button>
          ) : (
            <NicknameForm
              initialNickname={profile.nickname}
              submitLabel="บันทึก"
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
              สมัครสมาชิก
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`segmented__opt ${tab === 'login' ? 'is-active' : ''}`}
              onClick={() => setTab('login')}
            >
              เข้าสู่ระบบ
            </button>
          </div>

          <p className="account__hint">
            {tab === 'register'
              ? 'สมัครเพื่อเก็บ XP และสถิติไว้ถาวร เล่นต่อได้ทุกเครื่อง (XP ที่เล่นแบบแขกมาแล้วติดไปด้วย)'
              : 'ถ้าเข้าสู่ระบบบัญชีอื่น XP ที่เล่นแบบแขกในเครื่องนี้จะไม่ถูกรวม'}
          </p>

          <form
            className="account__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) submitEmail();
            }}
          >
            <label className="field">
              <span className="field__label">อีเมล</span>
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
              <span className="field__label">รหัสผ่าน (อย่างน้อย 6 ตัว)</span>
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
              {busy ? 'กำลังดำเนินการ...' : tab === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {tab === 'login' && (
            <button
              type="button"
              className="link-btn forgot-link"
              disabled={busy}
              onClick={() => {
                if (!email.trim()) {
                  setError('ใส่อีเมลก่อน แล้วกด "ลืมรหัสผ่าน" อีกครั้ง');
                  return;
                }
                run(
                  () => sendPasswordReset(email),
                  `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} แล้ว เปิดลิงก์ในอีเมลบนเครื่องนี้ แล้วตั้งรหัสผ่านใหม่`,
                );
              }}
            >
              ลืมรหัสผ่าน / ยังไม่ได้ตั้งรหัสผ่าน?
            </button>
          )}

          <div className="divider">หรือ</div>
          <button
            type="button"
            className="btn btn--ghost btn--block google-btn"
            disabled={busy}
            onClick={() => run(tab === 'register' && profile ? linkGoogle : loginWithGoogle)}
          >
            <span className="google-btn__g">G</span> {tab === 'register' ? 'สมัครด้วย Google' : 'เข้าสู่ระบบด้วย Google'}
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
                }, 'ตั้งรหัสผ่านเรียบร้อย ใช้เข้าสู่ระบบเครื่องอื่นได้แล้ว');
            }}
          >
            {needsPassword && (
              <p className="form-warning">
                <Key weight="fill" className="ico" /> ยืนยันอีเมลแล้ว แต่ยังไม่ได้ตั้งรหัสผ่าน ตั้งตอนนี้เพื่อใช้เข้าสู่ระบบจากเครื่องอื่น
              </p>
            )}
            <label className="field">
              <span className="field__label">{needsPassword ? 'ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)' : 'เปลี่ยนรหัสผ่าน'}</span>
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
              บันทึกรหัสผ่าน
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
            <DoorOpen weight="fill" className="ico" /> ออกจากระบบ
          </button>
        </section>
      )}

      <section className="settings-card">
        <label className="toggle-row">
          <span className="toggle-row__icon">
            <Cube weight="fill" />
          </span>
          <span className="toggle-row__text">
            <b>ลดเอฟเฟกต์ 3D</b>
            <small>{lowEnd ? 'เครื่องนี้ใช้ภาพนิ่งอัตโนมัติอยู่แล้ว' : 'ใช้ภาพนิ่งแทนตัวละครเคลื่อนไหว ช่วยประหยัดแบต'}</small>
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

      {notice && <p className="form-notice">{notice}</p>}
      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
    </div>
  );
}
