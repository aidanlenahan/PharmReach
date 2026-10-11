import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell';
import './styles.css';
import './theme.css';
import './error.css';

const forbidden = document.documentElement.dataset.errorCode === '403';
const code = forbidden ? '403' : '404';
const title = forbidden ? 'Access denied' : 'Page not found';
const message = forbidden
  ? 'This page isn’t available. You can return home or search for medicine nearby.'
  : 'We couldn’t find this page. Check the address or search for medicine nearby.';

createRoot(document.getElementById('app')!).render(<StrictMode>
  <AppShell active="error">
    <main className="error-page" aria-labelledby="error-title">
      <p className="error-code">{code}</p>
      <h1 id="error-title">{title}</h1>
      <p className="error-message">{message}</p>
      <a className="primary error-home" href="/">Back to home</a>
    </main>
  </AppShell>
</StrictMode>);
