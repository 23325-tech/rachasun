import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AnswerResult, Difficulty, Question, Subject } from './types';
import { SUBJECTS } from './data/subjects';
import { loadQuiz, sampleQuiz } from './lib/questionBank';
import { supabase } from './lib/supabase';
import { createProfile, displayName, isGuest, loadMe, recordGame, type GameRecord, type Profile } from './lib/profile';
import { createPlayers, type BattlePlayer } from './game/battle';
import { createBots, type Bot } from './game/bots';
import { StartScreen, type GameSettings } from './screens/StartScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BattleScreen, ME_ID, type MyBattleStats } from './screens/BattleScreen';
import { BattleResultScreen } from './screens/BattleResultScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { AccountScreen } from './screens/AccountScreen';
import { ProfileCard } from './components/ProfileCard';
import type { XpState } from './components/XpBadge';

type Screen =
  | { name: 'start'; error: string | null }
  | { name: 'loading'; message: string }
  | { name: 'account' }
  | { name: 'quiz'; questions: Question[]; runId: number }
  | { name: 'result'; questions: Question[]; results: AnswerResult[] }
  | { name: 'battle'; questions: Question[]; questionCount: number; players: BattlePlayer[]; bots: Bot[]; runId: number }
  | { name: 'battleResult'; players: BattlePlayer[] };

/** loading = กำลังโหลดผู้ใช้, offline = ไม่มี Supabase (เล่นได้แต่ไม่เก็บ XP) */
type MeState =
  | { status: 'loading' }
  | { status: 'offline'; error?: string }
  | { status: 'ready'; user: User; profile: Profile | null };

const ALL_SUBJECTS = Object.keys(SUBJECTS) as Subject[];
/** โจทย์สำรองสำหรับ Sudden Death (ถ้าใช้หมดจะวนกลับมาใช้ข้อเดิม) */
const SUDDEN_DEATH_SPARE = 5;

const subjectsOf = (s: GameSettings): Subject[] => (s.subject === 'all' ? ALL_SUBJECTS : [s.subject]);

function countCorrect(questions: Question[], results: AnswerResult[]): Record<Difficulty, number> {
  const out: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const r of results) {
    const q = questions.find((x) => x.id === r.questionId);
    if (q && r.correct) out[q.difficulty]++;
  }
  return out;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start', error: null });
  const [me, setMe] = useState<MeState>(supabase ? { status: 'loading' } : { status: 'offline' });
  const [xp, setXp] = useState<XpState>({ status: 'off' });
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

  const refreshMe = useCallback(async () => {
    if (!supabase) return;
    try {
      const { user, profile } = await loadMe();
      setMe({ status: 'ready', user, profile });
    } catch (e) {
      setMe({ status: 'offline', error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    refreshMe();
    // กลับมาจากหน้า Google / ยืนยันอีเมล / ออกจากระบบ -> โหลดผู้ใช้ใหม่
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') setTimeout(refreshMe, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshMe]);

  const profile = me.status === 'ready' ? me.profile : null;
  const guest = me.status === 'ready' ? isGuest(me.user) : true;

  /** บันทึกผลเกมแล้วอัปเดต XP บนการ์ดโปรไฟล์ */
  const saveGame = async (record: GameRecord) => {
    if (!profile) {
      setXp({ status: 'off' });
      return;
    }
    setXp({ status: 'saving' });
    try {
      const r = await recordGame(record);
      setXp({ status: 'saved', gained: r.xpGained, total: r.xpTotal });
      setMe((m) => (m.status === 'ready' && m.profile ? { ...m, profile: { ...m.profile, xp: r.xpTotal } } : m));
    } catch (e) {
      setXp({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const play = (s: GameSettings, questions: Question[]) => {
    if (s.mode === 'solo') {
      setScreen({ name: 'quiz', questions: questions.slice(0, s.count), runId: Date.now() });
      return;
    }
    const bots = createBots(s.botCount, s.botLevel);
    const players = createPlayers(
      [
        { id: ME_ID, name: profile ? displayName(profile) : 'คุณ', avatar: profile?.avatar ?? '😎', isBot: false },
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

  const openAccount = () => setScreen({ name: 'account' });

  // ---------- หน้าจอที่ขึ้นกับสถานะผู้ใช้ ----------
  if (me.status === 'loading') return <LoadingScreen message="กำลังโหลดโปรไฟล์..." onCancel={() => setMe({ status: 'offline' })} />;

  if (screen.name === 'account' && me.status === 'ready') {
    return <AccountScreen user={me.user} profile={me.profile} onBack={goHome} onChanged={refreshMe} />;
  }

  if (me.status === 'ready' && !me.profile) {
    return (
      <ProfileSetupScreen
        onCreate={async (nickname, avatar) => {
          const created = await createProfile(nickname, avatar);
          setMe({ ...me, profile: created });
        }}
        onLogin={openAccount}
      />
    );
  }

  switch (screen.name) {
    case 'start':
    case 'account':
      return (
        <StartScreen
          initial={settings}
          error={screen.name === 'start' ? (screen.error ?? (me.status === 'offline' ? me.error ?? null : null)) : null}
          onStart={start}
          onPlaySample={playSample}
          profileSlot={profile && <ProfileCard profile={profile} guest={guest} onOpen={openAccount} />}
        />
      );
    case 'loading':
      return <LoadingScreen message={screen.message} onCancel={goHome} />;
    case 'quiz':
      return (
        <QuizScreen
          key={screen.runId}
          questions={screen.questions}
          onQuit={goHome}
          onFinish={(results) => {
            setScreen({ name: 'result', questions: screen.questions, results });
            const c = countCorrect(screen.questions, results);
            saveGame({
              mode: 'solo',
              questions: results.length,
              correctEasy: c.easy,
              correctMedium: c.medium,
              correctHard: c.hard,
            });
          }}
        />
      );
    case 'result':
      return (
        <ResultScreen
          questions={screen.questions}
          results={screen.results}
          onReplay={() => start(settings)}
          onHome={goHome}
          xp={xp}
          guest={guest}
          onRegister={openAccount}
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
          onFinish={(players, stats: MyBattleStats) => {
            setScreen({ name: 'battleResult', players });
            const mine = players.find((p) => p.id === ME_ID)!;
            saveGame({
              mode: 'bots',
              questions: Math.max(1, stats.rounds),
              correctEasy: stats.correct.easy,
              correctMedium: stats.correct.medium,
              correctHard: stats.correct.hard,
              rank: mine.rank ?? players.length,
              players: players.length,
            });
          }}
        />
      );
    case 'battleResult':
      return (
        <BattleResultScreen
          players={screen.players}
          meId={ME_ID}
          onReplay={() => start(settings)}
          onHome={goHome}
          xp={xp}
          guest={guest}
          onRegister={openAccount}
        />
      );
  }
}
