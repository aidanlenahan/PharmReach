import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MedicationHelper } from './MedicationHelper';
import { DisclaimerFooter } from './components/DisclaimerFooter';
import './styles.css';
import './theme.css';

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function updateBrowserTheme() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', systemTheme.matches ? '#141518' : '#f7f8fa');
}
updateBrowserTheme();
systemTheme.addEventListener('change', updateBrowserTheme);

createRoot(document.getElementById('app')!).render(<StrictMode><App /><DisclaimerFooter /><MedicationHelper /></StrictMode>);
