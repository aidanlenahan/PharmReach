import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { extractStopsTxt, loadStopsFromFile, parseStops } from '../src/gtfs.ts';
import { BUS_FIXTURE, RAIL_FIXTURE } from './helpers.ts';

describe('parseStops (rail fixture)', () => {
  const res = parseStops(RAIL_FIXTURE, 'rail');

  it('fixture really starts with a BOM', () => {
    expect([...readFileSync(RAIL_FIXTURE).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('maps fields, strips the BOM from the first header, and tags type from the feed', () => {
    const nb = res.stops.find((s) => s.id === '103');
    expect(nb).toEqual({ id: '103', name: 'NEW BRUNSWICK', lat: 40.4966, lng: -74.4455, type: 'rail' });
    expect(res.stops.every((s) => s.type === 'rail')).toBe(true);
  });

  it('skips and counts the malformed row', () => {
    expect(res.stops).toHaveLength(5);
    expect(res.skipped).toBe(1);
    expect(res.skippedRows[0]).toMatchObject({ row: 7 });
    expect(res.stops.find((s) => s.id === '999')).toBeUndefined();
  });

  it('accepts a path or the file contents, string or Buffer', () => {
    const text = readFileSync(RAIL_FIXTURE, 'utf8');
    expect(parseStops(text, 'rail').stops).toEqual(res.stops);
    expect(parseStops(readFileSync(RAIL_FIXTURE), 'rail').stops).toEqual(res.stops);
  });
});

describe('parseStops (bus fixture)', () => {
  const res = parseStops(BUS_FIXTURE, 'bus');

  it('handles quoted commas, extra columns, missing optional columns, and trims names', () => {
    expect(res.skipped).toBe(0);
    expect(res.stops).toHaveLength(6);
    expect(res.stops[0]).toEqual({
      id: '20001',
      name: 'GEORGE ST AT ALBANY ST, NEW BRUNSWICK',
      lat: 40.4977,
      lng: -74.4441,
      type: 'bus',
    });
    expect(res.stops.find((s) => s.id === '20005')?.name).toBe('FRENCH ST AT JOHNSON & JOHNSON');
  });
});

describe('parseStops validation', () => {
  it('skips missing ids, empty, out-of-range and 0,0 coordinates, and falls back to id for missing names', () => {
    const text = [
      'stop_id,stop_lat,stop_lon,stop_name',
      'a,40.5,-74.4,Good',
      ',40.5,-74.4,No id',
      'b,,-74.4,Empty lat',
      'c,95,-74.4,Lat out of range',
      'd,40.5,-200,Lng out of range',
      'e,0,0,Null island',
      'f,40.6,-74.3',
    ].join('\n');
    const res = parseStops(text, 'bus');
    expect(res.stops.map((s) => s.id)).toEqual(['a', 'f']);
    expect(res.stops[1]!.name).toBe('f');
    expect(res.skipped).toBe(5);
  });

  it('handles CRLF line endings', () => {
    const res = parseStops('stop_id,stop_name,stop_lat,stop_lon\r\n1,A,40.1,-74.1\r\n', 'rail');
    expect(res.stops).toEqual([{ id: '1', name: 'A', lat: 40.1, lng: -74.1, type: 'rail' }]);
  });

  it('throws when a required column is missing', () => {
    expect(() => parseStops('stop_id,stop_name,stop_lat\n1,A,40.1\n', 'bus')).toThrow(/stop_lon/);
  });

  it('returns an empty result for a header-only file', () => {
    expect(parseStops('stop_id,stop_name,stop_lat,stop_lon\n', 'bus')).toMatchObject({ stops: [], skipped: 0 });
  });
});

describe('extractStopsTxt', () => {
  const stopsText = readFileSync(BUS_FIXTURE, 'utf8');
  const zip = Buffer.from(
    zipSync({
      'agency.txt': strToU8('agency_id,agency_name\nNJB,NJ TRANSIT BUS\n'),
      'stops.txt': strToU8(stopsText),
      'routes.txt': strToU8('route_id\n1\n'),
    }),
  );

  it('extracts stops.txt from a zip Buffer', () => {
    expect(extractStopsTxt(zip)).toBe(stopsText);
    expect(parseStops(extractStopsTxt(zip), 'bus').stops).toHaveLength(6);
  });

  it('finds stops.txt inside a subfolder', () => {
    const nested = zipSync({ 'gtfs/stops.txt': strToU8(stopsText) });
    expect(extractStopsTxt(nested)).toBe(stopsText);
  });

  it('extracts from a zip path via loadStopsFromFile', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const dir = mkdtempSync(path.join(tmpdir(), 'gtfs-'));
    const file = path.join(dir, 'bus_data.zip');
    writeFileSync(file, zip);
    expect(extractStopsTxt(file)).toBe(stopsText);
    expect(loadStopsFromFile(file, 'bus').stops).toHaveLength(6);
  });

  it('throws when stops.txt is absent', () => {
    expect(() => extractStopsTxt(zipSync({ 'agency.txt': strToU8('x\n') }))).toThrow(/stops\.txt/);
  });
});
