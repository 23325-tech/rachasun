import { useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';

type Part = { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean };

const MATH_PATTERN = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

function splitMath(source: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of source.matchAll(MATH_PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ kind: 'text', value: source.slice(last, start) });
    const raw = m[0];
    const display = raw.startsWith('$$');
    parts.push({ kind: 'math', value: raw.slice(display ? 2 : 1, display ? -2 : -1), display });
    last = start + raw.length;
  }
  if (last < source.length) parts.push({ kind: 'text', value: source.slice(last) });
  return parts;
}

/** แสดงข้อความที่ผสม LaTeX ($...$ และ $$...$$) รวมถึงสมการเคมี \ce{...} */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => splitMath(text), [text]);
  return (
    <span className={className ? `math-text ${className}` : 'math-text'}>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span
            key={i}
            className={p.display ? 'math-display' : undefined}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.value, { displayMode: p.display, throwOnError: false }),
            }}
          />
        ),
      )}
    </span>
  );
}
