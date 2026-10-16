import { Atom, Dna, Flask, Lightning, MathOperations, Translate, type Icon } from '@phosphor-icons/react';
import type { Subject } from '../types';

export const SUBJECT_ICON: Record<Subject, Icon> = {
  math: MathOperations,
  science: Atom,
  physics: Lightning,
  chemistry: Flask,
  biology: Dna,
  english: Translate,
};
