// สัตว์เลี้ยงลอยข้างตัวละคร (สร้างจากรูปทรงพื้นฐาน สไตล์เดียวกับตัว chibi)
import * as THREE from 'three';
import { capsule, part, sphere, toon, type Pose } from './chibi';
import { BUILDERS2 } from './pets2';

export type PetKind =
  | 'none' | 'cat' | 'owl' | 'slime' | 'dragon'
  | 'hamster' | 'chick' | 'frog' | 'bunny' | 'puppy' | 'penguin' | 'panda' | 'fox'
  | 'axolotl' | 'redpanda' | 'unicorn' | 'phoenix' | 'whale' | 'goldragon';

export interface Pet {
  root: THREE.Group;
  update(t: number, pose: Pose): void;
}

const black = () => new THREE.MeshBasicMaterial({ color: 0x22163d });
const white = () => new THREE.MeshBasicMaterial({ color: 0xffffff });

/** ตาดำกลมมีประกาย */
function eyePair(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.05) {
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

function buildCat(g: THREE.Group, moving: THREE.Object3D[]) {
  const fur = toon('#ffa94d');
  const head = part(sphere(0.2), fur, 0.05);
  head.scale.set(1.1, 0.95, 1);
  head.position.y = 0.12;
  g.add(head);
  for (const s of [1, -1]) {
    const ear = part(new THREE.ConeGeometry(0.07, 0.13, 4), fur, 0.08);
    ear.position.set(0.12 * s, 0.32, 0);
    ear.rotation.z = -0.25 * s;
    g.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), toon('#ffd1dc'));
    inner.position.set(0.12 * s, 0.31, 0.03);
    inner.rotation.z = -0.25 * s;
    g.add(inner);
  }
  eyePair(g, 0.08, 0.14, 0.18);
  const nose = new THREE.Mesh(sphere(0.02, 8, 6), toon('#ff6b8b'));
  nose.position.set(0, 0.08, 0.2);
  g.add(nose);
  // แถบลายส้มเข้ม
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(capsule(0.012, 0.06), toon('#e8762b'));
    stripe.position.set((i - 1) * 0.06, 0.29, 0.06);
    g.add(stripe);
  }
  const body = part(sphere(0.15), fur, 0.06);
  body.position.y = -0.12;
  body.scale.set(1, 0.9, 1);
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.1), toon('#fff1e0'));
  belly.position.set(0, -0.12, 0.08);
  belly.scale.set(1, 1, 0.6);
  g.add(belly);
  const tail = new THREE.Group();
  const t = part(new THREE.TorusGeometry(0.12, 0.035, 8, 16, Math.PI * 1.2), fur, 0.08);
  t.rotation.z = Math.PI * 0.2;
  tail.add(t);
  tail.position.set(-0.13, -0.08, -0.08);
  g.add(tail);
  moving.push(tail);
}

function buildOwl(g: THREE.Group, moving: THREE.Object3D[]) {
  const feather = toon('#9c6b4a');
  const body = part(sphere(0.22), feather, 0.05);
  body.scale.set(1, 1.1, 0.95);
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.15), toon('#f2dcc0'));
  belly.position.set(0, -0.06, 0.1);
  belly.scale.set(1, 1.1, 0.6);
  g.add(belly);
  for (const s of [1, -1]) {
    const ring = new THREE.Mesh(sphere(0.085, 16, 12), white());
    ring.position.set(0.085 * s, 0.07, 0.17);
    ring.scale.set(1, 1, 0.4);
    g.add(ring);
    const tuft = part(new THREE.ConeGeometry(0.05, 0.12, 6), feather, 0.08);
    tuft.position.set(0.13 * s, 0.25, 0);
    tuft.rotation.z = -0.4 * s;
    g.add(tuft);
    const wing = new THREE.Group();
    const wm = part(sphere(0.1), toon('#7d5238'), 0.06);
    wm.scale.set(0.45, 1, 0.8);
    wm.position.y = -0.08;
    wing.add(wm);
    wing.position.set(0.21 * s, 0.02, -0.02);
    wing.userData.side = s;
    g.add(wing);
    moving.push(wing);
  }
  eyePair(g, 0.085, 0.07, 0.2, 0.045);
  const beak = part(new THREE.ConeGeometry(0.03, 0.07, 6), toon('#ffb020'), 0.1);
  beak.position.set(0, 0.0, 0.22);
  beak.rotation.x = Math.PI;
  g.add(beak);
  // หมวกบัณฑิตจิ๋ว
  const cap = part(new THREE.BoxGeometry(0.2, 0.025, 0.2), toon('#25203f'), 0.06);
  cap.position.y = 0.27;
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
}

function buildSlime(g: THREE.Group, moving: THREE.Object3D[]) {
  const blob = new THREE.Group();
  const goo = part(new THREE.SphereGeometry(0.22, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), toon('#5ee08a', { transparent: true, opacity: 0.92 }), 0.05);
  goo.scale.set(1.1, 1, 1.05);
  blob.add(goo);
  const base = part(new THREE.CylinderGeometry(0.21, 0.24, 0.08, 28), toon('#4cc977'), 0.05);
  base.position.y = -0.06;
  blob.add(base);
  const shine = new THREE.Mesh(sphere(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  shine.position.set(-0.09, 0.13, 0.15);
  shine.scale.set(1, 0.6, 0.4);
  blob.add(shine);
  eyePair(blob, 0.07, 0.05, 0.2, 0.04);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), black());
  mouth.position.set(0, -0.01, 0.215);
  mouth.rotation.z = Math.PI;
  blob.add(mouth);
  blob.position.y = -0.05;
  g.add(blob);
  moving.push(blob);
}

function buildDragon(g: THREE.Group, moving: THREE.Object3D[]) {
  const scale = toon('#8a5cf6');
  const head = part(sphere(0.17), scale, 0.05);
  head.position.set(0, 0.13, 0.03);
  head.scale.set(1.05, 0.95, 1.1);
  g.add(head);
  const snout = part(sphere(0.09), scale, 0.06);
  snout.position.set(0, 0.07, 0.17);
  snout.scale.set(1.2, 0.8, 1);
  g.add(snout);
  for (const s of [1, -1]) {
    const horn = part(new THREE.ConeGeometry(0.035, 0.12, 8), toon('#ffd36e'), 0.08);
    horn.position.set(0.08 * s, 0.3, -0.03);
    horn.rotation.set(-0.4, 0, -0.3 * s);
    g.add(horn);
    const nostril = new THREE.Mesh(sphere(0.012, 6, 4), black());
    nostril.position.set(0.035 * s, 0.09, 0.255);
    g.add(nostril);
    // ปีกค้างคาว
    const wing = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.28, 0.12);
    shape.lineTo(0.24, -0.02);
    shape.lineTo(0.18, 0.02);
    shape.lineTo(0.12, -0.06);
    shape.lineTo(0, -0.04);
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(shape), toon('#ff8ad8', { side: THREE.DoubleSide }));
    wm.scale.x = s;
    wing.add(wm);
    wing.position.set(0.08 * s, -0.02, -0.08);
    wing.userData.side = s;
    g.add(wing);
    moving.push(wing);
  }
  eyePair(g, 0.075, 0.16, 0.15, 0.045);
  const body = part(sphere(0.14), scale, 0.06);
  body.position.y = -0.11;
  body.scale.set(1, 1.05, 0.95);
  g.add(body);
  const belly = new THREE.Mesh(sphere(0.1), toon('#ffe08a'));
  belly.position.set(0, -0.11, 0.07);
  belly.scale.set(0.9, 1, 0.6);
  g.add(belly);
  const tail = part(new THREE.ConeGeometry(0.06, 0.26, 10), scale, 0.07);
  tail.position.set(0, -0.2, -0.15);
  tail.rotation.x = -1.9;
  g.add(tail);
}

/** สร้างสัตว์เลี้ยง (none = null) */
/** level 1-10: ตัวโตขึ้น / Lv5+ มีประกายวน / Lv10 มีมงกุฎ  hungry = งอน (ห้อยต่ำ ตาเศร้า) */
export function createPet(kind: PetKind, level = 1, hungry = false): Pet | null {
  if (kind === 'none') return null;
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);
  const lv = Math.max(1, Math.min(10, level));
  root.scale.setScalar(1 + (lv - 1) * 0.045);
  const sparkles: THREE.Mesh[] = [];
  if (lv >= 5) {
    const geo = new THREE.OctahedronGeometry(0.03);
    const count = lv >= 10 ? 6 : lv >= 8 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: lv >= 10 ? 0xffd84d : 0xbfefff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      root.add(m);
      sparkles.push(m);
    }
  }
  if (lv >= 10) {
    const crown = new THREE.Group();
    const gold = toon('#ffc93c', { emissive: 0x4a3000 });
    const band = part(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 16, 1, true), gold, 0.08);
    crown.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = part(new THREE.ConeGeometry(0.025, 0.07, 6), gold, 0.1);
      spike.position.set(Math.cos(a) * 0.09, 0.05, Math.sin(a) * 0.09);
      crown.add(spike);
    }
    const jewel = new THREE.Mesh(sphere(0.02, 8, 6), toon('#ff5d73'));
    jewel.position.set(0, 0.01, 0.1);
    crown.add(jewel);
    crown.position.y = 0.38;
    crown.rotation.z = 0.15;
    g.add(crown);
  }
  const moving: THREE.Object3D[] = [];
  if (kind === 'cat') buildCat(g, moving);
  else if (kind === 'owl') buildOwl(g, moving);
  else if (kind === 'slime') buildSlime(g, moving);
  else if (kind === 'dragon') buildDragon(g, moving);
  else BUILDERS2[kind]?.(g, moving);
  g.rotation.y = -0.45;

  return {
    root,
    update(t, ownerPose) {
      const pose = hungry && ownerPose !== 'cheer' ? 'sad' : ownerPose;
      const happy = pose === 'cheer' || pose === 'clap';
      const sad = pose === 'sad';
      sparkles.forEach((m, i) => {
        const a = t * 2.2 + (i / sparkles.length) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.3, 0.05 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.3);
        m.rotation.y = t * 4;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.abs(Math.sin(t * 5 + i)) * 0.4;
      });
      // ลอยขึ้นลง: ดีใจเด้งสูงและหมุน / เสียใจห้อยต่ำ ช้า
      const speed = happy ? 7 : sad ? 1.5 : 2.4;
      const amp = happy ? 0.16 : sad ? 0.03 : 0.07;
      g.position.y = Math.abs(Math.sin(t * speed)) * amp * (happy ? 1 : 0) + Math.sin(t * speed) * (happy ? 0 : amp) + (sad ? -0.18 : 0);
      g.rotation.y = happy ? -0.45 + Math.sin(t * 3) * 0.9 : -0.45 + Math.sin(t * 0.8) * 0.2;
      g.rotation.x = sad ? 0.35 : 0;
      for (const m of moving) {
        const side = m.userData.side as number | undefined;
        if (side) m.rotation.z = side * (0.3 + Math.sin(t * (happy ? 22 : 9)) * (sad ? 0.1 : 0.45));
        else if (kind === 'slime') {
          const sq = 1 + Math.sin(t * (happy ? 12 : 5)) * (happy ? 0.12 : 0.05);
          m.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        } else m.rotation.z = Math.sin(t * 4) * 0.4;
      }
    },
  };
}
