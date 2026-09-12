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
    rolldownOptions: {
      output: {
        // Explicit vendor groups (rolldown `advancedChunks`). The goal is that the
        // login/home route only downloads the React runtime + routing, and each
        // heavy library (Konva, jsPDF, Lexical, html2canvas) is fetched only by the
        // route that actually uses it.
        advancedChunks: {
          groups: [
            { name: 'react-vendor', test: /node_modules\/(react|react-dom|scheduler)\//, priority: 100 },
            { name: 'routing-store', test: /node_modules\/(react-router|react-router-dom|zustand|use-sync-external-store)\//, priority: 90 },
            { name: 'canvas-vendor', test: /node_modules\/(konva|react-konva|react-reconciler|its-fine|use-image)\//, priority: 80 },
            { name: 'pdf-vendor', test: /node_modules\/(jspdf|fflate|pako|fast-png|iobuffer|canvg|svg-pathdata|stackblur-canvas|rgbcolor|raf|performance-now|core-js|@babel\/runtime)\//, priority: 80 },
            { name: 'editor-vendor', test: /node_modules\/(lexical|@lexical)\//, priority: 80 },
            { name: 'html2canvas', test: /node_modules\/html2canvas\//, priority: 80 },
            { name: 'ui-vendor', test: /node_modules\/(@headlessui|@floating-ui|react-aria|react-stately|sonner)\//, priority: 70 },
            { name: 'icons', test: /node_modules\/lucide-react\//, priority: 70 }
          ]
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
