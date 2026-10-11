export const sortOptions = ['Best match', 'Soonest arrival', 'Travel time', 'Medication cost', 'Travel cost', 'Total cost', 'Pharmacy', 'Availability'] as const;
export type SortOption = typeof sortOptions[number];
export type Mode = 'walk' | 'transit' | 'drive' | 'bike';
export const modeLabels: Record<Mode, string> = { walk: 'Walking', transit: 'Public transit', drive: 'Driving', bike: 'Cycling' };
export const descriptions: Record<string, string> = {
  'Best match': 'Balance medication cost and arrival time',
  'Soonest arrival': 'Earliest estimated arrival, including any departure wait',
  'Travel time': 'Compare trip duration, excluding departure wait',
  'Medication cost': 'Lowest medication price first',
  'Travel cost': 'Compare the fare or driving cost',
  'Total cost': 'Medication plus the selected travel cost',
};
export const transitTypes = { bus: 'Bus', subway: 'Subway / light rail', commuter: 'Commuter rail', ferry: 'Ferry' } as const;
export type TransitType = keyof typeof transitTypes;
export type TravelPreferences = {
  complete?: boolean;
  drive: boolean | null;
  bike: boolean | null;
  walkLimit: 'none' | 'time' | 'distance';
  walkValue: number;
  transit: boolean | null;
  transitTypes: TransitType[];
};
export const defaultPreferences: TravelPreferences = { drive: null, bike: null, walkLimit: 'none', walkValue: 20, transit: null, transitTypes: ['bus', 'subway', 'commuter', 'ferry'] };
const PREFERENCES_KEY = 'nearRxTravelPreferences';
const SORT_KEY = 'nearRxDefaultSort';
const ORIGIN_KEY = 'nearRxStartingLocation';
const COORDS_KEY = 'nearRxStartingCoordinates';

export async function api<T = any>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not load pharmacy data.');
  return body as T;
}
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export const money = (value: unknown) => value == null ? '—' : `$${Number(value).toFixed(2)}`;
export function normalizeSort(value: string | null): SortOption {
  const current = value === 'Travel / shipping cost' ? 'Travel cost' : value;
  return sortOptions.includes(current as SortOption) ? current as SortOption : 'Best match';
}
export function getDefaultSort(): SortOption {
  try { return normalizeSort(localStorage.getItem(SORT_KEY)); }
  catch { return 'Best match'; }
}
export function saveDefaultSort(sort: SortOption) { try { localStorage.setItem(SORT_KEY, sort); } catch { /* Storage can be disabled. */ } }
export function getPreferences(): TravelPreferences | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || 'null');
    if (saved) delete saved.delivery;
    return saved?.complete ? { ...defaultPreferences, ...saved, transitTypes: Array.isArray(saved.transitTypes) ? saved.transitTypes.filter((type: string) => type in transitTypes) : defaultPreferences.transitTypes } : null;
  } catch { return null; }
}
export function savePreferences(preferences: TravelPreferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...preferences, complete: true }));
}
export function allowedModes(preferences = getPreferences()): Mode[] {
  if (!preferences) return ['walk', 'transit', 'drive', 'bike'];
  return (['walk', 'transit', 'drive', 'bike'] as Mode[]).filter((mode) =>
    mode === 'walk' ? preferences.walkLimit === 'none' || preferences.walkValue > 0 :
        mode === 'transit' ? preferences.transit : mode === 'drive' ? preferences.drive : preferences.bike);
}
export function defaultMode(preferences = getPreferences()): Mode {
  const modes = allowedModes(preferences);
  return (['transit', 'drive', 'bike', 'walk'] as Mode[]).find((mode) => modes.includes(mode)) || 'walk';
}
export type Route = { available?: boolean; unavailable_reason?: string; walking_minutes?: number; walking_miles?: number; duration_minutes?: number; transit_types?: TransitType[] };
export type PharmacyRecord = { id: string; distance?: number; straight_line_miles?: number | null; methods: Record<Mode, Route>; [key: string]: any };
/** Freshness of the NJ TRANSIT GTFS feeds behind transit routing (backend/njt/status.py). */
export type TransitDataStatus = { updated_at: string | null; source: 'njt-api' | 'public-zip' | 'existing' | 'manual' | null; stale: boolean; fallback: boolean; service_end?: string | null; rebuild_pending?: boolean | null; message: string | null };
export function preferenceNote(pharmacy: PharmacyRecord, mode: Mode, preferences = getPreferences()): string {
  if (!preferences) return '';
  if (mode === 'drive' && !preferences.drive) return 'Driving is off in your preferences';
  if (mode === 'bike' && !preferences.bike) return 'Cycling is off in your preferences';
  if (mode === 'transit' && (!preferences.transit || (pharmacy.methods.transit.transit_types || ['bus']).some((type) => !preferences.transitTypes.includes(type)))) return 'Transit types are off in your preferences';
  if (mode === 'walk' || mode === 'transit') {
    const route = pharmacy.methods[mode];
    // A route OTP did not finish (or a farther store that was not route-planned) has no walking figures; don't call that over the limit.
    if (route.unavailable_reason === 'route_timeout' || route.unavailable_reason === 'beyond_route_limit') return '';
    const time = route.walking_minutes ?? (mode === 'transit' ? 8 : pharmacy.methods.walk.duration_minutes ?? Number.POSITIVE_INFINITY);
    const distance = route.walking_miles ?? (mode === 'transit' ? 0.4 : pharmacy.distance ?? Number.POSITIVE_INFINITY);
    if (preferences.walkLimit === 'time' && time > preferences.walkValue) return 'Exceeds your walking time limit';
    if (preferences.walkLimit === 'distance' && distance > preferences.walkValue) return 'Exceeds your walking distance limit';
  }
  return '';
}
export function getOriginLabel() { try { return sessionStorage.getItem(ORIGIN_KEY) || ''; } catch { return ''; } }
export function getOrigin() {
  try {
    const coordinateValue = sessionStorage.getItem(COORDS_KEY) || '';
    if (coordinateValue) return coordinateValue;
    const label = sessionStorage.getItem(ORIGIN_KEY) || '';
    return /^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(label) ? label : '';
  } catch { return ''; }
}
export function setOrigin(label: string, coordinates = '') {
  const value = label.trim();
  const coords = coordinates || (/^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(value) ? value : '');
  try {
    if (value) sessionStorage.setItem(ORIGIN_KEY, value); else sessionStorage.removeItem(ORIGIN_KEY);
    if (coords) sessionStorage.setItem(COORDS_KEY, coords); else sessionStorage.removeItem(COORDS_KEY);
  } catch { /* Origin remains usable for this interaction. */ }
}
export function toast(message: string) { window.dispatchEvent(new CustomEvent('pharmreach:toast', { detail: message })); }
export function goToMedication(id: string, replace = false) {
  const target = `/results.html?medication=${encodeURIComponent(id)}`;
  if (replace) location.replace(target); else location.href = target;
}
export function summary(preferences = getPreferences()): string {
  if (!preferences) return 'Travel preferences have not been set yet.';
  const types = preferences.transitTypes.map((type) => transitTypes[type]).join(', ');
  return [preferences.drive ? 'Driving allowed' : 'No driving', preferences.walkLimit === 'none' ? 'Walking: no limit' : `Walking: up to ${preferences.walkValue} ${preferences.walkLimit === 'time' ? 'minutes' : 'miles'}`, preferences.bike ? 'Cycling allowed' : 'No cycling', preferences.transit ? `Transit: ${types}` : 'No public transit'].join(' · ');
}

export function searchEntry() {
  return getPreferences()
    ? { label: 'Make a search', href: '/find-medicine.html' }
    : { label: 'Try it out', href: '/onboarding.html?next=%2Ffind-medicine.html' };
}
