import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// เมื่อมีเวอร์ชันใหม่ขึ้นเว็บ ให้โหลดหน้าใหม่เองทันที ผู้เล่นจะได้ไม่ค้างอยู่ที่ไฟล์เก่าในเครื่อง
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
