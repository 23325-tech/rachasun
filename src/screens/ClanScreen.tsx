import { useCallback, useEffect, useState } from 'react';
import { Crown, MagnifyingGlass, PaperPlaneTilt, ShareNetwork, ShieldStar, SignOut, UserMinus, UsersThree } from '@phosphor-icons/react';
import { ClanEmblem } from '../components/ClanEmblem';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { levelFromXp } from '../lib/level';
import { t } from '../lib/i18n';
import {
  CHEERS,
  CLAN_MAX,
  EMBLEM_COLORS,
  EMBLEM_ICONS,
  ROLE_TEXT,
  browseClans,
  createClan,
  fetchMyClan,
  joinClanByCode,
  joinOpenClan,
  kickMember,
  leaveClan,
  sendCheer,
  setRole,
  updateClan,
  type ClanFeedItem,
  type ClanListing,
  type ClanMember,
  type MyClan,
} from '../lib/clan';

interface Props {
  meId: string | null;
  onBack: () => void;
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return t('เมื่อกี้', 'just now');
  if (m < 60) return t(`${m} นาที`, `${m}m`);
  const h = Math.round(m / 60);
  return h < 24 ? t(`${h} ชม.`, `${h}h`) : t(`${Math.round(h / 24)} วัน`, `${Math.round(h / 24)}d`);
};

function feedText(f: ClanFeedItem) {
  const who = f.nickname ?? t('ใครบางคน', 'Someone');
  switch (f.kind) {
    case 'cheer':
      return `${who}: ${CHEERS[f.payload]?.() ?? ''}`;
    case 'create':
      return t(`${who} ก่อตั้งแคลน`, `${who} founded the clan`);
    case 'join':
      return t(`${who} เข้าแคลน`, `${who} joined`);
    case 'leave':
      return t(`${who} ออกจากแคลน`, `${who} left`);
    case 'kick':
      return t(`${who} เชิญ ${f.payload} ออกจากแคลน`, `${who} removed ${f.payload}`);
    case 'role':
      return t(`${who} เป็น${ROLE_TEXT[f.payload as ClanMember['role']]?.() ?? ''}`, `${who} is now ${ROLE_TEXT[f.payload as ClanMember['role']]?.() ?? ''}`);
  }
}

/** แคลน: สร้าง/เข้า/ค้นหา และหน้าแคลนของฉัน */
export function ClanScreen({ meId, onBack }: Props) {
  const [clan, setClan] = useState<MyClan | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => fetchMyClan().then(setClan).catch((e) => setError(e instanceof Error ? e.message : String(e))), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen clan">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <ShieldStar weight="fill" className="ico" /> {t('แคลน', 'Clan')}
        </div>
      </header>
      {clan === undefined && !error && <p className="muted analysis__loading">{t('กำลังโหลด...', 'Loading...')}</p>}
      {clan === null && <NoClan busy={busy} act={act} />}
      {clan && <ClanHome clan={clan} meId={meId} busy={busy} act={act} />}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

type Act = (fn: () => Promise<unknown>) => Promise<void>;

function NoClan({ busy, act }: { busy: boolean; act: Act }) {
  const [tab, setTab] = useState<'find' | 'create'>('find');
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<ClanListing[] | null>(null);

  useEffect(() => {
    const h = window.setTimeout(() => browseClans(query.trim()).then(setList).catch(() => setList([])), 300);
    return () => window.clearTimeout(h);
  }, [query]);

  return (
    <>
      <section className="settings-card clan__intro">
        <UsersThree weight="fill" size={40} />
        <p>
          {t(
            `รวมทีมกับเพื่อนจากโรงเรียนไหนก็ได้ สูงสุด ${CLAN_MAX} คน ช่วยกันฝึกเก็บคะแนนแข่งลีกแคลนทุกสัปดาห์`,
            `Team up with friends from any school, up to ${CLAN_MAX} people, and practise together for the weekly clan league.`,
          )}
        </p>
      </section>
      <div className="segmented clan__tabs">
        <button type="button" className={`segmented__opt ${tab === 'find' ? 'is-active' : ''}`} onClick={() => setTab('find')}>
          {t('หาแคลน', 'Find a clan')}
        </button>
        <button type="button" className={`segmented__opt ${tab === 'create' ? 'is-active' : ''}`} onClick={() => setTab('create')}>
          {t('สร้างแคลน', 'Create a clan')}
        </button>
      </div>
      {tab === 'find' ? (
        <>
          <form
            className="settings-card clan__code"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) void act(() => joinClanByCode(code));
            }}
          >
            <label className="field">
              <span className="field__label">{t('มีรหัสเชิญ?', 'Have an invite code?')}</span>
              <span className="clan__code-row">
                <input className="field__input" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" />
                <button type="submit" className="btn btn--primary" disabled={busy || code.trim().length < 6}>
                  {t('เข้า', 'Join')}
                </button>
              </span>
            </label>
          </form>
          <section className="settings-card">
            <label className="clan__search">
              <MagnifyingGlass weight="bold" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ค้นหาแคลนที่เปิดรับ', 'Search open clans')} />
            </label>
            {list === null && <p className="muted">{t('กำลังโหลด...', 'Loading...')}</p>}
            {list?.length === 0 && <p className="muted">{t('ยังไม่มีแคลนที่เปิดรับ ลองสร้างแคลนของตัวเองดูสิ', 'No open clans yet. Why not create one?')}</p>}
            <ul className="clan__list">
              {list?.map((c) => (
                <li key={c.id}>
                  <ClanEmblem emblem={c.emblem} size={40} />
                  <span className="clan__list-text">
                    <strong>{c.name}</strong>
                    <small>
                      {c.members}/{CLAN_MAX} {t('คน', 'members')}
                      {c.description && ` · ${c.description}`}
                    </small>
                  </span>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => act(() => joinOpenClan(c.id))}>
                    {t('เข้า', 'Join')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <ClanForm busy={busy} submitText={t('สร้างแคลน', 'Create clan')} onSubmit={(v) => act(() => createClan(v.name, v.emblem, v.description, v.open))} />
      )}
    </>
  );
}

interface FormValue {
  name: string;
  emblem: string;
  description: string;
  open: boolean;
}

function ClanForm({ initial, busy, submitText, onSubmit }: { initial?: FormValue; busy: boolean; submitText: string; onSubmit: (v: FormValue) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.emblem.split('.')[0] ?? 'shield');
  const [color, setColor] = useState(initial?.emblem.split('.')[1] ?? 'purple');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [open, setOpen] = useState(initial?.open ?? true);
  return (
    <form
      className="settings-card clan-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), emblem: `${icon}.${color}`, description: description.trim(), open });
      }}
    >
      <div className="clan-form__preview">
        <ClanEmblem emblem={`${icon}.${color}`} size={64} />
        <strong>{name || t('ชื่อแคลน', 'Clan name')}</strong>
      </div>
      <label className="field">
        <span className="field__label">{t('ชื่อแคลน', 'Clan name')}</span>
        <input className="field__input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t('เช่น ทีมหมอในอนาคต', 'e.g. Future Doctors')} />
      </label>
      <div className="field">
        <span className="field__label">{t('ตราแคลน', 'Emblem')}</span>
        <div className="clan-form__icons">
          {EMBLEM_ICONS.map((k) => (
            <button key={k} type="button" className={`clan-form__icon ${icon === k ? 'is-active' : ''}`} onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k}>
              <ClanEmblem emblem={`${k}.${color}`} size={36} />
            </button>
          ))}
        </div>
        <div className="clan-form__colors">
          {Object.entries(EMBLEM_COLORS).map(([k, hex]) => (
            <button key={k} type="button" className={`clan-form__color ${color === k ? 'is-active' : ''}`} style={{ background: hex }} onClick={() => setColor(k)} aria-label={k} aria-pressed={color === k} />
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field__label">{t('คำอธิบายสั้นๆ (ไม่บังคับ)', 'Short description (optional)')}</span>
        <input className="field__input" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder={t('เช่น ฝึกคณิตทุกวัน สู้ A-Level', 'e.g. Daily math for A-Level')} />
      </label>
      <label className="clan-form__open">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        <span>{t('เปิดให้ทุกคนค้นหาและกดเข้าได้ (ปิด = ต้องมีรหัสเชิญ)', 'Anyone can find and join (off = invite code only)')}</span>
      </label>
      <button type="submit" className="btn btn--primary btn--block btn--big" disabled={busy || name.trim().length < 2}>
        {submitText}
      </button>
    </form>
  );
}

function ClanHome({ clan, meId, busy, act }: { clan: MyClan; meId: string | null; busy: boolean; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // ข้อมูลแคลนเปลี่ยน (หลังทำรายการ) ปิดเมนูจัดการสมาชิก
  useEffect(() => setMenu(null), [clan]);
  const leader = clan.myRole === 'leader';
  const canKick = (m: ClanMember) => m.id !== meId && (leader || (clan.myRole === 'officer' && m.role === 'member'));

  const share = async () => {
    const text = t(`มาเข้าแคลน "${clan.name}" ใน Brain Gym กัน! รหัสเชิญ: ${clan.code}`, `Join my clan "${clan.name}" on Brain Gym! Invite code: ${clan.code}`);
    try {
      if (navigator.share) await navigator.share({ title: 'Brain Gym', text, url: location.origin });
      else {
        await navigator.clipboard.writeText(`${text}\n${location.origin}`);
        setCopied(true);
      }
    } catch {
      /* ผู้ใช้ยกเลิก */
    }
  };

  if (editing)
    return (
      <>
        <ClanForm
          initial={clan}
          busy={busy}
          submitText={t('บันทึก', 'Save')}
          onSubmit={(v) =>
            act(async () => {
              await updateClan(v.name, v.emblem, v.description, v.open);
              setEditing(false);
            })
          }
        />
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setEditing(false)}>
          {t('ยกเลิก', 'Cancel')}
        </button>
      </>
    );

  return (
    <>
      <section className="settings-card clan-head">
        <ClanEmblem emblem={clan.emblem} size={64} />
        <div className="clan-head__text">
          <h2>{clan.name}</h2>
          {clan.description && <p className="muted">{clan.description}</p>}
          <small className="muted">
            {clan.members.length}/{CLAN_MAX} {t('คน', 'members')} · {clan.open ? t('เปิดรับ', 'Open') : t('ใช้รหัสเชิญ', 'Invite only')}
          </small>
        </div>
        <div className="clan-head__code">
          <span>{t('รหัสเชิญ', 'Invite code')}</span>
          <b>{clan.code}</b>
          <button type="button" className="btn btn--primary" onClick={share}>
            <ShareNetwork weight="bold" className="ico" /> {copied ? t('คัดลอกแล้ว', 'Copied') : t('ชวนเพื่อน', 'Invite')}
          </button>
        </div>
        {leader && (
          <button type="button" className="btn btn--ghost clan-head__edit" onClick={() => setEditing(true)}>
            {t('แก้ไขแคลน', 'Edit clan')}
          </button>
        )}
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <PaperPlaneTilt weight="fill" className="ico" /> {t('ส่งกำลังใจ', 'Cheer')}
        </h2>
        <div className="clan-cheers">
          {Object.entries(CHEERS).map(([k, text]) => (
            <button key={k} type="button" className="clan-cheer" disabled={busy} onClick={() => act(() => sendCheer(k))}>
              {text()}
            </button>
          ))}
        </div>
        <ul className="clan-feed">
          {clan.feed.map((f) => (
            <li key={f.id} className={`clan-feed__item clan-feed__item--${f.kind}`}>
              <span>{feedText(f)}</span>
              <small className="muted">{ago(f.at)}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2 className="section-title section-title--dark">
          <UsersThree weight="fill" className="ico" /> {t('สมาชิก', 'Members')}
        </h2>
        <ul className="clan-members">
          {clan.members.map((m) => (
            <li key={m.id} className={m.id === meId ? 'is-me' : ''}>
              <PlayerAvatar code={m.avatar} size={38} />
              <span className="clan-members__name">
                <strong>
                  {m.nickname}
                  <small>#{m.tag}</small>
                </strong>
                <small>
                  {m.role !== 'member' && (
                    <b className={`clan-role clan-role--${m.role}`}>
                      {m.role === 'leader' && <Crown weight="fill" size={11} />} {ROLE_TEXT[m.role]()}
                    </b>
                  )}{' '}
                  Lv {levelFromXp(m.xp).level}
                </small>
              </span>
              {(canKick(m) || (leader && m.id !== meId)) && (
                <button type="button" className="icon-btn" onClick={() => setMenu(menu === m.id ? null : m.id)} aria-label={t('จัดการสมาชิก', 'Manage member')} aria-expanded={menu === m.id}>
                  ⋯
                </button>
              )}
              {menu === m.id && (
                <div className="clan-members__menu">
                  {leader && m.role === 'member' && (
                    <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => act(() => setRole(m.id, 'officer'))}>
                      {t('ตั้งเป็นรองหัวหน้า', 'Make officer')}
                    </button>
                  )}
                  {leader && m.role === 'officer' && (
                    <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => act(() => setRole(m.id, 'member'))}>
                      {t('ลดเป็นสมาชิก', 'Demote to member')}
                    </button>
                  )}
                  {leader && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy}
                      onClick={() => window.confirm(t(`ส่งต่อหัวหน้าให้ ${m.nickname}?`, `Make ${m.nickname} the leader?`)) && act(() => setRole(m.id, 'leader'))}
                    >
                      <Crown weight="fill" className="ico" /> {t('ส่งต่อหัวหน้า', 'Make leader')}
                    </button>
                  )}
                  {canKick(m) && (
                    <button
                      type="button"
                      className="btn btn--ghost clan-members__kick"
                      disabled={busy}
                      onClick={() => window.confirm(t(`เชิญ ${m.nickname} ออกจากแคลน?`, `Remove ${m.nickname} from the clan?`)) && act(() => kickMember(m.id))}
                    >
                      <UserMinus weight="bold" className="ico" /> {t('เชิญออก', 'Remove')}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        disabled={busy}
        onClick={() =>
          window.confirm(
            clan.members.length === 1
              ? t('คุณเป็นคนสุดท้าย ออกแล้วแคลนจะถูกลบ ยืนยัน?', "You're the last member. Leaving deletes the clan. Continue?")
              : t('ออกจากแคลน?', 'Leave the clan?'),
          ) && act(leaveClan)
        }
      >
        <SignOut weight="bold" className="ico" /> {t('ออกจากแคลน', 'Leave clan')}
      </button>
    </>
  );
}
