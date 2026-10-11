import { ArrowUpRight } from 'lucide-react';
import { searchEntry } from '../core';
import { Brand } from './Brand';
import './footer.css';

export function AppFooter() {
  const entry = searchEntry();
  return <footer className="app-footer">
    <div><Brand /><p>Over-the-counter medicine. Closer to home.</p></div>
    <nav aria-label="Footer navigation">
      <a href="/privacy.html">Privacy &amp; browser storage</a>
      <a href="/products.html">Products</a>
      <a href="/settings.html">Travel preferences</a>
      <a className="footer-search" href={entry.href}>{entry.label} <ArrowUpRight size={14} aria-hidden="true" /></a>
    </nav>
    <span>Hoboken &amp; nearby Hudson County, NJ</span>
  </footer>;
}
