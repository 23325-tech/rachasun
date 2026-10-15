import { useState } from 'react';
import { REPORT_REASONS, reportQuestion, type ReportReason } from '../lib/questionBank';

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
        🚩 รายงานข้อผิด
      </button>
    );
  }
  if (status === 'sent') return <p className="report-done">✅ ขอบคุณ! ส่งรายงานแล้ว</p>;
  if (status === 'duplicate') return <p className="report-done">คุณรายงานข้อนี้ไปแล้ว</p>;

  return (
    <div className="report">
      <div className="report__title">🚩 ข้อนี้ผิดตรงไหน?</div>
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
        placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {status === 'error' && <p className="report__error">ส่งไม่สำเร็จ: {error}</p>}
      <div className="report__actions">
        <button type="button" className="btn btn--ghost" onClick={() => setStatus('closed')}>
          ยกเลิก
        </button>
        <button type="button" className="btn btn--primary btn--grow" disabled={status === 'sending'} onClick={send}>
          {status === 'sending' ? 'กำลังส่ง...' : 'ส่งรายงาน'}
        </button>
      </div>
    </div>
  );
}
