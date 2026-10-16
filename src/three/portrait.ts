// วาดภาพหน้าตัวละคร (ครึ่งตัว) เป็นรูปนิ่ง ใช้ในรายชื่อผู้เล่น/ตารางอันดับ
// ใช้ renderer ตัวเดียวทั้งแอพ + แคชตามรหัสหน้าตา จึงเบาแม้มีผู้เล่นหลายคน
import * as THREE from 'three';
import { createChibi } from './chibi';
import { chibiOf } from '../lib/look';

const SIZE = 192;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  camera.position.set(0, 1.62, 4.1);
  camera.lookAt(0, 1.38, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f7cc8, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.5, 4, 3);
  scene.add(key);
}

/** คืน data URL ของภาพหน้าตัวละคร */
export function portraitOf(code: string): Promise<string> {
  const hit = cache.get(code);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(code);
  if (p) return p;
  // วาดทีละตัวตามคิว (ใช้ renderer เดียวกัน)
  const job = queue.then(() => {
    if (!renderer) setup();
    const chibi = createChibi(chibiOf(code));
    chibi.root.rotation.y = -0.25;
    chibi.update(0.4);
    scene.add(chibi.root);
    renderer!.render(scene, camera);
    const url = renderer!.domElement.toDataURL('image/png');
    scene.remove(chibi.root);
    chibi.dispose();
    cache.set(code, url);
    pending.delete(code);
    return url;
  });
  queue = job.catch(() => {});
  pending.set(code, job);
  return job;
}
