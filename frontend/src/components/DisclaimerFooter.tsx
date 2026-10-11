import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './disclaimer.css';

export function DisclaimerFooter() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef('');
  useEffect(() => {
    const show = () => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      previousOverflow.current = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    };
    window.addEventListener('pharmreach:disclaimer', show);
    return () => {
      window.removeEventListener('pharmreach:disclaimer', show);
      if (dialogRef.current?.open) document.body.style.overflow = previousOverflow.current;
    };
  }, []);
  return <>
    <dialog ref={dialogRef} className="disclaimer-modal" aria-labelledby="disclaimer-title" onClose={() => { document.body.style.overflow = previousOverflow.current; }}>
      <header><h2 id="disclaimer-title">Disclaimer</h2><button type="button" aria-label="Close disclaimer" onClick={() => dialogRef.current?.close()} autoFocus><X size={20} /></button></header>
      <div className="disclaimer-content">
    <p><b>Not medical advice.</b> PharmReach and its medication helper suggest products from a fixed list of over-the-counter medicines. Suggestions do not consider your health history or other medicines. Read the label and ask a pharmacist if you’re unsure. In an emergency, call 911.</p>
    <p>Prices and stock are snapshots from CVS and Walgreens websites and may have changed. Confirm current prices and availability with the pharmacy before traveling. Travel times are estimates and depend on current service and conditions.</p>
      </div>
    </dialog>
  </>;
}
