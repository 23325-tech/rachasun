import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // เปิดให้มือถือในวง Wi-Fi เดียวกันเข้ามาทดสอบได้
    host: true,
  },
});
