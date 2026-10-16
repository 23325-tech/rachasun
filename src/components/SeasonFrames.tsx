import { useEffect, useState } from 'react';
import { Coin, FrameCorners, Prohibit } from '@phosphor-icons/react';
import { PlayerAvatar } from './PlayerAvatar';
import { TierIcon } from './icons';
import { t } from '../lib/i18n';
import { frameOf, lookCode } from '../lib/look';
import { TIERS } from '../lib/rank';
import { fetchSeasonHistory, setFrame, SEASON_MIN_GAMES, type SeasonHistoryRow } from '../lib/season';

const tierName = (key: string) => TIERS.find((x) => x.key === key)?.name ?? key;
const LETTER: Record<string, string> = { bronze: 'b', silver: 's', gold: 'g', platinum: 'p', diamond: 'd', legend: 'l' };

/** หน้าบัญชี: กรอบฤดูกาลที่สะสมได้ (เลือกใส่ 1 อัน) + ประวัติรางวัล */
export function SeasonFrames({ avatar, onChanged }: { avatar: string; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<SeasonHistoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wearing = frameOf(avatar)?.season ?? null;
  const base = lookCode(avatar);

  useEffect(() => {
    fetchSeasonHistory().then(setRows).catch(() => setRows([]));
  }, []);

  const pick = async (season: number | null) => {
    if (busy || season === wearing) return;
    setBusy(true);
    setError('');
    try {
      await setFrame(season);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-card season-frames">
      <h2 className="section-title section-title--dark">
        <FrameCorners weight="fill" className="ico" /> {t('กรอบฤดูกาล', 'Season frames')}
      </h2>
      {rows === null ? (
        <p className="muted">{t('กำลังโหลด...', 'Loading...')}</p>
      ) : rows.length === 0 ? (
        <p className="muted">
          {t(
            `ยังไม่มีกรอบ เล่นสุ่มหาคู่อย่างน้อย ${SEASON_MIN_GAMES} เกมในฤดูกาล แล้วรับกรอบตามยศสูงสุดตอนจบฤดูกาล`,
            `No frames yet. Play ${SEASON_MIN_GAMES}+ matchmaking games in a season to earn your peak-tier frame at season end.`,
          )}
        </p>
      ) : (
        <div className="season-frames__grid">
          <button type="button" className={`season-frame ${wearing === null ? 'is-on' : ''}`} disabled={busy} onClick={() => pick(null)}>
            <span className="season-frame__none">
              <Prohibit weight="bold" size={26} />
            </span>
            <small>{t('ไม่ใส่กรอบ', 'No frame')}</small>
          </button>
          {rows.map((r) => (
            <button
              key={r.season}
              type="button"
              className={`season-frame ${wearing === r.season ? 'is-on' : ''}`}
              disabled={busy}
              onClick={() => pick(r.season)}
            >
              <PlayerAvatar code={`${base}+${r.season}${LETTER[r.tier]}`} size={52} />
              <small>
                <TierIcon tier={r.tier} size={14} /> S{r.season}
              </small>
            </button>
          ))}
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul className="season-history">
          {rows.map((r) => (
            <li key={r.season}>
              <span>{t(`ฤดูกาล ${r.season}`, `Season ${r.season}`)}</span>
              <span>
                <TierIcon tier={r.tier} size={16} /> {tierName(r.tier)} · {r.peakRp} RP
              </span>
              <span>
                <Coin weight="fill" className="ico" /> {r.coins}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
