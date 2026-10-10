import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Fixed demo location: the New Brunswick NJ Transit rail station area. */
export const DEMO_LOCATION: LatLng = { lat: 40.4962, lng: -74.4455 };

/** Generous New Jersey bounding box ("NJ-ish"). */
export const NJ_BOUNDS: Bounds = { minLat: 38.8, maxLat: 41.4, minLng: -75.6, maxLng: -73.8 };

/**
 * NJ Transit service area, which reaches into NY (Penn Station, Port Authority,
 * Orange/Rockland, Port Jervis) and PA (Philadelphia, Delaware Water Gap).
 */
export const NJ_NY_PA_BOUNDS: Bounds = { minLat: 38.8, maxLat: 41.8, minLng: -75.9, maxLng: -73.5 };

export function inBounds(p: LatLng, b: Bounds): boolean {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
}

/** poc/njtransit/ */
export const POC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Repo root (read-only access to bigPharma/). */
export const REPO_ROOT = path.resolve(POC_ROOT, '..', '..');
export const BIGPHARMA_DIR = path.join(REPO_ROOT, 'bigPharma');
export const DATA_DIR = path.join(POC_ROOT, 'data');
