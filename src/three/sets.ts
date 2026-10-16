// ชุดตัวละครพิเศษ: ทับชุด/หมวก (บางชุดคลุมผมด้วย) — สร้างชิ้นส่วนใส่ลงกลุ่มของตัว chibi
import * as THREE from 'three';
import { capsule, part, sphere, toon } from './chibi';

export type SetKind = 'none' | 'dino' | 'wizard' | 'robot' | 'ninja' | 'astronaut';

/** ชุดนี้ซ่อนอะไรของเดิมบ้าง */
export const SET_HIDES: Record<Exclude<SetKind, 'none'>, { hair: boolean; outfit: boolean; hat: boolean }> = {
  dino: { hair: true, outfit: true, hat: true },
  wizard: { hair: false, outfit: true, hat: true },
  robot: { hair: true, outfit: true, hat: true },
  ninja: { hair: true, outfit: true, hat: true },
  astronaut: { hair: false, outfit: true, hat: true },
};

interface Slots {
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
}

const glow = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity });

/** ลำตัว + กางเกง + แขนเสื้อ + ขา (สีชุด) */
function suit(s: Slots, top: string, bottom: string, sleeve: string, leg?: string) {
  const torso = part(capsule(0.27, 0.22), toon(top), 0.04);
  torso.position.y = 0.9;
  torso.scale.set(1.08, 1, 0.86);
  s.body.add(torso);
  const pants = part(new THREE.CylinderGeometry(0.32, 0.34, 0.26, 28), toon(bottom), 0.04);
  pants.position.y = 0.56;
  pants.scale.z = 0.88;
  s.body.add(pants);
  for (const arm of [s.armL, s.armR]) {
    const sl = part(capsule(0.105, 0.28), toon(sleeve), 0.05);
    sl.position.y = -0.18;
    sl.userData.setPart = true;
    arm.add(sl);
  }
  if (leg) {
    for (const x of [1, -1]) {
      const l = part(capsule(0.12, 0.2), toon(leg), 0.05);
      l.position.set(0.13 * x, 0.33, 0);
      s.body.add(l);
    }
  }
}

function dino(s: Slots) {
  suit(s, '#5ec96b', '#4aa857', '#5ec96b', '#4aa857');
  const belly = new THREE.Mesh(sphere(0.2), toon('#f2f7b8'));
  belly.position.set(0, 0.82, 0.16);
  belly.scale.set(0.9, 1.1, 0.5);
  s.body.add(belly);
  // ฮู้ดหัวไดโน: ครอบศีรษะ เปิดหน้า
  const hood = part(new THREE.SphereGeometry(0.7, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), toon('#5ec96b'), 0.03);
  hood.position.set(0, 0.04, -0.06);
  hood.rotation.x = -0.45;
  s.head.add(hood);
  const back = part(sphere(0.66, 32, 20), toon('#5ec96b'), 0.025);
  back.position.set(0, -0.05, -0.2);
  back.scale.set(1.04, 0.95, 0.82);
  s.head.add(back);
  // ฟันหน้าฮู้ด
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - 0.5) * 1.6;
    const tooth = part(new THREE.ConeGeometry(0.04, 0.09, 6), toon('#ffffff'), 0.1);
    tooth.position.set(Math.sin(a) * 0.55, 0.36 - Math.abs(a) * 0.12, Math.cos(a) * 0.5);
    tooth.rotation.x = Math.PI;
    s.head.add(tooth);
  }
  // หนามหลังไล่จากหัวถึงหาง
  for (let i = 0; i < 6; i++) {
    const spike = part(new THREE.ConeGeometry(0.075, 0.16, 4), toon('#ffb020'), 0.08);
    spike.position.set(0, 0.62 - i * 0.16, -0.48 + i * 0.03);
    spike.rotation.x = -0.6;
    s.head.add(spike);
  }
  for (let i = 0; i < 3; i++) {
    const spike = part(new THREE.ConeGeometry(0.06, 0.13, 4), toon('#ffb020'), 0.08);
    spike.position.set(0, 1.0 - i * 0.18, -0.28);
    spike.rotation.x = -0.9;
    s.body.add(spike);
  }
  const tail = part(new THREE.ConeGeometry(0.16, 0.6, 16), toon('#5ec96b'), 0.04);
  tail.position.set(0, 0.48, -0.42);
  tail.rotation.x = -2.1;
  s.body.add(tail);
}

function wizard(s: Slots) {
  suit(s, '#5a3df0', '#4a2fd0', '#5a3df0');
  const robe = part(new THREE.ConeGeometry(0.5, 0.7, 28, 1, true), toon('#5a3df0', { side: THREE.DoubleSide }), 0.03);
  robe.position.y = 0.62;
  robe.scale.z = 0.88;
  s.body.add(robe);
  const trim = part(new THREE.TorusGeometry(0.47, 0.03, 8, 40), toon('#ffcc00'), 0.06);
  trim.position.y = 0.28;
  trim.rotation.x = Math.PI / 2;
  trim.scale.y = 0.88;
  s.body.add(trim);
  const cape = part(new THREE.TorusGeometry(0.2, 0.05, 10, 24), toon('#ffcc00'), 0.06);
  cape.position.y = 1.08;
  cape.rotation.x = Math.PI / 2;
  s.body.add(cape);
  // หมวกปลายแหลม
  const brim = part(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 36), toon('#4a2fd0'), 0.03);
  brim.position.y = 0.44;
  s.head.add(brim);
  const cone = part(new THREE.ConeGeometry(0.5, 0.95, 28), toon('#5a3df0'), 0.03);
  cone.position.set(0, 0.92, -0.08);
  cone.rotation.x = -0.18;
  s.head.add(cone);
  const band = part(new THREE.TorusGeometry(0.47, 0.04, 8, 32), toon('#ffcc00'), 0.06);
  band.position.y = 0.5;
  band.rotation.x = Math.PI / 2;
  s.head.add(band);
  for (let i = 0; i < 4; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), toon('#ffe066'));
    star.position.set(Math.sin(i * 1.7) * 0.25, 0.65 + i * 0.13, Math.cos(i * 1.7) * 0.25 - 0.05);
    s.head.add(star);
  }
  // ไม้กายสิทธิ์
  const wand = part(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 8), toon('#7a4a2a'), 0.08);
  wand.position.set(-0.04, -0.5, 0.15);
  wand.rotation.x = 0.6;
  wand.userData.setPart = true;
  s.armR.add(wand);
  const tip = new THREE.Mesh(sphere(0.05, 12, 8), glow(0xfff3a0));
  tip.position.set(-0.04, -0.3, 0.3);
  tip.userData.setPart = true;
  s.armR.add(tip);
}

function robot(s: Slots) {
  const steel = '#b8c2d6';
  suit(s, steel, '#8d98b0', steel, '#8d98b0');
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), toon('#3a4fb8'));
  chest.position.set(0, 0.92, 0.25);
  s.body.add(chest);
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(sphere(0.025, 8, 6), glow([0xff5d73, 0xffcc00, 0x5ee08a][i]));
    led.position.set((i - 1) * 0.08, 0.92, 0.27);
    s.body.add(led);
  }
  // หัวกล่องหุ่นยนต์
  const box = part(new THREE.BoxGeometry(1.2, 1.05, 1.1, 2, 2, 2), toon(steel), 0.02);
  box.position.y = 0.02;
  s.head.add(box);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 0.02), toon('#1d2240'));
  visor.position.set(0, 0, 0.56);
  s.head.add(visor);
  for (const x of [1, -1]) {
    const eye = new THREE.Mesh(capsule(0.05, 0.1), glow(0x5ec8ff));
    eye.position.set(0.2 * x, 0.02, 0.575);
    eye.rotation.z = Math.PI / 2;
    s.head.add(eye);
    const bolt = part(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), toon('#8d98b0'), 0.06);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.63 * x, 0, 0);
    s.head.add(bolt);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.02), glow(0x5ec8ff));
  mouth.position.set(0, -0.14, 0.575);
  s.head.add(mouth);
  const antenna = part(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), toon('#8d98b0'), 0.08);
  antenna.position.y = 0.68;
  s.head.add(antenna);
  const ball = new THREE.Mesh(sphere(0.06, 12, 8), glow(0xff5d73));
  ball.position.y = 0.85;
  s.head.add(ball);
}

function ninja(s: Slots) {
  suit(s, '#25203f', '#25203f', '#25203f', '#25203f');
  const sash = part(new THREE.TorusGeometry(0.31, 0.04, 8, 32), toon('#e2435c'), 0.06);
  sash.position.y = 0.7;
  sash.rotation.x = Math.PI / 2;
  sash.scale.y = 0.88;
  s.body.add(sash);
  // ผ้าคลุมหัว เปิดช่องตา
  const hood = part(sphere(0.67, 36, 24), toon('#25203f'), 0.025);
  hood.scale.set(1.02, 0.96, 0.98);
  s.head.add(hood);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.05), toon('#ffd9c2'));
  slit.position.set(0, -0.04, 0.6);
  slit.userData.skin = true;
  s.head.add(slit);
  const band = part(new THREE.TorusGeometry(0.67, 0.045, 8, 40), toon('#e2435c'), 0.06);
  band.position.y = 0.2;
  band.rotation.x = Math.PI / 2 - 0.15;
  s.head.add(band);
  for (const x of [1, -1]) {
    const tail = part(capsule(0.03, 0.28), toon('#e2435c'), 0.08);
    tail.position.set(0.12 * x, 0.05, -0.7);
    tail.rotation.set(0.4, 0, 0.5 * x);
    s.head.add(tail);
  }
  // ดาบสะพายหลัง
  const blade = part(new THREE.BoxGeometry(0.05, 0.85, 0.02), toon('#e6ecf5'), 0.06);
  blade.position.set(0, 1.0, -0.3);
  blade.rotation.z = 0.6;
  s.body.add(blade);
  const hilt = part(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), toon('#e2435c'), 0.08);
  hilt.position.set(-0.3, 1.36, -0.3);
  hilt.rotation.z = 0.6;
  s.body.add(hilt);
}

function astronaut(s: Slots) {
  suit(s, '#f4f6fb', '#f4f6fb', '#f4f6fb', '#f4f6fb');
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.03, 8, 32), toon('#ff8a3c'));
  stripe.position.y = 0.82;
  stripe.rotation.x = Math.PI / 2;
  stripe.scale.y = 0.86;
  s.body.add(stripe);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.03), toon('#3d8bff'));
  panel.position.set(0, 0.95, 0.25);
  s.body.add(panel);
  const pack = part(new THREE.BoxGeometry(0.42, 0.45, 0.2), toon('#d9dee9'), 0.04);
  pack.position.set(0, 0.9, -0.3);
  s.body.add(pack);
  const ring = part(new THREE.TorusGeometry(0.28, 0.06, 10, 28), toon('#d9dee9'), 0.05);
  ring.position.y = 1.12;
  ring.rotation.x = Math.PI / 2;
  s.body.add(ring);
  // หมวกครอบแก้วใส
  const bubble = new THREE.Mesh(
    sphere(0.86, 36, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }),
  );
  bubble.position.y = 0.02;
  s.head.add(bubble);
  const shine = new THREE.Mesh(sphere(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  shine.position.set(-0.4, 0.4, 0.62);
  shine.scale.set(1, 0.5, 0.3);
  s.head.add(shine);
}

const BUILDERS: Record<Exclude<SetKind, 'none'>, (s: Slots) => void> = { dino, wizard, robot, ninja, astronaut };

/** ใส่ชิ้นส่วนชุดลงในกลุ่มที่กำหนด (กลุ่มต้องว่างก่อน) */
export function buildSet(kind: SetKind, s: Slots, skin: string) {
  if (kind === 'none') return;
  BUILDERS[kind](s);
  // ช่องตานินจาใช้สีผิวจริง
  s.head.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData.skin) (o.material as THREE.MeshToonMaterial).color.set(skin);
  });
}
