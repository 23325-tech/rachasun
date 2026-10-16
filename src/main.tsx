import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// เมื่อมีเวอร์ชันใหม่ขึ้นเว็บ ให้โหลดหน้าใหม่เองทันที ผู้เล่นจะได้ไม่ค้างอยู่ที่ไฟล์เก่าในเครื่อง
registerSW({ immediate: true });

// หน้าต้นแบบดีไซน์ (?lab) โหลดแยกไฟล์ three.js จะไม่ถูกโหลดในหน้าปกติ
const LabScreen = lazy(() => import('./screens/LabScreen'));
const isLab = new URLSearchParams(window.location.search).has('lab');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isLab ? (
      <Suspense fallback={null}>
        <LabScreen />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
