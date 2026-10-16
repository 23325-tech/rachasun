import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createChibi, type Chibi, type ChibiLook } from '../three/chibi';

interface Props {
  look: ChibiLook;
  /** ลากหมุนดูได้ */
  interactive?: boolean;
  /** 0..1 ท่าดีใจ (กระโดด โบกมือ) */
  cheer?: number;
  className?: string;
  /** มุมกล้อง: เต็มตัว หรือครึ่งตัว (เห็นหน้าชัด) */
  framing?: 'full' | 'bust';
}

/** แสดงตัวละคร 3D ในกรอบ (ปรับขนาดตามกล่องที่ครอบ) */
export function Avatar3D({ look, interactive = false, cheer = 0, className, framing = 'full' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chibiRef = useRef<Chibi | null>(null);
  const cheerRef = useRef(cheer);
  cheerRef.current = cheer;

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const target = framing === 'bust' ? new THREE.Vector3(0, 1.4, 0) : new THREE.Vector3(0, 1.05, 0);
    camera.position.set(0, framing === 'bust' ? 1.55 : 1.35, framing === 'bust' ? 3.6 : 6.2);
    camera.lookAt(target);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f7cc8, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb9a6ff, 1.2);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    const chibi = createChibi(look);
    chibiRef.current = chibi;
    chibi.root.rotation.y = -0.35;
    scene.add(chibi.root);

    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.enableDamping = true;
      controls.minPolarAngle = Math.PI * 0.32;
      controls.maxPolarAngle = Math.PI * 0.55;
      controls.update();
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // หยุดวาดเมื่อเลื่อนพ้นจอ (ประหยัดแบต)
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      chibi.update(t, cheerRef.current);
      if (!interactive) chibi.root.rotation.y = -0.35 + Math.sin(t * 0.5) * 0.25;
      controls?.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls?.dispose();
      chibi.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      chibiRef.current = null;
    };
    // สร้างฉากครั้งเดียว การแต่งตัวเปลี่ยนผ่าน setLook ด้านล่าง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, framing]);

  useEffect(() => {
    chibiRef.current?.setLook(look);
  }, [look]);

  return <div ref={hostRef} className={className ?? 'avatar3d'} />;
}
