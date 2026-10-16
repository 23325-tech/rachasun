// ออร่าติดตัวละคร: เอฟเฟกต์เคลื่อนไหวรอบตัว (เมชเล็กๆ ไม่กี่ชิ้น เบาพอรันบนมือถือ)
import * as THREE from 'three';
import { capsule, part, toon, type Pose } from './chibi';

export type AuraKind = 'none' | 'stars' | 'sakura' | 'books' | 'flames' | 'lightning';

export interface Aura {
  root: THREE.Group;
  update(t: number, pose: Pose): void;
  dispose(): void;
}

const glow = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

function starShape(outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** ดาวระยิบ: วงดาวเอียงหมุนรอบตัว */
function stars(root: THREE.Group) {
  const geo = new THREE.ShapeGeometry(starShape(0.13, 0.055));
  const items: { m: THREE.Mesh; a: number; y: number; ph: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : 0xffd84d, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    root.add(m);
    items.push({ m, a: (i / 9) * Math.PI * 2, y: 0.5 + (i % 3) * 0.5, ph: i * 1.7 });
  }
  return (t: number, speed: number) => {
    for (const it of items) {
      const a = it.a + t * 0.9 * speed;
      it.m.position.set(Math.cos(a) * 0.95, it.y + Math.sin(a * 2 + it.ph) * 0.12, Math.sin(a) * 0.55);
      const tw = 0.6 + Math.abs(Math.sin(t * 3 + it.ph)) * 0.6;
      it.m.scale.setScalar(tw);
      it.m.rotation.z = t * 2 + it.ph;
      (it.m.material as THREE.MeshBasicMaterial).opacity = 0.55 + tw * 0.35;
    }
  };
}

/** กลีบซากุระ: ร่วงหมุนเป็นเกลียวรอบตัววนไม่รู้จบ */
function sakura(root: THREE.Group) {
  const petal = new THREE.Shape();
  petal.moveTo(0, -0.05);
  petal.bezierCurveTo(0.05, -0.02, 0.05, 0.04, 0.012, 0.06);
  petal.lineTo(0, 0.045);
  petal.lineTo(-0.012, 0.06);
  petal.bezierCurveTo(-0.05, 0.04, -0.05, -0.02, 0, -0.05);
  const geo = new THREE.ShapeGeometry(petal);
  const items: { m: THREE.Mesh; a: number; off: number; spin: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb7d0 : 0xffd6e5, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.scale.setScalar(1.7);
    root.add(m);
    items.push({ m, a: Math.random() * Math.PI * 2, off: Math.random(), spin: 1 + Math.random() * 2 });
  }
  return (t: number, speed: number) => {
    for (const it of items) {
      const k = (t * 0.22 * speed + it.off) % 1; // 0 = บน, 1 = ล่าง
      const a = it.a + k * Math.PI * 2;
      it.m.position.set(Math.cos(a) * (0.7 + k * 0.3), 2.4 - k * 2.4, Math.sin(a) * 0.55);
      it.m.rotation.set(t * it.spin, t * it.spin * 0.7, t);
      (it.m.material as THREE.MeshBasicMaterial).opacity = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    }
  };
}

/** หนังสือลอยวน: 3 เล่มกางหน้าโคจรรอบตัว + ประกายตัวอักษร */
function books(root: THREE.Group) {
  const colors = ['#3d8bff', '#ff5d73', '#22c58b'];
  const items: { g: THREE.Group; a: number; flap: THREE.Object3D[] }[] = [];
  colors.forEach((c, i) => {
    const g = new THREE.Group();
    const flap: THREE.Object3D[] = [];
    for (const s of [1, -1]) {
      const half = new THREE.Group();
      const cover = part(new THREE.BoxGeometry(0.16, 0.22, 0.015), toon(c), 0.06);
      cover.position.x = 0.08 * s;
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.02), toon('#fffaf0'));
      pages.position.set(0.075 * s, 0, 0.015);
      half.add(cover, pages);
      half.userData.side = s;
      g.add(half);
      flap.push(half);
    }
    const spine = part(capsule(0.012, 0.18), toon(c), 0.08);
    g.add(spine);
    g.scale.setScalar(1.7);
    root.add(g);
    items.push({ g, a: (i / 3) * Math.PI * 2, flap });
  });
  const sparkGeo = new THREE.SphereGeometry(0.02, 6, 4);
  const sparks: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(sparkGeo, glow(0xfff3a0, 0.9));
    root.add(m);
    sparks.push(m);
  }
  return (t: number, speed: number) => {
    items.forEach((it, i) => {
      const a = it.a + t * 0.8 * speed;
      it.g.position.set(Math.cos(a) * 0.95, 1.15 + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * 0.6);
      it.g.rotation.set(-0.25, Math.sin(t * 1.3 + i) * 0.5, 0.15 * Math.sin(t + i));
      for (const h of it.flap) h.rotation.y = (h.userData.side as number) * (0.35 + Math.sin(t * 5 + i) * 0.25);
    });
    sparks.forEach((m, i) => {
      const k = (t * 0.5 + i / sparks.length) % 1;
      const b = items[i % items.length].g.position;
      m.position.set(b.x + Math.sin(i * 7) * 0.12, b.y + k * 0.5, b.z + Math.cos(i * 5) * 0.12);
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  };
}

/** เปลวไฟ: วงไฟลุกรอบเท้า + ลูกไฟลอยขึ้น */
function flames(root: THREE.Group) {
  const coneGeo = new THREE.ConeGeometry(0.16, 0.75, 10, 1, true);
  const tongues: { m: THREE.Mesh; inner: THREE.Mesh; a: number; ph: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.Mesh(coneGeo, glow(0xff7a1a, 0.75));
    const inner = new THREE.Mesh(coneGeo, glow(0xffe066, 0.9));
    inner.scale.setScalar(0.55);
    m.add(inner);
    m.position.set(Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.46);
    root.add(m);
    tongues.push({ m, inner, a, ph: i * 1.3 });
  }
  const emberGeo = new THREE.SphereGeometry(0.045, 6, 4);
  const embers: { m: THREE.Mesh; a: number; off: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(emberGeo, glow(i % 2 ? 0xffb020 : 0xff5d3c, 1));
    root.add(m);
    embers.push({ m, a: Math.random() * Math.PI * 2, off: Math.random() });
  }
  return (t: number, speed: number) => {
    for (const f of tongues) {
      const s = 0.75 + Math.abs(Math.sin(t * 9 * speed + f.ph)) * 0.6;
      f.m.scale.set(1, s, 1);
      f.m.position.y = 0.2 + s * 0.18;
      f.m.rotation.z = Math.sin(t * 6 + f.ph) * 0.15;
    }
    for (const e of embers) {
      const k = (t * 0.6 * speed + e.off) % 1;
      e.m.position.set(Math.cos(e.a + k * 2) * (0.5 + k * 0.2), 0.2 + k * 2, Math.sin(e.a + k * 2) * 0.4);
      (e.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      e.m.scale.setScalar(1 - k * 0.6);
    }
  };
}

/** สายฟ้า: สายฟ้าหยักแลบรอบตัว สุ่มใหม่ทุกช่วงสั้นๆ + วงพลังที่เท้า */
function lightning(root: THREE.Group) {
  const bolts = new THREE.Group();
  root.add(bolts);
  const segGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 5);
  const coreMat = glow(0xffffff, 1);
  const glowMat = glow(0x5ec8ff, 0.85);
  const ringMat = glow(0x5ec8ff, 0.6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);
  let next = 0;
  const regen = () => {
    for (const c of [...bolts.children]) bolts.remove(c);
    for (let b = 0; b < 4; b++) {
      const a = Math.random() * Math.PI * 2;
      let p = new THREE.Vector3(Math.cos(a) * 0.8, 2.1 + Math.random() * 0.3, Math.sin(a) * 0.5);
      for (let i = 0; i < 6; i++) {
        const q = new THREE.Vector3(Math.cos(a) * 0.8 + (Math.random() - 0.5) * 0.35, p.y - 0.32, Math.sin(a) * 0.5 + (Math.random() - 0.5) * 0.2);
        const mid = p.clone().add(q).multiplyScalar(0.5);
        const len = p.distanceTo(q);
        for (const [mat, w] of [
          [glowMat, 2.4],
          [coreMat, 1],
        ] as const) {
          const m = new THREE.Mesh(segGeo, mat);
          m.position.copy(mid);
          m.scale.set(w, len, w);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
          bolts.add(m);
        }
        p = q;
      }
    }
  };
  return (t: number, speed: number) => {
    if (t > next) {
      regen();
      next = t + 0.09 + Math.random() * 0.12 / speed;
    }
    // แลบเป็นจังหวะ
    bolts.visible = Math.sin(t * 23) > -0.3;
    ring.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
    ringMat.opacity = 0.4 + Math.abs(Math.sin(t * 11)) * 0.5;
  };
}

/** สร้างออร่า (none = null) */
export function createAura(kind: AuraKind): Aura | null {
  if (kind === 'none') return null;
  const root = new THREE.Group();
  root.renderOrder = 5;
  const step =
    kind === 'stars' ? stars(root) : kind === 'sakura' ? sakura(root) : kind === 'books' ? books(root) : kind === 'flames' ? flames(root) : lightning(root);
  return {
    root,
    update(t, pose) {
      // ดีใจ = เร็ว/คึกคัก เสียใจ = ช้า
      const speed = pose === 'cheer' || pose === 'clap' ? 1.8 : pose === 'sad' ? 0.45 : 1;
      step(t, speed);
    },
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
}
