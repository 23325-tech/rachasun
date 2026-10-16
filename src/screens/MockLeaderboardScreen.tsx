import { useEffect, useState } from 'react';
import { Clock, Medal, Trophy, UserCircle } from '@phosphor-icons/react';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RankMedal } from '../components/icons';
import { t } from '../lib/i18n';
import { fetchMockLeaderboard, paperTitle, type MockLeaderboard } from '../lib/mock';

interface Props {
  paperId: string;
  title: string;
  no: number;
  /** เปิดมาที่แท็บไหนก่อน */
  half: boolean;
  onBack: () => void;
}

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/** อันดับคะแนนจำลองสอบของชุดนี้ (แยกเต็มชุด/ครึ่งชุด) */
export function MockLeaderboardScreen({ paperId, title, no, half: startHalf, onBack }: Props) {
  const [half, setHalf] = useState(startHalf);
  const [data, setData] = useState<MockLeaderboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    fetchMockLeaderboard(paperId, half)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [paperId, half]);

  return (
    <div className="screen mock-board">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('กลับ', 'Back')}>
          ←
        </button>
        <div className="quiz__progress">
          <Trophy weight="fill" className="ico" /> {paperTitle(title)} · {t('ชุด', 'Set')} {no}
        </div>
      </header>

      <div className="segmented mock-board__tabs">
        <button type="button" className={`segmented__opt ${!half ? 'is-active' : ''}`} onClick={() => setHalf(false)}>
          {t('เต็มชุด', 'Full')}
        </button>
        <button type="button" className={`segmented__opt ${half ? 'is-active' : ''}`} onClick={() => setHalf(true)}>
          {t('ครึ่งชุด', 'Half')}
        </button>
      </div>

      {data && (
        <section className="settings-card mock-board__me">
          {data.me ? (
            <>
              <span className="mock-board__me-rank">
                <Medal weight="fill" className="ico" /> {t(`อันดับ ${data.me.rank} จาก ${data.takers}`, `Rank #${data.me.rank} of ${data.takers}`)}
              </span>
              <strong>
                {data.me.score.toFixed(2)} {t('คะแนน', 'pts')}
              </strong>
            </>
          ) : (
            <span className="muted">
              {t(`ยังไม่ได้สอบชุดนี้ · มีคนสอบแล้ว ${data.takers} คน`, `You haven't taken this set · ${data.takers} takers`)}
            </span>
          )}
        </section>
      )}

      {!data && !error && <p className="muted analysis__loading">{t('กำลังโหลดอันดับ...', 'Loading leaderboard...')}</p>}

      {data && data.top.length === 0 && (
        <p className="season-empty">{t('ยังไม่มีใครส่งข้อสอบชุดนี้ เป็นคนแรกเลย!', 'Nobody has submitted this set yet — be the first!')}</p>
      )}

      {data && data.top.length > 0 && (
        <ol className="ranking">
          {data.top.map((r, i) => (
            <li key={i} className={`ranking__item ${r.isMe ? 'is-me' : ''} ${r.rank === 1 ? 'is-winner' : ''}`}>
              <span className="ranking__rank">
                <RankMedal rank={r.rank} />
              </span>
              <span className="ranking__avatar" aria-hidden>
                {r.anon ? <UserCircle weight="fill" size={36} className="mock-board__anon" /> : <PlayerAvatar code={r.avatar} size={36} />}
              </span>
              <span className="ranking__name">
                {r.isMe ? t('คุณ', 'You') : r.anon ? t('ผู้เล่นนิรนาม', 'Anonymous') : `${r.nickname}#${r.tag}`}
                <small className="mock-board__time">
                  <Clock weight="bold" size={11} /> {mmss(r.secs)}
                </small>
              </span>
              <span className="ranking__score">{r.score.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted mock-board__note">
        {t('เรียงตามคะแนน คะแนนเท่ากันใครใช้เวลาน้อยกว่าอยู่ก่อน · ไม่อยากโชว์ชื่อ ตั้งค่าได้ที่หน้าบัญชี', 'Sorted by score, ties by faster time · hide your name in Account settings')}
      </p>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
