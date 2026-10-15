import { useState } from 'react';
import type { AnswerResult, Question } from './types';
import { SAMPLE_QUESTIONS } from './data/sampleQuestions';
import { shuffle } from './lib/shuffle';
import { StartScreen, type SubjectFilter } from './screens/StartScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultScreen } from './screens/ResultScreen';

type Screen =
  | { name: 'start' }
  | { name: 'quiz'; questions: Question[]; runId: number }
  | { name: 'result'; questions: Question[]; results: AnswerResult[] };

interface Settings {
  subject: SubjectFilter;
  count: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [settings, setSettings] = useState<Settings>({ subject: 'all', count: 10 });

  const start = ({ subject, count }: Settings) => {
    setSettings({ subject, count });
    const pool = SAMPLE_QUESTIONS.filter((q) => subject === 'all' || q.subject === subject);
    setScreen({ name: 'quiz', questions: shuffle(pool).slice(0, count), runId: Date.now() });
  };

  switch (screen.name) {
    case 'start':
      return <StartScreen onStart={(subject, count) => start({ subject, count })} />;
    case 'quiz':
      return (
        <QuizScreen
          key={screen.runId}
          questions={screen.questions}
          onQuit={() => setScreen({ name: 'start' })}
          onFinish={(results) => setScreen({ name: 'result', questions: screen.questions, results })}
        />
      );
    case 'result':
      return (
        <ResultScreen
          questions={screen.questions}
          results={screen.results}
          onReplay={() => start(settings)}
          onHome={() => setScreen({ name: 'start' })}
        />
      );
  }
}
