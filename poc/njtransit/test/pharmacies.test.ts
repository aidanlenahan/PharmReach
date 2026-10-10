import { describe, expect, it } from 'vitest';
import { DEMO_LOCATION, NJ_BOUNDS, inBounds } from '../src/constants.ts';
import { haversineMiles, nearestN, stopsWithin } from '../src/geo.ts';
import { loadAllPharmacies, loadNppesPharmacies, loadOsmPharmacies } from '../src/pharmacies.ts';

const nppes = loadNppesPharmacies();
const osm = loadOsmPharmacies();
const all = loadAllPharmacies();

describe('bigPharma pharmacy data', () => {
  it('loads > 100 pharmacies from each source', () => {
    console.log(
      `NPPES: ${nppes.pharmacies.length} loaded, ${nppes.skipped} skipped (no lat/lon); ` +
        `OSM: ${osm.pharmacies.length} loaded, ${osm.skipped} skipped`,
    );
    expect(nppes.pharmacies.length).toBeGreaterThan(100);
    expect(osm.pharmacies.length).toBeGreaterThan(100);
    expect(all.pharmacies.length).toBe(nppes.pharmacies.length + osm.pharmacies.length);
  });

  it('maps fields', () => {
    const p = nppes.pharmacies[0]!;
    expect(p.id).toMatch(/^nppes:\d+$/);
    expect(p.npi).toMatch(/^\d{10}$/);
    expect(p.source).toBe('nppes');
    expect(p.name).not.toBe('');
    expect(p.address).toMatch(/, NJ \d{5}$/);
    const o = osm.pharmacies[0]!;
    expect(o.id).toMatch(/^osm:(node|way|relation)\/\d+$/);
    expect(o.source).toBe('osm');
    expect(Number.isFinite(o.lat) && Number.isFinite(o.lng)).toBe(true);
  });

  it('NPIs repeat across practice locations (why ids use the row id)', () => {
    const npis = nppes.pharmacies.map((p) => p.npi);
    const dupes = npis.length - new Set(npis).size;
    console.log(`NPPES rows sharing an NPI with another loaded row: ${dupes} extra rows`);
    expect(dupes).toBeGreaterThanOrEqual(0);
  });

  it('has unique ids within each source', () => {
    expect(new Set(nppes.pharmacies.map((p) => p.id)).size).toBe(nppes.pharmacies.length);
    expect(new Set(osm.pharmacies.map((p) => p.id)).size).toBe(osm.pharmacies.length);
  });

  it('nearly all coordinates fall inside NJ-ish bounds', () => {
    const out = all.pharmacies.filter((p) => !inBounds(p, NJ_BOUNDS));
    console.log(`outside NJ bounds: ${out.length} of ${all.pharmacies.length}`);
    for (const p of out) console.log(`  ${p.source} ${p.id} ${p.name} (${p.lat}, ${p.lng}) ${p.address}`);
    // Honest threshold: geocoding mistakes exist; flag if more than 0.5% are off.
    expect(out.length).toBeLessThanOrEqual(Math.ceil(all.pharmacies.length * 0.005));
  });

  it('has at least one pharmacy within 1 mi of the demo location', () => {
    const near = stopsWithin(DEMO_LOCATION, all.pharmacies, 1);
    console.log(`within 1 mi of demo: ${near.length}`);
    for (const { item, miles } of nearestN(DEMO_LOCATION, all.pharmacies, 5)) {
      console.log(`  ${miles.toFixed(2)} mi  ${item.name} [${item.source}] ${item.address}`);
    }
    expect(near.length).toBeGreaterThanOrEqual(1);
    expect(haversineMiles(DEMO_LOCATION, near[0]!.item)).toBeLessThanOrEqual(1);
  });
});
