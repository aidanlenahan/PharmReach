import { describe, expect, it } from 'vitest';
import { PUBLIC_SOURCES, type FeedType } from '../../src/download.ts';

// Public GTFS zips (no account). Uses a 4-byte ranged GET so nothing big is downloaded.

async function probe(url: string) {
  const res = await fetch(url, { headers: { range: 'bytes=0-3' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  // Read only the first chunk, in case a server ignores Range and sends the whole file.
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  const total = Number(res.headers.get('content-range')?.split('/')[1] ?? res.headers.get('content-length'));
  return { res, head: Buffer.from(value ?? new Uint8Array()).subarray(0, 4), total };
}

for (const type of ['rail', 'bus'] as FeedType[]) {
  describe(`public ${type} GTFS zip`, () => {
    const [primary, mirror] = PUBLIC_SOURCES[type];

    it(`${primary} redirects to a zip`, async () => {
      const { res, head, total } = await probe(primary!);
      console.log(`${type}: ${res.status} ${res.url} ${total} B, Last-Modified ${res.headers.get('last-modified')}`);
      expect([200, 206]).toContain(res.status);
      expect(res.redirected).toBe(true);
      expect(res.url).toMatch(/content\.njtransit\.com\/.*\.zip$/);
      expect(res.headers.get('content-type')).toMatch(/zip/);
      expect(head.toString('hex')).toBe('504b0304');
      expect(total).toBeGreaterThan(type === 'rail' ? 1_000_000 : 10_000_000);
    });

    it(`mirror ${mirror} responds with a zip`, async () => {
      const { res, head, total } = await probe(mirror!);
      console.log(`${type} mirror: ${res.status} ${total} B, Last-Modified ${res.headers.get('last-modified')}`);
      expect([200, 206]).toContain(res.status);
      expect(head.toString('hex')).toBe('504b0304');
      expect(total).toBeGreaterThan(type === 'rail' ? 1_000_000 : 10_000_000);
    });
  });
}
