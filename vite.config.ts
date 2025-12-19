import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'seed/acme-floor0.svg'],
      manifest: {
        name: 'Deskly',
        short_name: 'Deskly',
        description: 'Deskly — floor plan & asset mapping',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      injectManifest: {
        sourcemap: true,
        minify: false,
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/uploads': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
});
