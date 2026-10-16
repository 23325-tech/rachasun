import { createElement, useEffect, useState } from 'react';
import { listMocks, MOCK_ICON, type MockAttemptSummary, type MockExam, type MockPaper } from '../lib/mock';
import { Exam, WarningCircle, Wrench } from '@phosphor-icons/react';

interface Props {
  onBack: () => void;
  onStart: (paperId: string, half: boolean) => Promise<void>;
  onReview: (attemptId: string) => void;
}

const EXAM_ORDER: MockExam[] = ['math1', 'math2', 'physics', 'chemistry', 'biology', 'english'];

/** เลือกวิชาและชุดข้อสอบจำลอง A-Level */
export function MockMenuScreen({ onBack, onStart, onReview }: Props) {
  const [data, setData] = useState<{ papers: MockPaper[]; attempts: MockAttemptSummary[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listMocks()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const begin = async (paperId: string, half: boolean) => {
    setBusy(`${paperId}:${half}`);
    setError('');
    try {
      await onStart(paperId, half);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  };

  const attemptOf = (paperId: string, half: boolean) => data?.attempts.find((a) => a.paperId === paperId && a.half === half);

  const button = (p: MockPaper, half: boolean) => {
    const a = attemptOf(p.id, half);
    const label = half ? `ครึ่งชุด · ${Math.ceil(p.count / 2)} ข้อ · ${p.minutes / 2} นาที` : `เต็มชุด · ${p.count} ข้อ · ${p.minutes} นาที`;
    if (a?.submitted)
      return (
        <button type="button" className="mock-paper__btn is-done" onClick={() => onReview(a.id)}>
          <span>{label}</span>
          <strong>{a.score?.toFixed(2)} คะแนน · ดูเฉลย</strong>
        </button>
      );
    const resuming = a && !a.submitted;
    return (
      <button type="button" className="mock-paper__btn" disabled={!!busy} onClick={() => begin(p.id, half)}>
        <span>{label}</span>
        <strong>{busy === `${p.id}:${half}` ? 'กำลังเปิด...' : resuming ? 'ทำต่อ' : 'เริ่มสอบ'}</strong>
      </button>
    );
  };

  return (
    <div className="screen mock-menu">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="กลับ">
          ←
        </button>
        <div className="quiz__progress"><Exam weight="fill" className="ico" /> จำลองสอบ A-Level</div>
      </header>

      <section className="settings-card">
        <p className="mock-menu__intro">
          ข้อสอบแนว A-Level แต่งใหม่โดย AI ตามสัดส่วนบทของข้อสอบจริง จับเวลาเหมือนสนามจริง
          <br />
          <span className="muted">ทำได้ชุดละ 1 ครั้งต่อความยาว เพื่อเทียบคะแนนกับคนอื่นได้ยุติธรรม · ออกกลางคันได้ แต่เวลายังเดินต่อ</span>
        </p>
      </section>

      {error && <p className="form-error"><WarningCircle weight="fill" className="ico" /> {error}</p>}
      {!data && !error && <p className="muted analysis__loading">กำลังโหลดชุดข้อสอบ...</p>}

      {data &&
        EXAM_ORDER.map((exam) => {
          const papers = data.papers.filter((p) => p.exam === exam);
          if (!papers.length) return null;
          return (
            <section key={exam} className="settings-card mock-exam-card">
              <h2 className="section-title section-title--dark">
                {createElement(MOCK_ICON[exam], { weight: 'fill', size: 22 })} {papers[0].title}
              </h2>
              {papers.map((p) => (
                <div key={p.id} className="mock-paper">
                  <span className="mock-paper__no">ชุดที่ {p.no}</span>
                  {button(p, false)}
                  {button(p, true)}
                </div>
              ))}
            </section>
          );
        })}

      {data && !data.papers.length && (
        <section className="settings-card analysis__empty">
          <p className="analysis__big"><Wrench weight="fill" className="ico" /></p>
          <p>กำลังเตรียมชุดข้อสอบ ลองกลับมาใหม่อีกสักพักนะ</p>
        </section>
      )}
    </div>
  );
}
