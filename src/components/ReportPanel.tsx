import { useState } from 'react';
import { REPORT_REASONS, reportQuestion, type ReportReason } from '../lib/questionBank';
import { CheckCircle, Flag } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

type Status = 'closed' | 'open' | 'sending' | 'sent' | 'duplicate' | 'error';

export function ReportPanel({ questionId }: { questionId: string }) {
  const [status, setStatus] = useState<Status>('closed');
  const [reason, setReason] = useState<ReportReason>('wrong_answer');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    setStatus('sending');
    try {
      setStatus((await reportQuestion(questionId, reason, note)) === 'ok' ? 'sent' : 'duplicate');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  if (status === 'closed') {
    return (
      <button type="button" className="report-link" onClick={() => setStatus('open')}>
        <Flag weight="fill" className="ico" /> {t('รายงานข้อผิด', 'Report a problem')}
      </button>
    );
  }
  if (status === 'sent') return <p className="report-done"><CheckCircle weight="fill" className="ico" /> {t('ขอบคุณ! ส่งรายงานแล้ว', 'Thanks! Report sent')}</p>;
  if (status === 'duplicate') return <p className="report-done">{t('คุณรายงานข้อนี้ไปแล้ว', 'You\'ve already reported this')}</p>;

  return (
    <div className="report">
      <div className="report__title"><Flag weight="fill" className="ico" /> {t('ข้อนี้ผิดตรงไหน?', 'What\'s wrong with this question?')}</div>
      <div className="chips">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`chip chip--small ${reason === r.value ? 'is-active' : ''}`}
            onClick={() => setReason(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        className="report__note"
        rows={2}
        maxLength={300}
        placeholder={t('รายละเอียดเพิ่มเติม (ไม่บังคับ)', 'More details (optional)')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {status === 'error' && <p className="report__error">{t('ส่งไม่สำเร็จ:', 'Couldn\'t send:')} {error}</p>}
      <div className="report__actions">
        <button type="button" className="btn btn--ghost" onClick={() => setStatus('closed')}>
          {t('ยกเลิก', 'Cancel')}
        </button>
        <button type="button" className="btn btn--primary btn--grow" disabled={status === 'sending'} onClick={send}>
          {status === 'sending' ? t('กำลังส่ง...', 'Sending...') : t('ส่งรายงาน', 'Send report')}
        </button>
      </div>
    </div>
  );
}
