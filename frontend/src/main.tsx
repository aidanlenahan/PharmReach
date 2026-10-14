import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MedicationHelper } from './MedicationHelper';
import './styles.css';
import './theme.css';
import { applyPalette, getPalette } from './palettes';

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function updateBrowserTheme() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', systemTheme.matches ? '#141518' : '#f7f8fa');
}
updateBrowserTheme();
systemTheme.addEventListener('change', updateBrowserTheme);

// Installable app: the service worker caches pages and data for offline use.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// /styles/?palette=<id> previews the homepage recolored with that palette.
const palette = location.pathname.startsWith('/styles') ? getPalette(new URLSearchParams(location.search).get('palette')) : undefined;
if (palette) applyPalette(palette);

createRoot(document.getElementById('app')!).render(<StrictMode><App /><MedicationHelper /></StrictMode>);
