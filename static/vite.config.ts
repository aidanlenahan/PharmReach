import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { loadingFrame } from './loading-frame.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

// Serve /results etc. from results.html in dev and preview, the way GitHub Pages does.
const cleanPages = new Set(['find-medicine', 'results', 'settings', 'privacy', 'onboarding', 'products']);
function cleanUrls(): Plugin {
  const rewrite = (middlewares: { use: (handler: (request: { url?: string }, response: unknown, next: () => void) => void) => void }) => {
    middlewares.use((request, _response, next) => {
      const [path, query] = (request.url || '').split('?');
      const name = path.split('/').pop() || '';
      if (cleanPages.has(name)) request.url = `${path}.html${query ? `?${query}` : ''}`;
      next();
    });
  };
  return { name: 'clean-urls', configureServer: (server) => rewrite(server.middlewares), configurePreviewServer: (server) => rewrite(server.middlewares) };
}

export default defineConfig(({ mode }) => {
  // The browser Maps key: VITE_GOOGLE_MAPS_API_KEY from the environment (a repo secret in CI)
  // or the repo-root .env for local builds.
  const env = loadEnv(mode, resolve(rootDir, '..'), '');
  const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || env.GOOGLE_API_KEY || '';
  return {
    root: rootDir,
    // Relative asset URLs: the same build works at a domain root or under /PharmReach/.
    base: './',
    plugins: [react(), cleanUrls(), loadingFrame(rootDir)],
    define: { 'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsKey) },
    server: { port: 5174 },
    preview: { port: 4174 },
    build: {
      outDir: resolve(rootDir, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: Object.fromEntries(['index', 'find-medicine', 'results', 'settings', 'privacy', 'onboarding', 'products']
          .map((name) => [name, resolve(rootDir, `${name}.html`)])),
      },
    },
  };
});
