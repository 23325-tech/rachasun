// หน้าต้นแบบ (สเต็ป 16.1) ระบบตัวละคร/ไอคอนใหม่ในสไตล์เดิมของแอพ เปิดด้วย ?lab — ยังไม่เชื่อมข้อมูลจริง ใช้ดูแนวทางก่อนเปลี่ยนทั้งแอพ
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Atom,
  Books,
  ChartLineUp,
  Coin,
  Crown,
  Diamond,
  Dna,
  Exam,
  Flask,
  GlobeHemisphereEast,
  Heart,
  Lightning,
  LinkSimple,
  MathOperations,
  PencilSimpleLine,
  Robot,
  ShieldStar,
  Sparkle,
  Student,
  Target,
  TestTube,
  Translate,
  UsersThree,
  Headphones,
  GraduationCap,
  BaseballCap,
  TShirt,
  Palette,
  HandGrabbing,
  Scissors,
  type Icon,
} from '@phosphor-icons/react';
import { Avatar3D } from '../components/Avatar3D';
import { DEFAULT_LOOK, type ChibiLook } from '../three/chibi';
import './lab.css';

type Rarity = 'common' | 'rare' | 'epic' | 'legend';
interface ShopItem {
  id: string;
  name: string;
  rarity: Rarity;
  price: { coin?: number; gem?: number };
  apply: Partial<ChibiLook>;
  swatch?: string;
  icon: Icon;
}

const RARITY_TEXT: Record<Rarity, string> = { common: 'ธรรมดา', rare: 'หายาก', epic: 'เอพิก', legend: 'ตำนาน' };

const TABS: { key: string; label: string; icon: Icon; items: ShopItem[] }[] = [
  {
    key: 'hair',
    label: 'ทรงผม',
    icon: Scissors,
    items: [
      { id: 'h1', name: 'สั้นเรียบร้อย', rarity: 'common', price: {}, apply: { hairStyle: 'short' }, icon: Scissors },
      { id: 'h2', name: 'บ็อบ', rarity: 'common', price: { coin: 300 }, apply: { hairStyle: 'bob' }, icon: Scissors },
      { id: 'h3', name: 'ตั้งชี้', rarity: 'rare', price: { coin: 800 }, apply: { hairStyle: 'spiky' }, icon: Scissors },
      { id: 'h4', name: 'มวยผม', rarity: 'epic', price: { gem: 39 }, apply: { hairStyle: 'bun' }, icon: Scissors },
    ],
  },
  {
    key: 'hat',
    label: 'หมวก',
    icon: BaseballCap,
    items: [
      { id: 'a0', name: 'ไม่ใส่', rarity: 'common', price: {}, apply: { hat: 'none' }, icon: Student },
      { id: 'a1', name: 'แก๊ปแดง', rarity: 'common', price: { coin: 400 }, apply: { hat: 'cap' }, icon: BaseballCap },
      { id: 'a2', name: 'ไหมพรม', rarity: 'rare', price: { coin: 900 }, apply: { hat: 'beanie' }, icon: BaseballCap },
      { id: 'a3', name: 'หูฟังเกมเมอร์', rarity: 'epic', price: { gem: 49 }, apply: { hat: 'headphones' }, icon: Headphones },
      { id: 'a4', name: 'หมวกบัณฑิต', rarity: 'legend', price: { gem: 59 }, apply: { hat: 'grad' }, icon: GraduationCap },
    ],
  },
  {
    key: 'outfit',
    label: 'ชุด',
    icon: TShirt,
    items: [
      { id: 'o1', name: 'ชุดนักเรียน', rarity: 'common', price: {}, apply: { outfit: 'uniform', outfitColor: '#2b3a8c' }, icon: TShirt },
      { id: 'o2', name: 'ฮู้ดดี้ม่วง', rarity: 'rare', price: { coin: 1200 }, apply: { outfit: 'hoodie', outfitColor: '#7c5cff' }, icon: TShirt },
      { id: 'o3', name: 'ชุดกีฬา', rarity: 'rare', price: { coin: 1000 }, apply: { outfit: 'sport', outfitColor: '#ff5d73' }, icon: TShirt },
      { id: 'o4', name: 'เสื้อกาวน์นักวิทย์', rarity: 'epic', price: { gem: 49 }, apply: { outfit: 'labcoat', outfitColor: '#22c58b' }, icon: Flask },
    ],
  },
  {
    key: 'item',
    label: 'ของในมือ',
    icon: HandGrabbing,
    items: [
      { id: 'i0', name: 'มือว่าง', rarity: 'common', price: {}, apply: { item: 'none' }, icon: HandGrabbing },
      { id: 'i1', name: 'ดินสอสีทอง', rarity: 'common', price: { coin: 250 }, apply: { item: 'pencil' }, icon: PencilSimpleLine },
      { id: 'i2', name: 'ตำราเล่มโปรด', rarity: 'rare', price: { coin: 700 }, apply: { item: 'book' }, icon: Books },
      { id: 'i3', name: 'ขวดทดลองเรืองแสง', rarity: 'epic', price: { gem: 29 }, apply: { item: 'flask' }, icon: TestTube },
    ],
  },
  {
    key: 'color',
    label: 'สีผิว/ผม',
    icon: Palette,
    items: [
      { id: 'c1', name: 'ผิวอ่อน', rarity: 'common', price: {}, apply: { skin: '#ffd9c2' }, swatch: '#ffd9c2', icon: Palette },
      { id: 'c2', name: 'ผิวน้ำผึ้ง', rarity: 'common', price: {}, apply: { skin: '#e9b48a' }, swatch: '#e9b48a', icon: Palette },
      { id: 'c3', name: 'ผิวแทน', rarity: 'common', price: {}, apply: { skin: '#b97a56' }, swatch: '#b97a56', icon: Palette },
      { id: 'c4', name: 'ผมน้ำตาลเข้ม', rarity: 'common', price: {}, apply: { hair: '#3b2a4d' }, swatch: '#3b2a4d', icon: Palette },
      { id: 'c5', name: 'ผมชมพูพาสเทล', rarity: 'rare', price: { coin: 600 }, apply: { hair: '#ff8fc0' }, swatch: '#ff8fc0', icon: Palette },
      { id: 'c6', name: 'ผมฟ้ากาแล็กซี่', rarity: 'epic', price: { gem: 19 }, apply: { hair: '#4fb6ff' }, swatch: '#4fb6ff', icon: Palette },
    ],
  },
];

const MODES: { key: string; title: string; desc: string; icon: Icon; grad: string; wide?: boolean }[] = [
  { key: 'solo', title: 'ฝึกเดี่ยว', desc: 'เลือกบท เลือกความยาก', icon: Target, grad: 'linear-gradient(135deg,#7c5cff,#b65cff)' },
  { key: 'bots', title: 'ดวลกับบอท', desc: 'ยิงหัวใจ อยู่รอดคนสุดท้าย', icon: Robot, grad: 'linear-gradient(135deg,#ff5d73,#ff9a62)' },
  { key: 'online', title: 'ออนไลน์', desc: 'สุ่มหาคู่ · ห้องเพื่อน', icon: GlobeHemisphereEast, grad: 'linear-gradient(135deg,#2fa8ff,#4fe0d0)' },
  { key: 'challenge', title: 'ท้าเพื่อน', desc: 'ส่งลิงก์ ชุดเดียวกัน', icon: LinkSimple, grad: 'linear-gradient(135deg,#ffb020,#ffd65c)' },
  { key: 'groups', title: 'กลุ่มเพื่อน', desc: 'โจทย์ประจำวัน', icon: UsersThree, grad: 'linear-gradient(135deg,#22c58b,#7be08f)' },
  { key: 'analysis', title: 'วิเคราะห์ของฉัน', desc: 'แผนฝึก + AI โค้ช', icon: ChartLineUp, grad: 'linear-gradient(135deg,#5a6bff,#8f9dff)' },
  { key: 'mock', title: 'จำลองสอบ A-Level', desc: 'เต็มชุด 90 นาที · เทียบคะแนนทั้งประเทศ', icon: Exam, grad: 'linear-gradient(135deg,#1c1640,#3b2d8f)', wide: true },
];

const SUBJECTS: { name: string; icon: Icon; grad: string }[] = [
  { name: 'คณิต', icon: MathOperations, grad: 'linear-gradient(135deg,#ff5d73,#ff8a65)' },
  { name: 'ฟิสิกส์', icon: Lightning, grad: 'linear-gradient(135deg,#2f7bff,#4fc3ff)' },
  { name: 'เคมี', icon: Flask, grad: 'linear-gradient(135deg,#1fbf86,#6fe3a5)' },
  { name: 'ชีวะ', icon: Dna, grad: 'linear-gradient(135deg,#ff9f1c,#ffcf5c)' },
  { name: 'อังกฤษ', icon: Translate, grad: 'linear-gradient(135deg,#a45cff,#d68bff)' },
  { name: 'วิทย์', icon: Atom, grad: 'linear-gradient(135deg,#14b8c4,#5ee0e8)' },
];

const LEVELS = ['ประถม', 'ม.ต้น', 'ม.ปลาย', 'มหาลัย'];

function Pill({ icon: I, value, tone }: { icon: Icon; value: string; tone: 'coin' | 'gem' }) {
  return (
    <span className={`lab-pill lab-pill--${tone}`}>
      <I weight="fill" size={18} />
      {value}
      <span className="lab-pill__plus">+</span>
    </span>
  );
}

function RankBadge() {
  return (
    <span className="lab-rank">
      <ShieldStar weight="fill" size={22} />
      <span>
        <strong>ทอง II</strong>
        <small>620 RP</small>
      </span>
    </span>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="lab-section">
      <div className="lab-section__head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function LabScreen() {
  const [look, setLook] = useState<ChibiLook>(DEFAULT_LOOK);
  const [tab, setTab] = useState(TABS[1].key);
  const [level, setLevel] = useState(2);
  const [cheer, setCheer] = useState(0);
  const [owned] = useState(new Set(['h1', 'a0', 'o1', 'i0', 'c1', 'c2', 'c3', 'c4']));


  const tryOn = (it: ShopItem) => {
    setLook((l) => ({ ...l, ...it.apply }));
    setCheer(1);
    setTimeout(() => setCheer(0), 900);
  };
  const current = TABS.find((t) => t.key === tab)!;
  const isWearing = (it: ShopItem) => Object.entries(it.apply).every(([k, v]) => look[k as keyof ChibiLook] === v);

  return (
    <div className="lab">
      <div className="lab-bg" aria-hidden />

      <header className="lab-top">
        <div className="lab-me">
          <span className="lab-me__ring">
            <span className="lab-me__lv">12</span>
          </span>
          <span>
            <strong>ฟ้าใส</strong>
            <small>#4821</small>
          </span>
        </div>
        <div className="lab-top__right">
          <Pill icon={Coin} value="1,250" tone="coin" />
          <Pill icon={Diamond} value="40" tone="gem" />
        </div>
      </header>

      <section className="lab-hero">
        <div className="lab-hero__stage">
          <div className="lab-hero__glow" />
          <div className="lab-hero__podium" />
          <Avatar3D look={look} interactive cheer={cheer} className="lab-hero__canvas" />
        </div>
        <div className="lab-hero__info">
          <RankBadge />
          <div className="lab-hero__stats">
            <span>
              <Heart weight="fill" size={14} /> ชนะ 38
            </span>
            <span>
              <Sparkle weight="fill" size={14} /> 2,340 XP
            </span>
          </div>
        </div>
        <p className="lab-hero__hint">ลากเพื่อหมุนดูตัวละคร</p>
      </section>

      <div className="lab-levels" role="tablist">
        {LEVELS.map((l, i) => (
          <button key={l} type="button" className={i === level ? 'is-active' : ''} onClick={() => setLevel(i)}>
            {l}
          </button>
        ))}
      </div>

      <Section title="วันนี้เล่นอะไรดี">
        <div className="lab-modes">
          {MODES.map((m) => (
            <button key={m.key} type="button" className={`lab-mode ${m.wide ? 'lab-mode--wide' : ''}`} style={{ '--g': m.grad } as CSSProperties}>
              <span className="lab-mode__icon">
                <m.icon weight="fill" size={m.wide ? 30 : 26} />
              </span>
              <span className="lab-mode__text">
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
              {m.wide && <Crown weight="fill" className="lab-mode__badge" size={18} />}
            </button>
          ))}
        </div>
      </Section>

      <Section title="วิชา">
        <div className="lab-subjects">
          {SUBJECTS.map((s) => (
            <div key={s.name} className="lab-subject">
              <span className="lab-subject__tile" style={{ '--g': s.grad } as CSSProperties}>
                <s.icon weight="fill" size={28} />
              </span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ห้องแต่งตัว" action={<span className="lab-muted">ลองสวมได้ก่อนซื้อ</span>}>
        <div className="lab-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={t.key === tab ? 'is-active' : ''} onClick={() => setTab(t.key)}>
              <t.icon weight={t.key === tab ? 'fill' : 'regular'} size={18} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="lab-items">
          {current.items.map((it) => {
            const own = owned.has(it.id) || (!it.price.coin && !it.price.gem);
            return (
              <button
                key={it.id}
                type="button"
                className={`lab-item lab-item--${it.rarity} ${isWearing(it) ? 'is-wearing' : ''}`}
                onClick={() => tryOn(it)}
              >
                <span className="lab-item__rarity">{RARITY_TEXT[it.rarity]}</span>
                <span className="lab-item__art">
                  {it.swatch ? <span className="lab-item__swatch" style={{ background: it.swatch }} /> : <it.icon weight="fill" size={34} />}
                </span>
                <span className="lab-item__name">{it.name}</span>
                <span className="lab-item__price">
                  {own ? (
                    isWearing(it) ? (
                      'สวมอยู่'
                    ) : (
                      'มีแล้ว'
                    )
                  ) : it.price.gem ? (
                    <>
                      <Diamond weight="fill" size={14} /> {it.price.gem}
                    </>
                  ) : (
                    <>
                      <Coin weight="fill" size={14} /> {it.price.coin}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <p className="lab-foot">ต้นแบบดีไซน์ Brain Gym · สเต็ป 16.1</p>
    </div>
  );
}
