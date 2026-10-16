// ฉากเอฟเฟกต์ 3D ซ้อนทับจอเกม (พิกัดเป็นพิกเซลของจอ: x ขวา, y ลง)
// วาดเฉพาะตอนมีเอฟเฟกต์ ว่างแล้วหยุด requestAnimationFrame
import * as THREE from 'three';

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type RGB = [number, number, number];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  /** ขนาดตอนจบ (โตขึ้น = ควัน / เล็กลง = ประกายไฟ) */
  endSize: number;
  color: RGB;
  alpha: number;
  gravity: number;
  drag: number;
}

interface Effect {
  /** คืน false เมื่อจบ */
  update(dt: number): boolean;
  dispose?(): void;
}

const CAP = 2400;
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const FIRE = [hex(0xfff3a0), hex(0xffcc00), hex(0xff9a3c), hex(0xff5d73)];
const ICE = [hex(0xffffff), hex(0xbfefff), hex(0x6fd3ff), hex(0x3d8bff)];
const GOLD = [hex(0xffffff), hex(0xfff3a0), hex(0xffcc00), hex(0xffa400)];
/** หน้าตากระสุน/ระเบิดตามเอฟเฟกต์ยิงของคนยิง */
export type ShotSkin = 'default' | 'star' | 'heart' | 'sakura' | 'lightning' | 'galaxy';
interface ShotStyle {
  trail: RGB[];
  burst: RGB[];
  star1: number;
  star2: number;
  ring1: number;
  ring2: number;
  spikes: number;
}
const PINK = [hex(0xffffff), hex(0xffd6e5), hex(0xff8fc0), hex(0xff5d9e)];
const SAKURA = [hex(0xffffff), hex(0xffe3ee), hex(0xffb7d0), hex(0xff9ac0)];
const GALAXY = [hex(0xffffff), hex(0xc9b6ff), hex(0x8a5cf6), hex(0x4fb6ff)];
const VIOLET = [hex(0xffffff), hex(0xe2c8ff), hex(0xb46bff), hex(0xff6bd6)];

/** หัวใจแบน 2 มิติ ขนาดราว 1 หน่วย */
function heartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.05, -0.3, -0.5, -0.05, -0.5, 0.2);
  s.bezierCurveTo(-0.5, 0.42, -0.3, 0.55, -0.15, 0.5);
  s.bezierCurveTo(-0.05, 0.47, 0, 0.38, 0, 0.32);
  s.bezierCurveTo(0, 0.38, 0.05, 0.47, 0.15, 0.5);
  s.bezierCurveTo(0.3, 0.55, 0.5, 0.42, 0.5, 0.2);
  s.bezierCurveTo(0.5, -0.05, 0.05, -0.3, 0, -0.35);
  return s;
}

const STYLES: Record<ShotSkin, () => ShotStyle> = {
  default: () => ({ trail: FIRE, burst: FIRE, star1: 0xffcc00, star2: 0xff5d73, ring1: 0xffd25c, ring2: 0xff5d73, spikes: 12 }),
  star: () => ({ trail: GOLD, burst: GOLD, star1: 0xffe066, star2: 0xffa400, ring1: 0xffe066, ring2: 0xffffff, spikes: 5 }),
  heart: () => ({ trail: PINK, burst: PINK, star1: 0xff8fc0, star2: 0xff3b7a, ring1: 0xffb7d0, ring2: 0xff5d9e, spikes: 10 }),
  sakura: () => ({ trail: SAKURA, burst: SAKURA, star1: 0xffd6e5, star2: 0xff9ac0, ring1: 0xffe3ee, ring2: 0xff9ac0, spikes: 8 }),
  lightning: () => ({ trail: ICE, burst: ICE, star1: 0xbfefff, star2: 0x3d8bff, ring1: 0x6fd3ff, ring2: 0xffffff, spikes: 9 }),
  galaxy: () => ({ trail: GALAXY, burst: GALAXY, star1: 0xc9b6ff, star2: 0x4fb6ff, ring1: 0x8a5cf6, ring2: 0x4fb6ff, spikes: 14 }),
};

export class FxEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -1000, 1000);
  private particles: Particle[] = [];
  private geo = new THREE.BufferGeometry();
  private aPos = new Float32Array(CAP * 3);
  private aCol = new Float32Array(CAP * 4);
  private aSize = new Float32Array(CAP);
  private effects: Effect[] = [];
  private raf = 0;
  private last = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private heartGeo: THREE.ExtrudeGeometry;
  private ringGeo = new THREE.RingGeometry(0.82, 1, 64);
  /** สั่นจอ (ขนาดพิกเซล) */
  onShake?: (px: number) => void;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    const c = this.renderer.domElement;
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    host.appendChild(c);

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.aCol, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uDpr: { value: this.dpr } },
      vertexShader: `
        attribute vec4 aColor; attribute float aSize; uniform float uDpr; varying vec4 vColor;
        void main() { vColor = aColor; gl_PointSize = aSize * uDpr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float a = pow(1.0 - d, 1.3);
          vec3 col = mix(vColor.rgb, vec3(1.0), smoothstep(0.55, 0.0, d) * 0.65);
          gl_FragColor = vec4(col, vColor.a * a);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const points = new THREE.Points(this.geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 10;
    this.scene.add(points);

    this.heartGeo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 });
    this.heartGeo.center();
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(0.3, 0.6, 1);
    this.scene.add(key);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  };

  // ---------- อนุภาค ----------
  private emit(p: Partial<Particle> & { x: number; y: number }) {
    if (this.particles.length >= CAP) return;
    const life = p.max ?? 0.6;
    this.particles.push({
      vx: 0,
      vy: 0,
      size: 10,
      color: [1, 1, 1],
      alpha: 1,
      gravity: 0,
      drag: 0,
      ...p,
      endSize: p.endSize ?? (p.size ?? 10) * 0.2,
      life,
      max: life,
    });
  }

  private burst(at: Pt, n: number, palette: RGB[], speed: [number, number], opts: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(speed[0], speed[1]);
      this.emit({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: pick(palette), size: rand(5, 13), max: rand(0.45, 1.05), gravity: 900, drag: 1.8, ...opts });
    }
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      // เอฟเฟกต์ที่เพิ่มระหว่างอัปเดต (เช่นจาก after) ต้องไม่หาย
      const list = this.effects;
      this.effects = [];
      const kept = list.filter((e) => {
        const alive = e.update(dt);
        if (!alive) e.dispose?.();
        return alive;
      });
      this.effects = kept.concat(this.effects);
      this.stepParticles(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.effects.length || this.particles.length) this.raf = requestAnimationFrame(tick);
      else {
        this.raf = 0;
        this.renderer.clear();
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stepParticles(dt: number) {
    const ps = this.particles;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ps[n++] = p;
    }
    ps.length = n;
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      const t = 1 - p.life / p.max;
      this.aPos[i * 3] = p.x;
      this.aPos[i * 3 + 1] = -p.y;
      this.aPos[i * 3 + 2] = 0;
      this.aCol[i * 4] = p.color[0];
      this.aCol[i * 4 + 1] = p.color[1];
      this.aCol[i * 4 + 2] = p.color[2];
      this.aCol[i * 4 + 3] = p.alpha * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      this.aSize[i] = p.size + (p.endSize - p.size) * t;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  private add(e: Effect) {
    this.effects.push(e);
    this.start();
  }

  private after(sec: number, fn: () => void) {
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        if (t >= sec) {
          fn();
          return false;
        }
        return true;
      },
    });
  }

  // ---------- วงแหวนคลื่นกระแทก ----------
  private ring(at: Pt, radius: number, color: number, dur = 0.45, thick = 1) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, side: THREE.DoubleSide });
    const geo = thick === 1 ? this.ringGeo : new THREE.RingGeometry(1 - 0.18 * thick, 1, 64);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(at.x, -at.y, 1);
    m.renderOrder = 9;
    this.scene.add(m);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        const r = 8 + (radius - 8) * (1 - Math.pow(1 - k, 3));
        m.scale.set(r, r, 1);
        mat.opacity = 1 - k;
        return k < 1;
      },
      dispose: () => {
        this.scene.remove(m);
        mat.dispose();
        if (geo !== this.ringGeo) geo.dispose();
      },
    });
  }

  // ---------- แสงวาบวงกลมใหญ่ ----------
  private flashTex?: THREE.CanvasTexture;
  private flash(at: Pt, radius: number, color: string, dur = 0.25) {
    if (!this.flashTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      this.flashTex = new THREE.CanvasTexture(c);
    }
    const mat = new THREE.MeshBasicMaterial({ map: this.flashTex, color, transparent: true, depthTest: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    m.position.set(at.x, -at.y, 4);
    m.renderOrder = 12;
    this.scene.add(m);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        const r = radius * (0.5 + 0.7 * Math.sqrt(k));
        m.scale.set(r, r, 1);
        mat.opacity = 1 - k * k;
        return k < 1;
      },
      dispose: () => {
        this.scene.remove(m);
        m.geometry.dispose();
        mat.dispose();
      },
    });
  }

  // ---------- ดาวระเบิดแบบการ์ตูน (ขอบหมึกหนา ตรงกับสไตล์แอป) ----------
  private starBurst(at: Pt, radius: number, fill: number, dur = 0.5, spikes = 12) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 === 0 ? 1 : 0.58 + Math.random() * 0.12;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const geo = new THREE.ShapeGeometry(shape);
    const fillMat = new THREE.MeshBasicMaterial({ color: fill, transparent: true, depthTest: false });
    const inkMat = new THREE.MeshBasicMaterial({ color: 0x2b1a4a, transparent: true, depthTest: false });
    const ink = new THREE.Mesh(geo, inkMat);
    const body = new THREE.Mesh(geo, fillMat);
    const g = new THREE.Group();
    ink.scale.set(1.12, 1.12, 1);
    body.position.z = 0.1;
    g.add(ink, body);
    g.position.set(at.x, -at.y, 0.5);
    g.rotation.z = Math.random() * Math.PI;
    ink.renderOrder = 7;
    body.renderOrder = 8;
    this.scene.add(g);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        // เด้งใหญ่เกินแล้วหดนิดหนึ่ง
        const pop = k < 0.3 ? 1.25 * (1 - Math.pow(1 - k / 0.3, 3)) : 1.25 - 0.25 * ((k - 0.3) / 0.7);
        g.scale.set(radius * pop, radius * pop, 1);
        g.rotation.z += dt * 0.8;
        const o = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        fillMat.opacity = o;
        inkMat.opacity = o;
        return k < 1;
      },
      dispose: () => {
        this.scene.remove(g);
        geo.dispose();
        fillMat.dispose();
        inkMat.dispose();
      },
    });
  }

  // ---------- เศษหัวใจ 3D ----------
  private heartShards(at: Pt, n: number) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: pick([0xff3b5c, 0xff5d73, 0xe0234e]), emissive: 0x5a0010, roughness: 0.35, metalness: 0.1, transparent: true });
      const m = new THREE.Mesh(this.heartGeo, mat);
      const s = rand(9, 18);
      m.scale.set(s, s, s);
      m.position.set(at.x, -at.y, 5);
      m.renderOrder = 11;
      this.scene.add(m);
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = rand(260, 620);
      let vx = Math.cos(a) * v;
      let vy = Math.sin(a) * v;
      const spin = [rand(-9, 9), rand(-9, 9), rand(-6, 6)];
      const life = rand(0.9, 1.4);
      let t = 0;
      this.add({
        update: (dt) => {
          t += dt;
          vy += 1500 * dt;
          vx *= 1 - 0.6 * dt;
          m.position.x += vx * dt;
          m.position.y -= vy * dt;
          m.rotation.x += spin[0] * dt;
          m.rotation.y += spin[1] * dt;
          m.rotation.z += spin[2] * dt;
          mat.opacity = Math.max(0, 1 - Math.max(0, t - life * 0.6) / (life * 0.4));
          return t < life;
        },
        dispose: () => {
          this.scene.remove(m);
          mat.dispose();
        },
      });
    }
  }

  // ---------- ระเบิดตอนกระสุนถึงเป้า ----------
  impact(at: Pt, lethal: boolean, palette = FIRE, skin: ShotSkin = 'default') {
    const st = palette === FIRE ? STYLES[skin]() : { ...STYLES.default(), burst: palette, star1: 0xc58bff, star2: 0xff6bd6 };
    palette = st.burst;
    this.starBurst(at, lethal ? 95 : 70, st.star1, 0.55, st.spikes);
    this.after(0.05, () => this.starBurst(at, lethal ? 62 : 46, st.star2, 0.45, Math.max(5, st.spikes - 3)));
    this.after(0.09, () => this.starBurst(at, lethal ? 32 : 24, 0xffffff, 0.35, 7));
    this.flash(at, lethal ? 260 : 180, '#ffffff', 0.18);
    if (lethal) {
      // ตกรอบ: ระเบิดลูกที่สอง
      this.after(0.22, () => {
        this.starBurst(at, 120, 0xff9a3c, 0.6, 14);
        this.burst(at, 90, palette, [500, 1300], { size: rand(10, 20) });
        this.ring(at, 260, 0xffcc00, 0.6, 2);
        this.onShake?.(22);
      });
    }
    this.ring(at, lethal ? 210 : 140, st.ring1, 0.5, 2);
    this.after(0.08, () => this.ring(at, lethal ? 160 : 105, st.ring2, 0.45, 2.4));
    this.skinExtra(at, skin, lethal);
    this.burst(at, lethal ? 170 : 95, palette, [260, lethal ? 1100 : 820], { size: rand(8, 18) });
    // ประกายเส้นยาวพุ่งออก
    this.burst(at, lethal ? 26 : 14, [hex(0xffffff), palette[0]], [900, 1500], { size: 16, endSize: 2, max: 0.28, gravity: 0, drag: 4 });
    // ควันม่วง
    for (let i = 0; i < (lethal ? 16 : 9); i++) {
      this.emit({ x: at.x + rand(-24, 24), y: at.y + rand(-24, 24), vx: rand(-90, 90), vy: rand(-120, -20), size: rand(34, 56), endSize: rand(90, 130), color: pick([hex(0xffd6e2), hex(0xffe9a8), hex(0xe9dcff)]), alpha: 0.55, max: rand(0.7, 1.2), drag: 1.4 });
    }
    this.heartShards(at, lethal ? 16 : 9);
    this.onShake?.(lethal ? 16 : 9);
  }

  /** ลูกเล่นเพิ่มตามสกินกระสุน */
  private skinExtra(at: Pt, skin: ShotSkin, lethal: boolean) {
    const n = lethal ? 1.6 : 1;
    if (skin === 'star') {
      for (let i = 0; i < 8 * n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(40, 120);
        this.after(rand(0.02, 0.25), () => this.starBurst({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r }, rand(10, 18), pick([0xffe066, 0xffffff, 0xffa400]), 0.5, 5));
      }
    } else if (skin === 'heart') {
      this.heartShards(at, Math.round(10 * n));
      this.flash(at, 140, '#ff8fc0', 0.35);
    } else if (skin === 'sakura') {
      for (let i = 0; i < 70 * n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = rand(120, 420);
        this.emit({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, size: rand(9, 15), endSize: 6, color: pick(SAKURA), max: rand(1.2, 2.2), gravity: 120, drag: 2.2 });
      }
    } else if (skin === 'lightning') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.random();
        const end = { x: at.x + Math.cos(a) * rand(80, 140), y: at.y + Math.sin(a) * rand(80, 140) };
        this.streak(at, end, 0.12, ICE, 8);
      }
      this.flash(at, 220, '#bfefff', 0.25);
    } else if (skin === 'galaxy') {
      for (let i = 0; i < 60 * n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(10, 150);
        this.emit({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, size: rand(4, 9), endSize: 1, color: pick(GALAXY), max: rand(0.6, 1.3), drag: 1 });
      }
      this.after(0.12, () => this.ring(at, 190, 0xc9b6ff, 0.7, 1.5));
    }
  }

  /** สายฟ้าตรงจากคนยิงถึงเป้า (สกินสายฟ้า) */
  private zap(from: Pt, to: Pt, delay: number, onHit: () => void) {
    this.flash(from, 80, '#bfefff', 0.3);
    this.after(Math.max(0, delay - 0.1), () => {
      const segs = 8;
      let p = from;
      for (let i = 1; i <= segs; i++) {
        const k = i / segs;
        const q = { x: from.x + (to.x - from.x) * k + (i < segs ? rand(-26, 26) : 0), y: from.y + (to.y - from.y) * k + (i < segs ? rand(-26, 26) : 0) };
        const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 5);
        for (let j = 0; j < n; j++) {
          const r = j / n;
          const x = p.x + (q.x - p.x) * r;
          const y = p.y + (q.y - p.y) * r;
          this.emit({ x, y, size: 24, endSize: 8, color: hex(0x6fd3ff), max: 0.3 });
          this.emit({ x, y, size: 9, endSize: 4, color: [1, 1, 1], max: 0.24 });
        }
        p = q;
      }
      this.after(0.1, onHit);
    });
  }

  // ---------- โล่ ----------
  shield(at: Pt) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0.0, depthTest: false });
    const geo = new THREE.SphereGeometry(1, 32, 16);
    const bubble = new THREE.Mesh(geo, mat);
    bubble.position.set(at.x, -at.y, 2);
    this.scene.add(bubble);
    const edge = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
    edge.position.set(at.x, -at.y, 3);
    this.scene.add(edge);
    let t = 0;
    const dur = 0.9;
    this.add({
      update: (dt) => {
        t += dt;
        const k = t / dur;
        const pop = k < 0.15 ? k / 0.15 : 1;
        const r = 64 * (0.6 + 0.4 * pop) + Math.sin(t * 40) * 3 * (1 - k);
        bubble.scale.set(r, r, r);
        edge.scale.set(r, r, 1);
        mat.opacity = 0.5 * (1 - k);
        (edge.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        return k < 1;
      },
      dispose: () => {
        this.scene.remove(bubble, edge);
        geo.dispose();
        mat.dispose();
        (edge.material as THREE.Material).dispose();
      },
    });
    this.burst(at, 70, ICE, [300, 900], { gravity: 300, size: rand(8, 16) });
    this.starBurst(at, 40, 0xbfefff, 0.4, 6);
    this.ring(at, 110, 0x6fd3ff, 0.4);
    // หกเหลี่ยมโล่ระยิบ
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.emit({ x: at.x + Math.cos(a) * 62, y: at.y + Math.sin(a) * 62, size: 14, endSize: 4, color: hex(0xbfefff), max: 0.7 });
    }
    this.onShake?.(4);
  }

  // ---------- กระสุนพลัง ----------
  projectile(from: Pt, to: Pt, dur: number, palette: RGB[], onHit: () => void) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    // โค้งขึ้นด้านบนเล็กน้อย
    const ctrl = { x: from.x + dx / 2 - (dy / len) * len * 0.25, y: from.y + dy / 2 + (dx / len) * len * 0.25 - len * 0.2 };
    // แสงชาร์จที่คนยิง
    this.flash(from, 70, '#fff3a0', 0.3);
    this.burst(from, 18, palette, [120, 320], { gravity: 0, max: 0.35 });
    let t = 0;
    let prev = from;
    this.add({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        const e = k * k * (3 - 2 * k);
        const u = 1 - e;
        const p = { x: u * u * from.x + 2 * u * e * ctrl.x + e * e * to.x, y: u * u * from.y + 2 * u * e * ctrl.y + e * e * to.y };
        // หัวกระสุน + หางเรืองแสงเติมช่องว่างระหว่างเฟรม
        const steps = Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / 6));
        for (let i = 1; i <= steps; i++) {
          const q = { x: prev.x + ((p.x - prev.x) * i) / steps, y: prev.y + ((p.y - prev.y) * i) / steps };
          this.emit({ x: q.x, y: q.y, size: rand(16, 26), endSize: 2, color: pick(palette), max: rand(0.22, 0.4), vx: rand(-30, 30), vy: rand(-30, 30) });
        }
        this.emit({ x: p.x, y: p.y, size: 54, endSize: 50, color: [1, 1, 1], max: 0.05 });
        this.emit({ x: p.x, y: p.y, size: 34, endSize: 30, color: palette[1], max: 0.06 });
        if (Math.random() < 0.6) this.emit({ x: p.x, y: p.y, size: 6, endSize: 1, color: palette[0], vx: rand(-200, 200), vy: rand(-200, 200), max: 0.4, gravity: 400 });
        prev = p;
        if (k >= 1) {
          onHit();
          return false;
        }
        return true;
      },
    });
  }

  // ---------- ฟ้าผ่า ----------
  lightning(to: Pt, onHit: () => void, delay: number) {
    this.after(Math.max(0, delay - 0.12), () => {
      const top = { x: to.x + rand(-80, 80), y: -20 };
      const bolt = (a: Pt, b: Pt, segs: number, width: number) => {
        let p = a;
        for (let i = 1; i <= segs; i++) {
          const k = i / segs;
          const q = { x: a.x + (b.x - a.x) * k + (i < segs ? rand(-34, 34) : 0), y: a.y + (b.y - a.y) * k };
          const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 5);
          for (let j = 0; j < n; j++) {
            const r = j / n;
            const x = p.x + (q.x - p.x) * r;
            const y = p.y + (q.y - p.y) * r;
            this.emit({ x, y, size: width * 2.6, endSize: width, color: hex(0x6fd3ff), max: 0.32 });
            this.emit({ x, y, size: width, endSize: width * 0.5, color: [1, 1, 1], max: 0.26 });
          }
          if (i > 2 && i < segs - 1 && Math.random() < 0.45) {
            const br = { x: q.x + rand(-90, 90), y: q.y + rand(40, 110) };
            bolt(q, br, 3, width * 0.55);
          }
          p = q;
        }
      };
      bolt(top, to, 9, 10);
      this.flash(to, 260, '#bfefff', 0.2);
      this.after(0.12, onHit);
    });
  }

  // ---------- ลำดับการยิงทั้งหมด ----------
  shoot(from: Pt | null, to: Pt, kind: 'hit' | 'blocked' | 'counter', lethal: boolean, flight: number, counterTo?: Pt, skin: ShotSkin = 'default') {
    const land = () => {
      if (kind === 'blocked') this.shield(to);
      else if (kind === 'counter' && counterTo) {
        this.shield(to);
        this.projectile(to, counterTo, flight * 0.6, VIOLET, () => this.impact(counterTo, lethal, VIOLET));
      } else this.impact(to, lethal, FIRE, skin);
    };
    if (!from) this.lightning(to, land, flight);
    else if (skin === 'lightning') this.zap(from, to, flight, land);
    else this.projectile(from, to, flight, STYLES[skin]().trail, land);
  }

  // =================== การ์ด ===================

  /** เส้นอนุภาควิ่งจาก a ไป b ในเวลา dur (รอยฟัน/สายลม) */
  private streak(a: Pt, b: Pt, dur: number, palette: RGB[], width: number) {
    let t = 0;
    let prev = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        const n = Math.max(1, Math.ceil(((k - prev) * Math.hypot(b.x - a.x, b.y - a.y)) / 4));
        for (let i = 1; i <= n; i++) {
          const r = prev + ((k - prev) * i) / n;
          const x = a.x + (b.x - a.x) * r;
          const y = a.y + (b.y - a.y) * r;
          this.emit({ x, y, size: width * 1.8, endSize: 1, color: pick(palette), max: 0.32 });
          this.emit({ x, y, size: width * 0.8, endSize: 1, color: [1, 1, 1], max: 0.2 });
        }
        prev = k;
        return k < 1;
      },
    });
  }

  /** ร่ายการ์ดทั่วไป (คนอื่นใช้การ์ด ไม่บอกชนิด) */
  cast(at: Pt, palette = GOLD, fill = 0xffe066) {
    this.ring(at, 70, fill, 0.45, 2);
    this.starBurst(at, 34, fill, 0.45, 8);
    for (let i = 0; i < 26; i++) {
      this.emit({ x: at.x + rand(-28, 28), y: at.y + rand(-10, 20), vx: rand(-40, 40), vy: rand(-260, -90), size: rand(6, 12), color: pick(palette), max: rand(0.6, 1.1), gravity: -80, drag: 1 });
    }
  }

  /** ได้การ์ดใหม่ */
  dealt(at: Pt) {
    this.flash(at, 90, '#fff3a0', 0.3);
    this.burst(at, 30, GOLD, [120, 380], { gravity: 200, size: rand(6, 11) });
    this.ring(at, 60, 0xffcc00, 0.4);
  }

  /** 50/50: ใบมีดฟันตัวเลือกผิดขาด */
  slash(rects: Rect[]) {
    rects.forEach((r, i) => {
      this.after(i * 0.12, () => {
        const a = { x: r.x - 10, y: r.y + r.h * 0.15 };
        const b = { x: r.x + r.w + 10, y: r.y + r.h * 0.85 };
        this.streak(a, b, 0.14, [hex(0xffffff), hex(0xffd6e2), hex(0xff6bd6)], 12);
        this.after(0.14, () => {
          const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
          this.starBurst(c, 34, 0xff6bd6, 0.4, 8);
          this.burst(c, 40, [hex(0xffffff), hex(0xff6bd6), hex(0xffd6e2)], [200, 700], { gravity: 700, size: rand(6, 12) });
          this.onShake?.(5);
        });
      });
    });
  }

  /** ข้ามข้อ: สายลมกวาดผ่านโจทย์ */
  whoosh(r: Rect) {
    for (let i = 0; i < 7; i++) {
      const y = r.y + (r.h * (i + 0.5)) / 7 + rand(-8, 8);
      this.after(i * 0.03, () => this.streak({ x: r.x - 30, y }, { x: r.x + r.w + 30, y: y - rand(10, 30) }, 0.22, ICE, 7));
    }
    this.after(0.2, () => this.burst({ x: r.x + r.w, y: r.y + r.h / 2 }, 30, ICE, [200, 600], { gravity: 0 }));
  }

  /** เพิ่มเวลา: ออร่าทองหมุนรอบตัว + แถบเวลาเรืองทอง */
  goldAura(at: Pt, bar?: Rect) {
    this.cast(at, GOLD, 0xffcc00);
    let t = 0;
    const dur = 1.3;
    this.add({
      update: (dt) => {
        t += dt;
        for (let j = 0; j < 3; j++) {
          const a = t * 9 + (j * Math.PI * 2) / 3;
          const r = 44 + Math.sin(t * 6) * 6;
          this.emit({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r * 0.55 - t * 40, size: 13, endSize: 2, color: pick(GOLD), max: 0.45 });
        }
        return t < dur;
      },
    });
    if (bar) {
      this.after(0.15, () => {
        for (let i = 0; i < 40; i++) {
          this.emit({ x: bar.x + Math.random() * bar.w, y: bar.y + bar.h / 2, vx: rand(-40, 40), vy: rand(-160, -40), size: rand(6, 12), color: pick(GOLD), max: rand(0.5, 1), gravity: -60 });
        }
        this.flash({ x: bar.x + bar.w / 2, y: bar.y + bar.h / 2 }, bar.w * 0.4, '#ffe066', 0.4);
      });
    }
  }

  /** ลดเวลา: กระสุนน้ำแข็งไปหาเป้า */
  iceShot(from: Pt, to: Pt, onHit?: () => void) {
    this.cast(from, ICE, 0x8fe0ff);
    this.projectile(from, to, 0.55, ICE, () => {
      this.iceBurst(to);
      onHit?.();
    });
  }

  iceBurst(at: Pt) {
    this.starBurst(at, 58, 0xbfefff, 0.6, 6);
    this.after(0.04, () => this.starBurst(at, 32, 0xffffff, 0.45, 6));
    this.ring(at, 120, 0x6fd3ff, 0.5, 2);
    this.burst(at, 50, ICE, [200, 700], { gravity: 400, size: rand(6, 12) });
    // เกล็ดหิมะลอยลงช้าๆ
    for (let i = 0; i < 40; i++) {
      this.emit({ x: at.x + rand(-90, 90), y: at.y + rand(-60, 20), vx: rand(-30, 30), vy: rand(10, 60), size: rand(5, 10), color: [1, 1, 1], max: rand(1.2, 2), gravity: 20, drag: 0.5 });
    }
    this.onShake?.(6);
  }

  /** โดนลดเวลา: น้ำแข็งเกาะแถบเวลาของเรา */
  frost(bar: Rect) {
    for (let i = 0; i < 6; i++) {
      this.after(i * 0.05, () => this.starBurst({ x: bar.x + (bar.w * (i + 0.5)) / 6, y: bar.y + bar.h / 2 }, rand(14, 22), 0xdff6ff, 0.9, 6));
    }
    for (let i = 0; i < 60; i++) {
      this.emit({ x: bar.x + Math.random() * bar.w, y: bar.y + bar.h / 2 + rand(-6, 6), vx: rand(-20, 20), vy: rand(-30, 30), size: rand(5, 10), color: pick(ICE), max: rand(0.8, 1.6), drag: 2 });
    }
  }

  /** ยิงสวน: วงเล็งสีม่วงหมุนรอบตัว */
  reticle(at: Pt) {
    this.starBurst(at, 36, 0xb46bff, 0.45, 8);
    const mk = (r: number) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb46bff, transparent: true, depthTest: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.RingGeometry(r - 4, r, 48, 1, 0, Math.PI * 1.6), mat);
      m.position.set(at.x, -at.y, 3);
      m.renderOrder = 9;
      this.scene.add(m);
      return m;
    };
    const outer = mk(58);
    const inner = mk(40);
    let t = 0;
    const dur = 1.4;
    this.add({
      update: (dt) => {
        t += dt;
        const k = t / dur;
        const sc = k < 0.2 ? 1.6 - (k / 0.2) * 0.6 : 1;
        outer.scale.set(sc, sc, 1);
        inner.scale.set(sc, sc, 1);
        outer.rotation.z += dt * 4;
        inner.rotation.z -= dt * 6;
        const o = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        (outer.material as THREE.MeshBasicMaterial).opacity = o;
        (inner.material as THREE.MeshBasicMaterial).opacity = o;
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          this.emit({ x: at.x + Math.cos(a) * 58, y: at.y + Math.sin(a) * 58, size: 9, endSize: 1, color: pick(VIOLET), max: 0.4 });
        }
        return k < 1;
      },
      dispose: () => {
        for (const m of [outer, inner]) {
          this.scene.remove(m);
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      },
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.effects.forEach((e) => e.dispose?.());
    this.effects = [];
    this.geo.dispose();
    this.heartGeo.dispose();
    this.ringGeo.dispose();
    this.flashTex?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
