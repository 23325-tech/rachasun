import { useEffect, useRef, useState } from 'react';
import type { FillQuestion } from '../types';
import { PaperPlaneTilt } from '@phosphor-icons/react';

interface Props {
  question: FillQuestion;
  revealed: boolean;
  correct: boolean | null;
  onSubmit: (value: string) => void;
}

export function FillAnswerInput({ question, revealed, correct, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isNumber = question.answer.kind === 'number';
  const unit = question.answer.kind === 'number' ? question.answer.unit : undefined;

  useEffect(() => {
    setValue('');
    inputRef.current?.focus();
  }, [question.id]);

  const stateClass = revealed ? (correct ? 'is-correct' : 'is-wrong') : '';

  return (
    <form
      className="fill"
      onSubmit={(e) => {
        e.preventDefault();
        if (!revealed && value.trim()) onSubmit(value);
      }}
    >
      <div className={`fill__box ${stateClass}`}>
        <input
          ref={inputRef}
          className="fill__input"
          type="text"
          inputMode={isNumber ? 'decimal' : 'text'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={isNumber ? 'พิมพ์ตัวเลข เช่น 2.5 หรือ 1/4' : 'พิมพ์คำตอบ'}
          value={value}
          disabled={revealed}
          onChange={(e) => setValue(e.target.value)}
        />
        {unit && <span className="fill__unit">{unit}</span>}
      </div>
      {!revealed && (
        <button type="submit" className="btn btn--primary btn--block" disabled={!value.trim()}>
          ส่งคำตอบ <PaperPlaneTilt weight="fill" className="ico" />
        </button>
      )}
    </form>
  );
}
