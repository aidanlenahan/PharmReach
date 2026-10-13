import { href } from '../base';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { searchEntry } from '../core';
import { AppFooter } from './AppFooter';
import { Brand } from './Brand';
import { InfoMenu } from './InfoMenu';

export function AppShell({ children, active = 'home', onboarding = false, landing = false }: { children: ReactNode; active?: string; onboarding?: boolean; landing?: boolean }) {
  const [notice, setNotice] = useState('');
  const entry = searchEntry();
  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setNotice(message);
      window.setTimeout(() => setNotice((current) => current === message ? '' : current), 2200);
    };
    window.addEventListener('pharmreach:toast', handler);
    return () => window.removeEventListener('pharmreach:toast', handler);
  }, []);
  return <>
    <div className="shell">
      <header className="topbar">
        <Brand />
        {onboarding ? <div className="setup-header-group"><span className="setup-header">Make it work for you</span><InfoMenu /></div> : landing ? <nav className="nav landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href={href('/products')}>Browse products</a>
          <a className="landing-nav-cta" href={entry.href}>{entry.label} <ArrowUpRight size={16} aria-hidden="true" /></a>
          <InfoMenu />
        </nav> : <nav className="nav" aria-label="Main navigation">
          <a className={active === 'home' ? 'current' : ''} href={href('/find-medicine')}>Find medication</a>
          <a className={active === 'products' ? 'current' : ''} href={href('/products')}>Products</a>
          <a className={active === 'settings' ? 'current' : ''} href={href('/settings')}>Settings</a>
          <InfoMenu />
        </nav>}
      </header>
      {children}
    </div>
    {notice && <div className="toast show" role="status">{notice}</div>}
    <AppFooter />
  </>;
}
