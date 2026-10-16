// ตัวละคร chibi 3D สร้างจากรูปทรงพื้นฐาน (ต้นแบบ) — แยกเป็นชิ้นส่วนให้เปลี่ยนชุด/ผม/หมวก/ของในมือได้
// ภายหลังเปลี่ยนเป็นโมเดล .glb จากนักปั้นได้ โดยคงรูปแบบ ChibiLook เดิม
import * as THREE from 'three';

export type Outfit = 'uniform' | 'labcoat' | 'hoodie' | 'sport';
export type HairStyle = 'short' | 'bob' | 'spiky' | 'bun';
export type Hat = 'none' | 'cap' | 'grad' | 'headphones' | 'beanie';
export type HandItem = 'none' | 'book' | 'flask' | 'pencil';

export interface ChibiLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes: string;
  outfit: Outfit;
  outfitColor: string;
  hat: Hat;
  item: HandItem;
}

export const DEFAULT_LOOK: ChibiLook = {
  skin: '#ffd9c2',
  hair: '#3b2a4d',
  hairStyle: 'short',
  eyes: '#3b2a4d',
  outfit: 'uniform',
  outfitColor: '#2b3a8c',
  hat: 'none',
  item: 'none',
};

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x22163d, side: THREE.BackSide });

/** ไล่แสง 3 ระดับแบบการ์ตูน */
let gradientMap: THREE.DataTexture | null = null;
function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const toon = (color: string, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });

/** เมชพร้อมเส้นขอบการ์ตูน (เปลือกด้านหลังขยายเล็กน้อย) */
function part(geo: THREE.BufferGeometry, mat: THREE.Material, outline = 0.035): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  if (outline > 0) {
    const shell = new THREE.Mesh(geo, OUTLINE);
    shell.scale.setScalar(1 + outline);
    shell.raycast = () => {};
    mesh.add(shell);
  }
  return mesh;
}

const sphere = (r: number, ws = 32, hs = 24) => new THREE.SphereGeometry(r, ws, hs);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 20);

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
};

export type Pose = 'idle' | 'cheer' | 'clap' | 'sad' | 'wave';

export interface Chibi {
  root: THREE.Group;
  setLook: (look: ChibiLook) => void;
  /** t = วินาที, cheer = 0..1 (ท่าดีใจ) */
  update: (t: number, cheer?: number, pose?: Pose) => void;
  dispose: () => void;
}

export function createChibi(initial: ChibiLook = DEFAULT_LOOK): Chibi {
  const root = new THREE.Group();
  const body = new THREE.Group(); // ขยับทั้งตัว (หายใจ/กระโดด)
  root.add(body);
  let look = initial;

  // กลุ่มชิ้นส่วนที่เปลี่ยนตามการแต่งตัว (สร้างใหม่ทุกครั้งที่เปลี่ยน)
  const parts = {
    base: new THREE.Group(),
    outfit: new THREE.Group(),
    hair: new THREE.Group(),
    hat: new THREE.Group(),
    item: new THREE.Group(),
  };
  const head = new THREE.Group();
  head.position.y = 1.55;
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(0.33, 0.98, 0);
  armR.position.set(-0.33, 0.98, 0);
  body.add(parts.base, parts.outfit, head, armL, armR);
  head.add(parts.hair, parts.hat);
  armR.add(parts.item);
  let eyes: THREE.Object3D[] = [];
  let mouth: THREE.Object3D | null = null;

  const clear = (g: THREE.Object3D) => {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (o.material !== OUTLINE) (o.material as THREE.Material).dispose();
        }
      });
    }
  };

  function buildBase() {
    clear(parts.base);
    for (const c of [...head.children]) if (c !== parts.hair && c !== parts.hat) head.remove(c);
    for (const arm of [armL, armR]) for (const c of [...arm.children]) if (c !== parts.item) arm.remove(c);
    const skin = toon(look.skin);

    // หัวโต
    const skull = part(sphere(0.62), skin, 0.03);
    skull.scale.set(1.02, 0.94, 0.96);
    head.add(skull);
    for (const s of [1, -1]) {
      const ear = part(sphere(0.12), skin, 0.06);
      ear.position.set(0.6 * s, -0.02, 0);
      ear.scale.set(0.6, 1, 0.8);
      head.add(ear);
    }
    // ตา: ทรงไข่สีเข้ม + ประกาย 2 จุด
    eyes = [];
    for (const s of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(0.21 * s, -0.04, 0.53);
      const ball = new THREE.Mesh(sphere(0.1), new THREE.MeshBasicMaterial({ color: look.eyes }));
      ball.scale.set(0.82, 1.18, 0.45);
      const hi = new THREE.Mesh(sphere(0.032, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi.position.set(0.03 * s, 0.05, 0.04);
      const hi2 = new THREE.Mesh(sphere(0.016, 10, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi2.position.set(-0.025 * s, -0.04, 0.045);
      eye.add(ball, hi, hi2);
      eye.lookAt(new THREE.Vector3(0.21 * s * 0.3, -0.04, 3));
      head.add(eye);
      eyes.push(eye);
      // แก้มแดง
      const blush = new THREE.Mesh(sphere(0.08, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.55 }));
      blush.position.set(0.36 * s, -0.17, 0.46);
      blush.scale.set(1.2, 0.6, 0.3);
      blush.lookAt(new THREE.Vector3(0.36 * s * 2, -0.17, 3));
      head.add(blush);
    }
    // คิ้ว
    for (const s of [1, -1]) {
      const brow = new THREE.Mesh(capsule(0.018, 0.08), new THREE.MeshBasicMaterial({ color: look.hair }));
      brow.position.set(0.21 * s, 0.11, 0.56);
      brow.rotation.z = Math.PI / 2 + 0.15 * s;
      head.add(brow);
    }
    // ปากยิ้ม
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 24, Math.PI), new THREE.MeshBasicMaterial({ color: 0x5a2a3a }));
    smile.position.set(0, -0.2, 0.58);
    smile.rotation.z = Math.PI;
    head.add(smile);
    mouth = smile;

    // ขา + รองเท้า
    for (const s of [1, -1]) {
      const leg = part(capsule(0.11, 0.22), toon(look.skin), 0.05);
      leg.position.set(0.13 * s, 0.32, 0);
      parts.base.add(leg);
      const shoe = part(sphere(0.15), toon('#f4f1fb'), 0.05);
      shoe.scale.set(0.95, 0.55, 1.35);
      shoe.position.set(0.13 * s, 0.08, 0.05);
      parts.base.add(shoe);
      const sole = new THREE.Mesh(sphere(0.15), toon('#6d5bd0'));
      sole.scale.set(0.97, 0.22, 1.37);
      sole.position.set(0.13 * s, 0.03, 0.05);
      parts.base.add(sole);
    }
    // แขน + มือ
    for (const [arm, s] of [
      [armL, 1],
      [armR, -1],
    ] as const) {
      const hand = part(sphere(0.095), skin, 0.06);
      hand.position.set(0.04 * s, -0.42, 0.02);
      arm.add(hand);
      arm.rotation.z = 0.22 * s;
    }
  }

  function buildOutfit() {
    clear(parts.outfit);
    for (const arm of [armL, armR]) for (const c of [...arm.children]) if (c.userData.sleeve) arm.remove(c);
    const main = look.outfitColor;
    const add = (m: THREE.Object3D) => parts.outfit.add(m);
    const sleeve = (color: string) => {
      for (const arm of [armL, armR]) {
        const sl = part(capsule(0.1, 0.26), toon(color), 0.05);
        sl.position.y = -0.17;
        sl.userData.sleeve = true;
        arm.add(sl);
      }
    };
    // ลำตัวพื้นฐาน (เสื้อ)
    const torso = (color: string, len = 0.2) => {
      const t = part(capsule(0.27, len), toon(color), 0.04);
      t.position.y = 0.9;
      t.scale.set(1.08, 1, 0.86);
      add(t);
    };
    // กางเกงสั้น
    const shorts = (color: string) => {
      const p = part(new THREE.CylinderGeometry(0.32, 0.34, 0.26, 28), toon(color), 0.04);
      p.position.y = 0.56;
      p.scale.z = 0.88;
      add(p);
      const belt = part(new THREE.TorusGeometry(0.315, 0.035, 10, 32), toon(shade(color, -0.12)), 0.06);
      belt.position.y = 0.68;
      belt.rotation.x = Math.PI / 2;
      belt.scale.y = 0.88;
      add(belt);
    };

    if (look.outfit === 'uniform') {
      torso('#fbfaff');
      shorts(main);
      sleeve('#fbfaff');
      const tie = part(new THREE.ConeGeometry(0.06, 0.26, 4), toon('#e2435c'), 0.08);
      tie.position.set(0, 0.88, 0.25);
      tie.rotation.set(0.1, Math.PI / 4, Math.PI);
      add(tie);
      const collar = part(new THREE.TorusGeometry(0.17, 0.045, 10, 24), toon('#fbfaff'), 0.06);
      collar.position.y = 1.08;
      collar.rotation.x = Math.PI / 2;
      add(collar);
    } else if (look.outfit === 'labcoat') {
      torso(main);
      shorts('#35305a');
      sleeve('#fbfaff');
      const coat = part(new THREE.CylinderGeometry(0.3, 0.42, 0.62, 28, 1, true, 0.5, Math.PI * 2 - 1), toon('#fbfaff', { side: THREE.DoubleSide }), 0.03);
      coat.position.y = 0.72;
      coat.scale.z = 0.88;
      add(coat);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.01), toon('#ffb020'));
      badge.position.set(-0.17, 0.92, 0.29);
      add(badge);
    } else if (look.outfit === 'hoodie') {
      torso(main, 0.36);
      shorts('#2c2850');
      sleeve(main);
      const hood = part(new THREE.TorusGeometry(0.22, 0.08, 12, 28), toon(shade(main, -0.06)), 0.05);
      hood.position.set(0, 1.08, -0.05);
      hood.rotation.x = Math.PI / 2.3;
      add(hood);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.02), toon(shade(main, -0.08)));
      pocket.position.set(0, 0.72, 0.25);
      add(pocket);
    } else {
      torso(main);
      shorts('#fbfaff');
      sleeve(main);
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.025, 8, 32), toon('#fbfaff'));
      stripe.position.y = 0.86;
      stripe.rotation.x = Math.PI / 2;
      stripe.scale.y = 0.86;
      add(stripe);
      const num = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), toon('#fbfaff'));
      num.position.set(0, 0.95, 0.255);
      add(num);
    }
  }

  function buildHair() {
    clear(parts.hair);
    const hairMat = toon(look.hair);
    const add = (m: THREE.Mesh) => parts.hair.add(m);
    // ฝาครอบศีรษะ
    const cap = part(new THREE.SphereGeometry(0.665, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, 0.025);
    cap.position.y = 0.06;
    cap.rotation.x = -0.32;
    // ผมด้านหลังยาวลงถึงท้ายทอย
    const nape = part(sphere(0.62, 32, 20), hairMat, 0.025);
    nape.position.set(0, 0, -0.17);
    nape.scale.set(1.02, 0.88, 0.8);
    add(nape);
    add(cap);
    // ผมหน้าม้า
    const bangs = look.hairStyle === 'spiky' ? 6 : 5;
    for (let i = 0; i < bangs; i++) {
      const a = (i / (bangs - 1) - 0.5) * 1.7;
      const b = part(sphere(look.hairStyle === 'spiky' ? 0.13 : 0.17, 20, 14), hairMat, 0.05);
      b.position.set(Math.sin(a) * 0.52, 0.3 - Math.abs(a) * 0.12, Math.cos(a) * 0.52);
      b.scale.set(1, look.hairStyle === 'spiky' ? 1.9 : 1.3, 0.62);
      b.lookAt(new THREE.Vector3(Math.sin(a) * 2, 0.3, Math.cos(a) * 2));
      if (look.hairStyle === 'spiky') b.rotation.z += 0.4 * Math.sign(a || 1);
      add(b);
    }
    if (look.hairStyle === 'bob' || look.hairStyle === 'bun') {
      for (const s of [1, -1]) {
        const side = part(sphere(0.24, 20, 16), hairMat, 0.04);
        side.position.set(0.52 * s, -0.12, -0.05);
        side.scale.set(0.7, 1.45, 1.1);
        add(side);
      }
      const back = part(sphere(0.6, 32, 20), hairMat, 0.025);
      back.position.set(0, -0.08, -0.2);
      back.scale.set(1.05, 0.95, 0.8);
      add(back);
    }
    if (look.hairStyle === 'bun') {
      const bun = part(sphere(0.2, 24, 16), hairMat, 0.05);
      bun.position.set(0, 0.62, -0.25);
      add(bun);
    }
    if (look.hairStyle === 'spiky') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 4 - 0.5) * 2.2;
        const spike = part(new THREE.ConeGeometry(0.13, 0.36, 12), hairMat, 0.05);
        spike.position.set(Math.sin(a) * 0.38, 0.58, Math.cos(a) * 0.2 - 0.15);
        spike.rotation.set(-0.5, 0, -a * 0.5);
        add(spike);
      }
    }
  }

  function buildHat() {
    clear(parts.hat);
    const add = (m: THREE.Mesh) => parts.hat.add(m);
    if (look.hat === 'cap') {
      const c = toon('#ff5d73');
      const dome = part(new THREE.SphereGeometry(0.69, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), c, 0.03);
      dome.position.y = 0.1;
      dome.rotation.x = -0.12;
      add(dome);
      const brim = part(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32, 1, false, -Math.PI / 2, Math.PI), c, 0.05);
      brim.position.set(0, 0.32, 0.42);
      brim.rotation.x = 0.2;
      brim.scale.z = 0.8;
      add(brim);
      const button = new THREE.Mesh(sphere(0.05, 12, 8), toon('#ffffff'));
      button.position.y = 0.78;
      add(button);
    } else if (look.hat === 'grad') {
      const c = toon('#25203f');
      const crown = part(new THREE.CylinderGeometry(0.42, 0.45, 0.22, 32), c, 0.04);
      crown.position.y = 0.55;
      add(crown);
      const board = part(new THREE.BoxGeometry(1.0, 0.05, 1.0), c, 0.03);
      board.position.y = 0.68;
      board.rotation.y = Math.PI / 4;
      add(board);
      const tassel = part(capsule(0.025, 0.28), toon('#ffc93c'), 0.1);
      tassel.position.set(0.42, 0.52, 0.2);
      add(tassel);
    } else if (look.hat === 'headphones') {
      const band = part(new THREE.TorusGeometry(0.67, 0.05, 12, 40, Math.PI), toon('#6d5bd0'), 0.06);
      band.position.y = 0.02;
      add(band);
      for (const s of [1, -1]) {
        const cup = part(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), toon('#ff7ab6'), 0.05);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(0.66 * s, 0, 0);
        add(cup);
      }
    } else if (look.hat === 'beanie') {
      const c = toon('#22c58b');
      const dome = part(new THREE.SphereGeometry(0.7, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.45), c, 0.03);
      dome.position.y = 0.08;
      add(dome);
      const rim = part(new THREE.TorusGeometry(0.64, 0.08, 12, 40), toon('#1aa874'), 0.04);
      rim.position.y = 0.2;
      rim.rotation.x = Math.PI / 2;
      add(rim);
      const pom = part(sphere(0.13, 16, 12), toon('#ffffff'), 0.06);
      pom.position.y = 0.8;
      add(pom);
    }
  }

  function buildItem() {
    clear(parts.item);
    const add = (m: THREE.Mesh) => parts.item.add(m);
    parts.item.position.set(-0.04, -0.45, 0.12);
    if (look.item === 'book') {
      const cover = part(new THREE.BoxGeometry(0.28, 0.36, 0.08), toon('#3d8bff'), 0.06);
      cover.rotation.set(0.2, 0.4, 0);
      add(cover);
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.33, 0.085), toon('#fffaf0'));
      pages.position.x = 0.02;
      pages.rotation.copy(cover.rotation);
      add(pages);
    } else if (look.item === 'flask') {
      const glass = part(sphere(0.13, 20, 14), toon('#cfefff', { transparent: true, opacity: 0.85 }), 0.06);
      glass.position.y = 0.05;
      add(glass);
      const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), toon('#22c58b'));
      liquid.position.y = 0.05;
      add(liquid);
      const neck = part(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 16), toon('#cfefff'), 0.08);
      neck.position.y = 0.22;
      add(neck);
    } else if (look.item === 'pencil') {
      const stick = part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), toon('#ffc93c'), 0.08);
      stick.rotation.z = 0.5;
      add(stick);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), toon('#f2d2a9'));
      tip.position.set(-0.13, -0.24, 0);
      tip.rotation.z = 0.5 + Math.PI;
      add(tip);
    }
  }

  function setLook(next: ChibiLook) {
    const prev = look;
    look = next;
    const all = !prev || prev === next;
    // สร้างร่างใหม่จะล้างแขนเสื้อด้วย จึงต้องสร้างชุดใหม่ตาม
    const baseChanged = all || prev.skin !== next.skin || prev.eyes !== next.eyes;
    if (baseChanged) buildBase();
    if (baseChanged || prev.outfit !== next.outfit || prev.outfitColor !== next.outfitColor) buildOutfit();
    if (all || prev.hair !== next.hair || prev.hairStyle !== next.hairStyle) buildHair();
    if (all || prev.hat !== next.hat) buildHat();
    if (all || prev.item !== next.item) buildItem();
  }

  // เงาวงรีใต้เท้า
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 40),
    new THREE.MeshBasicMaterial({ color: 0x1a1033, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  buildBase();
  buildOutfit();
  buildHair();
  buildHat();
  buildItem();

  let nextBlink = 2;
  /** cheer = 0..1 (กระโดดดีใจชั่วครู่) ทับท่าหลัก pose */
  function update(t: number, cheer = 0, pose: Pose = 'idle') {
    const k = pose === 'cheer' ? 1 : cheer;
    const sad = pose === 'sad';
    const bob = Math.sin(t * (sad ? 1.2 : 2.2)) * (sad ? 0.012 : 0.025);
    const hop = k * Math.abs(Math.sin(t * 7)) * 0.25;
    body.position.y = bob + hop - (sad ? 0.04 : 0);
    shadow.scale.setScalar(1 - (bob + hop) * 0.8);
    head.rotation.z = Math.sin(t * 1.1) * 0.05;
    head.rotation.x = sad ? 0.32 : Math.sin(t * 0.7) * 0.03;
    if (mouth) mouth.rotation.z = sad ? 0 : Math.PI;
    let l = 0.22 + Math.sin(t * 2.2) * 0.04;
    let r = -0.22 - Math.sin(t * 2.2) * 0.04;
    armL.rotation.x = 0;
    armR.rotation.x = 0;
    if (k > 0) {
      l += 2.4 * k;
      r += (-2.3 + Math.sin(t * 9) * 0.3) * k;
    } else if (pose === 'clap') {
      // แขนยื่นมาข้างหน้า ตบมือเข้าหากัน
      const c = Math.abs(Math.sin(t * 8));
      armL.rotation.x = -1.2;
      armR.rotation.x = -1.2;
      l = 0.05 + c * 0.45;
      r = -0.05 - c * 0.45;
    } else if (pose === 'wave') {
      r = -2.5 + Math.sin(t * 8) * 0.35;
    } else if (sad) {
      l = 0.08;
      r = -0.08;
    }
    armL.rotation.z = l;
    armR.rotation.z = r;
    // กะพริบตา
    const blinking = t > nextBlink && t < nextBlink + 0.12;
    if (t > nextBlink + 0.12) nextBlink = t + 2 + Math.random() * 3;
    for (const e of eyes) e.scale.y = blinking ? 0.12 : sad ? 0.75 : 1;
  }

  return {
    root,
    setLook,
    update,
    dispose: () => {
      for (const g of [parts.base, parts.outfit, parts.hair, parts.hat, parts.item, head, armL, armR]) clear(g);
    },
  };
}
