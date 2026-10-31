import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    host: true,
    // Same-origin API in development: /api/* is forwarded to the Express server.
    proxy: { '/api': { target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:4000', changeOrigin: false } },
  },
  preview: { port: 4173 },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
});
