import { useEffect, useRef, useState } from 'react';
import { api } from '../core';

type StoreLocation = {
  id: string; name: string; merchant: string; address: string;
  latitude: number; longitude: number; location_source?: string; coordinates_note?: string;
};

type Leaflet = any;
let leafletPromise: Promise<Leaflet> | null = null;

function loadLeaflet(): Promise<Leaflet> {
  const existing = (window as any).L;
  if (existing) return Promise.resolve(existing);
  if (leafletPromise) return leafletPromise;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  stylesheet.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  stylesheet.crossOrigin = '';
  document.head.appendChild(stylesheet);
  leafletPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve((window as any).L);
    script.onerror = () => {
      script.remove();
      stylesheet.remove();
      leafletPromise = null;
      reject(new Error('Could not load the map.'));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function storePopup(store: StoreLocation) {
  const popup = document.createElement('div');
  popup.className = 'location-popup';
  const name = document.createElement('strong');
  name.textContent = store.name;
  const address = document.createElement('p');
  address.textContent = store.address.replaceAll(' · ', ', ');
  popup.append(name, address);
  if (store.coordinates_note) {
    const note = document.createElement('small');
    note.textContent = store.coordinates_note;
    popup.append(note);
  }
  if (store.location_source) {
    const url = new URL(store.location_source);
    if (url.protocol === 'https:') {
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Store website ↗';
      popup.append(link);
    }
  }
  return popup;
}

export function LocationsMap() {
  const sectionRef = useRef<HTMLElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [status, setStatus] = useState('Loading locations…');
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (!sectionRef.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '240px' });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !mapNodeRef.current) return;
    let active = true;
    let map: any;
    let resize: ResizeObserver | undefined;
    setStatus('Loading locations…');
    Promise.all([loadLeaflet(), api<{ locations: StoreLocation[] }>('/locations.json')])
      .then(([L, response]) => {
        if (!active || !mapNodeRef.current) return;
        const locations = response.locations.filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude) && Math.abs(store.latitude) <= 90 && Math.abs(store.longitude) <= 180);
        if (!locations.length) throw new Error('No locations available.');
        setStores(locations);
        map = L.map(mapNodeRef.current, { scrollWheelZoom: false }).setView([40.744, -74.0324], 12);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
        }).addTo(map);
        const bounds = L.latLngBounds([]);
        locations.forEach((store) => {
          const chain = /duane reade/i.test(store.name) ? 'duane-reade' : store.merchant === 'CVS' ? 'cvs' : 'walgreens';
          const marker = L.marker([store.latitude, store.longitude], {
            title: `${store.name}, ${store.address}`,
            alt: `${store.name}, ${store.address}`,
            icon: L.divIcon({
              className: 'location-marker-shell',
              html: `<span class="location-marker ${chain}">${chain === 'cvs' ? 'C' : chain === 'duane-reade' ? 'DR' : 'W'}</span>`,
              iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15],
            }),
          }).bindPopup(storePopup(store)).addTo(map);
          bounds.extend(marker.getLatLng());
        });
        map.fitBounds(bounds.pad(0.12), { maxZoom: 14 });
        if ('ResizeObserver' in window) {
          resize = new ResizeObserver(() => map.invalidateSize());
          resize.observe(mapNodeRef.current);
        }
        setStatus('');
      })
      .catch(() => { if (active) setStatus('The map could not load.'); });
    return () => { active = false; resize?.disconnect(); map?.remove(); };
  }, [visible, request]);

  return <section ref={sectionRef} className="landing-locations" aria-labelledby="locations-title">
    <div className="locations-heading"><h2 id="locations-title">Pharmacy locations</h2>{stores.length > 0 && <span>{stores.length} stores</span>}</div>
    <div className="locations-map-frame">
      <div className="locations-map" ref={mapNodeRef} role="region" aria-label="Map of all CVS, Walgreens, and Duane Reade locations" />
      {status && <div className="locations-map-status" role="status"><p>{status}</p>{status === 'The map could not load.' && <button type="button" className="text-btn" onClick={() => setRequest((value) => value + 1)}>Try again</button>}</div>}
    </div>
    <div className="locations-legend"><span><i className="location-chain cvs" />CVS</span><span><i className="location-chain walgreens" />Walgreens</span><span><i className="location-chain duane-reade" />Duane Reade</span></div>
  </section>;
}
