import { useEffect, useState, type ReactNode } from 'react';

export function AppShell({ children, active = 'home', onboarding = false, landing = false }: { children: ReactNode; active?: string; onboarding?: boolean; landing?: boolean }) {
  const [notice, setNotice] = useState('');
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
        <a href="/" className="brand" style={{ textDecoration: 'none' }}><span className="brand-mark">✳</span>PharmReach</a>
        {onboarding ? <span className="setup-header">Make it work for you</span> : landing ? <nav className="nav landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="/products.html">Browse products</a>
          <a className="landing-nav-cta" href="#find-medicine">Find medicine <span aria-hidden="true">↗</span></a>
        </nav> : <nav className="nav" aria-label="Main navigation">
          <a className={active === 'home' ? 'current' : ''} href="/">Find medication</a>
          <a className={active === 'products' ? 'current' : ''} href="/products.html">Products</a>
          <a className={active === 'settings' ? 'current' : ''} href="/settings.html">Settings</a>
        </nav>}
      </header>
      {children}
    </div>
    {notice && <div className="toast show" role="status">{notice}</div>}
    {landing ? <footer className="landing-footer"><div><a className="brand" href="/"><span className="brand-mark">✳</span>PharmReach</a><p>Over-the-counter medicine. Closer to home.</p></div><nav aria-label="Footer navigation"><a href="/products.html">Products</a><a href="/settings.html">Travel preferences</a><a href="#find-medicine">Find medicine ↗</a></nav><span>Hoboken &amp; nearby Hudson County, NJ</span></footer> : <footer className="demo-footer">PharmReach</footer>}
  </>;
}
