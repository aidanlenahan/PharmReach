import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:4173' },
  },
  build: {
    outDir: resolve(rootDir, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(rootDir, 'index.html'),
        results: resolve(rootDir, 'results.html'),
        settings: resolve(rootDir, 'settings.html'),
        onboarding: resolve(rootDir, 'onboarding.html'),
        products: resolve(rootDir, 'products.html'),
        styles: resolve(rootDir, 'styles/index.html'),
      },
    },
  },
});
