import { useRef, useState } from 'react';
import type { AnswerResult, Question, Subject } from './types';
import { SUBJECTS } from './data/subjects';
import { loadQuiz, sampleQuiz } from './lib/questionBank';
import { supabase } from './lib/supabase';
import { StartScreen, type GameSettings } from './screens/StartScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultScreen } from './screens/ResultScreen';

type Screen =
  | { name: 'start'; error: string | null }
  | { name: 'loading'; message: string }
  | { name: 'quiz'; questions: Question[]; runId: number }
  | { name: 'result'; questions: Question[]; results: AnswerResult[] };

const ALL_SUBJECTS = Object.keys(SUBJECTS) as Subject[];

const subjectsOf = (s: GameSettings): Subject[] => (s.subject === 'all' ? ALL_SUBJECTS : [s.subject]);

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start', error: null });
  const [settings, setSettings] = useState<GameSettings>({
    subject: 'all',
    difficulty: 'medium',
    track: 'school',
    count: 10,
  });
  // กันผลโหลดที่ถูกยกเลิกไปแล้วมาเปลี่ยนหน้าจอทีหลัง
  const loadIdRef = useRef(0);

  const playQuestions = (questions: Question[]) => setScreen({ name: 'quiz', questions, runId: Date.now() });

  const playSample = (s: GameSettings) => {
    setSettings(s);
    playQuestions(sampleQuiz(subjectsOf(s), s.count));
  };

  const start = async (s: GameSettings) => {
    setSettings(s);
    if (!supabase) {
      setScreen({ name: 'start', error: 'ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env.local' });
      return;
    }
    const loadId = ++loadIdRef.current;
    setScreen({ name: 'loading', message: 'กำลังเตรียมโจทย์...' });
    try {
      const { questions } = await loadQuiz(
        { subjects: subjectsOf(s), difficulty: s.difficulty, track: s.track, count: s.count },
        (message) => loadId === loadIdRef.current && setScreen({ name: 'loading', message }),
      );
      if (loadId === loadIdRef.current) playQuestions(questions);
    } catch (e) {
      if (loadId === loadIdRef.current) setScreen({ name: 'start', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const goHome = () => {
    loadIdRef.current++;
    setScreen({ name: 'start', error: null });
  };

  switch (screen.name) {
    case 'start':
      return <StartScreen initial={settings} error={screen.error} onStart={start} onPlaySample={playSample} />;
    case 'loading':
      return <LoadingScreen message={screen.message} onCancel={goHome} />;
    case 'quiz':
      return (
        <QuizScreen
          key={screen.runId}
          questions={screen.questions}
          onQuit={goHome}
          onFinish={(results) => setScreen({ name: 'result', questions: screen.questions, results })}
        />
      );
    case 'result':
      return (
        <ResultScreen
          questions={screen.questions}
          results={screen.results}
          onReplay={() => start(settings)}
          onHome={goHome}
        />
      );
  }
}
