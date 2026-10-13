import { href } from '../base';
import { ArrowUpRight } from 'lucide-react';
import { searchEntry } from '../core';
import { Brand } from './Brand';
import './footer.css';

export function AppFooter() {
  const entry = searchEntry();
  return <footer className="app-footer">
    <div><Brand /><p>Over-the-counter medicine. Closer to home.</p></div>
    <nav aria-label="Footer navigation">
      <a href={href('/about')}>About</a>
      <a href={href('/disclaimer')}>Disclaimer</a>
      <a href={href('/privacy')}>Privacy &amp; browser storage</a>
      <a href={href('/products')}>Products</a>
      <a href={href('/settings')}>Travel preferences</a>
      <a className="footer-search" href={entry.href}>{entry.label} <ArrowUpRight size={14} aria-hidden="true" /></a>
    </nav>
    <span>Hoboken &amp; nearby Hudson County, NJ</span>
  </footer>;
}
