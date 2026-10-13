import { href } from '../base';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CircleAlert, FileText, GitFork, Info, ShieldCheck } from 'lucide-react';
import './info-menu.css';

const REPO_URL = 'https://github.com/aidanlenahan/pharmreach';

// Header "!" button: opens on hover (mouse) or click/tap, with About, Disclaimer, Privacy and the source code.
export function InfoMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); rootRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  // Hover only for real mice; touch devices use the tap toggle.
  const hover = (next: boolean) => (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    hovering.current = next;
    window.clearTimeout(closeTimer.current);
    if (next) setOpen(true);
    else closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  return <div className="info-menu" ref={rootRef} onPointerEnter={hover(true)} onPointerLeave={hover(false)} onBlur={(event) => { if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button type="button" className="info-menu-button" aria-label="About, disclaimer and privacy" aria-haspopup="menu" aria-expanded={open} aria-controls="info-menu-list" onClick={() => setOpen((value) => hovering.current || !value)}>
      <CircleAlert size={20} aria-hidden="true" />
    </button>
    <div id="info-menu-list" className={`info-menu-list${open ? ' open' : ''}`} role="menu" aria-label="Site information">
      <a role="menuitem" href={href('/about')}><Info size={16} aria-hidden="true" />About PharmReach</a>
      <a role="menuitem" href={href('/disclaimer')}><FileText size={16} aria-hidden="true" />Disclaimer</a>
      <a role="menuitem" href={href('/privacy')}><ShieldCheck size={16} aria-hidden="true" />Privacy</a>
      <a role="menuitem" href={REPO_URL} target="_blank" rel="noopener noreferrer"><GitFork size={16} aria-hidden="true" />Source on GitHub</a>
    </div>
  </div>;
}
