import type { Subject } from '../types';
import { subjectInfo } from '../data/subjects';
import { TCAS_BY_KEY } from '../data/tcas';
import { t } from '../lib/i18n';
import type { DreamFocus } from '../lib/dream';

/** สัดส่วนรอบฝึกต่อวิชาตามเป้า + วิชาที่ต้องฝึกนอกเว็บ */
export function DreamFocusBars({ focus }: { focus: DreamFocus }) {
  const rows = (Object.entries(focus.weights) as [Subject, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <div className="dream-focus">
      <ul className="dream-focus__bars">
        {rows.map(([s, pct]) => {
          const info = subjectInfo(s, 'upper');
          return (
            <li key={s}>
              <span className="dream-focus__name">
                <info.icon weight="fill" size={15} color={info.color} /> {info.name}
              </span>
              <span className="dream-focus__track">
                <span style={{ width: `${pct}%`, background: info.color }} />
              </span>
              <b>{pct}%</b>
            </li>
          );
        })}
      </ul>
      {focus.offsite.length > 0 && (
        <p className="muted dream-focus__off">
          {t('ยังฝึกในเว็บไม่ได้ (เตรียมเองเพิ่ม)', 'Not practiceable here yet (prepare separately)')}: {focus.offsite.map((k) => TCAS_BY_KEY[k]?.name() ?? k).join(', ')}
        </p>
      )}
    </div>
  );
}
