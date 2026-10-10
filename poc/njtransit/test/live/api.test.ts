import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DATA_DIR } from '../../src/constants.ts';
import { API_DATA_DIR, feedPaths, saveFeed } from '../../src/download.ts';
import { loadStopsFromFile } from '../../src/gtfs.ts';
import { API_CONFIG, NjtClient, mask, type NjtApi } from '../../src/njtClient.ts';

// Live NJ Transit token API.
//  - Route existence and bad-credential tests need no account and never use a real credential.
//  - Rail getToken (+isValidToken) is limited to 10 calls/day, so the rail bad-credential call is
//    opt-in via NJT_TEST_RAIL_AUTH=1, and the credentialed tests go through the token cache.

const post = async (api: NjtApi, p: string, fields: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const res = await fetch(API_CONFIG[api].base + p, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
  return { status: res.status, text: await res.text() };
};

// Clearly fake values, never real credentials.
const FAKE_USER = 'pharmacy-searcher-poc-fake-user';
const FAKE_PASS = 'not-a-real-password';
const DUMMY_TOKEN = 'dummy-token-for-route-check';

describe('API routes exist (dummy token, no credentials, no token limit used)', () => {
  it('rail GTFSRT/getGTFS rejects a dummy token with "Invalid token."', async () => {
    const r = await post('rail', API_CONFIG.rail.gtfsPath, { token: DUMMY_TOKEN });
    expect(r.status).toBe(500);
    expect(JSON.parse(r.text)).toEqual({ errorMessage: expect.stringMatching(/invalid token/i) });
  });

  it('bus GTFSG2/getGTFS rejects a dummy token with "Invalid Token. Please authenticate user."', async () => {
    const r = await post('bus', API_CONFIG.bus.gtfsPath, { token: DUMMY_TOKEN });
    expect(r.status).toBe(500);
    expect(JSON.parse(r.text)).toEqual({ errorMessage: expect.stringMatching(/invalid token/i) });
  });

  it('control: a made-up route returns 404 on both hosts', async () => {
    expect((await post('rail', '/api/GTFSRT/notARealEndpoint', { token: DUMMY_TOKEN })).status).toBe(404);
    expect((await post('bus', '/api/GTFSG2/notARealEndpoint', { token: DUMMY_TOKEN })).status).toBe(404);
  });
});

describe('bad credentials are rejected', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'njt-live-'));
  // Throwaway token file and no env creds: nothing here can touch data/tokens.json.
  const client = new NjtClient({ tokenFile: path.join(tmp, 'tokens.json'), env: {}, log: () => {} });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('bus authenticateUser returns Authenticated "False" for fake credentials', async () => {
    const r = await client.authenticate('bus', FAKE_USER, FAKE_PASS);
    expect(r).toMatchObject({ authenticated: false, token: '', status: 200 });
    expect(client.authCalls.bus).toBe(1);
  });

  it.skipIf(process.env.NJT_TEST_RAIL_AUTH !== '1')(
    'rail getToken rejects fake credentials (opt-in: NJT_TEST_RAIL_AUTH=1, one call against the 10/day limit)',
    async () => {
      const r = await client.authenticate('rail', FAKE_USER, FAKE_PASS);
      console.log(`rail getToken with fake creds: HTTP ${r.status} ${r.errorMessage}`);
      expect(r.authenticated).toBe(false);
      expect(r.token).toBe('');
      expect(client.authCalls.rail).toBe(1);
    },
  );
});

describe.skipIf(!process.env.NJT_USERNAME)('real credentials (token cached in data/tokens.json)', () => {
  const client = new NjtClient();

  for (const api of ['rail', 'bus'] as NjtApi[]) {
    describe(api, () => {
      it('authenticates (reusing the cached token when under 23h old)', async () => {
        const { token, from } = await client.getToken(api);
        console.log(`${api}: token ${mask(token)} from ${from}`);
        expect(token.length).toBeGreaterThan(0);
        // Asking again must not make another auth call.
        const before = client.authCalls[api];
        expect((await client.getToken(api)).token).toBe(token);
        expect(client.authCalls[api]).toBe(before);
        expect(client.authCalls[api]).toBeLessThanOrEqual(1);
      });

      it('downloads getGTFS and parses a non-empty stops.txt', async () => {
        const r = await client.getGTFS(api);
        console.log(`${api}: getGTFS ${r.zip.byteLength} B (token from ${r.tokenFrom}${r.retried ? ', refreshed once' : ''})`);
        const meta = saveFeed(api, r.zip, { source: 'api', url: r.url }, API_DATA_DIR);
        console.log(`${api}: files ${meta.files.join(', ')}; service ${JSON.stringify(meta.serviceDateRange)}`);
        const { stops, skipped } = loadStopsFromFile(feedPaths(api, API_DATA_DIR).stops, api);
        expect(stops.length).toBeGreaterThan(0);
        expect(new Set(stops.map((s) => s.id)).size).toBe(stops.length);

        const publicStops = feedPaths(api, DATA_DIR).stops;
        if (existsSync(publicStops)) {
          const pub = loadStopsFromFile(publicStops, api).stops;
          const pubIds = new Set(pub.map((s) => s.id));
          const shared = stops.filter((s) => pubIds.has(s.id)).length;
          console.log(`${api}: API ${stops.length} stops (${skipped} skipped) vs public ${pub.length}; ${shared} ids shared`);
          // Expect the same network; allow a small drift between snapshots.
          expect(Math.abs(stops.length - pub.length) / pub.length).toBeLessThan(0.1);
        }
      });
    });
  }
});
