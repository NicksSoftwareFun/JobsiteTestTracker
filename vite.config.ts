import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
// In production the app is served from a GitHub Pages project subpath
// (https://<user>.github.io/JobsiteTestTracker/), so assets/SW/manifest need
// that base. Dev/preview stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/JobsiteTestTracker/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Warwick QC Test Reports',
        short_name: 'QC Reports',
        description:
          'Fill test reports, mark up drawings, sign, and export a single closeout document.',
        theme_color: '#1f3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + assets cached for offline launch on the jobsite.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,mjs}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  // pdf.js ships an ESM worker we resolve with ?url in renderDrawing.ts
  optimizeDeps: { include: ['pdfjs-dist'] },
}));
