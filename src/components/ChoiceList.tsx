import type { McqQuestion } from '../types';
import { CHOICE_LABELS } from '../data/subjects';
import { MathText } from './MathText';

interface Props {
  question: McqQuestion;
  revealed: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
}

export function ChoiceList({ question, revealed, selected, onSelect }: Props) {
  return (
    <div className="choices">
      {question.choices.map((choice, i) => {
        let state = '';
        if (revealed) {
          if (i === question.answerIndex) state = 'is-correct';
          else if (i === selected) state = 'is-wrong';
          else state = 'is-dim';
        }
        return (
          <button
            key={i}
            type="button"
            className={`choice choice--${i} ${state}`}
            disabled={revealed}
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
