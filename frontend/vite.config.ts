import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // The browser Maps key lives in the repo-root .env next to the backend keys.
  const env = loadEnv(mode, resolve(rootDir, '..'), '');
  const mapsKey = env.VITE_GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || env.GOOGLE_API_KEY || '';
  return {
    root: rootDir,
    plugins: [react()],
    define: { 'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsKey) },
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
          findMedicine: resolve(rootDir, 'find-medicine.html'),
          results: resolve(rootDir, 'results.html'),
          settings: resolve(rootDir, 'settings.html'),
          privacy: resolve(rootDir, 'privacy.html'),
          onboarding: resolve(rootDir, 'onboarding.html'),
          products: resolve(rootDir, 'products.html'),
          styles: resolve(rootDir, 'styles/index.html'),
        },
      },
    },
  };
});
