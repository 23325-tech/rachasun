// สร้างชุดไอคอนเฉพาะตัวที่แอพใช้ (เฉพาะน้ำหนัก fill / bold) จาก @phosphor-icons/react
// ไอคอนของ Phosphor แต่ละตัวพก path ครบ 6 น้ำหนัก ทำให้ไฟล์หลักใหญ่ขึ้นมาก
// วิธีใช้: npm run icons:gen  (รันใหม่ทุกครั้งที่ใช้ไอคอนตัวใหม่ ไม่งั้น build จะแจ้งว่าไม่พบไอคอน)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');
const OUT = join(SRC, 'components', 'phosphor.generated.tsx');
const DEFS = join(ROOT, 'node_modules', '@phosphor-icons', 'react', 'dist', 'defs');
const WEIGHTS = ['fill', 'bold'];

// 1) หาชื่อไอคอนจาก import ทุกไฟล์ใน src
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const names = new Set();
for (const f of walk(SRC).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('phosphor.generated.tsx'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from\s*'@phosphor-icons\/react'/g)) {
    for (const raw of m[1].split(',')) {
      const n = raw.trim();
      if (n && !n.startsWith('type ') && /^[A-Z]/.test(n)) names.add(n);
    }
  }
}

// 2) ดึงรูปทรงของแต่ละน้ำหนักจาก defs ของ Phosphor (เป็น React element) แปลงเป็นข้อมูลล้วน
const React = (await import('react')).default;
const toData = (el) => {
  if (!el || typeof el !== 'object') return [];
  if (el.type === React.Fragment) return [].concat(el.props.children ?? []).flatMap(toData);
  const { children, ...props } = el.props;
  return [[el.type, props, ...(children ? [].concat(children).flatMap(toData) : [])]];
};
const icons = {};
for (const name of [...names].sort()) {
  const mod = await import(pathToFileURL(join(DEFS, `${name}.mjs`)).href).catch(() => null);
  if (!mod) throw new Error(`ไม่พบไอคอน ${name} ใน @phosphor-icons/react`);
  const map = mod.default;
  icons[name] = Object.fromEntries(WEIGHTS.map((w) => [w, toData(map.get(w))]));
}

// 3) เขียนไฟล์ไอคอน (ใช้ props แบบเดียวกับ Phosphor: size / color / weight / className / mirrored)
const out = `// ไฟล์นี้สร้างอัตโนมัติด้วย scripts/gen-icons.mjs — ห้ามแก้เอง
// มีเฉพาะไอคอนที่แอพใช้ และเฉพาะน้ำหนัก ${WEIGHTS.join(' / ')} (ไฟล์เล็กกว่า Phosphor เต็มชุดมาก)
import { createElement, forwardRef, type ForwardRefExoticComponent, type RefAttributes, type SVGProps } from 'react';

export type IconWeight = ${WEIGHTS.map((w) => `'${w}'`).join(' | ')} | 'regular' | 'thin' | 'light' | 'duotone';
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  color?: string;
  weight?: IconWeight;
  mirrored?: boolean;
  alt?: string;
}
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

type Shape = [string, Record<string, string>, ...Shape[]];
const draw = (s: Shape, i: number): ReturnType<typeof createElement> =>
  createElement(s[0], { key: i, ...s[1] }, ...(s.slice(2) as Shape[]).map(draw));

function make(name: string, shapes: Record<string, Shape[]>): Icon {
  const C = forwardRef<SVGSVGElement, IconProps>(({ size = '1em', color = 'currentColor', weight = 'bold', mirrored, alt, children, ...rest }, ref) =>
    createElement(
      'svg',
      {
        ref,
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        fill: color,
        viewBox: '0 0 256 256',
        transform: mirrored ? 'scale(-1, 1)' : undefined,
        ...rest,
      },
      alt ? createElement('title', null, alt) : null,
      children,
      // น้ำหนักที่ไม่ได้สร้างไว้ ใช้ bold แทน
      ...(shapes[weight] ?? shapes.bold).map(draw),
    ),
  );
  C.displayName = name;
  return C as Icon;
}

${Object.entries(icons)
  .map(([n, s]) => `export const ${n} = make('${n}', ${JSON.stringify(s)} as Record<string, Shape[]>);`)
  .join('\n')}
`;
writeFileSync(OUT, out);
console.log(`สร้าง ${Object.keys(icons).length} ไอคอน -> ${OUT}`);
