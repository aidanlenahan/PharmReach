import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

type Medication = {
  id: string;
  name: string;
  strength: string;
  quantity_label?: string;
  aka: string;
  category: string;
};

const quickSearches = ['Aspirin', 'Ibuprofen', 'Pepto-Bismol', 'TUMS'];

type Props = {
  inputId?: string;
  initialValue?: string;
  resultPage?: boolean;
  onSelect?: (medication: Medication) => void;
};

async function findMedications(query: string): Promise<Medication[]> {
  const response = await fetch(`/api/medications?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not load medications.');
  return body.medications;
}

export function HomeSearch({ initialValue = '', resultPage = false, onSelect, inputId }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [matches, setMatches] = useState<Medication[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const suggestionsRequested = useRef(false);

  useEffect(() => {
    const value = query.trim();
    const requestId = ++requestRef.current;
    if (!value) {
      setMatches([]);
      setOpen(false);
      setStatus('');
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const medications = await findMedications(value);
        if (requestId !== requestRef.current) return;
        setMatches(medications);
        setOpen(suggestionsRequested.current);
        setStatus(medications.length ? '' : 'No products match. Try aspirin, ibuprofen, or Pepto-Bismol.');
      } catch (error) {
        if (requestId !== requestRef.current) return;
        setMatches([]);
        setOpen(suggestionsRequested.current);
        setStatus(error instanceof Error ? error.message : 'Could not load medications.');
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 140);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { suggestionsRequested.current = false; setOpen(false); }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function choose(medication: Medication) {
    if (onSelect) onSelect(medication);
    else window.location.href = `/results.html?medication=${encodeURIComponent(medication.id)}`;
  }

  async function submit() {
    const value = query.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    try {
      const medications = await findMedications(value);
      if (medications.length === 1) choose(medications[0]);
      else {
        setMatches(medications);
        setOpen(true);
        setStatus(medications.length ? 'Choose a product from the list.' : 'No products match. Try aspirin, ibuprofen, or Pepto-Bismol.');
        inputRef.current?.focus();
      }
    } catch (error) {
      setOpen(true);
      setStatus(error instanceof Error ? error.message : 'Could not load medications.');
    }
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { suggestionsRequested.current = false; setOpen(false); }
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      suggestionsRequested.current = true;
      setOpen(true);
      window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('.suggestion')?.focus());
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  }

  function handleSuggestionKeys(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...(event.currentTarget.querySelectorAll<HTMLButtonElement>('.suggestion'))];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(current + 1) % buttons.length]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (current <= 0) inputRef.current?.focus();
      else buttons[current - 1]?.focus();
    }
    if (event.key === 'Escape') {
      inputRef.current?.focus();
      suggestionsRequested.current = false;
      setOpen(false);
    }
  }

  return (
    <div className="home-search-app" ref={rootRef}>
      <div className={`search-area${resultPage ? ' result-search' : ''}`}>
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" />
          </svg>
          <input
            id={inputId}
            ref={inputRef}
            value={query}
            onFocus={() => { suggestionsRequested.current = true; if (query.trim()) setOpen(true); }}
            onClick={() => { suggestionsRequested.current = true; if (query.trim()) setOpen(true); }}
            onChange={(event) => { suggestionsRequested.current = true; setQuery(event.target.value); }}
            onKeyDown={handleKeys}
            autoComplete="off"
            placeholder="Search a medication…"
            aria-label="Search medication"
            aria-expanded={open}
            aria-controls="homeSuggestions"
            role="combobox"
            aria-autocomplete="list"
          />
          <button className="primary" onClick={() => void submit()} disabled={loading}>
            {loading ? 'Searching…' : resultPage ? 'Search' : 'Compare prices'}
          </button>
        </div>
        <div id="homeSuggestions" className={`suggestions${open ? ' open' : ''}`} onKeyDown={handleSuggestionKeys} role="listbox">
          {matches.map((medication) => (
            <button key={medication.id} className="suggestion" role="option" aria-selected="false" onClick={() => choose(medication)}>
              <span className="pill-icon" aria-hidden="true">✳</span>
              <span><b>{medication.name}</b><small>{[medication.strength, medication.quantity_label].filter(Boolean).join(' · ')}</small></span>
              <span className="suggestion-tag">{medication.category}</span>
            </button>
          ))}
          {status && <div className="empty-search" role="status">{status}</div>}
        </div>
      </div>
      {!resultPage && <div className="popular"><span>Try:</span>{quickSearches.map((name) => (
        <button key={name} onClick={() => { setQuery(name); inputRef.current?.focus(); }}>{name}</button>
      ))}</div>}
    </div>
  );
}
