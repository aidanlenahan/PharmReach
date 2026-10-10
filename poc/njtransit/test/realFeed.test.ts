import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR, DEMO_LOCATION, NJ_NY_PA_BOUNDS, inBounds } from '../src/constants.ts';
import { loadStopsFromFile, type Stop, type StopType } from '../src/gtfs.ts';
import { stopsWithin } from '../src/geo.ts';
import { TRANSPORT } from '../src/transit.ts';

// Runs only when real feeds have been downloaded into data/{rail,bus}/stops.txt.
const feeds: { type: StopType; file: string }[] = [
  { type: 'rail', file: path.join(DATA_DIR, 'rail', 'stops.txt') },
  { type: 'bus', file: path.join(DATA_DIR, 'bus', 'stops.txt') },
];

for (const { type, file } of feeds) {
  describe.skipIf(!existsSync(file))(`real ${type} feed (${path.relative(process.cwd(), file)})`, () => {
    let stops: Stop[] = [];
    it('parses to a non-empty list', () => {
      const res = loadStopsFromFile(file, type);
      stops = res.stops;
      console.log(`${type}: ${stops.length} stops, ${res.skipped} skipped`);
      expect(stops.length).toBeGreaterThan(0);
    });

    it('has unique stop ids', () => {
      expect(new Set(stops.map((s) => s.id)).size).toBe(stops.length);
    });

    it('has all coordinates within NJ/NY/PA bounds', () => {
      const out = stops.filter((s) => !inBounds(s, NJ_NY_PA_BOUNDS));
      expect(out, JSON.stringify(out.slice(0, 5))).toEqual([]);
    });

    if (type === 'rail') {
      it('includes a stop named like "New Brunswick"', () => {
        expect(stops.some((s) => /new\s*brunswick/i.test(s.name))).toBe(true);
      });
    }
  });
}

const present = feeds.filter((f) => existsSync(f.file));
describe.skipIf(present.length === 0)('real feeds near the demo location', () => {
  it(`has a stop within ${TRANSPORT.MAX_WALK_TO_STOP_MI} mi of DEMO_LOCATION`, () => {
    const stops = present.flatMap((f) => loadStopsFromFile(f.file, f.type).stops);
    expect(stopsWithin(DEMO_LOCATION, stops, TRANSPORT.MAX_WALK_TO_STOP_MI).length).toBeGreaterThan(0);
  });
});
