import { Clock, Coin, Info, Medal, Trophy } from '@phosphor-icons/react';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RankMedal, TierIcon } from '../components/icons';
import { t } from '../lib/i18n';
import { tierOf, TIERS } from '../lib/rank';
import { SEASON_COINS, SEASON_MIN_GAMES, seasonLeft, type SeasonState } from '../lib/season';

interface Props {
  season: SeasonState;
  meId: string | null;
  onBack: () => void;
}

/** ฤดูกาลแรงค์: ยศของเรา + รางวัลตอนจบ + อันดับ Top 100 */
export function SeasonScreen({ season, meId, onBack }: Props) {
  const { me } = season;
  const tier = tierOf(me.rp);
  const peak = tierOf(me.peakRp);
  const qualified = me.games >= SEASON_MIN_GAMES;

  return (
    <div className="screen season">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Trophy weight="fill" className="ico" /> {t(`ฤดูกาล ${season.no}`, `Season ${season.no}`)}
        </div>
        <span className="season-left">
          <Clock weight="bold" className="ico" /> {seasonLeft(season.endsAt)}
        </span>
      </header>

      <section className="settings-card season-me">
        <div className="season-me__tier">
          <TierIcon tier={tier.key} size={40} />
          <div>
            <strong>{tier.name}</strong>
            <span className="muted">
              {me.rp} RP · {me.rank ? t(`อันดับ ${me.rank}`, `Rank #${me.rank}`) : t('ยังไม่ติดอันดับ', 'Unranked')}
            </span>
          </div>
        </div>
        <div className="season-me__stats">
          <span>
            <Medal weight="fill" className="ico" /> {t('สูงสุด', 'Peak')} <b>{peak.name}</b>
          </span>
          <span>
            {t('เกมฤดูกาลนี้', 'Games')} <b>{me.games}</b>
          </span>
        </div>
        <p className={`season-me__reward ${qualified ? 'is-ok' : ''}`}>
          <Coin weight="fill" className="ico" />{' '}
          {qualified
            ? t(`จบฤดูกาลจะได้ ${SEASON_COINS[peak.key]} เหรียญ + กรอบ${peak.name}`, `Season end: ${SEASON_COINS[peak.key]} coins + ${peak.name} frame`)
            : t(
                `เล่นสุ่มหาคู่อีก ${SEASON_MIN_GAMES - me.games} เกม เพื่อรับรางวัลฤดูกาล`,
                `Play ${SEASON_MIN_GAMES - me.games} more matchmaking games to earn season rewards`,
              )}
        </p>
      </section>

      <details className="settings-card season-rules">
        <summary>
          <Info weight="fill" className="ico" /> {t('กติกาฤดูกาล', 'Season rules')}
        </summary>
        <ul>
          <li>{t('ฤดูกาลละ 2 เดือน นับ RP จากโหมดสุ่มหาคู่เท่านั้น', 'Each season lasts 2 months; only matchmaking games count')}</li>
          <li>
            {t(
              `จบฤดูกาลได้เหรียญและกรอบตามยศสูงสุดที่ทำได้ (ต้องเล่นอย่างน้อย ${SEASON_MIN_GAMES} เกม)`,
              `At season end you get coins and a frame for your peak tier (min ${SEASON_MIN_GAMES} games)`,
            )}
          </li>
          <li>{t('ฤดูกาลใหม่ RP เหลือครึ่งหนึ่ง', 'A new season halves your RP')}</li>
        </ul>
        <div className="season-rules__tiers">
          {TIERS.map((x) => (
            <span key={x.key}>
              <TierIcon tier={x.key} size={18} /> {x.name} <Coin weight="fill" className="ico" /> {SEASON_COINS[x.key]}
            </span>
          ))}
        </div>
      </details>

      <h2 className="section-title">
        <Trophy weight="fill" className="ico" /> {t('อันดับฤดูกาล', 'Season leaderboard')}
      </h2>
      {season.top.length === 0 ? (
        <p className="muted season-empty">{t('ยังไม่มีใครเล่นสุ่มหาคู่ในฤดูกาลนี้ เป็นคนแรกเลย!', 'No ranked games yet this season — be the first!')}</p>
      ) : (
        <ol className="ranking">
          {season.top.map((r, i) => (
            <li key={r.id} className={`ranking__item ${r.id === meId ? 'is-me' : ''} ${i === 0 ? 'is-winner' : ''}`}>
              <span className="ranking__rank">
                <RankMedal rank={i + 1} />
              </span>
              <span className="ranking__avatar" aria-hidden>
                <PlayerAvatar code={r.avatar} size={36} />
              </span>
              <span className="ranking__name">{r.id === meId ? t('คุณ', 'You') : `${r.nickname}#${r.tag}`}</span>
              <span className="ranking__score">
                <TierIcon tier={tierOf(r.rp).key} size={16} /> {r.rp}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
