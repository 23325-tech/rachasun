import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AnswerResult, Difficulty, Level, Question, Subject } from './types';
import { adjustForLevel, LEVELS } from './data/subjects';
import { loadQuiz, sampleQuiz } from './lib/questionBank';
import { supabase } from './lib/supabase';
import {
  createProfile,
  displayName,
  isGuest,
  loadMe,
  recordGame,
  updateProfile,
  type GameRecord,
  type Profile,
} from './lib/profile';
import { createPlayers, type BattlePlayer } from './game/battle';
import { createBots, type Bot } from './game/bots';
import { StartScreen, withLevel, type GameSettings } from './screens/StartScreen';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { DressingRoomScreen } from './screens/DressingRoomScreen';
import { isDressingSeen, markDressingSeen } from './components/DressEntry';
import { HomeScreen } from './screens/HomeScreen';
import { ShopScreen } from './screens/ShopScreen';
import { CheckinCard } from './components/CheckinCard';
import { fetchShopState, type ShopState } from './lib/shop';
import { MockMenuScreen } from './screens/MockMenuScreen';
import { MockExamScreen } from './screens/MockExamScreen';
import { MockResultScreen } from './screens/MockResultScreen';
import { reviewMock, startMock, submitMock, type MockReview, type MockSession } from './lib/mock';
import { LoadingScreen } from './screens/LoadingScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BattleScreen, ME_ID, type MyBattleStats } from './screens/BattleScreen';
import { BattleResultScreen } from './screens/BattleResultScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { AccountScreen } from './screens/AccountScreen';
import type { XpState } from './components/XpBadge';
import { InstallBanner } from './components/InstallBanner';
import { useOnline } from './hooks/usePwa';
import { OnlineMenuScreen } from './screens/OnlineMenuScreen';
import { RoomScreen } from './screens/RoomScreen';
import { ChallengeScreen } from './screens/ChallengeScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { GroupScreen } from './screens/GroupScreen';
import { createChallenge } from './lib/asyncPlay';
import { logAnswers } from './lib/analysis';
import { markPlanDone } from './lib/studyPlan';
import { DEFAULT_LOOK_CODE } from './lib/look';
import { createRoom, findMatch, joinRoom, leaveRoom, type MatchSettings, type RoomSettings } from './lib/rooms';
import { t, useLang } from './lib/i18n';
import { fetchSeason, type SeasonState } from './lib/season';
import { SeasonScreen } from './screens/SeasonScreen';
import { VersusIntro } from './components/VersusIntro';

type Screen =
  | { name: 'start'; error: string | null }
  | { name: 'setup'; error: string | null }
  | { name: 'loading'; message: string }
  | { name: 'account' }
  | { name: 'quiz'; questions: Question[]; runId: number }
  | { name: 'result'; questions: Question[]; results: AnswerResult[] }
  | { name: 'battle'; questions: Question[]; questionCount: number; players: BattlePlayer[]; bots: Bot[]; runId: number; intro?: boolean }
  | { name: 'battleResult'; players: BattlePlayer[] }
  | { name: 'online'; initialCode?: string }
  | { name: 'lobby'; roomId: string }
  | { name: 'challenge'; code: string; autoPlay?: boolean }
  | { name: 'groups'; initialCode?: string }
  | { name: 'group'; groupId: string }
  | { name: 'analysis' }
  | { name: 'dressing' }
  | { name: 'shop' }
  | { name: 'season' }
  | { name: 'mock' }
  | { name: 'mockExam'; session: MockSession }
  | { name: 'mockResult'; review: MockReview };

/** loading = กำลังโหลดผู้ใช้, offline = ไม่มี Supabase (เล่นได้แต่ไม่เก็บ XP) */
type MeState =
  | { status: 'loading' }
  | { status: 'offline'; error?: string }
  | { status: 'ready'; user: User; profile: Profile | null; needsPassword: boolean };

/** โจทย์สำรองสำหรับ Sudden Death (ถ้าใช้หมดจะวนกลับมาใช้ข้อเดิม) */
const SUDDEN_DEATH_SPARE = 5;

/** อ่านรหัสจากลิงก์ เช่น ?room=CODE หรือ ?challenge=CODE (ครั้งเดียวตอนเปิดแอพ แล้วลบออกจาก URL) */
function takeLinkCode(param: 'room' | 'challenge' | 'group', length: number): string | undefined {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(param)?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return undefined;
  url.searchParams.delete(param);
  window.history.replaceState(null, '', url.toString());
  return code.slice(0, length);
}

/** อ่านครั้งเดียวตอนโหลดแอพ (ถ้าอ่านใน useState initializer, StrictMode จะเรียกซ้ำแล้วรหัสหาย) */
const INVITE_CODE = takeLinkCode('room', 5);
const CHALLENGE_CODE = takeLinkCode('challenge', 6);
const GROUP_CODE = takeLinkCode('group', 6);

const toRoomSettings = (s: GameSettings): RoomSettings => ({
  subject: s.subject,
  difficulty: s.difficulty,
  track: s.track,
  level: s.level,
  count: ([5, 10, 20] as const).includes(s.count as 5 | 10 | 20) ? (s.count as RoomSettings['count']) : 10,
});

const subjectsOf = (s: GameSettings): Subject[] => (s.subject === 'all' ? LEVELS[s.level].subjects : [s.subject]);

function countCorrect(questions: Question[], results: AnswerResult[]): Record<Difficulty, number> {
  const out: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, challenge: 0 };
  for (const r of results) {
    const q = questions.find((x) => x.id === r.questionId);
    if (q && r.correct) out[q.difficulty]++;
  }
  return out;
}

export default function App() {
  // เปลี่ยนภาษาแล้ววาดใหม่ทั้งแอป
  useLang();
  const [screen, setScreen] = useState<Screen>(() =>
    CHALLENGE_CODE
      ? { name: 'challenge', code: CHALLENGE_CODE }
      : GROUP_CODE
        ? { name: 'groups', initialCode: GROUP_CODE }
        : INVITE_CODE
          ? { name: 'online', initialCode: INVITE_CODE }
          : { name: 'start', error: null },
  );
  const [me, setMe] = useState<MeState>(supabase ? { status: 'loading' } : { status: 'offline' });
  const [xp, setXp] = useState<XpState>({ status: 'off' });
  const [settings, setSettings] = useState<GameSettings>({
    mode: 'solo',
    botCount: 3,
    botLevel: 'normal',
    level: 'upper',
    subject: 'all',
    chapters: [],
    difficulty: 'medium',
    track: 'school',
    count: 10,
  });
  const [matchSettings, setMatchSettings] = useState<MatchSettings>({
    subject: 'all',
    difficulty: 'medium',
    track: 'school',
    level: 'upper',
    mode: 'classic',
  });
  const online = useOnline();
  const [dressNew, setDressNew] = useState(() => !isDressingSeen());
  const [shop, setShop] = useState<ShopState | null>(null);
  const loadShop = useCallback(() => fetchShopState().then((s) => (setShop(s), s)), []);
  const [season, setSeason] = useState<SeasonState | null>(null);
  // รอบที่เริ่มจากแผนการฝึก (ทำจบแล้วติ๊กในแผน)
  const planRunRef = useRef<{ level: Level; index: number } | null>(null);
  // กันผลโหลดที่ถูกยกเลิกไปแล้วมาเปลี่ยนหน้าจอทีหลัง
  const loadIdRef = useRef(0);

  const refreshMe = useCallback(async () => {
    if (!supabase) return;
    try {
      setMe({ status: 'ready', ...(await loadMe()) });
    } catch (e) {
      // เน็ตหลุด: ไม่ต้องแสดง error ยาว แถบออฟไลน์บอกอยู่แล้ว
      setMe({ status: 'offline', error: navigator.onLine ? (e instanceof Error ? e.message : String(e)) : undefined });
    }
  }, []);

  // เน็ตกลับมา -> โหลดโปรไฟล์ใหม่
  useEffect(() => {
    if (online && me.status === 'offline' && supabase) refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    if (!supabase) return;
    refreshMe();
    // กลับมาจากหน้า Google / ยืนยันอีเมล / ออกจากระบบ -> โหลดผู้ใช้ใหม่
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // กดลิงก์ลืมรหัสผ่านในอีเมล -> พาไปหน้าบัญชีเพื่อตั้งรหัสใหม่
      if (event === 'PASSWORD_RECOVERY') setScreen({ name: 'account' });
      if (['SIGNED_IN', 'USER_UPDATED', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(event)) setTimeout(refreshMe, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshMe]);

  const profile = me.status === 'ready' ? me.profile : null;
  const guest = me.status === 'ready' ? isGuest(me.user) : true;
  const needsPassword = me.status === 'ready' && me.needsPassword;

  // ระดับชั้นในโปรไฟล์ = ค่าเริ่มต้นของหน้าแรก
  const profileLevel = profile?.level;
  useEffect(() => {
    if (!profileLevel) return;
    setSettings((prev) => (prev.level === profileLevel ? prev : withLevel(prev, profileLevel)));
    setMatchSettings((prev) => (prev.level === profileLevel ? prev : adjustForLevel(prev, profileLevel)));
  }, [profileLevel]);

  const profileId = profile?.id;
  useEffect(() => {
    if (profileId && (screen.name === 'start' || screen.name === 'shop' || screen.name === 'dressing')) loadShop().catch(() => {});
    if (profileId && (screen.name === 'start' || screen.name === 'season')) fetchSeason().then(setSeason).catch(() => {});
  }, [profileId, screen.name, loadShop]);

  const changeLevel = (level: Level) => {
    setSettings((prev) => withLevel(prev, level));
    setMatchSettings((prev) => adjustForLevel(prev, level));
    if (!profile || profile.level === level) return;
    setMe((m) => (m.status === 'ready' && m.profile ? { ...m, profile: { ...m.profile, level } } : m));
    // บันทึกเงียบๆ ถ้าไม่สำเร็จก็ยังเล่นระดับนี้ได้ในรอบนี้
    updateProfile(profile.id, { level }).catch(() => {});
  };

  /** บันทึกผลเกมแล้วอัปเดต XP บนการ์ดโปรไฟล์ */
  const saveGame = async (record: GameRecord) => {
    if (!profile) {
      setXp({ status: 'off' });
      return;
    }
    setXp({ status: 'saving' });
    try {
      const before = shop?.coins;
      const r = await recordGame(record);
      setXp({ status: 'saved', gained: r.xpGained, total: r.xpTotal });
      // เหรียญที่ได้จากเกมนี้ (เซิร์ฟเวอร์ให้ตาม XP มีเพดานรายวัน)
      loadShop()
        .then((s) => before !== undefined && setXp((x) => (x.status === 'saved' ? { ...x, coins: s.coins - before } : x)))
        .catch(() => {});
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
        { id: ME_ID, name: profile ? displayName(profile) : t('คุณ', 'You'), avatar: profile?.avatar ?? DEFAULT_LOOK_CODE, isBot: false },
        ...bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, isBot: true })),
      ],
      s.count,
    );
    setScreen({ name: 'battle', questions, questionCount: s.count, players, bots, runId: Date.now(), intro: true });
  };

  const totalNeeded = (s: GameSettings) => s.count + (s.mode === 'bots' ? SUDDEN_DEATH_SPARE : 0);

  const playSample = (s: GameSettings) => {
    setSettings(s);
    play(s, sampleQuiz(subjectsOf(s), totalNeeded(s)));
  };

  const start = async (s: GameSettings) => {
    setSettings(s);
    // ออฟไลน์: ฝึกเดี่ยว/ดวลบอทใช้โจทย์ตัวอย่างในเครื่อง
    if (!navigator.onLine) {
      if (s.mode === 'challenge') {
        setScreen({ name: 'setup', error: t('โหมดท้าเพื่อนต้องต่อเน็ต', 'Challenge mode needs an internet connection') });
        return;
      }
      play(s, sampleQuiz(subjectsOf(s), totalNeeded(s)));
      return;
    }
    if (!supabase) {
      setScreen({ name: 'setup', error: t('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองเล่นโจทย์ตัวอย่างไปก่อนนะ', "Can't reach the server. Try the sample questions for now.") });
      return;
    }
    const loadId = ++loadIdRef.current;
    if (s.mode === 'challenge') {
      setScreen({ name: 'loading', message: t('กำลังเตรียมชุดโจทย์คำท้า...', 'Preparing the challenge set...') });
      try {
        const { code } = await createChallenge({
          subject: s.subject,
          difficulty: s.difficulty,
          track: s.track,
          level: s.level,
          count: s.count,
        });
        if (loadId === loadIdRef.current) setScreen({ name: 'challenge', code, autoPlay: true });
      } catch (e) {
        if (loadId === loadIdRef.current) setScreen({ name: 'setup', error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    setScreen({ name: 'loading', message: t('กำลังเตรียมโจทย์...', 'Preparing questions...') });
    try {
      const { questions } = await loadQuiz(
        {
          subjects: subjectsOf(s),
          difficulty: s.difficulty,
          track: s.track,
          level: s.level,
          chapters: s.subject === 'all' ? [] : s.chapters,
          count: totalNeeded(s),
        },
        (message) => loadId === loadIdRef.current && setScreen({ name: 'loading', message }),
      );
      if (loadId !== loadIdRef.current) return;
      // โหมดดวลต้องมีโจทย์ครบจำนวนข้อปกติ (ถ้าไม่ครบ ลดจำนวนข้อลงตามที่มี)
      const count = Math.min(s.count, questions.length);
      play({ ...s, count }, questions);
    } catch (e) {
      if (loadId === loadIdRef.current) setScreen({ name: 'setup', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const goHome = () => {
    loadIdRef.current++;
    setScreen({ name: 'start', error: null });
  };

  const openAccount = () => setScreen({ name: 'account' });
  const myId = me.status === 'ready' ? me.user.id : '';
  const find = async (m: MatchSettings) => {
    setMatchSettings(m);
    const room = await findMatch(m);
    setScreen({ name: 'lobby', roomId: room.id });
  };
  const roomGone = useCallback((reason: string) => setScreen({ name: 'start', error: reason }), []);

  // ---------- หน้าจอที่ขึ้นกับสถานะผู้ใช้ ----------
  if (me.status === 'loading' && online)
    return <LoadingScreen message={t('กำลังโหลดโปรไฟล์...', 'Loading profile...')} onCancel={() => setMe({ status: 'offline' })} />;

  if (screen.name === 'account' && me.status === 'ready') {
    return (
      <AccountScreen
        user={me.user}
        profile={me.profile}
        needsPassword={me.needsPassword}
        onBack={goHome}
        onChanged={refreshMe}
      />
    );
  }

  if (me.status === 'ready' && !me.profile) {
    return (
      <ProfileSetupScreen
        onCreate={async (nickname, avatar, level) => {
          const created = await createProfile(nickname, avatar, level);
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
        <HomeScreen
          coins={shop?.coins}
          onShop={() => setScreen({ name: 'shop' })}
          season={season ? { no: season.no, endsAt: season.endsAt, rank: season.me.rank } : undefined}
          onSeason={() => setScreen({ name: 'season' })}
          checkinSlot={
            shop && profile && !shop.checkin.claimedToday ? (
              <CheckinCard state={shop} onClaimed={() => loadShop().catch(() => {})} />
            ) : null
          }
          profile={profile}
          guest={guest}
          needsPassword={needsPassword}
          level={settings.level}
          onLevelChange={changeLevel}
          offline={!online}
          installSlot={<InstallBanner />}
          error={screen.name === 'start' ? (screen.error ?? (me.status === 'offline' ? me.error ?? null : null)) : null}
          onDismissError={goHome}
          onAccount={openAccount}
          dressNew={dressNew}
          onDress={() => {
            markDressingSeen();
            setDressNew(false);
            setScreen({ name: 'dressing' });
          }}
          onSubject={(subject) => {
            setSettings((prev) => ({ ...prev, mode: 'solo', subject, chapters: [] }));
            setScreen({ name: 'setup', error: null });
          }}
          onAction={(a) => {
            if (a === 'solo' || a === 'bots' || a === 'challenge') {
              setSettings((prev) => ({ ...prev, mode: a }));
              setScreen({ name: 'setup', error: null });
              return;
            }
            if (me.status !== 'ready') {
              setScreen({ name: 'start', error: t('โหมดนี้ต้องเชื่อมต่ออินเทอร์เน็ต', 'This mode needs an internet connection') });
              return;
            }
            if (a === 'online') setScreen({ name: 'online' });
            else if (a === 'groups') setScreen({ name: 'groups' });
            else if (a === 'analysis') setScreen({ name: 'analysis' });
            else setScreen({ name: 'mock' });
          }}
        />
      );
    case 'setup':
      return (
        <StartScreen
          key={settings.mode}
          initial={settings}
          error={screen.error}
          offline={!online}
          onBack={goHome}
          onStart={(s) => {
            planRunRef.current = null;
            start(s);
          }}
          onPlaySample={playSample}
        />
      );
    case 'analysis':
      return (
        <AnalysisScreen
          initialLevel={settings.level}
          onBack={goHome}
          onPracticePlan={(level, item, index) => {
            planRunRef.current = { level, index };
            const [, subject] = item.chapter.split('.');
            start({
              ...settings,
              mode: 'solo',
              level,
              subject: subject as Subject,
              chapters: [item.chapter],
              difficulty: item.difficulty,
              track: 'school',
              count: 10,
            });
          }}
          onPractice={(p) => {
            planRunRef.current = null;
            start({
              ...settings,
              mode: 'solo',
              level: p.level,
              subject: p.subject,
              chapters: [p.chapter],
              difficulty: p.difficulty,
              track: 'school',
              count: 10,
            });
          }}
        />
      );
    case 'mock':
      return (
        <MockMenuScreen
          onBack={goHome}
          onStart={async (paperId, half) => {
            const r = await startMock(paperId, half);
            if (r.submitted) setScreen({ name: 'mockResult', review: await reviewMock(r.attemptId) });
            else setScreen({ name: 'mockExam', session: r });
          }}
          onReview={(attemptId) =>
            reviewMock(attemptId)
              .then((review) => setScreen({ name: 'mockResult', review }))
              .catch((e) => setScreen({ name: 'start', error: e instanceof Error ? e.message : String(e) }))
          }
        />
      );
    case 'mockExam':
      return (
        <MockExamScreen
          key={screen.session.attemptId}
          session={screen.session}
          onExit={() => setScreen({ name: 'mock' })}
          onSubmit={async () => {
            const review = await submitMock(screen.session.attemptId);
            setScreen({ name: 'mockResult', review });
            refreshMe();
          }}
        />
      );
    case 'mockResult':
      return (
        <MockResultScreen
          review={screen.review}
          onBack={() => setScreen({ name: 'mock' })}
          onAnalysis={() => {
            changeLevel('upper');
            setScreen({ name: 'analysis' });
          }}
        />
      );
    case 'season':
      return season ? (
        <SeasonScreen season={season} meId={profile?.id ?? null} onBack={goHome} />
      ) : (
        <LoadingScreen message={t('กำลังโหลดฤดูกาล...', 'Loading season...')} onCancel={goHome} />
      );
    case 'shop':
      return profile && shop ? (
        <ShopScreen
          code={profile.avatar}
          state={shop}
          onBack={goHome}
          onBought={(coins, itemId) => setShop((s) => (s ? { ...s, coins, owned: [...s.owned, itemId] } : s))}
          onWear={async (avatar) => {
            const updated = await updateProfile(profile.id, { avatar });
            setMe((m) => (m.status === 'ready' ? { ...m, profile: updated } : m));
            goHome();
          }}
        />
      ) : (
        <LoadingScreen message={t('กำลังเปิดร้านค้า...', 'Opening the shop...')} onCancel={goHome} />
      );
    case 'dressing':
      return profile ? (
        <DressingRoomScreen
          code={profile.avatar}
          owned={shop?.owned ?? []}
          onShop={() => setScreen({ name: 'shop' })}
          onBack={goHome}
          onSave={async (avatar) => {
            const updated = await updateProfile(profile.id, { avatar });
            setMe((m) => (m.status === 'ready' ? { ...m, profile: updated } : m));
            goHome();
          }}
        />
      ) : null;
    case 'loading':
      return <LoadingScreen message={screen.message} onCancel={goHome} />;
    case 'groups':
      return (
        <GroupsScreen
          initialCode={screen.initialCode}
          onBack={goHome}
          onOpen={(groupId) => setScreen({ name: 'group', groupId })}
        />
      );
    case 'group':
      return (
        <GroupScreen
          key={screen.groupId}
          groupId={screen.groupId}
          guest={guest}
          onBack={() => setScreen({ name: 'groups' })}
          onLeft={() => setScreen({ name: 'groups' })}
          onRegister={openAccount}
          onXpAwarded={refreshMe}
        />
      );
    case 'challenge':
      return (
        <ChallengeScreen
          key={screen.code}
          code={screen.code}
          autoPlay={screen.autoPlay}
          guest={guest}
          onHome={goHome}
          onRegister={openAccount}
          onXpAwarded={refreshMe}
        />
      );
    case 'online':
      return (
        <OnlineMenuScreen
          initialCode={screen.initialCode}
          initialMatch={matchSettings}
          onFind={find}
          onBack={goHome}
          onCreate={async () => {
            const room = await createRoom(toRoomSettings(settings));
            setScreen({ name: 'lobby', roomId: room.id });
          }}
          onJoin={async (code) => {
            const room = await joinRoom(code);
            setScreen({ name: 'lobby', roomId: room.id });
          }}
        />
      );
    case 'lobby':
      return (
        <RoomScreen
          roomId={screen.roomId}
          myId={myId}
          guest={guest}
          onRegister={openAccount}
          onXpAwarded={refreshMe}
          onFindAgain={() =>
            find(matchSettings).catch((e) => setScreen({ name: 'start', error: e instanceof Error ? e.message : String(e) }))
          }
          onGone={roomGone}
          onLeave={() => {
            leaveRoom(screen.roomId).catch(() => {});
            setScreen({ name: 'online' });
          }}
        />
      );
    case 'quiz':
      return (
        <QuizScreen
          key={screen.runId}
          questions={screen.questions}
          avatar={profile?.avatar ?? DEFAULT_LOOK_CODE}
          onQuit={goHome}
          onFinish={(results) => {
            setScreen({ name: 'result', questions: screen.questions, results });
            if (planRunRef.current) {
              const { level, index } = planRunRef.current;
              planRunRef.current = null;
              markPlanDone(level, index).catch(() => {});
            }
            logAnswers(
              'solo',
              screen.runId,
              screen.questions,
              results.map((r) => ({ questionId: r.questionId, correct: r.correct, timeMs: r.timeUsedMs })),
            );
            const c = countCorrect(screen.questions, results);
            saveGame({
              mode: 'solo',
              questions: results.length,
              correctEasy: c.easy,
              correctMedium: c.medium,
              correctHard: c.hard,
              correctChallenge: c.challenge,
            });
          }}
        />
      );
    case 'result':
      return (
        <ResultScreen
          questions={screen.questions}
          results={screen.results}
          avatar={profile?.avatar ?? DEFAULT_LOOK_CODE}
          onReplay={() => start(settings)}
          onHome={goHome}
          xp={xp}
          guest={guest}
          onRegister={openAccount}
        />
      );
    case 'battle':
      if (screen.intro) {
        const done = () => setScreen({ ...screen, intro: false });
        return <VersusIntro players={screen.players} meId={ME_ID} autoCloseMs={3000} onDone={done} />;
      }
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
            logAnswers('bots', screen.runId, screen.questions, stats.answers);
            saveGame({
              mode: 'bots',
              questions: Math.max(1, stats.rounds),
              correctEasy: stats.correct.easy,
              correctMedium: stats.correct.medium,
              correctHard: stats.correct.hard,
              correctChallenge: stats.correct.challenge,
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
