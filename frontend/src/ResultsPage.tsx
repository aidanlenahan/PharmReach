import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Bike, BusFront, CarFront, ChevronRight, Footprints, Loader2, Ship, TrainFront } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { HomeSearch } from './HomeSearch';
import { LocationPanel } from './components/LocationPanel';
import { ResultsSkeleton } from './components/LoadingSkeleton';
import { allowedModes, api, defaultMode, durationText, getDefaultSort, getOrigin, getOriginLabel, getPreferences, modeLabels, money, normalizeSort, preferenceNote, sortOptions, type Mode, type PharmacyRecord, type SortOption, type TransitDataStatus, type TravelPreferences } from './core';

const allSortOptions = [...sortOptions];
type RouteData = {
  available: boolean; duration_minutes: number; depart_in_minutes: number; arrival_in_minutes: number;
  travel_cost?: number | null; travel_cost_type?: 'otp' | 'estimated_max' | 'configured'; total_cost?: number | null; steps?: { title: string; detail: string }[]; walking_minutes?: number;
  walking_miles?: number; at_destination?: boolean; transit_types?: string[]; unavailable_reason?: string; walk_is_faster?: boolean;
  geometry?: { type: string; coordinates: number[][]; polyline?: string };
};
type Pharmacy = PharmacyRecord & {
  name: string; address: string; tag: string; merchant?: string; stock: string; stock_count?: number | null; pickup_available?: boolean | null; price: number; regular_price?: number; price_type?: string; product_source?: string; price_source?: string; availability_source?: string; map_number: number; latitude: number; longitude: number;
  pharmacy_hours?: { checked_on: string; timezone?: string; source: string; days: { day: string; status: string; open?: string; close?: string; break_start?: string; break_end?: string }[] };
  methods: Record<Mode, RouteData>;
};
type PharmacyResponse = {
  source_info?: { checked_on?: string; inventory_note?: string; price_note?: string; walgreens_checked_on?: string; walgreens_inventory_note?: string; walgreens_price_note?: string };
  medication: { id: string; name: string; strength: string; quantity: number | null; quantity_label: string; aka: string; product_source?: string; variants: { id: string; strength: string; form: string; quantity: number | null; quantity_label: string }[]; selected_variant_id: string };
  pharmacies: Pharmacy[]; scheduling_supported?: boolean; routing_source?: string; unrouted_count?: number; beyond_limit_count?: number; origin?: string; origin_is_default?: boolean; transit_data?: TransitDataStatus;
};
const labels = modeLabels;
const applePlatform = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(navigator.userAgent) || /^Mac/i.test(navigator.platform);

type RouteIconName = 'walk' | 'bus' | 'rail' | 'ferry' | 'drive' | 'bike';
const routeIcons = { walk: Footprints, bus: BusFront, rail: TrainFront, ferry: Ship, drive: CarFront, bike: Bike };
const routeIconLabels: Record<RouteIconName, string> = { walk: 'Walking', bus: 'Bus', rail: 'Train', ferry: 'Ferry', drive: 'Driving', bike: 'Cycling' };

/** A store whose route OTP has not finished, or a farther store that was not route-planned: keep it and its mode columns visible. */
const routePending = (route?: RouteData) => route?.unavailable_reason === 'route_timeout' || route?.unavailable_reason === 'beyond_route_limit';
const walkingLimitNote = (note: string) => note === 'Exceeds your walking time limit' || note === 'Exceeds your walking distance limit';
function canInspectRoute(pharmacy: Pharmacy, mode: Mode, preferences: TravelPreferences | null) {
  const note = preferenceNote(pharmacy, mode, preferences);
  return !note || (pharmacy.methods[mode]?.available && walkingLimitNote(note));
}
/** Route distance when routed; otherwise the labeled straight-line distance, never a made-up trip. */
const distanceText = (pharmacy: Pharmacy) => typeof pharmacy.distance === 'number' ? `${pharmacy.distance} mi` : typeof pharmacy.straight_line_miles === 'number' ? `${pharmacy.straight_line_miles} mi straight-line` : 'Distance unavailable';
/** Decode a Google-encoded polyline (1e-5 precision) into GeoJSON [longitude, latitude] points. */
function decodePolyline(encoded: string): number[][] {
  const points: number[][] = [];
  let index = 0, latitude = 0, longitude = 0;
  while (index < encoded.length) {
    const deltas = [0, 0].map(() => {
      let result = 0, shift = 0, value: number;
      do { value = encoded.charCodeAt(index++) - 63; result |= (value & 0x1f) << shift; shift += 5; } while (value >= 0x20);
      return result & 1 ? ~(result >> 1) : result >> 1;
    });
    latitude += deltas[0]; longitude += deltas[1];
    points.push([longitude / 1e5, latitude / 1e5]);
  }
  return points;
}
/** The API sends route lines as polylines to keep responses small; the map needs coordinates. */
function withRouteCoordinates(pharmacy: Pharmacy): Pharmacy {
  const methods = { ...pharmacy.methods };
  for (const mode of Object.keys(methods) as Mode[]) {
    const geometry = methods[mode]?.geometry;
    if (geometry?.polyline) methods[mode] = { ...methods[mode], geometry: { type: geometry.type, coordinates: decodePolyline(geometry.polyline) } };
  }
  return { ...pharmacy, methods };
}
function routeSketch(mode: Mode, route: RouteData) {
  const transitIcon: RouteIconName = route.transit_types?.includes('ferry') ? 'ferry' : route.transit_types?.some((type) => type === 'commuter' || type === 'subway') ? 'rail' : 'bus';
  const icons: RouteIconName[] = mode === 'transit' ? ['walk', transitIcon, 'walk'] : [mode];
  return <span className={`route-visual ${mode}`} role="img" aria-label={icons.map((icon) => routeIconLabels[icon]).join(' then ')}>
    {icons.map((kind, index) => {
      const Icon = routeIcons[kind];
      return <Fragment key={`${kind}-${index}`}>
        {index > 0 && <ChevronRight className="route-chevron" aria-hidden="true" />}
        <span className="route-mode-icon" title={routeIconLabels[kind]}><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
      </Fragment>;
    })}
  </span>;
}
function arrivalLabel(route: RouteData, leaveAt: string) {
  if (leaveAt) {
    const time = new Date(leaveAt);
    if (Number.isFinite(time.getTime())) { time.setMinutes(time.getMinutes() + route.arrival_in_minutes); return time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  }
  return durationText(route.arrival_in_minutes);
}
function transitSummary(route: RouteData) {
  const rides = (route.steps || []).filter((step) => /^(Ride |Take )/i.test(step.title || '')).length;
  const transfers = Math.max(0, rides - 1);
  return rides ? `${transfers} ${transfers === 1 ? 'transfer' : 'transfers'}` : 'Transit route';
}
function walkingText(route?: RouteData) {
  const minutes = route?.walking_minutes;
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 ? `${durationText(minutes)} walking` : '';
}
function walkingLimitLabel(route: RouteData, mode: Mode) {
  return mode === 'transit' && walkingText(route) ? `Over walking limit (${durationText(route.walking_minutes)})` : 'Over walking limit';
}
function departureNote(route: RouteData, leaveAt: string) {
  if (leaveAt) return route.depart_in_minutes ? `Start ${durationText(route.depart_in_minutes)} after selected time` : 'Start at selected time';
  return route.depart_in_minutes ? `Recommended: leave in ${durationText(route.depart_in_minutes)}` : 'Recommended: leave now';
}
const njtFaresUrl = 'https://www.njtransit.com/fares/';
function fareText(route: RouteData, value = route.travel_cost) {
  return route.travel_cost_type === 'estimated_max' ? `Estimated max fare ${money(value)}` : `Travel cost ${money(value)}`;
}
function totalText(route: RouteData, value = route.total_cost) {
  return route.travel_cost_type === 'estimated_max' ? `Estimated max total ${money(value)}` : `Total ${money(value)}`;
}
function unavailable(route: RouteData, mode: Mode, stock: string, straightLineMiles?: number | null) {
  if (stock === 'Out of stock') return { title: 'Out of stock', detail: 'This medication is unavailable at this pharmacy' };
  if (stock === 'Unknown') return { title: 'Availability unknown', detail: 'No store-specific availability result was verified for this product.' };
  if (route.unavailable_reason === 'route_timeout') return { title: 'Route not ready', detail: 'Route planning timed out. Try again.' };
  if (route.unavailable_reason === 'beyond_route_limit') return { title: 'Farther away', detail: `${typeof straightLineMiles === 'number' ? `Straight-line ${straightLineMiles} mi` : 'Straight-line distance unknown'} · not route-planned` };
  if (mode === 'transit' && route.unavailable_reason === 'walking_faster_no_alternative') return { title: 'No transit alternative', detail: 'Walking to and from transit stops was considered, but walking directly is faster.' };
  if (mode === 'transit' && route.unavailable_reason === 'walking_faster') return { title: 'Walking is faster', detail: 'Transit planning already includes walking to and from stops.' };
  if (mode === 'transit') return { title: 'No transit route', detail: 'No walk-plus-transit itinerary was available at this time.' };
  return { title: 'Unavailable', detail: 'No route from this starting location' };
}
function stockLabel(stock: string) {
  if (stock === 'In stock') return 'In stock';
  if (stock === 'Out of stock') return 'Out of stock';
  return 'Status not shown';
}
function stockClass(stock: string) {
  return stock === 'Out of stock' ? 'unavailable' : stock === 'Limited stock' ? 'limited' : stock === 'Unknown' ? 'unknown' : '';
}
function todayHours(hours?: Pharmacy['pharmacy_hours']) {
  if (!hours?.days?.length) return '';
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: hours.timezone || 'America/New_York' }).format(new Date());
  const schedule = hours.days.find((item) => item.day === today);
  if (!schedule) return '';
  if (schedule.status === 'unspecified' || !schedule.open || !schedule.close) return 'Today: hours not listed';
  const short = (value: string) => value.replace(/^0?(\d+):(\d{2}) (AM|PM)$/i, (_match, hour, mins, meridiem) => `${Number(hour)}${mins === '00' ? '' : `:${mins}`} ${meridiem}`);
  return `Today: ${short(schedule.open)}–${short(schedule.close)}`;
}
function localDateTimeValue(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function validLeaveAt(iso: string) {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= Date.now() - 60_000 && time <= Date.now() + 30 * 24 * 60 * 60 * 1000 ? iso : '';
}
function hoursPanel(pharmacy: Pharmacy) {
  const hours = pharmacy.pharmacy_hours;
  if (!hours?.days?.length) return null;
  return <section className="pharmacy-hours"><h4>Pharmacy hours</h4><p>{todayHours(hours)}</p><details><summary>Weekly hours</summary><ul>{hours.days.map((day) => <li key={day.day}><span>{day.day}</span><b>{day.status === 'unspecified' ? 'Hours not listed' : day.open && day.close ? `${day.open}–${day.close}` : 'Closed'}</b></li>)}</ul><a href={hours.source} target="_blank" rel="noreferrer">View store hours ↗</a></details></section>;
}

function PharmacyMap({ pharmacies, selected, selectedMode, onSelect }: { pharmacies: Pharmacy[]; selected?: Pharmacy; selectedMode: Mode; onSelect: (id: string, mode: Mode) => void }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const onSelectRef = useRef(onSelect);
  const [mapStatus, setMapStatus] = useState('Loading pharmacy map…');
  const [mapReady, setMapReady] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !nodeRef.current) { setMapStatus('The interactive map could not load. Pharmacy results are still available above.'); return; }
    try {
      const map = L.map(nodeRef.current, { scrollWheelZoom: false, zoomAnimation: false }).setView([40.744, -74.0324], 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' }).addTo(map);
      const route = L.geoJSON(null, { style: { color: '#397bd7', weight: 5, opacity: 0.9 } }).addTo(map);
      mapRef.current = map;
      layerRef.current = route;
      setMapReady(true);
      setMapStatus('');
      return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
    } catch { setMapStatus('The interactive map could not load. Pharmacy results are still available above.'); }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!mapReady || !map || !L) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    const bounds = L.latLngBounds([]);
    pharmacies.forEach((pharmacy) => {
      const lat = Number(pharmacy.latitude), lon = Number(pharmacy.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
      const kind = stockClass(pharmacy.stock);
      const statusLabel = stockLabel(pharmacy.stock);
      const marker = L.marker([lat, lon], { title: `${pharmacy.name} · ${statusLabel}`, alt: `Map marker for ${pharmacy.name}, ${statusLabel}`, icon: L.divIcon({ className: 'pharmacy-marker-shell', html: `<span class="pharmacy-marker ${kind}" aria-hidden="true">${pharmacy.map_number}</span>`, iconSize: [30, 36], iconAnchor: [15, 32], tooltipAnchor: [0, -28] }) });
      marker.bindTooltip(`${pharmacy.name} · ${statusLabel}`, { direction: 'top', offset: [0, -3] });
      marker.on('click', () => onSelectRef.current(pharmacy.id, selectedMode));
      marker.addTo(map);
      markersRef.current.set(pharmacy.id, marker);
      bounds.extend(marker.getLatLng());
    });
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.22), { maxZoom: 14 });
    const frame = requestAnimationFrame(() => { if (mapRef.current === map) map.invalidateSize(); });
    return () => cancelAnimationFrame(frame);
  }, [mapReady, pharmacies, selectedMode]);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = layerRef.current;
    if (!map || !routeLayer) return;
    routeLayer.clearLayers();
    if (!selected) return;
    const geometry = selected.methods?.[selectedMode]?.geometry;
    if (geometry?.type === 'LineString' && geometry.coordinates?.length > 1) {
      routeLayer.addData({ type: 'Feature', properties: {}, geometry });
      const bounds = routeLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 15 });
    } else {
      const marker = markersRef.current.get(selected.id);
      if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
    }
  }, [mapReady, selected, selectedMode]);

  return <section className="map-section" aria-label="Pharmacy locations map">
    <div className="map-head"><strong>{pharmacies.length === 1 && selected ? 'Planned route' : 'Nearby pharmacies'}</strong><span>{pharmacies.length === 1 && selected ? labels[selectedMode] : null}</span></div>
    <div className="map-illustration" ref={nodeRef} role="region" aria-label="Interactive map with pharmacy locations"><p className="map-status" role="status" hidden={!mapStatus}>{mapStatus}</p></div>
    <div className="map-legend"><span><i className="legend-dot" />In stock</span><span><i className="legend-dot unavailable" />Out of stock</span></div>
  </section>;
}

export function ResultsPage() {
  const initial = new URLSearchParams(location.search);
  const [medicationId, setMedicationId] = useState(initial.get('medication') || 'cvs-low-dose-aspirin-81-300');
  const [mode, setMode] = useState<Mode>((['walk', 'transit', 'drive', 'bike'] as string[]).includes(initial.get('mode') || '') ? initial.get('mode') as Mode : defaultMode());
  const [sort, setSort] = useState<SortOption>(normalizeSort(initial.get('sort') || getDefaultSort()));
  const [direction, setDirection] = useState<'asc' | 'desc'>(initial.get('direction') === 'desc' ? 'desc' : 'asc');
  const [variant, setVariant] = useState(initial.get('variant') || '');
  const [leaveAt, setLeaveAt] = useState(validLeaveAt(initial.get('leave_at') || ''));
  const [originRevision, setOriginRevision] = useState(0);
  const [preferences, setPreferences] = useState<TravelPreferences | null>(getPreferences());
  const [data, setData] = useState<PharmacyResponse | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');
  const [detailMode, setDetailMode] = useState<Mode>(mode);
  const [requestVersion, setRequestVersion] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const currentOrigin = getOrigin();
  const currentLabel = getOriginLabel();
  const prefsKey = preferences ? JSON.stringify(preferences) : '';

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => { if (event.key === 'nearRxTravelPreferences') setPreferences(getPreferences()); };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const version = requestVersion;
    let canceled = false;
    const chosenMode = mode || defaultMode(preferences);
    const query = new URLSearchParams({ medication: medicationId, mode: chosenMode, sort, direction });
    if (variant) query.set('variant', variant);
    if (leaveAt) query.set('leave_at', leaveAt);
    history.replaceState(null, '', `/results.html?${query}`);
    setLoading(true);
    setStatus('');
    const apiQuery = new URLSearchParams(query);
    if (currentOrigin) apiQuery.set('origin', currentOrigin);
    if (preferences?.transit) apiQuery.set('transit_types', preferences.transitTypes.join(','));
    api<PharmacyResponse>(`/api/pharmacies?${apiQuery}`).then((result) => {
      if (canceled || version !== requestVersion) return;
      // Defend the UI if an older API process still returns unchecked rows.
      // The backend applies the same filter and the source JSON stays intact.
      const visibleResult = {
        ...result,
        pharmacies: result.pharmacies.filter((pharmacy) => String(pharmacy.stock || 'Unknown').trim().toLowerCase() !== 'unknown').map(withRouteCoordinates),
      };
      setData(visibleResult);
      if (!result.scheduling_supported && leaveAt) setLeaveAt('');
      const defaultVariant = result.medication.selected_variant_id || result.medication.variants[0]?.id || '';
      if (variant && variant !== defaultVariant && !result.medication.variants.some((item) => item.id === variant)) { setVariant(defaultVariant); return; }
      const canonical = new URLSearchParams({ medication: medicationId, mode: chosenMode, sort, direction });
      const selectedVariant = variant || defaultVariant;
      if (selectedVariant) canonical.set('variant', selectedVariant);
      if (leaveAt && result.scheduling_supported) canonical.set('leave_at', leaveAt);
      history.replaceState(null, '', `/results.html?${canonical}`);
      const permitted = allowedModes(preferences).filter((candidate) => visibleResult.pharmacies.some((pharmacy) => !preferenceNote(pharmacy, candidate, preferences)));
      if (permitted.length && !permitted.includes(mode)) { setMode(permitted.includes(defaultMode(preferences)) ? defaultMode(preferences) : permitted[0]); return; }
      if (!permitted.length && mode !== chosenMode) setMode(chosenMode);
      setLoading(false);
    }).catch((error) => { if (!canceled && version === requestVersion) { setLoading(false); setStatus(error instanceof Error ? error.message : 'Could not load pharmacy results.'); } });
    return () => { canceled = true; };
  }, [medicationId, mode, sort, direction, variant, leaveAt, currentOrigin, originRevision, prefsKey, requestVersion]);

  const permittedModes = useMemo(() => allowedModes(preferences), [prefsKey]);
  const visibleModes = useMemo(() => data ? permittedModes.filter((candidate) => data.pharmacies.some((pharmacy) => routePending(pharmacy.methods[candidate]) || (pharmacy.methods[candidate]?.available && canInspectRoute(pharmacy, candidate, preferences)))) : permittedModes, [data, permittedModes, prefsKey]);
  const selectedPharmacy = data?.pharmacies.find((pharmacy) => pharmacy.id === activeId);
  const hasMatches = !!data?.pharmacies.some((pharmacy) => visibleModes.some((candidate) => routePending(pharmacy.methods[candidate]) || (pharmacy.methods[candidate]?.available && !preferenceNote(pharmacy, candidate, preferences))));

  useEffect(() => {
    if (!activeId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setActiveId(''); return; }
      if (event.key !== 'Tab' || !detailRef.current) return;
      const elements = [...detailRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,select,summary')].filter((element) => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId]);
  useEffect(() => {
    if (activeId) detailRef.current?.querySelector<HTMLElement>('.detail-close')?.focus();
    else returnFocusRef.current?.focus();
  }, [activeId]);

  function openDetails(id: string, routeMode = mode) {
    if (!activeId) returnFocusRef.current = document.activeElement as HTMLElement;
    setActiveId(id);
    setDetailMode(routeMode);
  }
  function closeDetails() { setActiveId(''); }
  function setSortAndReset(next: SortOption) { setSort(next); setDirection('asc'); }
  function clickSort(next: SortOption, targetMode = mode) {
    if (targetMode === mode && next === sort) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setMode(targetMode); setSort(next); setDirection('asc'); }
  }
  function selectMedication(medication: { id: string }) { location.href = `/results.html?medication=${encodeURIComponent(medication.id)}`; }

  const tableStyle = { '--table-min-width': `${500 + visibleModes.length * 115}px` } as CSSProperties;
  const scheduledSupported = data?.scheduling_supported ?? false;
  const minLeave = localDateTimeValue(new Date().toISOString());
  const maxLeave = localDateTimeValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

  return <AppShell active="home"><main id="resultsScreen" className="screen active results" aria-busy={loading}>
    <div className="results-toolbar"><div className="result-search"><HomeSearch key={`med-${medicationId}-${data?.medication.name || ''}`} initialValue={data?.medication.name || medicationId} resultPage onSelect={selectMedication} /></div><a className="text-btn" href="/find-medicine.html">← New search</a></div>
    <LocationPanel onChange={() => { setOriginRevision((value) => value + 1); closeDetails(); }} />
    {data?.origin_is_default && <p className="comparison-note">Starting from central Hoboken.</p>}
    <div className="results-meta"><div className="results-heading"><h2>{data ? data.medication.name : 'Nearby pharmacy options'}{loading && data && <Loader2 size={14} className="loading-indicator" role="status" aria-label="Updating pharmacy options" />}</h2><p>{data ? [data.medication.strength, data.medication.quantity_label, `${data.pharmacies.length} pharmacies`].filter(Boolean).join(' · ') : ''}</p></div>
      <div className="result-controls">
        {!!data && data.medication.variants.length > 1 && <label className="sort-wrap variant-picker">Strength, form &amp; amount<select value={variant || data.medication.selected_variant_id} onChange={(event) => setVariant(event.target.value)}>{data.medication.variants.map((item) => <option value={item.id} key={item.id}>{item.strength} {item.form} · {item.quantity_label}</option>)}</select></label>}
        <label className="sort-wrap mobile-control">Compare using<select value={mode} disabled={!visibleModes.length} onChange={(event) => { setMode(event.target.value as Mode); setDirection('asc'); }} aria-label="Compare using">{visibleModes.map((candidate) => <option value={candidate} key={candidate}>{labels[candidate]}</option>)}</select></label>
        {scheduledSupported && <div className="sort-wrap leave-at"><label htmlFor="leaveAt">Leave at</label><div className="leave-at-control"><input id="leaveAt" type="datetime-local" step="60" min={minLeave} max={maxLeave} value={localDateTimeValue(leaveAt)} onChange={(event) => setLeaveAt(event.target.value ? new Date(event.target.value).toISOString() : '')} aria-label="Planned departure time" /><button className="leave-now" type="button" onClick={() => setLeaveAt('')}>Now</button></div></div>}
        <label className="sort-wrap">Sort results<select value={sort} onChange={(event) => setSortAndReset(event.target.value as SortOption)}>{allSortOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="sort-wrap mobile-control">Order<select value={direction} onChange={(event) => setDirection(event.target.value as 'asc' | 'desc')}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div>
    </div>
    {status && <p className="status-message" role="status">{status}<button className="text-btn" onClick={() => setRequestVersion((value) => value + 1)}>Try again</button></p>}
    {loading && !data && <ResultsSkeleton modes={visibleModes} />}
    {!!data && !hasMatches && !loading && <section className="empty-results" aria-live="polite"><h2>No in-stock options found</h2><p>Try another product or adjust your travel preferences.</p><a href="/settings.html" className="restart-setup">Adjust travel preferences →</a><a href="/find-medicine.html" className="text-btn">Search another product</a></section>}
    {!!data && hasMatches && <>
      <p className="visually-hidden" aria-live="polite">Comparing {labels[mode]?.toLowerCase()} · {sort} · {direction === 'asc' ? 'Ascending' : 'Descending'}</p>
      {permittedModes.includes('transit') && (data.transit_data?.stale || data.transit_data?.fallback) && data.transit_data.message && <p className="snapshot-note" role="note">{data.transit_data.message}</p>}
      {!!data.unrouted_count && <p className="snapshot-note" role="note">{data.unrouted_count + (data.beyond_limit_count || 0) >= data.pharmacies.length ? 'Travel routes are temporarily unavailable.' : `Routes to ${data.unrouted_count} ${data.unrouted_count === 1 ? 'pharmacy' : 'pharmacies'} took too long to plan.`}<button className="text-btn" onClick={() => setRequestVersion((value) => value + 1)}>Try again</button></p>}
      <section className="table-shell"><div className="table-scroll"><table className="table" style={tableStyle}><thead><tr>
        <th scope="col" aria-sort={sort === 'Pharmacy' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className={`sort-header${sort === 'Pharmacy' ? ' active-sort-button' : ''}`} onClick={() => clickSort('Pharmacy')}>Pharmacy<span className="sort-arrow">{sort === 'Pharmacy' ? direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>
        <th scope="col" aria-sort={sort === 'Medication cost' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className={`sort-header${sort === 'Medication cost' ? ' active-sort-button' : ''}`} onClick={() => clickSort('Medication cost')}>Medication<span className="sort-arrow">{sort === 'Medication cost' ? direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>
        <th scope="col" aria-sort={sort === 'Availability' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className={`sort-header${sort === 'Availability' ? ' active-sort-button' : ''}`} onClick={() => clickSort('Availability')}>Availability<span className="sort-arrow">{sort === 'Availability' ? direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>
        {visibleModes.map((candidate) => <th scope="col" key={candidate}><button className={`sort-header${sort === 'Soonest arrival' && candidate === mode ? ' active-sort-button' : ''}`} onClick={() => clickSort('Soonest arrival', candidate)}>{labels[candidate]}<span className="sort-arrow">{sort === 'Soonest arrival' && candidate === mode ? direction === 'asc' ? '↑' : '↓' : '↕'}</span></button><div className="header-metrics">{[['Travel time', 'Trip'], ['Travel cost', 'Cost'], ['Total cost', 'Total']].filter(([sortKey]) => sortKey !== 'Total cost' || candidate === 'drive' || candidate === 'transit').map(([sortKey, title]) => <button className={`metric-header${sort === sortKey && mode === candidate ? ' active-sort-button' : ''}`} key={sortKey} onClick={() => clickSort(sortKey as SortOption, candidate)}>{candidate === 'transit' && sortKey === 'Total cost' ? 'Est. total' : title}<span className="sort-arrow">{sort === sortKey && mode === candidate ? direction === 'asc' ? '↑' : '↓' : ''}</span></button>)}</div></th>)}
        <th scope="col"><span className="visually-hidden">Details</span></th>
      </tr></thead><tbody>
        {data.pharmacies.map((pharmacy) => <tr key={pharmacy.id} onClick={() => openDetails(pharmacy.id)}>
          <td><span className="pharmacy-name"><span className="ph-number">{pharmacy.map_number}</span> {pharmacy.name}</span><span className="pharmacy-address">{pharmacy.address} · {distanceText(pharmacy)}</span><span className="hours-today">{todayHours(pharmacy.pharmacy_hours)}</span></td>
          <td><span className="mobile-cell-label" aria-hidden="true">Medication</span><span className="med-price">{money(pharmacy.price)}</span></td>
          <td><span className="mobile-cell-label" aria-hidden="true">Availability</span><span className={`availability ${stockClass(pharmacy.stock)}`}>{stockLabel(pharmacy.stock)}</span></td>
          {visibleModes.map((candidate) => <MethodCell key={candidate} pharmacy={pharmacy} mode={candidate} preferences={preferences} onClick={() => openDetails(pharmacy.id, candidate)} />)}
          <td><button className="row-detail" onClick={(event) => { event.stopPropagation(); openDetails(pharmacy.id); }}>Details →</button></td>
        </tr>)}
      </tbody></table></div><div className="table-foot"><span>Online prices · Availability checked {data.source_info?.checked_on || 'Oct 10, 2026'}</span></div></section>
      <PharmacyMap pharmacies={data.pharmacies} selected={selectedPharmacy || data.pharmacies.find((pharmacy) => pharmacy.methods[mode]?.available && !preferenceNote(pharmacy, mode, preferences))} selectedMode={selectedPharmacy ? detailMode : mode} onSelect={openDetails} />
    </>}
    {!!data && activeId && selectedPharmacy && <><div className="scrim open" onClick={closeDetails} /><aside className="detail open" role="dialog" aria-modal="true" aria-label="Pharmacy route and pricing details" ref={detailRef}>
      <div className="detail-cover"><button className="detail-close" onClick={closeDetails} aria-label="Close pharmacy details">×</button></div>
      <DetailContent pharmacy={selectedPharmacy} response={data} mode={detailMode} modes={visibleModes} leaveAt={leaveAt} originLabel={currentOrigin || data.origin || currentLabel} preferences={preferences} onModeChange={setDetailMode} />
    </aside></>}
  </main></AppShell>;
}

function MethodCell({ pharmacy, mode, preferences, onClick }: { pharmacy: Pharmacy; mode: Mode; preferences: TravelPreferences | null; onClick: () => void }) {
  const route = pharmacy.methods[mode];
  const note = preferenceNote(pharmacy, mode, preferences);
  const reason = unavailable(route, mode, pharmacy.stock, pharmacy.straight_line_miles);
  if (!route.available || (note && !walkingLimitNote(note))) return <td className="method" data-label={labels[mode]} title={!route.available ? reason.detail : note || reason.detail} onClick={(event) => { event.stopPropagation(); onClick(); }}><strong>{pharmacy.stock === 'Out of stock' || (route.available && note) ? '—' : reason.title}</strong></td>;
  const time = route.at_destination ? 'Here' : durationText(route.duration_minutes);
  const notes = route.at_destination ? '' : mode === 'transit' ? `${transitSummary(route)} - Estimated Cost ${money(route.travel_cost)}` : mode === 'drive' ? `Est. trip ${money(route.travel_cost)}` : '';
  return <td className="method" data-label={labels[mode]} onClick={(event) => { event.stopPropagation(); onClick(); }}>{!route.at_destination && routeSketch(mode, route)}<strong>{time}</strong>{walkingLimitNote(note) && <small className="route-limit" title={note}>{walkingLimitLabel(route, mode)}</small>}{mode === 'transit' && !route.at_destination && !walkingLimitNote(note) && walkingText(route) && <small>{walkingText(route)}</small>}{notes && <small>{notes}</small>}{(mode === 'drive' || mode === 'transit') && <small title={route.travel_cost_type === 'estimated_max' ? 'Estimated maximum total' : undefined}>{mode === 'transit' ? 'Est. total' : 'Total'} <em>{money(route.total_cost)}</em></small>}</td>;
}

function DetailContent({ pharmacy, response, mode, modes, leaveAt, originLabel, preferences, onModeChange }: { pharmacy: Pharmacy; response: PharmacyResponse; mode: Mode; modes: Mode[]; leaveAt: string; originLabel: string; preferences: TravelPreferences | null; onModeChange: (mode: Mode) => void }) {
  const routeModes = modes.filter((candidate) => canInspectRoute(pharmacy, candidate, preferences));
  const selectedMode = routeModes.includes(mode) ? mode : routeModes[0];
  const route = pharmacy.methods[selectedMode];
  const failure = selectedMode ? unavailable(route, selectedMode, pharmacy.stock, pharmacy.straight_line_miles) : { title: 'No matching route', detail: 'Your current travel choices do not provide a route to this pharmacy.' };
  const destination = `${pharmacy.name}, ${pharmacy.address.replaceAll(' · ', ', ')}`;
  const googleModes: Record<string, string> = { walk: 'walking', transit: 'transit', drive: 'driving', bike: 'bicycling' };
  const appleModes: Record<string, string> = { walk: 'walking', transit: 'transit', drive: 'driving', bike: 'cycling' };
  const googleQuery = new URLSearchParams({ api: '1', destination, travelmode: googleModes[selectedMode] || 'transit' });
  const appleQuery = new URLSearchParams({ destination, mode: appleModes[selectedMode] || 'transit' });
  if (originLabel) { googleQuery.set('origin', originLabel); appleQuery.set('source', originLabel); }
  if (selectedMode === 'transit' && preferences?.transitTypes.length) appleQuery.set('transit-preferences', preferences.transitTypes.join(','));
  const mapsAvailable = !!selectedMode && !route?.at_destination;
  const appleUrl = `maps://maps.apple.com/directions?${appleQuery}`;
  const googleUrl = `https://www.google.com/maps/dir/?${googleQuery}`;
  const arrivalText = leaveAt ? `Planned departure ${new Date(leaveAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} · Estimated arrival at ${arrivalLabel(route, leaveAt)}` : `Estimated arrival in ${durationText(route?.arrival_in_minutes)}`;

  return <div className="detail-body">
    <h3>{pharmacy.name}</h3><div className="detail-sub">{pharmacy.address} · {distanceText(pharmacy)}</div>
    {pharmacy.location_source && <a className="source-link" href={pharmacy.location_source} target="_blank" rel="noreferrer">View {pharmacy.merchant || 'CVS'} store ↗</a>}
    {hoursPanel(pharmacy)}
    <div className="detail-price"><div><b>{money(pharmacy.price)}</b><small>{response.medication.name}</small></div><span className={`availability ${stockClass(pharmacy.stock)}`}>{stockLabel(pharmacy.stock)}</span></div>
    {(pharmacy.product_source || response.medication.product_source) && <a className="source-link" href={pharmacy.product_source || response.medication.product_source} target="_blank" rel="noreferrer">View product at {pharmacy.merchant || 'CVS'} ↗</a>}
    {!routeModes.length ? <><h3>No matching route</h3><a className="restart-setup" href="/settings.html">Adjust travel preferences →</a></> : <>
      <div className="detail-modes">{routeModes.map((candidate) => {
        const item = pharmacy.methods[candidate];
        const reason = unavailable(item, candidate, pharmacy.stock, pharmacy.straight_line_miles);
        const note = preferenceNote(pharmacy, candidate, preferences);
        return <button key={candidate} className={`mode-card${selectedMode === candidate ? ' selected' : ''}`} onClick={() => onModeChange(candidate)}><b>{labels[candidate]} · {item.available ? item.at_destination ? 'Here' : durationText(item.duration_minutes) : reason.title}</b>{item.available && walkingLimitNote(note) && <span className="route-limit">{walkingLimitLabel(item, candidate)}</span>}{!item.at_destination && <span>{item.available ? `${fareText(item)} · ${totalText(item)}` : reason.detail}</span>}</button>;
      })}</div>
      <div className="cost-breakdown"><div><span>Medication</span><b>{money(pharmacy.price)}</b></div><div><span>{route.travel_cost_type === 'estimated_max' ? 'Estimated max transit fare' : 'Travel cost'}</span><b>{route.available ? money(route.travel_cost) : '—'}</b></div><div className="cost-total"><span>{route.travel_cost_type === 'estimated_max' ? 'Estimated max total' : `Total for ${labels[selectedMode].toLowerCase()}`}</span><b>{route.available ? money(route.total_cost) : 'Unavailable'}</b></div></div>
      {route.available && route.travel_cost_type === 'estimated_max' && <p className="detail-sub"><a className="source-link" href={njtFaresUrl} target="_blank" rel="noreferrer">NJ TRANSIT fare guide ↗</a></p>}
      <div className="route-title">Directions</div>
      {route.available && walkingLimitNote(preferenceNote(pharmacy, selectedMode, preferences)) && <p className="route-limit">{preferenceNote(pharmacy, selectedMode, preferences)} · <a href="/settings.html">Adjust limit</a></p>}
      {!route.available ? <p className="detail-sub">{failure.detail}</p> : <>
        <div className="eta-summary">{route.at_destination ? 'You are already at this pharmacy.' : `${arrivalText}${selectedMode === 'transit' ? ` · ${departureNote(route, leaveAt)}${walkingText(route) ? ` · ${walkingText(route)}` : ''}${typeof route.walking_miles === 'number' && Number.isFinite(route.walking_miles) && route.walking_miles >= 0 ? ` (${route.walking_miles.toFixed(1)} mi)` : ''}${route.walk_is_faster ? ' · Walking directly is faster' : ''}` : ''}`}</div>
        {route.geometry && <PharmacyMap pharmacies={[pharmacy]} selected={pharmacy} selectedMode={selectedMode} onSelect={() => {}} />}
        <div className="route-steps">{route.steps?.map((step, index) => <div className="step" key={`${step.title}-${index}`}><i>{index + 1}</i><span><b>{step.title}</b>{step.detail}</span></div>)}</div>
      </>}
      {mapsAvailable && <div className="maps-links"><a href={googleUrl} target="_blank" rel="noreferrer">Google Maps ↗</a>{applePlatform && <a href={appleUrl}>Apple Maps ↗</a>}</div>}
    </>}
  </div>;
}
