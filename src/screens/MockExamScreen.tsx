import { useCallback, useEffect, useRef, useState } from 'react';
import { MathText } from '../components/MathText';
import { chapterName } from '../data/chapters';
import { CHOICE5, isAnswered, saveMockAnswer, type MockGiven, type MockSession } from '../lib/mock';
import { BookOpenText,CaretLeft,CaretRight,Timer,Warning } from '@phosphor-icons/react';

interface Props {
  session: MockSession;
  /** ส่งข้อสอบ (กดเองหรือหมดเวลา) */
  onSubmit: () => Promise<void>;
  onExit: () => void;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
};

/** ห้องสอบจำลอง: ข้ามไปมาได้ คำตอบบันทึกที่เซิร์ฟเวอร์ทุกครั้งที่เปลี่ยน */
export function MockExamScreen({ session, onSubmit, onExit }: Props) {
  const qs = session.questions;
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, MockGiven>>(session.answers ?? {});
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [showGrid, setShowGrid] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // เวลาเครื่องผู้เล่นอาจเพี้ยน ใช้ส่วนต่างกับเวลาเซิร์ฟเวอร์
  const offset = useRef(session.serverNow - Date.now());
  const deadline = Date.parse(session.deadlineAt);
  const [now, setNow] = useState(() => Date.now() + offset.current);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit();
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [onSubmit]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now >= deadline) submit();
  }, [now, deadline, submit]);

  const q = qs[pos];
  const key = String(q.i);
  const given = answers[key];
  const answeredCount = qs.filter((x) => isAnswered(answers[String(x.i)])).length;
  const remaining = deadline - now;

  const setAnswer = (value: MockGiven) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    saveMockAnswer(session.attemptId, q.i, value)
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  };

  // ช่องตัวเลข: เก็บในเครื่องทันที แล้วค่อยบันทึกตอนพิมพ์หยุด
  const [fillDraft, setFillDraft] = useState('');
  useEffect(() => {
    setFillDraft(typeof given === 'string' ? given : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);
  const commitFill = () => {
    const v = fillDraft.trim();
    if (v !== (typeof given === 'string' ? given : '')) setAnswer(v || null);
  };

  const go = (p: number) => {
    if (q.type === 'fill') commitFill();
    setPos(Math.min(qs.length - 1, Math.max(0, p)));
    setShowGrid(false);
  };

  const toggleFlag = () =>
    setFlags((f) => {
      const n = new Set(f);
      if (n.has(q.i)) n.delete(q.i);
      else n.add(q.i);
      return n;
    });

  return (
    <div className="screen mock-room">
      <header className="quiz__top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="ออก">
          ✕
        </button>
        <div className="quiz__progress">
          {session.title} · ชุด {session.no}
          {session.half ? ' (ครึ่งชุด)' : ''}
        </div>
        <div className={`mock-timer ${remaining < 5 * 60_000 ? 'is-low' : ''}`} aria-label="เวลาที่เหลือ">
          <Timer weight="fill" className="ico" /> {fmt(remaining)}
        </div>
      </header>

      <button type="button" className="mock-progress" onClick={() => setShowGrid(!showGrid)}>
        ตอบแล้ว {answeredCount}/{qs.length} ข้อ {saveError && <span className="mock-progress__err">· <Warning weight="fill" className="ico" /> บันทึกไม่สำเร็จ ลองใหม่</span>}
        <span>{showGrid ? '▲' : '▼ ดูทุกข้อ'}</span>
      </button>
      {showGrid && (
        <div className="mock-grid">
          {qs.map((x, p) => (
            <button
              key={x.i}
              type="button"
              className={`mock-grid__cell ${isAnswered(answers[String(x.i)]) ? 'is-answered' : ''} ${p === pos ? 'is-current' : ''} ${
                flags.has(x.i) ? 'is-flagged' : ''
              }`}
              onClick={() => go(p)}
            >
              {p + 1}
            </button>
          ))}
        </div>
      )}

      <article key={q.i} className="card question-card">
        <div className="question-card__meta">
          <span className="tag tag--ghost">
            ข้อ {pos + 1}/{qs.length}
          </span>
          <span className="tag tag--ghost">
            {q.type === 'mcq5' ? 'ปรนัย 5 ตัวเลือก' : q.type === 'fill' ? 'ระบายคำตอบเป็นตัวเลข' : 'เลือกตอบเชิงซ้อน'}
          </span>
          {chapterName(q.chapter) && <span className="tag tag--ghost"><BookOpenText weight="fill" className="ico" /> {chapterName(q.chapter)}</span>}
        </div>
        <MathText className="question-card__prompt" text={q.prompt} />
      </article>

      {q.type === 'mcq5' && (
        <div className="mock-choices">
          {q.choices?.map((c, k) => (
            <button
              key={k}
              type="button"
              className={`choice choice--${k % 4} ${given === k ? 'is-picked' : ''}`}
              aria-pressed={given === k}
              onClick={() => setAnswer(given === k ? null : k)}
            >
              <span className="choice__label">{CHOICE5[k]}</span>
              <MathText className="choice__text" text={c} />
            </button>
          ))}
        </div>
      )}

      {q.type === 'fill' && (
        <div className="fill">
          <div className="fill__box">
            <input
              className="fill__input"
              inputMode="decimal"
              placeholder="พิมพ์คำตอบเป็นตัวเลข"
              value={fillDraft}
              maxLength={20}
              onChange={(e) => setFillDraft(e.target.value)}
              onBlur={commitFill}
              onKeyDown={(e) => e.key === 'Enter' && commitFill()}
            />
            {q.unit && <span className="fill__unit">{q.unit}</span>}
          </div>
        </div>
      )}

      {q.type === 'multi' && (
        <ul className="mock-multi">
          {q.statements?.map((st, k) => {
            const arr = Array.isArray(given) ? given : [null, null, null];
            const pick = (v: boolean) => setAnswer(arr.map((x, j) => (j === k ? (x === v ? null : v) : x)));
            return (
              <li key={k} className="mock-multi__row">
                <MathText className="mock-multi__text" text={`${k + 1}) ${st}`} />
                <div className="segmented">
                  <button type="button" className={`segmented__opt ${arr[k] === true ? 'is-active' : ''}`} onClick={() => pick(true)}>
                    ✓ ถูก
                  </button>
                  <button type="button" className={`segmented__opt ${arr[k] === false ? 'is-active' : ''}`} onClick={() => pick(false)}>
                    ✗ ผิด
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mock-nav">
        <button type="button" className="btn btn--ghost" disabled={pos === 0} onClick={() => go(pos - 1)}>
          <CaretLeft weight="bold" className="ico" /> ก่อนหน้า
        </button>
        <button type="button" className={`btn btn--ghost ${flags.has(q.i) ? 'is-flagged' : ''}`} onClick={toggleFlag}>
          {flags.has(q.i) ? '⚑ ติดธงแล้ว' : '⚐ ไว้กลับมาดู'}
        </button>
        {pos < qs.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => go(pos + 1)}>
            ถัดไป <CaretRight weight="bold" className="ico" />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              commitFill();
              setConfirming(true);
            }}
          >
            ส่งข้อสอบ
          </button>
        )}
      </div>

      <button
        type="button"
        className="btn btn--ghost btn--block mock-submit"
        disabled={submitting}
        onClick={() => {
          if (q.type === 'fill') commitFill();
          setConfirming(true);
        }}
      >
        {submitting ? 'กำลังตรวจ...' : 'ส่งข้อสอบ'}
      </button>

      {confirming && !submitting && (
        <div className="mock-confirm" role="dialog" aria-modal="true">
          <div className="settings-card">
            <h2 className="section-title section-title--dark">ส่งข้อสอบเลยไหม?</h2>
            <p>
              ตอบแล้ว {answeredCount}/{qs.length} ข้อ
              {answeredCount < qs.length && <strong> · ยังไม่ได้ตอบ {qs.length - answeredCount} ข้อ</strong>}
            </p>
            <p className="muted">ส่งแล้วแก้ไม่ได้ และทำชุดนี้ซ้ำไม่ได้</p>
            <div className="plan__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
                กลับไปตรวจ
              </button>
              <button type="button" className="btn btn--primary" onClick={submit}>
                ส่งเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
