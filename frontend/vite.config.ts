import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { loadingFrame } from './loading-frame.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

// Publish just the location fields for the homepage map, refreshed on each build.
function locationSnapshot() {
  type Store = {
    id: string; name: string; merchant: string; address: string;
    latitude: number; longitude: number; location_source?: string; coordinates_note?: string;
  };
  const locations = ['cvs-data.json', 'walgreens-data.json'].flatMap((filename) => {
    const data = JSON.parse(readFileSync(resolve(rootDir, '../backend/data', filename), 'utf8')) as { pharmacies: Store[] };
    return data.pharmacies.map(({ id, name, merchant, address, latitude, longitude, location_source, coordinates_note }) => ({
      id, name, merchant, address, latitude, longitude, location_source, coordinates_note,
    }));
  });
  return JSON.stringify({ locations });
}

function locationsAsset(): Plugin {
  return {
    name: 'pharmacy-locations',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/locations.json') return next();
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(locationSnapshot());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'locations.json', source: locationSnapshot() });
    },
  };
}

// Serve /results etc. from results.html in dev and preview, matching backend/serve.py.
const cleanPages = new Set(['find-medicine', 'results', 'settings', 'privacy', 'onboarding', 'products']);
function cleanUrls(): Plugin {
  const rewrite = (middlewares: { use: (handler: (request: { url?: string }, response: unknown, next: () => void) => void) => void }) => {
    middlewares.use((request, _response, next) => {
      const [path, query] = (request.url || '').split('?');
      if (cleanPages.has(path.slice(1))) request.url = `${path}.html${query ? `?${query}` : ''}`;
      next();
    });
  };
  return { name: 'clean-urls', configureServer: (server) => rewrite(server.middlewares), configurePreviewServer: (server) => rewrite(server.middlewares) };
}

export default defineConfig(({ mode }) => {
  // The browser Maps key lives in the repo-root .env next to the backend keys.
  const env = loadEnv(mode, resolve(rootDir, '..'), '');
  const mapsKey = env.VITE_GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || env.GOOGLE_API_KEY || '';
  return {
    root: rootDir,
    plugins: [react(), cleanUrls(), locationsAsset(), loadingFrame(rootDir)],
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
          forbidden: resolve(rootDir, '403.html'),
          notFound: resolve(rootDir, '404.html'),
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
