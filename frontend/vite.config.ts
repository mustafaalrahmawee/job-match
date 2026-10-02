import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
// defineConfig aus vitest/config, damit der test-Abschnitt mitgetypt wird.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Der Dev-Server liefert das Frontend und leitet /api an das Backend weiter – damit
    // laufen Entwicklung und Produktion unter demselben Ursprung (keine CORS-Regeln nötig).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
});
