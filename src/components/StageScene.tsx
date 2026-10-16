import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { createChibi, type Chibi, type Pose } from '../three/chibi';
import { chibiOf } from '../lib/look';

export interface StageActor {
  code: string;
  pose?: Pose;
}

interface Props {
  actors: StageActor[];
  /** row = เรียงแถว (หน้า VS, เกิน 4 คนขึ้น 2 แถว) / podium = แท่นรางวัล 3 อันดับ (ลำดับ actors = ที่ 1, 2, 3) */
  layout: 'row' | 'podium';
  className?: string;
  /** ป้ายชื่อใต้ตัวละคร (ตามลำดับ actors) */
  labels?: ReactNode[];
}

const SPACING = 1.45;

/** ตำแหน่งตัวละคร (x, y, z) และจำนวนคอลัมน์ต่อแถว ใช้วางชื่อใต้ตัวให้ตรงกัน */
export function stageSlots(n: number, layout: Props['layout']): { pos: [number, number, number]; scale: number }[] {
  if (layout === 'podium') {
    // ที่ 1 กลางสูงสุด ที่ 2 ซ้าย ที่ 3 ขวา
    const spots: [number, number, number][] = [
      [0, 0.55, 0],
      [-SPACING, 0.3, 0],
      [SPACING, 0.12, 0],
    ];
    return spots.slice(0, n).map((pos) => ({ pos, scale: 1 }));
  }
  if (n <= 4) return Array.from({ length: n }, (_, i) => ({ pos: [(i - (n - 1) / 2) * SPACING, 0, 0], scale: 1 }));
  const top = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const back = i < top;
    const cols = back ? top : n - top;
    const col = back ? i : i - top;
    // แถวหลังสูงกว่าและอยู่ลึกเข้าไป
    return { pos: [(col - (cols - 1) / 2) * SPACING, back ? 1.75 : -1.1, back ? -1 : 0.6], scale: 1 };
  });
}

/** ฉากเดียวที่มีตัวละครหลายตัว (ประหยัดกว่าเปิดหลายผืนผ้าใบ) */
export function StageScene({ actors, layout, className, labels }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posesRef = useRef<Pose[]>([]);
  posesRef.current = actors.map((a) => a.pose ?? 'idle');
  const key = actors.map((a) => a.code).join('|');

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f7cc8, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 4, 4);
    scene.add(key);

    const slots = stageSlots(actors.length, layout);
    const chibis: Chibi[] = actors.map((a, i) => {
      const c = createChibi(chibiOf(a.code));
      c.root.position.set(...slots[i].pos);
      c.root.rotation.y = (slots[i].pos[0] > 0 ? -1 : slots[i].pos[0] < 0 ? 1 : 0) * 0.18;
      scene.add(c.root);
      return c;
    });
    if (layout === 'podium') {
      // แท่นสีทอง/เงิน/ทองแดง
      const colors = [0xffcc00, 0xc9cfdc, 0xe0a070];
      slots.forEach((s, i) => {
        const h = s.pos[1] + 0.6;
        const block = new THREE.Mesh(new THREE.BoxGeometry(1.25, h, 1.1), new THREE.MeshToonMaterial({ color: colors[i] }));
        block.position.set(s.pos[0], s.pos[1] - h / 2, 0);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry), new THREE.LineBasicMaterial({ color: 0x2b1a4a }));
        block.add(edges);
        scene.add(block);
      });
    }

    // กล้องมุมฉาก: ทุกตัวขนาดเท่ากัน วางชื่อตามคอลัมน์ได้ตรง
    const xs = slots.map((s) => s.pos[0]);
    const halfW = Math.max(2.2, Math.max(...xs.map(Math.abs)) + SPACING * 0.62);
    const camera = new THREE.OrthographicCamera(-halfW, halfW, 1, -1, 0.1, 50);
    const top = Math.max(...slots.map((s) => s.pos[1])) + (layout === 'podium' ? 2.75 : 2.35);
    const bottom = Math.min(...slots.map((s) => s.pos[1])) - (layout === 'podium' ? 0.75 : 0.15);
    camera.position.set(0, (top + bottom) / 2 + 0.6, 10);
    camera.lookAt(0, (top + bottom) / 2, 0);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      // ปรับความสูงตามสัดส่วนจอ ให้ความกว้างพอดีเสมอ
      const halfH = (halfW * height) / width;
      const needH = (top - bottom) / 2;
      const s = Math.max(1, needH / halfH);
      camera.left = -halfW * s;
      camera.right = halfW * s;
      camera.top = halfH * s;
      camera.bottom = -halfH * s;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ตำแหน่งป้ายชื่อ: แปลงตำแหน่งเท้าตัวละครเป็นพิกัดบนจอ
    const feet = new THREE.Vector3();
    const placeLabels = () => {
      const { width, height } = host.getBoundingClientRect();
      chibis.forEach((c, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        feet.copy(c.root.position);
        // แท่นรางวัล: วางป้ายชื่อบนหน้าแท่น
        if (layout === 'podium') feet.set(feet.x, feet.y - 0.3, 0.55);
        feet.project(camera);
        el.style.left = `${((feet.x + 1) / 2) * width}px`;
        el.style.top = `${((1 - feet.y) / 2) * height}px`;
      });
    };

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const t = clock.getElapsedTime();
      chibis.forEach((c, i) => c.update(t + i * 0.37, 0, posesRef.current[i]));
      renderer.render(scene, camera);
      placeLabels();
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      chibis.forEach((c) => c.dispose());
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // ฉากสร้างใหม่เมื่อรายชื่อเปลี่ยน (ท่าทางเปลี่ยนผ่าน posesRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, layout]);

  return (
    <div ref={hostRef} className={className ?? 'stage-scene'}>
      {labels?.map((l, i) => (
        <div key={i} ref={(el) => {
            labelRefs.current[i] = el;
          }} className="stage-label">
          {l}
        </div>
      ))}
    </div>
  );
}
