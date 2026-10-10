import { describe, expect, it } from 'vitest';
import { DEMO_LOCATION } from '../src/constants.ts';
import { parseStops } from '../src/gtfs.ts';
import { haversineMiles, nearestN, nearestStop, stopsWithin } from '../src/geo.ts';
import { BUS_FIXTURE, RAIL_FIXTURE, northOf } from './helpers.ts';

const rail = parseStops(RAIL_FIXTURE, 'rail').stops;
const bus = parseStops(BUS_FIXTURE, 'bus').stops;
const all = [...rail, ...bus];
const byId = (id: string) => all.find((s) => s.id === id)!;

describe('haversineMiles', () => {
  it('is zero for the same point and symmetric', () => {
    expect(haversineMiles(DEMO_LOCATION, DEMO_LOCATION)).toBe(0);
    expect(haversineMiles(byId('103'), byId('125'))).toBeCloseTo(haversineMiles(byId('125'), byId('103')), 12);
  });

  it('New Brunswick station -> Princeton Junction is ~15.6 mi straight-line', () => {
    // Independent check: dLat 0.1802 deg * 69.09 mi = 12.45 mi N-S; dLng 0.1781 deg * 52.66 mi = 9.38 mi E-W;
    // sqrt(12.45^2 + 9.38^2) = 15.59 mi. (By rail it is ~24 track miles.)
    expect(haversineMiles(byId('103'), byId('125'))).toBeCloseTo(15.58, 1);
  });

  it('one degree of latitude is ~69.09 mi', () => {
    expect(haversineMiles({ lat: 40, lng: -74 }, { lat: 41, lng: -74 })).toBeCloseTo(69.09, 1);
  });

  it('northOf helper produces exact distances', () => {
    expect(haversineMiles(DEMO_LOCATION, northOf(DEMO_LOCATION, 0.4))).toBeCloseTo(0.4, 9);
  });
});

describe('nearestStop', () => {
  it('returns null for no stops', () => {
    expect(nearestStop(DEMO_LOCATION, [])).toBeNull();
  });

  it('finds New Brunswick station from the demo location', () => {
    const n = nearestStop(DEMO_LOCATION, all)!;
    expect(n.item.id).toBe('103');
    expect(n.item.type).toBe('rail');
    expect(n.miles).toBeLessThan(0.05);
  });

  it('finds the nearest bus stop when only bus stops are given', () => {
    expect(nearestStop(DEMO_LOCATION, bus)!.item.id).toBe('20001'); // George St at Albany St
  });

  it('finds Edison station near Edison', () => {
    expect(nearestStop({ lat: 40.52, lng: -74.41 }, all)!.item.name).toBe('EDISON STATION');
  });
});

describe('stopsWithin', () => {
  it('returns stops within 0.4 mi of the demo location, sorted nearest first', () => {
    const ids = stopsWithin(DEMO_LOCATION, all, 0.4).map((d) => d.item.id);
    // NB station 0.03, George/Albany 0.13, George/Church 0.19, French St 0.29, College/Bishop 0.32
    expect(ids).toEqual(['103', '20001', '20002', '20005', '20003']);
  });

  it('excludes College Ave Student Center (~0.61 mi) at 0.5 mi and includes it at 0.7 mi', () => {
    expect(stopsWithin(DEMO_LOCATION, all, 0.5).map((d) => d.item.id)).not.toContain('20004');
    expect(stopsWithin(DEMO_LOCATION, all, 0.7).map((d) => d.item.id)).toContain('20004');
  });

  it('is inclusive at the radius', () => {
    const s = { ...northOf(DEMO_LOCATION, 0.4), id: 'edge' };
    expect(stopsWithin(DEMO_LOCATION, [s], 0.4 + 1e-12)).toHaveLength(1);
    expect(stopsWithin(DEMO_LOCATION, [s], 0.399)).toHaveLength(0);
  });

  it('nearestN returns n items in order', () => {
    const n = nearestN(DEMO_LOCATION, all, 3);
    expect(n.map((d) => d.item.id)).toEqual(['103', '20001', '20002']);
  });
});
