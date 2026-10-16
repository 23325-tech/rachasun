import { useState } from 'react';
import type { Level } from '../types';
import { NicknameForm } from '../components/NicknameForm';
import { LevelPicker } from '../components/LevelPicker';
import { LookPicker } from '../components/LookPicker';
import { randomFreeCode } from '../lib/look';
import { t } from '../lib/i18n';

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
        <p className="home__tagline">{t('สร้างตัวละครของคุณ แล้วเริ่มฝึกได้เลย ไม่ต้องสมัคร!', 'Create your character and start practicing — no sign-up needed!')}</p>
      </header>

      <section className="settings-card">
        <LookPicker code={look} onChange={setLook} />
      </section>

      <section className="settings-card">
        <LevelPicker label={t('เรียนอยู่ระดับไหน? (เปลี่ยนทีหลังได้)', 'What level are you? (you can change it later)')} value={level} onChange={setLevel} />
        <NicknameForm submitLabel={t('เริ่มเล่นเลย!', 'Let\'s play!')} onSubmit={(nickname) => onCreate(nickname, look, level)} />
      </section>

      <p className="setup__login">
        {t('มีบัญชีอยู่แล้ว?', 'Already have an account?')}{' '}
        <button type="button" className="link-btn" onClick={onLogin}>
          {t('เข้าสู่ระบบ', 'Log in')}
        </button>
      </p>
    </div>
  );
}
