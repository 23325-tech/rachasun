// ฉากเอฟเฟกต์ 3D ซ้อนทับจอเกม (พิกัดเป็นพิกเซลของจอ: x ขวา, y ลง)
// วาดเฉพาะตอนมีเอฟเฟกต์ ว่างแล้วหยุด requestAnimationFrame
import * as THREE from 'three';

export interface Pt {
  x: number;
  y: number;
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
      this.effects = this.effects.filter((e) => {
        const alive = e.update(dt);
        if (!alive) e.dispose?.();
        return alive;
      });
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
  impact(at: Pt, lethal: boolean, palette = FIRE) {
    const fire = palette === FIRE;
    this.starBurst(at, lethal ? 95 : 70, fire ? 0xffcc00 : 0xc58bff, 0.55);
    this.after(0.05, () => this.starBurst(at, lethal ? 62 : 46, fire ? 0xff5d73 : 0xff6bd6, 0.45, 9));
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
    this.ring(at, lethal ? 210 : 140, 0xffd25c, 0.5, 2);
    this.after(0.08, () => this.ring(at, lethal ? 160 : 105, 0xff5d73, 0.45, 2.4));
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
  shoot(from: Pt | null, to: Pt, kind: 'hit' | 'blocked' | 'counter', lethal: boolean, flight: number, counterTo?: Pt) {
    const land = () => {
      if (kind === 'blocked') this.shield(to);
      else if (kind === 'counter' && counterTo) {
        this.shield(to);
        this.projectile(to, counterTo, flight * 0.6, VIOLET, () => this.impact(counterTo, lethal, VIOLET));
      } else this.impact(to, lethal);
    };
    if (from) this.projectile(from, to, flight, FIRE, land);
    else this.lightning(to, land, flight);
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
