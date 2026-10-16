import type { McqQuestion } from '../types';
import { CHOICE_LABELS } from '../data/subjects';
import { MathText } from './MathText';

interface Props {
  question: McqQuestion;
  /** ล็อกปุ่ม (ตอบแล้วหรือเฉลยแล้ว) */
  revealed: boolean;
  /** แสดงเฉลยถูก/ผิด ค่าเริ่มต้น = revealed (โหมดแข่งจะล็อกก่อน แล้วค่อยเฉลยตอนทุกคนตอบครบ) */
  showAnswer?: boolean;
  selected: number | null;
  /** ตัวเลือกที่ถูกตัดด้วยการ์ด 50/50 */
  removed?: number[];
  onSelect: (index: number) => void;
}

export function ChoiceList({ question, revealed, showAnswer = revealed, selected, removed = [], onSelect }: Props) {
  return (
    <div className="choices">
      {question.choices.map((choice, i) => {
        let state = '';
        const cut = removed.includes(i);
        if (cut && !showAnswer) {
          state = 'is-removed';
        } else if (showAnswer) {
          if (i === question.answerIndex) state = 'is-correct';
          else if (i === selected) state = 'is-wrong';
          else state = 'is-dim';
        } else if (revealed) {
          state = i === selected ? 'is-selected' : 'is-dim';
        }
        return (
          <button
            key={i}
            type="button"
            className={`choice choice--${i} ${state}`}
            disabled={revealed || cut}
            onClick={() => onSelect(i)}
          >
            <span className="choice__label">{CHOICE_LABELS[i]}</span>
            <MathText className="choice__text" text={choice} />
          </button>
        );
      })}
    </div>
  );
}
