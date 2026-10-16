// สัตว์เลี้ยงชุดที่ 2 (สเต็ป 22.2b) — ใช้ตัวช่วยเดียวกับ pets.ts
import * as THREE from 'three';
import { capsule, part, sphere, toon } from './chibi';

type Build = (g: THREE.Group, moving: THREE.Object3D[]) => void;

const black = () => new THREE.MeshBasicMaterial({ color: 0x22163d });
const white = () => new THREE.MeshBasicMaterial({ color: 0xffffff });
const glowMat = (color: number, opacity = 0.85) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

function eyes(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.045) {
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(sphere(r, 14, 10), black());
    e.position.set(x * s, y, z);
    e.scale.set(0.85, 1.15, 0.5);
    const hi = new THREE.Mesh(sphere(r * 0.35, 8, 6), white());
    hi.position.set(r * 0.3, r * 0.4, r * 0.4);
    e.add(hi);
    parent.add(e);
  }
}

function blush(parent: THREE.Object3D, x: number, y: number, z: number) {
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(sphere(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.6 }));
    b.position.set(x * s, y, z);
    b.scale.set(1.3, 0.7, 0.3);
    parent.add(b);
  }
}

/** หัวกลม + ตัวกลม (โครงสัตว์สี่ขาตัวเล็ก) */
function critter(g: THREE.Group, fur: string, belly: string, headR = 0.19) {
  const head = part(sphere(headR), toon(fur), 0.05);
  head.position.y = 0.12;
  head.scale.set(1.08, 0.95, 1);
  g.add(head);
  const body = part(sphere(0.14), toon(fur), 0.06);
  body.position.y = -0.12;
  g.add(body);
  const b = new THREE.Mesh(sphere(0.095), toon(belly));
  b.position.set(0, -0.12, 0.08);
  b.scale.set(1, 1, 0.6);
  g.add(b);
  for (const s of [1, -1]) {
    const foot = part(sphere(0.05), toon(fur), 0.08);
    foot.position.set(0.07 * s, -0.24, 0.05);
    foot.scale.set(1, 0.7, 1.2);
    g.add(foot);
  }
  return head;
}

const hamster: Build = (g) => {
  critter(g, '#f2b46b', '#fff1dc', 0.2);
  for (const s of [1, -1]) {
    const ear = part(sphere(0.06), toon('#f2b46b'), 0.07);
    ear.position.set(0.13 * s, 0.29, 0);
    ear.scale.set(1, 1, 0.5);
    g.add(ear);
    const cheek = new THREE.Mesh(sphere(0.07), toon('#fff1dc'));
    cheek.position.set(0.12 * s, 0.06, 0.12);
    g.add(cheek);
  }
  eyes(g, 0.075, 0.15, 0.18);
  blush(g, 0.13, 0.08, 0.17);
  const nose = new THREE.Mesh(sphere(0.018, 8, 6), toon('#ff8fa3'));
  nose.position.set(0, 0.1, 0.2);
  g.add(nose);
};

const chick: Build = (g, moving) => {
  const body = part(sphere(0.22), toon('#ffe14d'), 0.05);
  body.scale.set(1, 1.05, 1);
  g.add(body);
  eyes(g, 0.08, 0.06, 0.19);
  blush(g, 0.13, 0.0, 0.17);
  const beak = part(new THREE.ConeGeometry(0.04, 0.08, 8), toon('#ff9a3c'), 0.1);
  beak.position.set(0, 0.0, 0.23);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (let i = 0; i < 3; i++) {
    const tuft = part(capsule(0.015, 0.06), toon('#ffe14d'), 0.1);
    tuft.position.set((i - 1) * 0.03, 0.24, 0);
    tuft.rotation.z = (i - 1) * 0.5;
    g.add(tuft);
  }
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    const wm = part(sphere(0.07), toon('#ffd21f'), 0.07);
    wm.scale.set(0.45, 1, 0.8);
    wm.position.y = -0.04;
    wing.add(wm);
    wing.position.set(0.2 * s, -0.02, 0);
    wing.userData.side = s;
    g.add(wing);
    moving.push(wing);
  }
  // เปลือกไข่ครึ่งใบ
  const shell = part(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), toon('#fffaf0', { side: THREE.DoubleSide }), 0.04);
  shell.position.y = -0.04;
  g.add(shell);
};

const frog: Build = (g) => {
  const body = part(sphere(0.22), toon('#5ec96b'), 0.05);
  body.scale.set(1.15, 0.85, 1);
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.15), toon('#d9f5b8'));
  belly.position.set(0, -0.05, 0.1);
  belly.scale.set(1.1, 0.8, 0.6);
  g.add(belly);
  for (const s of [1, -1]) {
    const bump = part(sphere(0.08), toon('#5ec96b'), 0.07);
    bump.position.set(0.11 * s, 0.17, 0.08);
    g.add(bump);
  }
  eyes(g, 0.11, 0.2, 0.15, 0.05);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20, Math.PI), black());
  mouth.position.set(0, 0.03, 0.2);
  mouth.rotation.z = Math.PI;
  g.add(mouth);
  blush(g, 0.17, 0.05, 0.16);
};

const bunny: Build = (g, moving) => {
  critter(g, '#fbf7ff', '#ffe3ee');
  for (const s of [1, -1]) {
    const ear = new THREE.Group();
    const outer = part(capsule(0.045, 0.2), toon('#fbf7ff'), 0.06);
    outer.position.y = 0.12;
    const inner = new THREE.Mesh(capsule(0.025, 0.16), toon('#ffc2d6'));
    inner.position.set(0, 0.12, 0.025);
    ear.add(outer, inner);
    ear.position.set(0.07 * s, 0.27, -0.02);
    ear.rotation.z = -0.15 * s;
    ear.userData.side = s;
    g.add(ear);
    moving.push(ear);
  }
  eyes(g, 0.075, 0.14, 0.17);
  blush(g, 0.12, 0.08, 0.16);
  const tail = part(sphere(0.06), toon('#ffffff'), 0.07);
  tail.position.set(0, -0.14, -0.15);
  g.add(tail);
};

const puppy: Build = (g, moving) => {
  critter(g, '#e8b07a', '#fff4e6');
  for (const s of [1, -1]) {
    const ear = part(sphere(0.09), toon('#9a6440'), 0.06);
    ear.position.set(0.17 * s, 0.13, -0.01);
    ear.scale.set(0.5, 1.2, 0.8);
    ear.rotation.z = 0.25 * s;
    g.add(ear);
  }
  eyes(g, 0.075, 0.15, 0.17);
  const snout = new THREE.Mesh(sphere(0.07), toon('#fff4e6'));
  snout.position.set(0, 0.07, 0.15);
  snout.scale.set(1.2, 0.8, 0.9);
  g.add(snout);
  const nose = new THREE.Mesh(sphere(0.025, 10, 8), black());
  nose.position.set(0, 0.1, 0.22);
  g.add(nose);
  const tongue = new THREE.Mesh(sphere(0.025, 10, 8), toon('#ff6b8b'));
  tongue.position.set(0, 0.03, 0.2);
  tongue.scale.set(1, 1.4, 0.5);
  g.add(tongue);
  const tail = new THREE.Group();
  const t = part(capsule(0.025, 0.1), toon('#e8b07a'), 0.08);
  t.rotation.x = -0.8;
  tail.add(t);
  tail.position.set(0, -0.08, -0.15);
  g.add(tail);
  moving.push(tail);
};

const penguin: Build = (g, moving) => {
  const body = part(sphere(0.22), toon('#2b2f4a'), 0.05);
  body.scale.set(1, 1.15, 0.95);
  g.add(body);
  const face = new THREE.Mesh(sphere(0.17), toon('#ffffff'));
  face.position.set(0, -0.02, 0.09);
  face.scale.set(0.95, 1.15, 0.7);
  g.add(face);
  eyes(g, 0.07, 0.1, 0.2);
  blush(g, 0.11, 0.04, 0.19);
  const beak = part(new THREE.ConeGeometry(0.035, 0.07, 8), toon('#ffb020'), 0.1);
  beak.position.set(0, 0.04, 0.24);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (const s of [1, -1]) {
    const fl = new THREE.Group();
    const fm = part(sphere(0.07), toon('#2b2f4a'), 0.07);
    fm.scale.set(0.35, 1.1, 0.7);
    fm.position.y = -0.06;
    fl.add(fm);
    fl.position.set(0.2 * s, 0.0, 0);
    fl.userData.side = s;
    g.add(fl);
    moving.push(fl);
    const foot = part(sphere(0.05), toon('#ffb020'), 0.08);
    foot.position.set(0.07 * s, -0.25, 0.06);
    foot.scale.set(1.1, 0.4, 1.3);
    g.add(foot);
  }
  // ผ้าพันคอแดง
  const scarf = part(new THREE.TorusGeometry(0.16, 0.035, 8, 24), toon('#ff5d73'), 0.06);
  scarf.position.y = -0.03;
  scarf.rotation.x = Math.PI / 2;
  g.add(scarf);
};

const panda: Build = (g) => {
  critter(g, '#ffffff', '#f2f2f7');
  const darkM = toon('#2b2f4a');
  for (const s of [1, -1]) {
    const ear = part(sphere(0.06), darkM, 0.07);
    ear.position.set(0.14 * s, 0.29, 0);
    g.add(ear);
    const patch = new THREE.Mesh(sphere(0.055, 12, 10), darkM);
    patch.position.set(0.075 * s, 0.14, 0.15);
    patch.scale.set(1, 1.3, 0.5);
    patch.rotation.z = 0.5 * s;
    g.add(patch);
    const arm = part(sphere(0.055), darkM, 0.07);
    arm.position.set(0.12 * s, -0.08, 0.04);
    g.add(arm);
  }
  eyes(g, 0.075, 0.15, 0.19, 0.035);
  const nose = new THREE.Mesh(sphere(0.022, 8, 6), black());
  nose.position.set(0, 0.08, 0.2);
  g.add(nose);
  // ไม้ไผ่ในมือ
  const bamboo = part(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8), toon('#6ccf5a'), 0.1);
  bamboo.position.set(0.15, -0.06, 0.1);
  bamboo.rotation.z = 0.4;
  g.add(bamboo);
};

const fox: Build = (g, moving) => {
  critter(g, '#ff8a3c', '#fff4e6', 0.18);
  for (const s of [1, -1]) {
    const ear = part(new THREE.ConeGeometry(0.075, 0.16, 4), toon('#ff8a3c'), 0.08);
    ear.position.set(0.11 * s, 0.32, 0);
    ear.rotation.z = -0.2 * s;
    g.add(ear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 4), black());
    tip.position.set(0.122 * s, 0.39, 0);
    tip.rotation.z = -0.2 * s;
    g.add(tip);
  }
  const muzzle = new THREE.Mesh(sphere(0.08), toon('#fff4e6'));
  muzzle.position.set(0, 0.07, 0.13);
  muzzle.scale.set(1, 0.75, 1);
  g.add(muzzle);
  eyes(g, 0.07, 0.15, 0.16);
  const nose = new THREE.Mesh(sphere(0.02, 8, 6), black());
  nose.position.set(0, 0.09, 0.22);
  g.add(nose);
  // หางฟูปลายขาว
  const tail = new THREE.Group();
  const t1 = part(sphere(0.11), toon('#ff8a3c'), 0.06);
  t1.scale.set(0.8, 1.5, 0.8);
  t1.position.y = 0.1;
  const t2 = part(sphere(0.065), toon('#ffffff'), 0.07);
  t2.position.y = 0.26;
  tail.add(t1, t2);
  tail.position.set(-0.08, -0.15, -0.14);
  tail.rotation.z = 0.6;
  g.add(tail);
  moving.push(tail);
};

const axolotl: Build = (g, moving) => {
  const body = part(sphere(0.2), toon('#ffb3d1'), 0.05);
  body.scale.set(1.15, 0.9, 1.05);
  g.add(body);
  eyes(g, 0.1, 0.06, 0.17);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16, Math.PI), black());
  mouth.position.set(0, -0.02, 0.2);
  mouth.rotation.z = Math.PI;
  g.add(mouth);
  blush(g, 0.15, 0.0, 0.16);
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const gill = new THREE.Group();
      const gm = part(capsule(0.025, 0.09), toon('#ff5d9e'), 0.08);
      gm.position.y = 0.06;
      gill.add(gm);
      gill.position.set(0.19 * s, 0.08 + (i - 1) * 0.06, -0.02);
      gill.rotation.z = (-0.9 - (i - 1) * 0.5) * s;
      gill.userData.side = s;
      g.add(gill);
      moving.push(gill);
    }
  }
};

const redpanda: Build = (g, moving) => {
  critter(g, '#c8552b', '#3a2a35', 0.19);
  for (const s of [1, -1]) {
    const ear = part(new THREE.ConeGeometry(0.06, 0.1, 6), toon('#c8552b'), 0.08);
    ear.position.set(0.13 * s, 0.29, 0);
    g.add(ear);
    const mark = new THREE.Mesh(sphere(0.045, 10, 8), toon('#ffffff'));
    mark.position.set(0.08 * s, 0.2, 0.16);
    mark.scale.set(1.2, 0.8, 0.4);
    g.add(mark);
  }
  const muzzle = new THREE.Mesh(sphere(0.07), toon('#ffffff'));
  muzzle.position.set(0, 0.07, 0.15);
  muzzle.scale.set(1.2, 0.8, 0.8);
  g.add(muzzle);
  eyes(g, 0.075, 0.13, 0.18, 0.04);
  const nose = new THREE.Mesh(sphere(0.02, 8, 6), black());
  nose.position.set(0, 0.09, 0.21);
  g.add(nose);
  // หางลายวง
  const tail = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const seg = part(sphere(0.07), toon(i % 2 ? '#7a2e14' : '#d9663a'), 0.05);
    seg.position.set(0, i * 0.075, 0);
    tail.add(seg);
  }
  tail.position.set(-0.12, -0.18, -0.12);
  tail.rotation.z = 0.9;
  g.add(tail);
  moving.push(tail);
};

const unicorn: Build = (g, moving) => {
  critter(g, '#ffffff', '#f6f0ff', 0.19);
  const horn = part(new THREE.ConeGeometry(0.035, 0.16, 12), toon('#ffd36e'), 0.1);
  horn.position.set(0, 0.36, 0.06);
  horn.rotation.x = 0.25;
  g.add(horn);
  const rainbow = ['#ff6b8b', '#ffb020', '#ffe14d', '#5ec96b', '#4fb6ff', '#a45cff'];
  rainbow.forEach((c, i) => {
    const lock = part(sphere(0.05), toon(c), 0.06);
    lock.position.set(-0.06 + i * 0.012, 0.28 - i * 0.06, -0.14);
    g.add(lock);
  });
  for (const s of [1, -1]) {
    const ear = part(new THREE.ConeGeometry(0.04, 0.08, 6), toon('#ffffff'), 0.08);
    ear.position.set(0.11 * s, 0.3, -0.02);
    g.add(ear);
  }
  eyes(g, 0.075, 0.14, 0.17);
  blush(g, 0.12, 0.08, 0.16);
  const tail = new THREE.Group();
  rainbow.slice(0, 4).forEach((c, i) => {
    const s = part(sphere(0.05), toon(c), 0.06);
    s.position.set(0, i * 0.05, 0);
    tail.add(s);
  });
  tail.position.set(0, -0.15, -0.16);
  tail.rotation.x = -0.9;
  g.add(tail);
  moving.push(tail);
  const spark = new THREE.Mesh(sphere(0.03, 8, 6), glowMat(0xfff3a0));
  spark.position.set(0, 0.46, 0.1);
  g.add(spark);
};

const phoenix: Build = (g, moving) => {
  const body = part(sphere(0.18), toon('#ff6a2b', { emissive: 0x5a1a00 }), 0.05);
  body.scale.set(1, 1.1, 1);
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.12), toon('#ffd36e'));
  belly.position.set(0, -0.04, 0.09);
  belly.scale.set(1, 1.1, 0.6);
  g.add(belly);
  eyes(g, 0.07, 0.08, 0.16, 0.04);
  const beak = part(new THREE.ConeGeometry(0.03, 0.08, 8), toon('#ffe14d'), 0.1);
  beak.position.set(0, 0.03, 0.2);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  // หงอนเปลวไฟ
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), glowMat(i === 1 ? 0xffe066 : 0xff7a1a, 0.9));
    c.position.set((i - 1) * 0.05, 0.25, -0.02);
    c.rotation.z = (i - 1) * -0.4;
    g.add(c);
  }
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28 - i * 0.04, 6), glowMat(i % 2 ? 0xffb020 : 0xff5d3c, 0.88));
      f.position.set(s * (0.08 + i * 0.05), 0.04 - i * 0.02, -0.02);
      f.rotation.z = s * (-1.2 + i * 0.25);
      wing.add(f);
    }
    wing.position.set(0.12 * s, 0.02, -0.04);
    wing.userData.side = s;
    g.add(wing);
    moving.push(wing);
  }
  const tail = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.32, 6), glowMat(i === 1 ? 0xffe066 : 0xff7a1a, 0.85));
    t.position.set((i - 1) * 0.05, -0.2, -0.1);
    t.rotation.x = Math.PI - 0.5;
    tail.add(t);
  }
  g.add(tail);
};

const whale: Build = (g, moving) => {
  const body = part(sphere(0.22), toon('#3a4fb8'), 0.05);
  body.scale.set(1.35, 0.85, 1);
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.17), toon('#a9c4ff'));
  belly.position.set(0, -0.06, 0.06);
  belly.scale.set(1.3, 0.6, 0.8);
  g.add(belly);
  eyes(g, 0.12, 0.04, 0.17, 0.04);
  blush(g, 0.17, -0.02, 0.15);
  // จุดดาวบนหลัง
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const star = new THREE.Mesh(sphere(0.018, 8, 6), glowMat(0xfff3a0, 1));
    star.position.set(Math.cos(a) * 0.17, 0.13 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.12 - 0.04);
    g.add(star);
  }
  const tail = new THREE.Group();
  for (const s of [1, -1]) {
    const fl = part(sphere(0.08), toon('#3a4fb8'), 0.06);
    fl.position.set(0.07 * s, 0.03, 0);
    fl.scale.set(1.2, 0.35, 0.8);
    fl.rotation.z = 0.5 * s;
    tail.add(fl);
  }
  tail.position.set(-0.33, 0.05, -0.02);
  tail.rotation.y = Math.PI / 2;
  g.add(tail);
  moving.push(tail);
  // น้ำพุดาว
  const spout = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(sphere(0.025, 8, 6), glowMat(i % 2 ? 0x8fe0ff : 0xffffff, 0.9));
    d.position.set((i - 1.5) * 0.03, 0.26 + (i % 2) * 0.05, 0);
    spout.add(d);
  }
  g.add(spout);
};

const goldragon: Build = (g, moving) => {
  const gold = toon('#ffc93c', { emissive: 0x4a3000 });
  const head = part(sphere(0.17), gold, 0.05);
  head.position.set(0, 0.13, 0.03);
  head.scale.set(1.05, 0.95, 1.1);
  g.add(head);
  const snout = part(sphere(0.09), gold, 0.06);
  snout.position.set(0, 0.07, 0.17);
  snout.scale.set(1.2, 0.8, 1);
  g.add(snout);
  eyes(g, 0.075, 0.16, 0.15, 0.045);
  for (const s of [1, -1]) {
    const horn = part(new THREE.ConeGeometry(0.035, 0.14, 8), toon('#ffffff'), 0.08);
    horn.position.set(0.08 * s, 0.31, -0.03);
    horn.rotation.set(-0.5, 0, -0.35 * s);
    g.add(horn);
    // หนวดมังกร
    const whisker = part(capsule(0.01, 0.12), toon('#fff3a0'), 0.1);
    whisker.position.set(0.1 * s, 0.05, 0.2);
    whisker.rotation.z = 1.1 * s;
    g.add(whisker);
    const wing = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.32, 0.16);
    shape.lineTo(0.27, -0.02);
    shape.lineTo(0.2, 0.03);
    shape.lineTo(0.13, -0.07);
    shape.lineTo(0, -0.04);
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(shape), toon('#fff3a0', { side: THREE.DoubleSide, emissive: 0x403000 }));
    wm.scale.x = s;
    wing.add(wm);
    wing.position.set(0.08 * s, -0.02, -0.08);
    wing.userData.side = s;
    g.add(wing);
    moving.push(wing);
  }
  const body = part(sphere(0.14), gold, 0.06);
  body.position.y = -0.11;
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.1), toon('#fff8dc'));
  belly.position.set(0, -0.11, 0.07);
  belly.scale.set(0.9, 1, 0.6);
  g.add(belly);
  // วงรัศมีศักดิ์สิทธิ์ + อัญมณีบนหน้าผาก
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 8, 32), glowMat(0xfff3a0, 0.95));
  halo.position.set(0, 0.42, -0.02);
  halo.rotation.x = Math.PI / 2.4;
  g.add(halo);
  moving.push(halo);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), toon('#4fb6ff', { emissive: 0x103060 }));
  gem.position.set(0, 0.22, 0.17);
  g.add(gem);
};

export const BUILDERS2: Record<string, Build> = {
  hamster,
  chick,
  frog,
  bunny,
  puppy,
  penguin,
  panda,
  fox,
  axolotl,
  redpanda,
  unicorn,
  phoenix,
  whale,
  goldragon,
};
