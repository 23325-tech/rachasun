import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: [
      // ใช้ชุดไอคอนที่สร้างเฉพาะตัวที่ใช้ (scripts/gen-icons.mjs) แทน Phosphor เต็มชุด
      {
        find: /^@phosphor-icons\/react$/,
        // path ของไฟล์ (แปลงจาก file:// และตัด / หน้าอักษรไดรฟ์บน Windows)
        replacement: decodeURIComponent(new URL('./src/components/phosphor.generated.tsx', import.meta.url).pathname).replace(
          /^\/([A-Za-z]:)/,
          '$1',
        ),
      },
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png', 'img/*.svg'],
      manifest: {
        name: 'Brain Gym - ฝึกโจทย์แข่งกับเพื่อน',
        short_name: 'Brain Gym',
        description: 'ฝึกโจทย์คณิต ฟิสิกส์ เคมี ชีวะ อังกฤษ แล้วดวลกับเพื่อนแบบยิงหัวใจ',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#5b2bd9',
        background_color: '#6a3df0',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // เก็บไฟล์แอพทั้งหมดไว้ในเครื่อง เปิดได้แม้ไม่มีเน็ต (รวมฟอนต์ KaTeX)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // หน้าต้นแบบดีไซน์ (three.js) ไม่ต้องโหลดเก็บไว้ในเครื่องผู้เล่นทุกคน
        globIgnores: ['**/LabScreen-*'],
        navigateFallback: '/index.html',
        // ตัวรับแจ้งเตือน Web Push (public/push-sw.js)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // ฟอนต์ Mitr จาก Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // แยกไลบรารีใหญ่ออกจากโค้ดแอพ ให้โหลดเร็วขึ้นและแคชแยกกัน
        manualChunks: {
          katex: ['katex'],
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    // เปิดให้มือถือในวง Wi-Fi เดียวกันเข้ามาทดสอบได้
    host: true,
  },
});
