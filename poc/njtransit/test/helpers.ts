import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EARTH_RADIUS_MI } from '../src/geo.ts';
import type { LatLng } from '../src/constants.ts';

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const RAIL_FIXTURE = path.join(FIXTURES, 'stops_rail.txt');
export const BUS_FIXTURE = path.join(FIXTURES, 'stops_bus.txt');

/** Point exactly `miles` due north of `p` (exact along a meridian for haversine). */
export function northOf(p: LatLng, miles: number): LatLng {
  return { lat: p.lat + (miles / EARTH_RADIUS_MI) * (180 / Math.PI), lng: p.lng };
}
