/**
 * Download NJ Transit's public static GTFS zips (no account needed) into data/<type>/.
 *
 * For each feed this writes:
 *   data/<type>/feed.zip    the GTFS zip as downloaded
 *   data/<type>/stops.txt   extracted from the zip
 *   data/<type>/meta.json   source URL, bytes, Last-Modified, downloadedAt, feed_info / service date range
 *
 * The same writer (`saveFeed`) is used by the token API client, pointed at a different directory.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { DATA_DIR } from './constants.ts';
import { extractStopsTxt } from './gtfs.ts';

export type FeedType = 'rail' | 'bus';
export const FEED_TYPES: readonly FeedType[] = ['rail', 'bus'];

/** Primary URL first, then fallbacks (Mobility Database mirrors). See API_NOTES.md section 4. */
export const PUBLIC_SOURCES: Record<FeedType, readonly string[]> = {
  rail: ['https://www.njtransit.com/rail_data.zip', 'https://files.mobilitydatabase.org/mdb-509/latest.zip'],
  bus: ['https://www.njtransit.com/bus_data.zip', 'https://files.mobilitydatabase.org/mdb-508/latest.zip'],
};

/** Where `npm run fetch:api` saves the token-API feeds, kept apart from the public ones for comparison. */
export const API_DATA_DIR = path.join(DATA_DIR, 'api');

export const DEFAULT_MAX_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FeedMeta {
  type: FeedType;
  source: 'public' | 'api';
  /** URL that was requested. */
  url: string;
  /** Final URL after redirects (public downloads only). */
  finalUrl?: string;
  bytes: number;
  lastModified: string | null;
  downloadedAt: string;
  /** Files in the zip. */
  files: string[];
  stopsTxtBytes: number;
  /** Row 1 of feed_info.txt, if present. */
  feedInfo: Record<string, string> | null;
  /** Earliest/latest service date (YYYYMMDD) from calendar.txt and calendar_dates.txt. */
  serviceDateRange: { start: string; end: string } | null;
}

export interface FeedPaths {
  dir: string;
  zip: string;
  stops: string;
  meta: string;
}

export function feedPaths(type: FeedType, baseDir = DATA_DIR): FeedPaths {
  const dir = path.join(baseDir, type);
  return { dir, zip: path.join(dir, 'feed.zip'), stops: path.join(dir, 'stops.txt'), meta: path.join(dir, 'meta.json') };
}

export function readMeta(type: FeedType, baseDir = DATA_DIR): FeedMeta | null {
  const p = feedPaths(type, baseDir).meta;
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as FeedMeta;
  } catch {
    return null;
  }
}

/** Age in ms of the saved feed (from meta.downloadedAt, else the zip's mtime), or null if missing. */
export function feedAgeMs(type: FeedType, baseDir = DATA_DIR, now = Date.now()): number | null {
  const p = feedPaths(type, baseDir);
  if (!existsSync(p.zip) || !existsSync(p.stops)) return null;
  const meta = readMeta(type, baseDir);
  const t = meta ? Date.parse(meta.downloadedAt) : NaN;
  return now - (Number.isFinite(t) ? t : statSync(p.zip).mtimeMs);
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Minimal CSV line splitter for small GTFS metadata files (handles quoted fields). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q && c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvRows(text: string): { header: string[]; rows: string[][] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.toLowerCase());
  return { header, rows: lines.slice(1).map(splitCsvLine) };
}

/** List files, read feed_info.txt and compute the service date range from calendar(_dates).txt. */
export function summarizeGtfsZip(zip: Uint8Array): Pick<FeedMeta, 'files' | 'feedInfo' | 'serviceDateRange'> {
  const files: string[] = [];
  const wanted = new Set(['feed_info.txt', 'calendar.txt', 'calendar_dates.txt']);
  const got = unzipSync(zip, {
    filter: (f) => {
      files.push(f.name);
      return wanted.has(path.posix.basename(f.name));
    },
  });
  const byBase = new Map(Object.entries(got).map(([n, b]) => [path.posix.basename(n), strFromU8(b)]));

  let feedInfo: FeedMeta['feedInfo'] = null;
  const fi = byBase.get('feed_info.txt');
  if (fi) {
    const { header, rows } = csvRows(fi);
    if (rows[0]) feedInfo = Object.fromEntries(header.map((h, i) => [h, rows[0]![i] ?? '']));
  }

  let start: string | null = null;
  let end: string | null = null;
  const consider = (d: string | undefined) => {
    if (!d || !/^\d{8}$/.test(d)) return;
    if (start === null || d < start) start = d;
    if (end === null || d > end) end = d;
  };
  const cal = byBase.get('calendar.txt');
  if (cal) {
    const { header, rows } = csvRows(cal);
    const s = header.indexOf('start_date');
    const e = header.indexOf('end_date');
    for (const r of rows) {
      consider(r[s]);
      consider(r[e]);
    }
  }
  const cd = byBase.get('calendar_dates.txt');
  if (cd) {
    const { header, rows } = csvRows(cd);
    const d = header.indexOf('date');
    for (const r of rows) consider(r[d]);
  }

  return {
    files: files.sort(),
    feedInfo,
    serviceDateRange: start !== null && end !== null ? { start, end } : null,
  };
}

function writeAtomic(file: string, data: string | Uint8Array) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

/** Save a GTFS zip into `<baseDir>/<type>/` (feed.zip, stops.txt, meta.json). Throws if it isn't a GTFS zip. */
export function saveFeed(
  type: FeedType,
  zip: Uint8Array,
  info: Pick<FeedMeta, 'source' | 'url'> & Partial<Pick<FeedMeta, 'finalUrl' | 'lastModified'>>,
  baseDir = DATA_DIR,
): FeedMeta {
  if (!isZip(zip)) throw new Error(`${type}: downloaded body is not a zip (first bytes ${Buffer.from(zip.slice(0, 16)).toString('hex')})`);
  const stopsTxt = extractStopsTxt(zip); // throws if missing
  const p = feedPaths(type, baseDir);
  mkdirSync(p.dir, { recursive: true });
  const meta: FeedMeta = {
    type,
    source: info.source,
    url: info.url,
    ...(info.finalUrl ? { finalUrl: info.finalUrl } : {}),
    bytes: zip.byteLength,
    lastModified: info.lastModified ?? null,
    downloadedAt: new Date().toISOString(),
    stopsTxtBytes: Buffer.byteLength(stopsTxt),
    ...summarizeGtfsZip(zip),
  };
  writeAtomic(p.zip, zip);
  writeAtomic(p.stops, stopsTxt);
  writeAtomic(p.meta, JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

export interface DownloadOptions {
  force?: boolean;
  maxAgeDays?: number;
  baseDir?: string;
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
}

export type DownloadResult = { status: 'skipped'; ageDays: number; meta: FeedMeta | null } | { status: 'downloaded'; meta: FeedMeta };

/** Download the public zip for `type` unless a fresh copy exists. Tries each URL in PUBLIC_SOURCES in order. */
export async function downloadPublicFeed(type: FeedType, opts: DownloadOptions = {}): Promise<DownloadResult> {
  const { force = false, maxAgeDays = DEFAULT_MAX_AGE_DAYS, baseDir = DATA_DIR, fetchImpl = fetch, log = console.log } = opts;
  const age = feedAgeMs(type, baseDir);
  if (!force && age !== null && age < maxAgeDays * DAY_MS) {
    const ageDays = age / DAY_MS;
    log(`${type}: fresh copy (${ageDays.toFixed(1)} days old), skipping. Use --force to re-download.`);
    return { status: 'skipped', ageDays, meta: readMeta(type, baseDir) };
  }

  const errors: string[] = [];
  for (const url of PUBLIC_SOURCES[type]) {
    try {
      log(`${type}: GET ${url}`);
      const res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const zip = new Uint8Array(await res.arrayBuffer());
      const meta = saveFeed(type, zip, { source: 'public', url, finalUrl: res.url, lastModified: res.headers.get('last-modified') }, baseDir);
      log(`${type}: saved ${meta.bytes.toLocaleString()} B from ${res.url} (Last-Modified ${meta.lastModified ?? 'n/a'})`);
      return { status: 'downloaded', meta };
    } catch (err) {
      const msg = `${url}: ${(err as Error).message}`;
      errors.push(msg);
      log(`${type}: failed ${msg}`);
    }
  }
  throw new Error(`${type}: all sources failed:\n  ${errors.join('\n  ')}`);
}
