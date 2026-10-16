import { useEffect, useRef, useState } from 'react';
import type { FillQuestion } from '../types';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { t } from '../lib/i18n';

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
          placeholder={isNumber ? t('พิมพ์ตัวเลข เช่น 2.5 หรือ 1/4', 'Type a number, e.g. 2.5 or 1/4') : t('พิมพ์คำตอบ', 'Type your answer')}
          value={value}
          disabled={revealed}
          onChange={(e) => setValue(e.target.value)}
        />
        {unit && <span className="fill__unit">{unit}</span>}
      </div>
      {!revealed && (
        <button type="submit" className="btn btn--primary btn--block" disabled={!value.trim()}>
          {t('ส่งคำตอบ', 'Submit')} <PaperPlaneTilt weight="fill" className="ico" />
        </button>
      )}
    </form>
  );
}
