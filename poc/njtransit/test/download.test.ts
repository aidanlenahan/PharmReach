import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { PUBLIC_SOURCES, downloadPublicFeed, feedPaths, readMeta, summarizeGtfsZip } from '../src/download.ts';

// Offline: fetch is mocked. The real download runs via `npm run fetch` and test/live/.

const ZIP = zipSync({
  'stops.txt': strToU8('﻿stop_id,stop_name,stop_lat,stop_lon\n1,"New Brunswick, NJ",40.4962,-74.4455\n'),
  'calendar_dates.txt': strToU8('service_id,date,exception_type\r\n1,20260915,1\r\n2,20270313,1\r\n1,20261001,1\r\n'),
  'calendar.txt': strToU8('service_id,monday,start_date,end_date\n9,1,20260901,20261231\n'),
  'feed_info.txt': strToU8('feed_publisher_name,feed_version\n"NJ Transit, Inc",v42\n'),
});

let dir: string;
beforeEach(() => (dir = mkdtempSync(path.join(tmpdir(), 'njt-dl-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function fetchSeq(responses: (() => Response)[]) {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input));
    const r = responses.shift();
    if (!r) throw new Error('unexpected fetch');
    return r();
  }) as typeof fetch;
  return { fetchImpl, urls };
}

const ok = () => new Response(ZIP, { status: 200, headers: { 'last-modified': 'Thu, 17 Sep 2026 17:55:35 GMT' } });

describe('summarizeGtfsZip', () => {
  it('lists files, reads feed_info and the service date range', () => {
    const s = summarizeGtfsZip(ZIP);
    expect(s.files).toEqual(['calendar.txt', 'calendar_dates.txt', 'feed_info.txt', 'stops.txt']);
    expect(s.feedInfo).toEqual({ feed_publisher_name: 'NJ Transit, Inc', feed_version: 'v42' });
    expect(s.serviceDateRange).toEqual({ start: '20260901', end: '20270313' });
  });

  it('returns nulls when feed_info and calendars are absent', () => {
    const s = summarizeGtfsZip(zipSync({ 'stops.txt': strToU8('stop_id\n') }));
    expect(s).toEqual({ files: ['stops.txt'], feedInfo: null, serviceDateRange: null });
  });
});

describe('downloadPublicFeed', () => {
  it('saves feed.zip, stops.txt and meta.json', async () => {
    const { fetchImpl, urls } = fetchSeq([ok]);
    const r = await downloadPublicFeed('rail', { baseDir: dir, fetchImpl, log: () => {} });
    expect(r.status).toBe('downloaded');
    expect(urls).toEqual([PUBLIC_SOURCES.rail[0]]);
    const p = feedPaths('rail', dir);
    expect(readFileSync(p.zip).equals(Buffer.from(ZIP))).toBe(true);
    expect(readFileSync(p.stops, 'utf8')).toContain('New Brunswick, NJ');
    const meta = readMeta('rail', dir)!;
    expect(meta).toMatchObject({
      type: 'rail',
      source: 'public',
      url: PUBLIC_SOURCES.rail[0],
      bytes: ZIP.byteLength,
      lastModified: 'Thu, 17 Sep 2026 17:55:35 GMT',
      serviceDateRange: { start: '20260901', end: '20270313' },
    });
    expect(Date.parse(meta.downloadedAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('falls back to the mirror when the primary fails or returns a non-zip', async () => {
    const { fetchImpl, urls } = fetchSeq([() => new Response('<html>maintenance</html>', { status: 200 }), ok]);
    const r = await downloadPublicFeed('bus', { baseDir: dir, fetchImpl, log: () => {} });
    expect(r.status).toBe('downloaded');
    expect(urls).toEqual([...PUBLIC_SOURCES.bus]);
    expect(readMeta('bus', dir)!.url).toBe(PUBLIC_SOURCES.bus[1]);
  });

  it('throws listing every source when all fail', async () => {
    const { fetchImpl } = fetchSeq([() => new Response('', { status: 503 }), () => new Response('', { status: 404 })]);
    await expect(downloadPublicFeed('rail', { baseDir: dir, fetchImpl, log: () => {} })).rejects.toThrow(/HTTP 503[\s\S]*HTTP 404/);
  });

  it('skips a fresh copy unless forced, and re-downloads a stale one', async () => {
    await downloadPublicFeed('rail', { baseDir: dir, fetchImpl: fetchSeq([ok]).fetchImpl, log: () => {} });
    const none = fetchSeq([]);
    expect((await downloadPublicFeed('rail', { baseDir: dir, fetchImpl: none.fetchImpl, log: () => {} })).status).toBe('skipped');
    expect(none.urls).toHaveLength(0);

    const forced = fetchSeq([ok]);
    expect((await downloadPublicFeed('rail', { baseDir: dir, fetchImpl: forced.fetchImpl, force: true, log: () => {} })).status).toBe(
      'downloaded',
    );

    const p = feedPaths('rail', dir);
    const meta = JSON.parse(readFileSync(p.meta, 'utf8'));
    meta.downloadedAt = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    writeFileSync(p.meta, JSON.stringify(meta));
    const stale = fetchSeq([ok]);
    expect((await downloadPublicFeed('rail', { baseDir: dir, fetchImpl: stale.fetchImpl, log: () => {} })).status).toBe('downloaded');
  });
});
