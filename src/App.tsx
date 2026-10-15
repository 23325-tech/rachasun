import { useRef, useState } from 'react';
import type { AnswerResult, Question, Subject } from './types';
import { SUBJECTS } from './data/subjects';
import { loadQuiz, sampleQuiz } from './lib/questionBank';
import { supabase } from './lib/supabase';
import { createPlayers, type BattlePlayer } from './game/battle';
import { createBots, type Bot } from './game/bots';
import { StartScreen, type GameSettings } from './screens/StartScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BattleScreen, ME_ID } from './screens/BattleScreen';
import { BattleResultScreen } from './screens/BattleResultScreen';

type Screen =
  | { name: 'start'; error: string | null }
  | { name: 'loading'; message: string }
  | { name: 'quiz'; questions: Question[]; runId: number }
  | { name: 'result'; questions: Question[]; results: AnswerResult[] }
  | { name: 'battle'; questions: Question[]; questionCount: number; players: BattlePlayer[]; bots: Bot[]; runId: number }
  | { name: 'battleResult'; players: BattlePlayer[] };

const ALL_SUBJECTS = Object.keys(SUBJECTS) as Subject[];
/** โจทย์สำรองสำหรับ Sudden Death (ถ้าใช้หมดจะวนกลับมาใช้ข้อเดิม) */
const SUDDEN_DEATH_SPARE = 5;

const subjectsOf = (s: GameSettings): Subject[] => (s.subject === 'all' ? ALL_SUBJECTS : [s.subject]);

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start', error: null });
  const [settings, setSettings] = useState<GameSettings>({
    mode: 'solo',
    botCount: 3,
    botLevel: 'normal',
    subject: 'all',
    difficulty: 'medium',
    track: 'school',
    count: 10,
  });
  // กันผลโหลดที่ถูกยกเลิกไปแล้วมาเปลี่ยนหน้าจอทีหลัง
  const loadIdRef = useRef(0);

  const play = (s: GameSettings, questions: Question[]) => {
    if (s.mode === 'solo') {
      setScreen({ name: 'quiz', questions: questions.slice(0, s.count), runId: Date.now() });
      return;
    }
    const bots = createBots(s.botCount, s.botLevel);
    const players = createPlayers(
      [
        { id: ME_ID, name: 'คุณ', avatar: '😎', isBot: false },
        ...bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, isBot: true })),
      ],
      s.count,
    );
    setScreen({ name: 'battle', questions, questionCount: s.count, players, bots, runId: Date.now() });
  };

  const totalNeeded = (s: GameSettings) => s.count + (s.mode === 'bots' ? SUDDEN_DEATH_SPARE : 0);

  const playSample = (s: GameSettings) => {
    setSettings(s);
    play(s, sampleQuiz(subjectsOf(s), totalNeeded(s)));
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
        { subjects: subjectsOf(s), difficulty: s.difficulty, track: s.track, count: totalNeeded(s) },
        (message) => loadId === loadIdRef.current && setScreen({ name: 'loading', message }),
      );
      if (loadId !== loadIdRef.current) return;
      // โหมดดวลต้องมีโจทย์ครบจำนวนข้อปกติ (ถ้าไม่ครบ ลดจำนวนข้อลงตามที่มี)
      const count = Math.min(s.count, questions.length);
      play({ ...s, count }, questions);
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
    case 'battle':
      return (
        <BattleScreen
          key={screen.runId}
          questions={screen.questions}
          questionCount={screen.questionCount}
          initialPlayers={screen.players}
          bots={screen.bots}
          onQuit={goHome}
          onFinish={(players) => setScreen({ name: 'battleResult', players })}
        />
      );
    case 'battleResult':
      return (
        <BattleResultScreen players={screen.players} meId={ME_ID} onReplay={() => start(settings)} onHome={goHome} />
      );
  }
}
