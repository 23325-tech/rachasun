import { useEffect, useState } from 'react';
import { ChatCircleText, Copy, Eye, UserMinus, UsersFour } from '@phosphor-icons/react';
import { ensureSession } from '../lib/supabase';
import { t } from '../lib/i18n';

/** Basic ID ของ LINE OA (เช่น @123abcd) ใส่เมื่อได้จากผู้ดูแล ว่าง = ไม่แสดงปุ่มแอดเพื่อน */
const LINE_OA_ID = '';

interface Links {
  links: { id: string; name: string; createdAt: string }[];
  code: { code: string; expiresAt: string } | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(t('th-TH', 'en-GB'), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

/** เชื่อม LINE ผู้ปกครอง: นักเรียนสร้างรหัสเอง (ยินยอม) และยกเลิกได้ทุกเมื่อ */
export function ParentLineSettings() {
  const [data, setData] = useState<Links | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const reload = async () => {
    const sb = await ensureSession();
    const { data: d, error: e } = await sb.rpc('my_parent_links');
    if (e) throw new Error(e.message);
    setData(d as Links);
  };
  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createCode = () =>
    run(async () => {
      const sb = await ensureSession();
      const { error: e } = await sb.rpc('create_parent_code');
      if (e) throw new Error(e.message.includes('too_many_parents') ? t('เชื่อมได้สูงสุด 3 คน', 'Up to 3 parents') : t('สร้างรหัสไม่สำเร็จ', 'Could not create a code'));
      await reload();
    });

  const showPreview = () =>
    run(async () => {
      const sb = await ensureSession();
      const { data: d, error: e } = await sb.functions.invoke<{ text?: string }>('line-weekly', { body: { action: 'preview' } });
      if (e || !d?.text) throw new Error(t('ดูตัวอย่างไม่สำเร็จ', 'Could not load the preview'));
      setPreview(d.text);
    });

  if (!data) return error ? <p className="form-error">{error}</p> : null;

  return (
    <section className="settings-card parent-line">
      <h2 className="section-title section-title--dark">
        <UsersFour weight="fill" className="ico" /> {t('เชื่อม LINE ผู้ปกครอง', 'Parent LINE summary')}
      </h2>
      <p className="muted parent-line__note">
        {t(
          'ผู้ปกครองจะได้รับสรุปทุกวันอาทิตย์ 19:00 น.: วันที่ฝึก จำนวนข้อ ความแม่นยำ บทที่ควรทบทวน และการบ้าน (ไม่มีรายละเอียดอื่น) ยกเลิกได้ทุกเมื่อ',
          'Parents get a summary every Sunday at 19:00: practice days, questions, accuracy, chapters to review and homework (nothing else). You can stop it any time.',
        )}
      </p>

      {data.links.length > 0 && (
        <ul className="parent-line__list">
          {data.links.map((l) => (
            <li key={l.id}>
              <ChatCircleText weight="fill" />
              <span>
                <strong>{l.name || t('ผู้ปกครอง', 'Parent')}</strong>
                <small className="muted">{t(`เชื่อมเมื่อ ${fmt(l.createdAt)}`, `Linked ${fmt(l.createdAt)}`)}</small>
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={busy}
                aria-label={t('ยกเลิกการเชื่อม', 'Unlink')}
                onClick={() =>
                  window.confirm(t(`หยุดส่งสรุปให้ ${l.name || 'ผู้ปกครองคนนี้'}?`, `Stop sending summaries to ${l.name || 'this parent'}?`)) &&
                  run(async () => {
                    const sb = await ensureSession();
                    await sb.rpc('remove_parent_link', { p_id: l.id });
                    await reload();
                  })
                }
              >
                <UserMinus weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {data.code ? (
        <div className="parent-line__code">
          <span>{t('รหัสเชื่อม (ใช้ได้ครั้งเดียว)', 'Link code (single use)')}</span>
          <b>{data.code.code}</b>
          <small className="muted">{t(`หมดอายุ ${fmt(data.code.expiresAt)}`, `Expires ${fmt(data.code.expiresAt)}`)}</small>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(data.code!.code);
                setCopied(true);
              } catch {
                /* คัดลอกไม่ได้ */
              }
            }}
          >
            <Copy weight="bold" className="ico" /> {copied ? t('คัดลอกแล้ว', 'Copied') : t('คัดลอก', 'Copy')}
          </button>
          <ol className="parent-line__steps">
            <li>
              {t('ผู้ปกครองแอดเพื่อน LINE OA ของ Brain Gym', 'Your parent adds the Brain Gym LINE OA as a friend')}
              {LINE_OA_ID && (
                <>
                  {' '}
                  <a href={`https://line.me/R/ti/p/${encodeURIComponent(LINE_OA_ID)}`} target="_blank" rel="noreferrer">
                    {LINE_OA_ID}
                  </a>
                </>
              )}
            </li>
            <li>{t('พิมพ์รหัสนี้ส่งในแชท', 'They send this code in the chat')}</li>
          </ol>
        </div>
      ) : (
        data.links.length < 3 && (
          <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={createCode}>
            {t('สร้างรหัสเชื่อมผู้ปกครอง', 'Create a parent link code')}
          </button>
        )
      )}

      <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={showPreview}>
        <Eye weight="bold" className="ico" /> {t('ดูตัวอย่างสรุปที่ผู้ปกครองจะได้รับ', 'Preview what parents receive')}
      </button>
      {preview && <pre className="parent-line__preview">{preview}</pre>}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
