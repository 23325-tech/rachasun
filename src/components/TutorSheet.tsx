import { useEffect, useRef, useState } from 'react';
import { ChalkboardTeacher, Lightbulb, ListNumbers, LockSimple, PaperPlaneRight, X } from '@phosphor-icons/react';
import { MathText } from './MathText';
import { t } from '../lib/i18n';
import {
  HINTS_FOR_SOLUTION,
  TutorError,
  askTutor,
  fetchTutorQuota,
  type TutorAction,
  type TutorQuestion,
  type TutorQuota,
  type TutorTurn,
} from '../lib/tutor';

interface Props {
  question: TutorQuestion;
  /** บทสนทนาที่มีแล้ว (เช่น คำใบ้แรกจากการอ่านรูป) ถ้ามีจะไม่ขอคำใบ้แรกซ้ำ */
  initial?: TutorTurn[];
  onClose: () => void;
}

/** AI ติวเตอร์: คำใบ้ทีละขั้นก่อน ครบ 2 คำใบ้จึงดูวิธีทำเต็มได้ ถามเพิ่มเองได้ */
export function TutorSheet({ question, initial, onClose }: Props) {
  const [turns, setTurns] = useState<TutorTurn[]>(initial ?? []);
  const [quota, setQuota] = useState<TutorQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  // กันกดซ้ำระหว่างรอ (state อาจยังไม่อัปเดตในคลิกที่ติดกัน)
  const inFlight = useRef(false);
  const turnsRef = useRef<TutorTurn[]>([]);
  turnsRef.current = turns;

  const hints = turns.filter((x) => x.role === 'tutor' && x.kind === 'hint').length;
  const solved = turns.some((x) => x.role === 'tutor' && x.kind === 'solution');
  const unlocked = hints >= HINTS_FOR_SOLUTION;
  const outOfQuota = !!quota && quota.used >= quota.limit;

  const send = async (action: TutorAction, message = '') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const history = turnsRef.current;
    if (action === 'ask') setTurns((prev) => [...prev, { role: 'user', kind: 'ask', text: message }]);
    try {
      const res = await askTutor(question, history, action, message);
      setTurns((prev) => [...prev, { role: 'tutor', kind: action, text: res.reply }]);
      setQuota(res.quota);
    } catch (e) {
      if (action === 'ask') setTurns((prev) => prev.slice(0, -1));
      if (e instanceof TutorError && e.quota) setQuota(e.quota);
      setError(e instanceof Error ? e.message : String(e));
      if (action === 'ask') setText(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // เปิดมาแล้วขอคำใบ้ข้อแรกให้เลย
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    fetchTutorQuota()
      .then((q) => {
        setQuota(q);
        if (!inFlight.current) setBusy(false);
        if (q.used < q.limit && !initial?.length) void send('hint');
      })
      .catch(() => {
        if (!inFlight.current) setBusy(false);
        if (!initial?.length) void send('hint');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label = (x: TutorTurn, i: number) => {
    if (x.kind === 'hint') {
      const n = turns.slice(0, i + 1).filter((y) => y.role === 'tutor' && y.kind === 'hint').length;
      return t(`คำใบ้ ${n}`, `Hint ${n}`);
    }
    if (x.kind === 'solution') return t('วิธีทำเต็ม', 'Full solution');
    return t('ติวเตอร์', 'Tutor');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = text.trim();
    if (!m) return;
    setText('');
    void send('ask', m);
  };

  return (
    <div className="modal-backdrop tutor-backdrop" role="dialog" aria-modal="true" aria-label={t('AI ติวเตอร์', 'AI tutor')} onClick={onClose}>
      <div className="tutor-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="tutor-sheet__head">
          <span className="tutor-sheet__title">
            <ChalkboardTeacher weight="fill" size={22} /> {t('AI ติวเตอร์', 'AI tutor')}
          </span>
          {quota && (
            <span className="tutor-sheet__quota">
              {t(`เหลือ ${Math.max(0, quota.limit - quota.used)}/${quota.limit} วันนี้`, `${Math.max(0, quota.limit - quota.used)}/${quota.limit} left today`)}
            </span>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('ปิด', 'Close')}>
            <X weight="bold" />
          </button>
        </header>

        <div className="tutor-sheet__list" ref={listRef}>
          <p className="tutor-sheet__intro muted">
            {t('ติวเตอร์จะใบ้ทีละขั้นให้ลองคิดเองก่อน ได้คำใบ้ครบ 2 ข้อแล้วกดดูวิธีทำเต็มได้', "The tutor gives step-by-step hints first. After 2 hints you can open the full solution.")}
          </p>
          {turns.map((x, i) => (
            <div key={i} className={`tutor-msg tutor-msg--${x.role} tutor-msg--${x.kind}`}>
              {x.role === 'tutor' && <span className="tutor-msg__label">{label(x, i)}</span>}
              {x.role === 'tutor' ? <MathText text={x.text} /> : <span>{x.text}</span>}
            </div>
          ))}
          {busy && (
            <div className="tutor-msg tutor-msg--tutor tutor-msg--typing" aria-label={t('กำลังพิมพ์', 'Typing')}>
              <span />
              <span />
              <span />
            </div>
          )}
          {outOfQuota && !busy && (
            <p className="form-error">
              {t(`วันนี้ถามครบ ${quota.limit} ครั้งแล้ว พรุ่งนี้มาใหม่นะ`, `You've used all ${quota.limit} questions today. Come back tomorrow!`)}
              {quota.limit < 30 && t(' (สมัครสมาชิกถามได้วันละ 30 ครั้ง)', ' (members get 30 a day)')}
            </p>
          )}
          {error && !outOfQuota && <p className="form-error">{error}</p>}
        </div>

        <div className="tutor-sheet__actions">
          <button type="button" className="btn btn--ghost" disabled={busy || outOfQuota || solved} onClick={() => send('hint')}>
            <Lightbulb weight="fill" className="ico" /> {hints ? t('ขอคำใบ้เพิ่ม', 'Another hint') : t('ขอคำใบ้', 'Get a hint')}
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || outOfQuota || !unlocked || solved} onClick={() => send('solution')}>
            {unlocked ? <ListNumbers weight="bold" className="ico" /> : <LockSimple weight="fill" className="ico" />}{' '}
            {unlocked ? t('ดูวิธีทำเต็ม', 'Full solution') : t(`วิธีทำเต็ม (${hints}/${HINTS_FOR_SOLUTION})`, `Solution (${hints}/${HINTS_FOR_SOLUTION})`)}
          </button>
        </div>
        <form className="tutor-sheet__ask" onSubmit={submit}>
          <input
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('ถามติวเตอร์ เช่น ทำไมต้องใช้สูตรนี้', 'Ask, e.g. why use this formula?')}
            disabled={outOfQuota}
          />
          <button type="submit" className="icon-btn" disabled={busy || outOfQuota || !text.trim()} aria-label={t('ส่ง', 'Send')}>
            <PaperPlaneRight weight="fill" />
          </button>
        </form>
      </div>
    </div>
  );
}
