import { NicknameForm } from '../components/NicknameForm';

interface Props {
  onCreate: (nickname: string, avatar: string) => Promise<void>;
  onLogin: () => void;
}

/** เข้าเล่นครั้งแรก: ตั้งชื่อเล่นแล้วเล่นแบบแขกได้เลย */
export function ProfileSetupScreen({ onCreate, onLogin }: Props) {
  return (
    <div className="screen setup">
      <header className="setup__hero pop-in">
        <div className="home__logo" aria-hidden>
          <span>🧠</span>
        </div>
        <h1 className="home__title">Brain Gym</h1>
        <p className="home__tagline">ตั้งชื่อเล่นแล้วเริ่มฝึกได้เลย ไม่ต้องสมัคร!</p>
      </header>

      <section className="settings-card">
        <NicknameForm submitLabel="เริ่มเล่นเลย! 🚀" onSubmit={onCreate} />
      </section>

      <p className="setup__login">
        มีบัญชีอยู่แล้ว?{' '}
        <button type="button" className="link-btn" onClick={onLogin}>
          เข้าสู่ระบบ
        </button>
      </p>
    </div>
  );
}
