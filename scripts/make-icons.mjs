// สร้างไอคอน PWA (PNG) จาก public/icon.svg  ใช้: npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const sizes = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

for (const [name, size] of sizes) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(name));
  console.log('wrote', name);
}
