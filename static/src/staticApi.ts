// Browser-side stand-in for the Python API (backend/serve.py) so the site runs as static files.
// The snapshot JSON comes from scripts/build_data.py. Travel times are estimated from
// straight-line distance because there is no OpenTripPlanner server behind GitHub Pages.
import { href } from './base';

type Json = Record<string, any>;
type Catalog = { source_info: Json; medications: Json[]; pharmacies: Json[]; inventory: Record<string, Record<string, Json>> };
type AddressEntry = { address: string; house_number: string; street: string; latitude: number; longitude: number };

const MODES = ['walk', 'transit', 'drive', 'bike'] as const;
const SORT_OPTIONS = ['Best match', 'Soonest arrival', 'Travel time', 'Medication cost', 'Travel cost', 'Total cost', 'Pharmacy', 'Availability'];
const DEFAULT_ORIGIN = '40.744,-74.0324';
const GAS_PRICE_PER_GALLON = 3.10;
const DEFAULT_MPG = 25;
// Street grids add roughly a third to the straight line; speeds are typical for Hoboken streets.
const DETOUR = 1.3;
const SPEED_MPH = { walk: 3, bike: 9, drive: 14 };
const DRIVE_PARKING_MINUTES = 4;

const cache = new Map<string, Promise<any>>();
function loadJson<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(href(`data/${name}`), { headers: { Accept: 'application/json' } }).then((response) => {
      if (!response.ok) throw new Error('Could not load the pharmacy snapshot.');
      return response.json();
    }).catch((error) => { cache.delete(name); throw error; }));
  }
  return cache.get(name)!;
}
export const loadCatalog = () => loadJson<Catalog>('catalog.json');

let wordList: Promise<string> | null = null;
/** Large English word list for the helper's typo fixer (public/english-words.txt); '' if it can't load. */
export function loadWordList() {
  return wordList ??= fetch(href('english-words.txt')).then((response) => (response.ok ? response.text() : ''))
    .catch(() => { wordList = null; return ''; });
}

const stockOf = (item?: Json) => String(item?.stock ?? 'Unknown').trim().toLowerCase();
const STOCKED = ['in stock', 'limited stock'];

function hasConfirmedInventory(id: string, data: Catalog) {
  return Object.values(data.inventory[id] || {}).some((item) => stockOf(item) !== 'unknown');
}
function checkedPharmacies(data: Catalog, id: string) {
  return data.pharmacies.filter((pharmacy) => { const item = data.inventory[id]?.[pharmacy.id]; return item && stockOf(item) !== 'unknown'; });
}
/** Products with at least one store confirmed In stock or Limited stock (the chat catalog). */
export function inStockCatalog(data: Catalog) {
  return data.medications.filter((m) => Object.values(data.inventory[m.id] || {}).some((item) => STOCKED.includes(stockOf(item))));
}

// --- /api/medications --------------------------------------------------------

const words = (value: string) => value.toLowerCase().match(/[a-z0-9]+/g) || [];
function searchableText(m: Json) {
  const text = words([m.name, m.strength, m.aka, ...(m.search_terms || [])].filter(Boolean).join(' ')).join(' ');
  // "81mg" should find "81 mg" (the search box shows doses without the space).
  return `${text} ${text.replace(/(\d) (mg|mcg|g|ml|iu)\b/g, '$1$2')}`;
}
async function medications(q: string) {
  const data = await loadCatalog();
  const terms = words(q);
  const matches = data.medications
    .filter((m) => hasConfirmedInventory(m.id, data) && (!terms.length || terms.every((term) => searchableText(m).includes(term))))
    .map((m) => ({ ...m, store_count: checkedPharmacies(data, m.id).filter((p) => STOCKED.includes(stockOf(data.inventory[m.id][p.id]))).length }));
  return { mock: true, source_info: data.source_info, medications: matches };
}

// --- /api/pharmacies ---------------------------------------------------------

function parseCoordinates(value: string) {
  const match = /^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(value || '');
  if (!match) return null;
  const [latitude, longitude] = [Number(match[1]), Number(match[2])];
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}
const round2 = (value: number) => Math.round(value * 100) / 100;

function estimateRoutes(pharmacy: Json, straightMiles: number, stocked: boolean, mpg: number | null) {
  const miles = straightMiles * DETOUR;
  const action = { walk: 'Walk', drive: 'Drive', bike: 'Cycle' } as const;
  const routes: Json = {};
  for (const mode of MODES) {
    if (mode === 'transit') {
      // A transit trip can't be guessed honestly without a schedule; send people to Google Maps instead.
      routes.transit = { available: false, unavailable_reason: 'no_live_routing', travel_cost: null, total_cost: null, steps: [] };
      continue;
    }
    const minutes = Math.max(1, Math.round(miles / SPEED_MPH[mode] * 60 + (mode === 'drive' ? DRIVE_PARKING_MINUTES : 0)));
    const travelCost = mode === 'drive' ? round2(miles / (mpg || DEFAULT_MPG) * GAS_PRICE_PER_GALLON) : 0;
    routes[mode] = {
      available: stocked,
      estimated: true,
      duration_minutes: minutes,
      depart_in_minutes: 0,
      arrival_in_minutes: minutes,
      travel_cost: travelCost,
      ...(mode === 'drive' && mpg ? { travel_cost_type: 'mpg' } : {}),
      total_cost: round2(pharmacy.price + travelCost),
      ...(mode === 'walk' ? { walking_minutes: minutes, walking_miles: round2(miles) } : {}),
      ...(mode === 'drive' ? { distance_miles: round2(miles) } : {}),
      steps: [
        { title: `${action[mode]} about ${miles.toFixed(1)} mi`, detail: `Estimated ${minutes} minutes from straight-line distance. Open Google Maps for turn-by-turn directions.` },
        { title: `Arrive at ${pharmacy.name}`, detail: pharmacy.address },
      ],
    };
  }
  return routes;
}

function atDestination(stocked: boolean, price: number) {
  return Object.fromEntries(MODES.map((mode) => [mode, {
    available: stocked, duration_minutes: 0, depart_in_minutes: 0, arrival_in_minutes: 0, travel_cost: 0,
    total_cost: stocked ? price : null, walking_minutes: 0, walking_miles: 0, at_destination: true,
    steps: [{ title: 'You are here', detail: 'This address matches your starting point.' }],
  }]));
}

async function pharmacies(params: URLSearchParams) {
  const data = await loadCatalog();
  const medicationId = params.get('medication') || '';
  const mode = params.get('mode') || 'transit';
  let sort = params.get('sort') || 'Best match';
  const direction = params.get('direction') || 'asc';
  const originParam = (params.get('origin') || '').slice(0, 512);
  const mpgParam = params.get('mpg');
  const mpg = mpgParam ? Number(mpgParam) : null;

  const record = data.medications.find((m) => m.id === medicationId);
  if (!record) throw new Error('Unknown medication. Choose a medication from the search suggestions.');
  if (!(MODES as readonly string[]).includes(mode)) throw new Error('Unknown comparison mode.');
  if (sort === 'Travel / shipping cost') sort = 'Travel cost';
  if (!SORT_OPTIONS.includes(sort)) throw new Error('Unknown sort option.');
  if (direction !== 'asc' && direction !== 'desc') throw new Error('Unknown sort direction.');
  if (mpg !== null && !(mpg >= 1 && mpg <= 200)) throw new Error('Enter gas mileage between 1 and 200 MPG.');

  const variants = record.variants || [{ id: record.id, strength: record.strength, form: '', quantity: record.quantity, price_multiplier: 1 }];
  const variant = variants.find((v: Json) => v.id === params.get('variant')) || variants[0];
  const medication = {
    ...record,
    strength: [variant.strength, variant.form].filter(Boolean).join(' '),
    quantity: variant.quantity,
    quantity_label: variant.quantity_label || record.quantity_label || `${variant.quantity} count`,
    selected_variant_id: variant.id,
    variants: variants.map((v: Json) => ({ id: v.id, strength: v.strength, form: v.form || '', quantity: v.quantity, quantity_label: v.quantity_label || `${v.quantity} count` })),
  };

  const originIsDefault = !originParam;
  const origin = originParam || DEFAULT_ORIGIN;
  const point = parseCoordinates(origin);
  const records = checkedPharmacies(data, medicationId).map((pharmacy, index) => {
    const base = data.inventory[medicationId][pharmacy.id];
    const item: Json = { ...base, price: round2(base.price * (variant.price_multiplier ?? 1)) };
    const stocked = item.stock === 'In stock';
    const straight = point ? haversineMiles(point.latitude, point.longitude, pharmacy.latitude, pharmacy.longitude) : null;
    const merged: Json = { ...pharmacy, ...item, map_number: index + 1, straight_line_miles: straight == null ? null : round2(straight) };
    if (straight == null) {
      merged.distance = null;
      merged.methods = Object.fromEntries(MODES.map((m) => [m, { available: false, unavailable_reason: 'no_live_routing', travel_cost: null, total_cost: null, steps: [] }]));
    } else if (straight * 1609.344 <= 12) {
      merged.distance = 0;
      merged.methods = atDestination(stocked, item.price);
    } else {
      merged.distance = round2(straight * DETOUR);
      merged.methods = estimateRoutes(merged, straight, stocked, mpg);
    }
    return merged;
  });

  const rank = (r: Json): [number | string, string] => {
    const route = r.methods[mode];
    const inf = Number.POSITIVE_INFINITY;
    const score = sort === 'Pharmacy' ? r.name.toLowerCase()
      : sort === 'Availability' ? ({ 'In stock': 0, 'Limited stock': 1, Unknown: 2, 'Out of stock': 3 } as Json)[r.stock] ?? 2
      : sort === 'Medication cost' ? r.price
      : sort === 'Travel cost' ? route.travel_cost ?? inf
      : sort === 'Total cost' ? route.total_cost ?? inf
      : sort === 'Travel time' ? route.duration_minutes ?? inf
      : sort === 'Soonest arrival' ? route.arrival_in_minutes ?? inf
      : r.price * 0.5 + (route.arrival_in_minutes ?? inf) * 0.32 + (r.stock === 'Limited stock' ? 8 : 0);
    return [score, r.name.toLowerCase()];
  };
  const compare = (a: Json, b: Json) => {
    const [sa, na] = rank(a), [sb, nb] = rank(b);
    const primary = typeof sa === 'string' ? sa.localeCompare(sb as string) : sa === sb ? 0 : sa < (sb as number) ? -1 : 1;
    return primary || na.localeCompare(nb);
  };
  records.sort((a, b) => direction === 'desc' ? compare(b, a) : compare(a, b));
  // Keep unfillable results last in either direction (stable sort).
  records.sort((a, b) => Number(!a.methods[mode].available) - Number(!b.methods[mode].available));

  return {
    mock: true, source_info: data.source_info, routing_source: 'estimate', scheduling_supported: false,
    origin, origin_is_default: originIsDefault, medication, compare_mode: mode, sort, direction, leave_at: null,
    unrouted_count: 0, beyond_limit_count: 0, pharmacies: records,
  };
}

// --- /api/geocode (ported from geocode_local_address) -------------------------

function addressTokens(value: string) {
  const text = value.split(/[,·]/, 1)[0].toLowerCase().replaceAll('street', 'st').replaceAll('avenue', 'ave').replaceAll('boulevard', 'blvd').replaceAll('road', 'rd');
  const tokens = text.match(/[a-z0-9]+/g) || [];
  const unit = tokens.findIndex((token) => ['apt', 'apartment', 'unit', 'suite', 'ste', 'floor', 'fl'].includes(token));
  return unit === -1 ? tokens : tokens.slice(0, unit);
}
const sameTokens = (a: string[], b: string[]) => a.length === b.length && a.every((token, i) => token === b[i]);

async function geocode(query: string) {
  query = query.trim();
  if (!query || query.length > 256) return [];
  const { addresses } = await loadJson<{ addresses: AddressEntry[] }>('address-index.json');
  const queryTokens = addressTokens(query);
  if (!queryTokens.length || !/^\d+(?:-\d+)?[a-z]?$/.test(queryTokens[0])) return [];
  const streetQuery = queryTokens.slice(1);
  const matches: [number, string, AddressEntry][] = [];
  for (const item of addresses) {
    const tokens = addressTokens(`${item.house_number} ${item.street}`);
    if (!tokens.length || tokens[0] !== queryTokens[0]) continue;
    let score: number;
    if (!streetQuery.length) score = 1;
    else if (sameTokens(tokens, queryTokens)) score = 0;
    else if (sameTokens(tokens.slice(1, 1 + streetQuery.length), streetQuery)
      || (tokens[1]?.startsWith(streetQuery[0]) && sameTokens(tokens.slice(2, 2 + streetQuery.length - 1), streetQuery.slice(1)))) score = 1;
    else continue;
    matches.push([score, item.address.toLowerCase(), item]);
  }
  matches.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  if (!matches.length && streetQuery.length) {
    // Interpolate between the nearest known house numbers on the same street.
    const target = parseInt(queryTokens[0], 10);
    const sameStreet: [number, AddressEntry][] = [];
    for (const item of addresses) {
      const street = addressTokens(item.street);
      if (!sameTokens(street.slice(0, streetQuery.length), streetQuery)
        && !(street[0]?.startsWith(streetQuery[0]) && sameTokens(street.slice(1, streetQuery.length), streetQuery.slice(1)))) continue;
      const number = parseInt(item.house_number, 10);
      if (Number.isFinite(number)) sameStreet.push([number, item]);
    }
    const lower = sameStreet.filter(([n]) => n < target).sort((a, b) => b[0] - a[0])[0];
    const upper = sameStreet.filter(([n]) => n > target).sort((a, b) => a[0] - b[0])[0];
    if (lower && upper && upper[0] - lower[0] <= 200) {
      const ratio = (target - lower[0]) / (upper[0] - lower[0]);
      const [low, high] = [lower[1], upper[1]];
      return [{
        address: `${low.street}, Hoboken, NJ`,
        latitude: Number((low.latitude + (high.latitude - low.latitude) * ratio).toFixed(7)),
        longitude: Number((low.longitude + (high.longitude - low.longitude) * ratio).toFixed(7)),
        approximate: true,
      }];
    }
  }
  return matches.slice(0, 8).map(([, , item]) => ({ address: item.address, latitude: item.latitude, longitude: item.longitude, approximate: false }));
}

// --- dispatcher ---------------------------------------------------------------

/** Answer a GET to one of the old /api/ paths from the static snapshot. */
export async function staticApi(path: string): Promise<any> {
  const url = new URL(path, 'https://pharmreach.invalid');
  const params = url.searchParams;
  switch (url.pathname) {
    case '/api/medications': return medications(params.get('q') || '');
    case '/api/pharmacies': return pharmacies(params);
    case '/api/geocode': return { source: 'local OpenStreetMap address index', matches: await geocode(params.get('q') || '') };
    case '/api/health': return { ok: true, mock: true, static: true, chat_configured: true };
    case '/locations.json': return loadJson('locations.json');
    default: throw new Error('Unknown API endpoint.');
  }
}
