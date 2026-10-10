import { describe, expect, it } from 'vitest';
import { DEMO_LOCATION } from '../src/constants.ts';
import { parseStops, type Stop } from '../src/gtfs.ts';
import { haversineMiles } from '../src/geo.ts';
import { TRANSPORT, driveEstimate, modeFor, transitEstimate, walkEstimate } from '../src/transit.ts';
import { BUS_FIXTURE, RAIL_FIXTURE, northOf } from './helpers.ts';

const rail = parseStops(RAIL_FIXTURE, 'rail').stops;
const bus = parseStops(BUS_FIXTURE, 'bus').stops;
const all = [...rail, ...bus];

describe('TRANSPORT constants match TECHSTACK.md', () => {
  it('has the documented values', () => {
    expect(TRANSPORT).toMatchObject({
      WALK_MPH: 3,
      MAX_COMFORTABLE_WALK_MI: 0.5,
      MAX_WALK_TO_STOP_MI: 0.4,
      BUS_MPH: 20,
      TRAIN_MPH: 35,
      AVG_TRANSIT_WAIT_MIN: 10,
      MAX_CAR_MI: 15,
      CAR_COST_PER_MI: 0.7,
    });
  });

  it('fares are inside the documented ranges', () => {
    expect(TRANSPORT.BUS_FARE_USD).toBeGreaterThanOrEqual(2);
    expect(TRANSPORT.BUS_FARE_USD).toBeLessThanOrEqual(4);
    expect(TRANSPORT.TRAIN_FARE_USD).toBeGreaterThanOrEqual(5);
    expect(TRANSPORT.TRAIN_FARE_USD).toBeLessThanOrEqual(10);
  });
});

describe('walkEstimate', () => {
  it('is feasible at exactly 0.5 mi and just under', () => {
    expect(walkEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 0.4999)).feasible).toBe(true);
    const half = walkEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 0.5));
    expect(half.miles).toBeCloseTo(0.5, 9);
    expect(half.feasible).toBe(true); // limit is inclusive
  });

  it('is infeasible just over 0.5 mi', () => {
    expect(walkEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 0.5001)).feasible).toBe(false);
  });

  it('takes 10 min for 0.5 mi at 3 mph and costs nothing', () => {
    const w = walkEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 0.5));
    expect(w.minutes).toBeCloseTo(10, 6);
    expect(w.cost).toBe(0);
  });
});

describe('driveEstimate', () => {
  it('costs $0.70/mi: 10 mi -> $7.00', () => {
    const d = driveEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 10));
    expect(d.miles).toBeCloseTo(10, 9);
    expect(d.cost).toBeCloseTo(7, 9);
    expect(d.minutes).toBeCloseTo((10 / TRANSPORT.CAR_MPH) * 60, 9); // 24 min at 25 mph
    expect(d.feasible).toBe(true);
  });

  it('is feasible up to 15 mi and not beyond', () => {
    expect(driveEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 14.999)).feasible).toBe(true);
    expect(driveEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 15)).feasible).toBe(true);
    const far = driveEstimate(DEMO_LOCATION, northOf(DEMO_LOCATION, 15.001));
    expect(far.feasible).toBe(false);
    expect(far.cost).toBeCloseTo(15.001 * 0.7, 9);
  });

  it('is zero for the same point', () => {
    expect(driveEstimate(DEMO_LOCATION, DEMO_LOCATION)).toMatchObject({ miles: 0, minutes: 0, cost: 0, feasible: true });
  });
});

describe('transitEstimate', () => {
  it('modeFor: rail only when both ends are rail', () => {
    expect(modeFor('rail', 'rail')).toBe('rail');
    expect(modeFor('rail', 'bus')).toBe('bus');
    expect(modeFor('bus', 'rail')).toBe('bus');
    expect(modeFor('bus', 'bus')).toBe('bus');
  });

  it('demo -> near Edison station uses rail, and the breakdown sums to the total', () => {
    const dest = { lat: 40.5180, lng: -74.4120 };
    const t = transitEstimate(DEMO_LOCATION, dest, all);
    expect(t.feasible).toBe(true);
    expect(t.transitMode).toBe('rail');
    expect(t.originStop?.name).toBe('NEW BRUNSWICK');
    expect(t.destinationStop?.name).toBe('EDISON STATION');
    expect(t.fare).toBe(TRANSPORT.TRAIN_FARE_USD);

    const b = t.breakdown;
    expect(b.waitMin).toBe(10);
    expect(b.walkToStopMin + b.waitMin + b.rideMin + b.walkFromStopMin).toBeCloseTo(t.minutes, 9);

    // Recompute each leg independently from the constants.
    const nb = rail.find((s) => s.id === '103')!;
    const ed = rail.find((s) => s.id === '38')!;
    expect(t.walkToStopMi).toBeCloseTo(haversineMiles(DEMO_LOCATION, nb), 9);
    expect(b.walkToStopMin).toBeCloseTo((t.walkToStopMi / 3) * 60, 9);
    expect(t.rideMi).toBeCloseTo(haversineMiles(nb, ed), 9);
    expect(b.rideMin).toBeCloseTo((t.rideMi / 35) * 60, 9);
    expect(b.walkFromStopMin).toBeCloseTo((haversineMiles(dest, ed) / 3) * 60, 9);
    // ~2.43 mi ride at 35 mph is ~4.2 min; total is dominated by the 10 min wait.
    expect(t.minutes).toBeGreaterThan(14);
    expect(t.minutes).toBeLessThan(18);
  });

  it('demo -> College Ave Student Center uses bus (rail origin, bus destination)', () => {
    const t = transitEstimate(DEMO_LOCATION, { lat: 40.5036, lng: -74.4523 }, all);
    expect(t.feasible).toBe(true);
    expect(t.originStop?.type).toBe('rail');
    expect(t.destinationStop?.id).toBe('20004');
    expect(t.transitMode).toBe('bus');
    expect(t.fare).toBe(TRANSPORT.BUS_FARE_USD);
    expect(t.breakdown.rideMin).toBeCloseTo((t.rideMi / 20) * 60, 9);
  });

  it('is infeasible when the destination has no stop within 0.4 mi', () => {
    const t = transitEstimate(DEMO_LOCATION, { lat: 40.42, lng: -74.3 }, all);
    expect(t.feasible).toBe(false);
    expect(t.walkFromStopMi).toBeGreaterThan(0.4);
    expect(t.reason).toMatch(/destination stop/);
  });

  it('is infeasible when the origin has no stop within 0.4 mi', () => {
    const t = transitEstimate({ lat: 40.42, lng: -74.3 }, DEMO_LOCATION, all);
    expect(t.feasible).toBe(false);
    expect(t.reason).toMatch(/origin stop/);
  });

  it('applies the 0.4 mi walk-to-stop limit inclusively', () => {
    const origin: Stop = { id: 'o', name: 'O', ...DEMO_LOCATION, type: 'bus' };
    const far: Stop = { id: 'f', name: 'F', lat: 40.6, lng: -74.3, type: 'bus' };
    const within = northOf(DEMO_LOCATION, 0.3999);
    const beyond = northOf(DEMO_LOCATION, 0.4001);
    expect(transitEstimate(within, far, [origin, far]).feasible).toBe(true);
    expect(transitEstimate(northOf(DEMO_LOCATION, 0.4), far, [origin, far]).feasible).toBe(true);
    expect(transitEstimate(beyond, far, [origin, far]).feasible).toBe(false);
  });

  it('is infeasible with no stops', () => {
    expect(transitEstimate(DEMO_LOCATION, DEMO_LOCATION, [])).toMatchObject({ feasible: false, transitMode: null });
  });

  it('is infeasible when both ends snap to the same stop', () => {
    const t = transitEstimate(DEMO_LOCATION, { lat: 40.4970, lng: -74.4450 }, all);
    expect(t.feasible).toBe(false);
    expect(t.reason).toMatch(/same stop/);
  });
});
