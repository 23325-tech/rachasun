// วาดภาพหน้าตัวละคร (ครึ่งตัว) เป็นรูปนิ่ง ใช้ในรายชื่อผู้เล่น/ตารางอันดับ
// ใช้ renderer ตัวเดียวทั้งแอพ + แคชตามรหัสหน้าตา จึงเบาแม้มีผู้เล่นหลายคน
import * as THREE from 'three';
import { createChibi } from './chibi';
import { createPet, type PetKind } from './pets';
import { chibiOf } from '../lib/look';

const SIZE = 192;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let fullCamera: THREE.PerspectiveCamera;
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
  // เต็มตัว (เห็นชุดและของในมือ)
  fullCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  fullCamera.position.set(0, 1.3, 5.6);
  fullCamera.lookAt(0, 1.08, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f7cc8, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.5, 4, 3);
  scene.add(key);
}

/** คืน data URL ของภาพหน้าตัวละคร */
export function portraitOf(code: string, framing: 'bust' | 'full' = 'bust'): Promise<string> {
  const key = `${framing}:${code}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  // วาดทีละตัวตามคิว (ใช้ renderer เดียวกัน)
  const job = queue.then(() => {
    if (!renderer) setup();
    const chibi = createChibi(chibiOf(code));
    chibi.root.rotation.y = -0.25;
    chibi.update(0.4);
    scene.add(chibi.root);
    renderer!.render(scene, framing === 'full' ? fullCamera : camera);
    const url = renderer!.domElement.toDataURL('image/png');
    scene.remove(chibi.root);
    chibi.dispose();
    cache.set(key, url);
    pending.delete(key);
    return url;
  });
  queue = job.catch(() => {});
  pending.set(key, job);
  return job;
}

let petCamera: THREE.PerspectiveCamera | null = null;
/** ภาพนิ่งสัตว์เลี้ยงตัวเดียว */
export function petPortraitOf(kind: PetKind): Promise<string> {
  const key = `pet:${kind}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  const job = queue.then(() => {
    if (!renderer) setup();
    if (!petCamera) {
      petCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
      petCamera.position.set(0, 0.05, 1.45);
      petCamera.lookAt(0, 0.02, 0);
    }
    const pet = createPet(kind);
    if (!pet) return '';
    pet.update(0.3, 'idle');
    scene.add(pet.root);
    renderer!.render(scene, petCamera);
    const url = renderer!.domElement.toDataURL('image/png');
    scene.remove(pet.root);
    pet.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    cache.set(key, url);
    pending.delete(key);
    return url;
  });
  queue = job.catch(() => {});
  pending.set(key, job);
  return job;
}
