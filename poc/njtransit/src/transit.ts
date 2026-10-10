import type { LatLng } from './constants.ts';
import type { Stop, StopType } from './gtfs.ts';
import { haversineMiles, nearestStop } from './geo.ts';

/**
 * MVP transport constants from TECHSTACK.md "Core Logic". Tune together with the
 * team; don't change silently. All distances are straight-line (haversine) miles.
 */
export const TRANSPORT = {
  WALK_MPH: 3,
  MAX_COMFORTABLE_WALK_MI: 0.5,
  MAX_WALK_TO_STOP_MI: 0.4,
  BUS_MPH: 20,
  TRAIN_MPH: 35,
  AVG_TRANSIT_WAIT_MIN: 10,
  MAX_CAR_MI: 15,
  CAR_COST_PER_MI: 0.7,
  /**
   * Not in TECHSTACK.md: average door-to-door city driving speed, including lights
   * and parking, applied to straight-line distance. 25 mph is a typical urban/suburban
   * NJ average; tune if driving ETAs look off.
   */
  CAR_MPH: 25,
  /**
   * Hardcoded fares. TECHSTACK.md gives ranges (bus ~$2-4, train ~$5-10); we pick one
   * value in each. $2.90 is roughly a 1-zone NJ Transit local bus fare; $7.50 is a
   * mid-range NJ Transit rail fare for a short-to-medium Northeast Corridor trip.
   */
  BUS_FARE_USD: 2.9,
  TRAIN_FARE_USD: 7.5,
} as const;

/**
 * Inclusive limit check with a tiny tolerance (1e-9 mi, about 1.6 micrometres) so a
 * distance that is exactly at a limit doesn't fail on floating-point rounding in haversine.
 */
const LIMIT_EPSILON_MI = 1e-9;
export const withinLimit = (miles: number, limit: number) => miles <= limit + LIMIT_EPSILON_MI;

const minutesAt = (miles: number, mph: number) => (miles / mph) * 60;

export interface WalkEstimate {
  mode: 'walk';
  miles: number;
  minutes: number;
  cost: 0;
  feasible: boolean;
}

/** Walking: straight-line distance at 3 mph; feasible up to 0.5 mi (inclusive). */
export function walkEstimate(from: LatLng, to: LatLng): WalkEstimate {
  const miles = haversineMiles(from, to);
  return {
    mode: 'walk',
    miles,
    minutes: minutesAt(miles, TRANSPORT.WALK_MPH),
    cost: 0,
    feasible: withinLimit(miles, TRANSPORT.MAX_COMFORTABLE_WALK_MI),
  };
}

export interface DriveEstimate {
  mode: 'car';
  miles: number;
  minutes: number;
  cost: number;
  feasible: boolean;
}

/** Driving: straight-line distance at CAR_MPH, $0.70/mi; feasible up to 15 mi (inclusive). */
export function driveEstimate(from: LatLng, to: LatLng): DriveEstimate {
  const miles = haversineMiles(from, to);
  return {
    mode: 'car',
    miles,
    minutes: minutesAt(miles, TRANSPORT.CAR_MPH),
    cost: miles * TRANSPORT.CAR_COST_PER_MI,
    feasible: withinLimit(miles, TRANSPORT.MAX_CAR_MI),
  };
}

export type TransitMode = 'bus' | 'rail';

export interface TransitLeg {
  stop: Stop;
  miles: number;
  minutes: number;
}

export interface TransitEstimate {
  mode: 'transit';
  /** Rail only if both the origin and destination stops are rail; otherwise bus. */
  transitMode: TransitMode | null;
  feasible: boolean;
  /** Why the trip is infeasible, when it is. */
  reason?: string;
  originStop: Stop | null;
  destinationStop: Stop | null;
  breakdown: {
    walkToStopMin: number;
    waitMin: number;
    rideMin: number;
    walkFromStopMin: number;
  };
  walkToStopMi: number;
  rideMi: number;
  walkFromStopMi: number;
  /** Sum of the breakdown. */
  minutes: number;
  fare: number;
}

export function modeFor(a: StopType, b: StopType): TransitMode {
  return a === 'rail' && b === 'rail' ? 'rail' : 'bus';
}

/**
 * Heuristic transit ETA (TECHSTACK.md):
 *   walk to nearest origin stop + avg wait + straight-line ride / mode speed + walk from nearest destination stop
 * Infeasible if either walk to/from a stop exceeds 0.4 mi. No schedules, routes or
 * transfers are considered; the ride is a straight line between the two stops.
 */
export function transitEstimate(from: LatLng, to: LatLng, stops: readonly Stop[]): TransitEstimate {
  const o = nearestStop(from, stops);
  const d = nearestStop(to, stops);
  const empty: TransitEstimate = {
    mode: 'transit',
    transitMode: null,
    feasible: false,
    reason: 'no stops',
    originStop: null,
    destinationStop: null,
    breakdown: { walkToStopMin: 0, waitMin: 0, rideMin: 0, walkFromStopMin: 0 },
    walkToStopMi: 0,
    rideMi: 0,
    walkFromStopMi: 0,
    minutes: 0,
    fare: 0,
  };
  if (!o || !d) return empty;

  const transitMode = modeFor(o.item.type, d.item.type);
  const rideMi = haversineMiles(o.item, d.item);
  const breakdown = {
    walkToStopMin: minutesAt(o.miles, TRANSPORT.WALK_MPH),
    waitMin: TRANSPORT.AVG_TRANSIT_WAIT_MIN,
    rideMin: minutesAt(rideMi, transitMode === 'rail' ? TRANSPORT.TRAIN_MPH : TRANSPORT.BUS_MPH),
    walkFromStopMin: minutesAt(d.miles, TRANSPORT.WALK_MPH),
  };
  const minutes = breakdown.walkToStopMin + breakdown.waitMin + breakdown.rideMin + breakdown.walkFromStopMin;

  const reasons: string[] = [];
  if (!withinLimit(o.miles, TRANSPORT.MAX_WALK_TO_STOP_MI)) reasons.push(`origin stop ${o.miles.toFixed(2)} mi away`);
  if (!withinLimit(d.miles, TRANSPORT.MAX_WALK_TO_STOP_MI)) reasons.push(`destination stop ${d.miles.toFixed(2)} mi away`);
  if (o.item.id === d.item.id && o.item.type === d.item.type) reasons.push('same stop at both ends (just walk)');

  return {
    mode: 'transit',
    transitMode,
    feasible: reasons.length === 0,
    ...(reasons.length ? { reason: reasons.join('; ') } : {}),
    originStop: o.item,
    destinationStop: d.item,
    breakdown,
    walkToStopMi: o.miles,
    rideMi,
    walkFromStopMi: d.miles,
    minutes,
    fare: transitMode === 'rail' ? TRANSPORT.TRAIN_FARE_USD : TRANSPORT.BUS_FARE_USD,
  };
}
