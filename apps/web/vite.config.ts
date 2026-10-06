/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin API in development, so SameSite=strict cookies just work.
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    sourcemap: true,
    // recharts is lazy-loaded on chart pages only; the initial bundle stays far below the 250 KB budget.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Charts load only on pages that use them (NFR-8 bundle budget).
        manualChunks: { charts: ['recharts'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
});
