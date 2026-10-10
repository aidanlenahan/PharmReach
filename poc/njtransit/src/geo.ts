import type { LatLng } from './constants.ts';

export const EARTH_RADIUS_MI = 3958.7613;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (straight-line) distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface WithDistance<T> {
  item: T;
  miles: number;
}

/** Nearest item to `point`, or null if `items` is empty. */
export function nearestStop<T extends LatLng>(point: LatLng, items: readonly T[]): WithDistance<T> | null {
  let best: WithDistance<T> | null = null;
  for (const item of items) {
    const miles = haversineMiles(point, item);
    if (best === null || miles < best.miles) best = { item, miles };
  }
  return best;
}

/** All items within `miles` (inclusive) of `point`, sorted nearest first. */
export function stopsWithin<T extends LatLng>(point: LatLng, items: readonly T[], miles: number): WithDistance<T>[] {
  return items
    .map((item) => ({ item, miles: haversineMiles(point, item) }))
    .filter((d) => d.miles <= miles)
    .sort((a, b) => a.miles - b.miles);
}

/** The `n` nearest items to `point`, nearest first. */
export function nearestN<T extends LatLng>(point: LatLng, items: readonly T[], n: number): WithDistance<T>[] {
  return items
    .map((item) => ({ item, miles: haversineMiles(point, item) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, n);
}
