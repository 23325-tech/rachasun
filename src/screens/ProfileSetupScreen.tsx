import { useState } from 'react';
import type { Level } from '../types';
import { NicknameForm } from '../components/NicknameForm';
import { LevelPicker } from '../components/LevelPicker';
import { LookPicker } from '../components/LookPicker';
import { randomFreeCode } from '../lib/look';

interface Props {
  onCreate: (nickname: string, avatar: string, level: Level) => Promise<void>;
  onLogin: () => void;
}

/** เข้าเล่นครั้งแรก: ออกแบบตัวละคร + ตั้งชื่อเล่น + เลือกระดับชั้น แล้วเล่นแบบแขกได้เลย */
export function ProfileSetupScreen({ onCreate, onLogin }: Props) {
  const [level, setLevel] = useState<Level>('upper');
  const [look, setLook] = useState(randomFreeCode);
  return (
    <div className="screen setup">
      <header className="setup__hero pop-in">
        <h1 className="home__title">Brain Gym</h1>
        <p className="home__tagline">สร้างตัวละครของคุณ แล้วเริ่มฝึกได้เลย ไม่ต้องสมัคร!</p>
      </header>

      <section className="settings-card">
        <LookPicker code={look} onChange={setLook} />
      </section>

      <section className="settings-card">
        <LevelPicker label="เรียนอยู่ระดับไหน? (เปลี่ยนทีหลังได้)" value={level} onChange={setLevel} />
        <NicknameForm submitLabel="เริ่มเล่นเลย!" onSubmit={(nickname) => onCreate(nickname, look, level)} />
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
