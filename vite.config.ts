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
      includeAssets: ['favicon.svg', 'plixmap-logo.png', 'seed/acme-floor0.svg'],
      manifest: {
        name: 'Plixmap',
        short_name: 'Plixmap',
        description: 'Plixmap — floor plan & asset mapping',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: '/plixmap-logo.png',
            sizes: '1024x1024',
            type: 'image/png',
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
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('node_modules')) return;
          if (normalizedId.includes('react-router') || normalizedId.includes('zustand')) return 'routing-store';
          if (normalizedId.includes('jspdf') || normalizedId.includes('dompurify')) return 'pdf-vendor';
          if (normalizedId.includes('lexical') || normalizedId.includes('@lexical')) return 'editor-vendor';
          if (normalizedId.includes('konva') || normalizedId.includes('react-konva')) return 'canvas-vendor';
          if (normalizedId.includes('lucide-react')) return 'icons';
          return;
        }
      }
    }
  },
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
