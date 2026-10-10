import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { unzipSync, strFromU8 } from 'fflate';

export type StopType = 'bus' | 'rail';

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: StopType;
}

export interface ParseStopsResult {
  stops: Stop[];
  /** Rows dropped because of a missing id or missing/invalid/out-of-range coordinates. */
  skipped: number;
  /** Row numbers (1-based, header = row 1) and reasons for skipped rows, for debugging. */
  skippedRows: { row: number; reason: string }[];
}

const REQUIRED_COLUMNS = ['stop_id', 'stop_lat', 'stop_lon'] as const;

function looksLikePath(input: string): boolean {
  return !input.includes('\n') && input.length < 4096 && existsSync(input);
}

function parseCoord(raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/**
 * Parse a GTFS stops.txt. `input` may be the file contents or a path to the file.
 * `type` is decided by the caller from which feed (bus or rail) the file came from.
 */
export function parseStops(input: string | Buffer, type: StopType): ParseStopsResult {
  let text: string;
  if (Buffer.isBuffer(input)) text = input.toString('utf8');
  else text = looksLikePath(input) ? readFileSync(input, 'utf8') : input;
  // Strip UTF-8 BOM (csv-parse's `bom` option also handles it; belt and braces).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const records = parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: false,
  }) as Record<string, string | undefined>[];

  if (records.length > 0) {
    const cols = Object.keys(records[0]!);
    const missing = REQUIRED_COLUMNS.filter((c) => !cols.includes(c));
    if (missing.length) throw new Error(`stops.txt is missing required column(s): ${missing.join(', ')}`);
  }

  const stops: Stop[] = [];
  const skippedRows: ParseStopsResult['skippedRows'] = [];
  records.forEach((r, i) => {
    const row = i + 2;
    const id = (r.stop_id ?? '').trim();
    if (!id) {
      skippedRows.push({ row, reason: 'missing stop_id' });
      return;
    }
    const lat = parseCoord(r.stop_lat, -90, 90);
    const lng = parseCoord(r.stop_lon, -180, 180);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) {
      skippedRows.push({ row, reason: `invalid coordinates (${r.stop_lat}, ${r.stop_lon})` });
      return;
    }
    const name = (r.stop_name ?? '').trim() || id;
    stops.push({ id, name, lat, lng, type });
  });

  return { stops, skipped: skippedRows.length, skippedRows };
}

/** Extract stops.txt (as a string) from a GTFS zip given as a Buffer or file path. */
export function extractStopsTxt(zip: Buffer | Uint8Array | string): string {
  const bytes = typeof zip === 'string' ? readFileSync(zip) : zip;
  const files = unzipSync(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
    filter: (f) => f.name === 'stops.txt' || f.name.endsWith('/stops.txt'),
  });
  const names = Object.keys(files).sort((a, b) => a.length - b.length);
  const name = names[0];
  if (!name) throw new Error('stops.txt not found in GTFS zip');
  return strFromU8(files[name]!);
}

/** Load stops from a stops.txt path or a GTFS .zip path. */
export function loadStopsFromFile(filePath: string, type: StopType): ParseStopsResult {
  const text = filePath.toLowerCase().endsWith('.zip') ? extractStopsTxt(filePath) : readFileSync(filePath, 'utf8');
  return parseStops(text, type);
}
