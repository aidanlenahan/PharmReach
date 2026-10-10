import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { BIGPHARMA_DIR } from './constants.ts';

export type PharmacySource = 'nppes' | 'osm';

export interface Pharmacy {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  source: PharmacySource;
  /** NPPES only. Not unique: one NPI can have a primary plus secondary practice locations. */
  npi?: string;
}

export interface LoadPharmaciesResult {
  pharmacies: Pharmacy[];
  /** Rows dropped for empty or invalid lat/lon. */
  skipped: number;
}

export const NPPES_CSV = path.join(BIGPHARMA_DIR, 'nj_pharmacies_geocoded.csv');
export const OSM_CSV = path.join(BIGPHARMA_DIR, 'pharmacies_osm.csv');

type Row = Record<string, string | undefined>;

function readCsv(file: string): Row[] {
  return parse(readFileSync(file, 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Row[];
}

function coord(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const join = (...parts: (string | undefined)[]) =>
  parts.map((p) => (p ?? '').trim()).filter(Boolean).join(', ');

/** NPPES postal codes are often ZIP+4 without a dash (077472162). */
function zip5(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  return s.length > 5 ? s.slice(0, 5) : s;
}

/** Geocoded NPPES registry pharmacies (bigPharma/nj_pharmacies_geocoded.csv). */
export function loadNppesPharmacies(file = NPPES_CSV): LoadPharmaciesResult {
  const pharmacies: Pharmacy[] = [];
  let skipped = 0;
  for (const r of readCsv(file)) {
    const lat = coord(r.lat);
    const lng = coord(r.lon);
    if (lat === null || lng === null) {
      skipped++;
      continue;
    }
    pharmacies.push({
      // NPI is not unique per location (secondary practice locations share it), so key on
      // the CSV's per-row `id` column and keep the NPI separately.
      id: `nppes:${(r.id ?? '').trim()}`,
      npi: (r.npi ?? '').trim(),
      name: (r.pharmacy_name ?? '').trim() || (r.legal_business_name ?? '').trim(),
      lat,
      lng,
      address: join(r.address_1, r.address_2, r.city, `${(r.state ?? '').trim()} ${zip5(r.postal_code)}`.trim()),
      source: 'nppes',
    } satisfies Pharmacy);
  }
  return { pharmacies, skipped };
}

/** OpenStreetMap pharmacies (bigPharma/pharmacies_osm.csv). */
export function loadOsmPharmacies(file = OSM_CSV): LoadPharmaciesResult {
  const pharmacies: Pharmacy[] = [];
  let skipped = 0;
  for (const r of readCsv(file)) {
    const lat = coord(r.lat);
    const lng = coord(r.lon);
    if (lat === null || lng === null) {
      skipped++;
      continue;
    }
    const address =
      (r.address ?? '').trim() ||
      join(r.street, r.city, `${(r.state ?? '').trim()} ${(r.postcode ?? '').trim()}`.trim());
    pharmacies.push({
      id: `osm:${(r.osm_id ?? '').trim()}`,
      name: (r.name ?? '').trim() || (r.brand ?? '').trim() || 'Pharmacy',
      lat,
      lng,
      address,
      source: 'osm',
    });
  }
  return { pharmacies, skipped };
}

/** Both sources concatenated (no de-duplication across sources). */
export function loadAllPharmacies(): LoadPharmaciesResult & { bySource: Record<PharmacySource, number> } {
  const a = loadNppesPharmacies();
  const b = loadOsmPharmacies();
  return {
    pharmacies: [...a.pharmacies, ...b.pharmacies],
    skipped: a.skipped + b.skipped,
    bySource: { nppes: a.pharmacies.length, osm: b.pharmacies.length },
  };
}
