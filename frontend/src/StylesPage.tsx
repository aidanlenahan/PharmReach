import { ArrowUpRight } from 'lucide-react';
import { palettes } from './palettes';
import { AppFooter } from './components/AppFooter';
import { Brand } from './components/Brand';
import './styles-gallery.css';

export function StylesPage() {
  return <><main className="styles-page">
    <header className="styles-header">
      <Brand className="styles-brand" />
      <h1>Styles</h1>
      <p>Color palette samples for the homepage. Layout, content, and type are unchanged; only the colors move onto each palette. Pick one to open its sample.</p>
    </header>
    <div className="styles-grid">
      <a className="styles-card" href="/">
        <div className="styles-frame"><iframe src="/" title="Current homepage" loading="lazy" tabIndex={-1} /></div>
        <div className="styles-card-body"><div><h2>Current</h2><p>The live homepage as it ships today.</p></div><ArrowUpRight size={18} aria-hidden="true" /></div>
      </a>
      {palettes.map((palette) => <a className="styles-card" key={palette.id} href={`/styles/?palette=${palette.id}`}>
        <div className="styles-frame"><iframe src={`/styles/?palette=${palette.id}`} title={`${palette.name} sample`} loading="lazy" tabIndex={-1} /></div>
        <div className="styles-swatches">{palette.colors.map((color) => <span key={color} style={{ background: color }} title={color} />)}</div>
        <div className="styles-card-body"><div><h2>{palette.name}</h2><p>{palette.note}</p><code>{palette.colors.map((color) => color.slice(1)).join('-')}</code></div><ArrowUpRight size={18} aria-hidden="true" /></div>
      </a>)}
    </div>
  </main><AppFooter /></>;
}
