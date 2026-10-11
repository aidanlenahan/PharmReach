import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, getOrigin, getOriginLabel, setOrigin } from '../core';
import { placesEnabled, resolveAddress, suggestAddresses, type AddressSuggestion } from '../places';

type Props = { onChange?: () => void; embedded?: boolean };
const coordinatePattern = /^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/;

export function LocationPanel({ onChange, embedded = false }: Props) {
  const [value, setValue] = useState(getOriginLabel());
  const [status, setStatus] = useState(getOrigin() ? 'Starting point saved.' : 'Enter a Hoboken address, coordinates, or use your location.');
  const [invalid, setInvalid] = useState(false);
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);
  const latestRequest = useRef(0);

  // Ask Google for address suggestions once the user pauses typing.
  useEffect(() => {
    const query = value.trim();
    if (!placesEnabled || !typed.current || query.length < 3 || coordinatePattern.test(query)) {
      setSuggestions([]);
      return;
    }
    const request = ++latestRequest.current;
    const timer = setTimeout(() => {
      suggestAddresses(query)
        .then((found) => { if (request === latestRequest.current) { setSuggestions(found.slice(0, 5)); setActive(-1); } })
        .catch(() => { if (request === latestRequest.current) setSuggestions([]); });
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  function closeSuggestions() {
    typed.current = false;
    latestRequest.current++;
    setSuggestions([]);
    setActive(-1);
  }

  async function choose(suggestion: AddressSuggestion) {
    closeSuggestions();
    setInvalid(false);
    setStatus('Looking up this address…');
    try {
      const place = await resolveAddress(suggestion);
      save(place.address, `Matched ${place.address}. Live routes use this mapped point.`, `${place.latitude}, ${place.longitude}`);
    } catch (error) {
      setInvalid(true);
      setStatus(`Address lookup failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // -1 means "nothing highlighted" (Enter then submits the typed text).
      setActive((current) => {
        const next = current + step;
        return next >= suggestions.length ? -1 : next < -1 ? suggestions.length - 1 : next;
      });
    } else if (event.key === 'Escape') {
      closeSuggestions();
    }
  }

  function save(label: string, message: string, coordinates = '') {
    if (coordinatePattern.test(label)) {
      const [latitude, longitude] = label.split(',').map(Number);
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        setInvalid(true);
        setStatus('Coordinates must be latitude −90 to 90 and longitude −180 to 180.');
        return false;
      }
    }
    setInvalid(false);
    setOrigin(label, coordinates);
    setValue(label);
    setStatus(message);
    onChange?.();
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) {
      setStatus('Enter a starting point or use your location.');
      return;
    }
    setInvalid(false);
    if (suggestions[active]) {
      await choose(suggestions[active]);
      return;
    }
    const fallback = suggestions[0];
    closeSuggestions();
    if (coordinatePattern.test(query)) {
      save(query, 'Starting point saved.', query);
      return;
    }
    setStatus('Matching this address against the local Hoboken map index…');
    try {
      const result = await api<{ matches: { address: string; latitude: number; longitude: number; approximate?: boolean }[] }>(`/api/geocode?q=${encodeURIComponent(query)}`);
      const match = result.matches?.[0];
      if (!match && fallback) {
        await choose(fallback);
        return;
      }
      if (!match) {
        setInvalid(true);
        setStatus('No local address match. Try a nearby Hoboken street address or enter latitude, longitude.');
        return;
      }
      save(query, `${match.approximate ? 'Approximate match' : 'Matched'} ${match.address}. Live routes use this mapped point.`, `${match.latitude}, ${match.longitude}`);
    } catch (error) {
      setInvalid(true);
      setStatus(`Address lookup failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  }

  function useLocation() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setStatus('Location is unavailable here. Enter your address instead.');
      return;
    }
    setLocating(true);
    setStatus('Requesting your location…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false);
      const point = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
      save(point, 'Current location saved.', point);
    }, (error) => {
      setLocating(false);
      setStatus(error.code === 1 ? 'Location access denied. Enter your starting address instead.' : error.code === 3 ? 'Location request timed out. Try again or enter your address.' : 'Could not determine your location. Enter your starting address instead.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return <section className={`location-panel${embedded ? ' location-panel--embedded' : ''}`} aria-label="Starting location">
    <form onSubmit={submit}>
      <label htmlFor="originInput">Starting location</label>
      <div className="origin-row">
        <div className="origin-field">
          <input id="originInput" type="text" maxLength={512} autoComplete="off" placeholder="Hoboken address or lat, long" value={value} onChange={(event) => { typed.current = true; setValue(event.target.value); }} onKeyDown={handleKeys} onBlur={() => setTimeout(closeSuggestions, 150)} role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls="originSuggestions" aria-activedescendant={active >= 0 ? `originSuggestion-${active}` : undefined} aria-describedby="locationStatus" aria-invalid={invalid} />
          {suggestions.length > 0 && <div id="originSuggestions" className="suggestions open origin-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => <button type="button" tabIndex={-1} key={suggestion.id} id={`originSuggestion-${index}`} className={`suggestion${index === active ? ' active' : ''}`} role="option" aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(suggestion)}>
              <span><strong>{suggestion.main}</strong>{suggestion.secondary && <small>{suggestion.secondary}</small>}</span>
            </button>)}
            <small className="origin-suggestions-credit">Powered by Google</small>
          </div>}
        </div>
        <button className="origin-save" type="submit">Set location</button>
      </div>
      <div className="location-actions">
        <button type="button" onClick={useLocation} disabled={locating}>⌖ {locating ? 'Finding you…' : 'Use my location'}</button>
        <button type="button" id="clearLocation" onClick={() => save('', 'Starting point cleared. Maps can ask where to start.')}>Clear</button>
        <span id="locationStatus" role="status">{status}</span>
      </div>
      <small className="geocoder-credit">Address index © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</small>
    </form>
  </section>;
}
