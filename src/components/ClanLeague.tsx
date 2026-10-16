import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Clock, Coins, Diamond, Medal, Trophy } from '@phosphor-icons/react';
import { ClanEmblem } from './ClanEmblem';
import { PlayerAvatar } from './PlayerAvatar';
import { t } from '../lib/i18n';
import { LEAGUE_TOP, TIERS, fetchLeague, markRewardSeen, type LeagueView } from '../lib/clan';

function leftText(iso: string) {
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? t(`เหลือ ${d} วัน ${h} ชม.`, `${d}d ${h}h left`) : t(`เหลือ ${h} ชม.`, `${h}h left`);
}

/** ลีกแคลนรายสัปดาห์: ชั้น อันดับในกลุ่ม คนที่ช่วยทำคะแนน และรางวัลสัปดาห์ที่แล้ว */
export function ClanLeague({ refreshKey }: { refreshKey: unknown }) {
  const [view, setView] = useState<LeagueView | null>(null);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchLeague()
      .then(setView)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refreshKey]);

  if (error) return <p className="form-error">{error}</p>;
  if (!view) return null;
  const tier = TIERS[view.tier - 1];
  const rows = view.standings.map((s, i) => ({ ...s, rank: s.score > 0 ? i + 1 : null }));
  const counted = view.contributors.slice(0, LEAGUE_TOP);
  const shown = showAll ? view.contributors : view.contributors.slice(0, 5);
  const last = view.lastResult;

  return (
    <section className="settings-card league">
      <div className="league__head">
        <span className="league__tier" style={{ background: tier.color }}>
          {view.tier === 5 ? <Diamond weight="fill" /> : <Medal weight="fill" />} {tier.name()}
        </span>
        <span className="muted league__left">
          <Clock weight="bold" size={13} /> {leftText(view.endsAt)}
        </span>
      </div>
      <p className="muted league__rule">
        {t(
          `คะแนนแคลน = XP สัปดาห์นี้ของ ${LEAGUE_TOP} คนที่ได้มากสุด · ทุกวันจันทร์ อันดับ 1-4 เลื่อนชั้น อันดับ 17-20 ตกชั้น`,
          `Clan score = this week's XP of the top ${LEAGUE_TOP} members · Every Monday, ranks 1-4 move up and 17-20 move down`,
        )}
      </p>
      {last && (
        <p className="league__last">
          {t('สัปดาห์ที่แล้ว', 'Last week')}:{' '}
          {last.rank ? t(`อันดับ ${last.rank} (${last.score} คะแนน)`, `#${last.rank} (${last.score} pts)`) : t('ไม่ได้คะแนน', 'no points')}
          {last.move === 1 && (
            <b className="league__up">
              <ArrowUp weight="bold" /> {t('เลื่อนชั้น', 'Promoted')}
            </b>
          )}
          {last.move === -1 && (
            <b className="league__down">
              <ArrowDown weight="bold" /> {t('ตกชั้น', 'Relegated')}
            </b>
          )}
        </p>
      )}

      <ol className="league__table">
        {rows.map((s) => {
          const zone = s.rank && s.rank <= 4 && view.tier < 5 ? 'up' : s.rank && s.rank >= 17 && view.tier > 1 ? 'down' : '';
          return (
            <li key={s.clanId} className={`${s.clanId === view.myClanId ? 'is-mine' : ''} ${zone ? `is-${zone}` : ''}`}>
              <span className="league__rank">{s.rank ?? '-'}</span>
              <ClanEmblem emblem={s.emblem} size={30} />
              <span className="league__name">
                <strong>{s.name}</strong>
                <small>
                  {s.members} {t('คน', 'members')}
                </small>
              </span>
              <b className="league__score">{s.score.toLocaleString()}</b>
            </li>
          );
        })}
      </ol>
      {rows.length === 1 && <p className="muted league__alone">{t('ยังมีแคลนเดียวในกลุ่มนี้ แคลนใหม่จะถูกจัดเข้ากลุ่มเรื่อยๆ', 'Your clan is alone in this group so far. New clans will be added.')}</p>}

      <h3 className="league__sub">
        <Trophy weight="fill" className="ico" /> {t('คนที่ช่วยทำคะแนนสัปดาห์นี้', 'Top contributors this week')}
      </h3>
      <ul className="league__members">
        {shown.map((m, i) => (
          <li key={i} className={`${m.isMe ? 'is-me' : ''} ${i >= LEAGUE_TOP ? 'is-out' : ''}`}>
            <span className="league__rank">{i + 1}</span>
            <PlayerAvatar code={m.avatar} size={28} />
            <span className="league__name">{m.nickname}</span>
            <b>{m.xp.toLocaleString()} XP</b>
          </li>
        ))}
      </ul>
      {view.contributors.length > 5 && (
        <button type="button" className="dream-goal__toggle" onClick={() => setShowAll(!showAll)}>
          {showAll ? t('ย่อ', 'Show less') : t(`ดูทั้งหมด ${view.contributors.length} คน`, `Show all ${view.contributors.length}`)}
        </button>
      )}
      <p className="muted league__note">
        {t(
          `นับ ${counted.filter((m) => m.xp > 0).length} คนที่มี XP สัปดาห์นี้ · สมาชิกที่ได้ XP ในสัปดาห์จะได้เหรียญรางวัลตามอันดับแคลน`,
          `${counted.filter((m) => m.xp > 0).length} members scored this week · members with XP earn coins based on the clan's rank`,
        )}
      </p>

      {view.reward && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('รางวัลลีก', 'League reward')}>
          <div className="settings-card season-modal">
            <Trophy weight="fill" size={56} className="season-modal__burst" />
            <h2>{t('ผลลีกสัปดาห์ที่แล้ว', "Last week's league")}</h2>
            <p className="season-modal__tier">
              {TIERS[view.reward.tier - 1].name()} · {t(`อันดับ ${view.reward.rank}`, `Rank #${view.reward.rank}`)}
            </p>
            <p className="season-modal__coins">
              <Coins weight="fill" /> +{view.reward.coins}
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                const week = view.reward!.week;
                setView({ ...view, reward: null });
                markRewardSeen(week).catch(() => {});
              }}
            >
              {t('รับเหรียญ', 'Collect')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
