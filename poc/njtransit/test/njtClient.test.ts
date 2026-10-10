import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { NjtApiError, NjtClient, TOKEN_MAX_AGE_MS, mask, type NjtApi } from '../src/njtClient.ts';

// Offline: every HTTP call goes to an injected fetch mock. No network, no real credentials.

const ZIP = zipSync({ 'stops.txt': strToU8('stop_id,stop_name,stop_lat,stop_lon\n1,A,40.5,-74.4\n') });
const T0 = Date.parse('2026-10-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

interface Call {
  url: string;
  fields: Record<string, string>;
}

type Handler = (call: Call) => Response;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const zipResponse = () => new Response(ZIP, { status: 200, headers: { 'content-type': 'application/zip' } });
const invalidToken = (api: NjtApi) =>
  json(500, { errorMessage: api === 'rail' ? 'Invalid token.' : 'Invalid Token. Please authenticate user.' });

function mockFetch(handler: Handler) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const fields: Record<string, string> = {};
    if (init?.body instanceof FormData) for (const [k, v] of init.body.entries()) fields[k] = String(v);
    const call = { url: String(input), fields };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

/** A fake NJT server: auth issues tok-1, tok-2, ...; getGTFS accepts only tokens in `valid`. */
function fakeServer(valid: Set<string>) {
  let n = 0;
  return (call: Call): Response => {
    if (/getToken|authenticateUser/.test(call.url)) {
      const token = `tok-${++n}`;
      valid.add(token);
      return json(200, { Authenticated: 'True', UserToken: token });
    }
    if (/getGTFS/.test(call.url)) {
      const api: NjtApi = call.url.includes('raildata') ? 'rail' : 'bus';
      return valid.has(call.fields.token ?? '') ? zipResponse() : invalidToken(api);
    }
    return new Response('', { status: 404 });
  };
}

const authCalls = (calls: Call[]) => calls.filter((c) => /getToken|authenticateUser/.test(c.url));
const gtfsCalls = (calls: Call[]) => calls.filter((c) => /getGTFS/.test(c.url));

let dir: string;
let tokenFile: string;
const env = { NJT_USERNAME: 'fake-user', NJT_PASSWORD: 'fake-pass' };
const silent = () => {};

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'njt-client-'));
  tokenFile = path.join(dir, 'tokens.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function client(fetchImpl: typeof fetch, opts: { now?: number; env?: NodeJS.ProcessEnv } = {}) {
  return new NjtClient({ fetchImpl, tokenFile, env: opts.env ?? env, now: () => opts.now ?? T0, log: silent });
}

function seedCache(api: NjtApi, token: string, issuedAt: number) {
  writeFileSync(tokenFile, JSON.stringify({ [api]: { token, issuedAt: new Date(issuedAt).toISOString() } }));
}

describe('NjtClient token caching', () => {
  it('uses the documented endpoints and multipart fields', async () => {
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    await client(fetchImpl).getGTFS('rail');
    await client(fetchImpl).getGTFS('bus');
    expect(calls.map((c) => c.url)).toEqual([
      'https://raildata.njtransit.com/api/GTFSRT/getToken',
      'https://raildata.njtransit.com/api/GTFSRT/getGTFS',
      'https://pcsdata.njtransit.com/api/GTFSG2/authenticateUser',
      'https://pcsdata.njtransit.com/api/GTFSG2/getGTFS',
    ]);
    expect(calls[0]!.fields).toEqual({ username: 'fake-user', password: 'fake-pass' });
    expect(calls[1]!.fields).toEqual({ token: 'tok-1' });
  });

  it('fetches a token once, caches it with issuedAt, and reuses it across calls and client instances', async () => {
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    const r1 = await client(fetchImpl).getGTFS('rail');
    const r2 = await client(fetchImpl, { now: T0 + HOUR }).getGTFS('rail');
    const r3 = await client(fetchImpl, { now: T0 + 22 * HOUR }).getGTFS('rail');
    expect([r1.tokenFrom, r2.tokenFrom, r3.tokenFrom]).toEqual(['new', 'cache', 'cache']);
    expect(authCalls(calls)).toHaveLength(1);
    expect(gtfsCalls(calls)).toHaveLength(3);
    expect(Buffer.from(r3.zip).equals(Buffer.from(ZIP))).toBe(true);

    const cache = JSON.parse(readFileSync(tokenFile, 'utf8'));
    expect(cache).toEqual({ rail: { token: 'tok-1', issuedAt: new Date(T0).toISOString() } });
    expect(statSync(tokenFile).mode & 0o777).toBe(0o600);
  });

  it('reuses a token already in tokens.json without calling auth', async () => {
    seedCache('rail', 'tok-seeded', T0 - 2 * HOUR);
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set(['tok-seeded'])));
    const r = await client(fetchImpl).getGTFS('rail');
    expect(r.tokenFrom).toBe('cache');
    expect(authCalls(calls)).toHaveLength(0);
    expect(calls[0]!.fields.token).toBe('tok-seeded');
  });

  it('refreshes a token once it is 23h old', async () => {
    seedCache('bus', 'tok-old', T0);
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set(['tok-old'])));
    const justUnder = await client(fetchImpl, { now: T0 + TOKEN_MAX_AGE_MS - 1 }).getGTFS('bus');
    expect(justUnder.tokenFrom).toBe('cache');
    expect(authCalls(calls)).toHaveLength(0);

    const at23h = await client(fetchImpl, { now: T0 + TOKEN_MAX_AGE_MS }).getGTFS('bus');
    expect(at23h.tokenFrom).toBe('new');
    expect(authCalls(calls)).toHaveLength(1);
    const cache = JSON.parse(readFileSync(tokenFile, 'utf8'));
    expect(cache.bus).toEqual({ token: 'tok-1', issuedAt: new Date(T0 + TOKEN_MAX_AGE_MS).toISOString() });
  });

  it('keeps the other API’s cached token when refreshing one', async () => {
    seedCache('rail', 'tok-rail', T0);
    const { fetchImpl } = mockFetch(fakeServer(new Set(['tok-rail'])));
    await client(fetchImpl).getGTFS('bus');
    const cache = JSON.parse(readFileSync(tokenFile, 'utf8'));
    expect(Object.keys(cache).sort()).toEqual(['bus', 'rail']);
    expect(cache.rail.token).toBe('tok-rail');
  });

  it('treats an unreadable cache file as empty', async () => {
    writeFileSync(tokenFile, '{not json');
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    expect((await client(fetchImpl).getGTFS('rail')).tokenFrom).toBe('new');
    expect(authCalls(calls)).toHaveLength(1);
  });

  it('shares one in-flight token request between concurrent calls', async () => {
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    const c = client(fetchImpl);
    await Promise.all([c.getGTFS('rail'), c.getGTFS('rail'), c.getGTFS('rail')]);
    expect(authCalls(calls)).toHaveLength(1);
  });
});

describe('NjtClient invalid-token retry', () => {
  it('on "Invalid token" for a cached token, gets one new token and retries once', async () => {
    seedCache('rail', 'tok-revoked', T0 - HOUR);
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    const r = await client(fetchImpl).getGTFS('rail');
    expect(r).toMatchObject({ tokenFrom: 'new', retried: true });
    expect(calls.map((c) => [c.url.split('/').pop(), c.fields.token ?? 'creds'])).toEqual([
      ['getGTFS', 'tok-revoked'],
      ['getToken', 'creds'],
      ['getGTFS', 'tok-1'],
    ]);
    expect(JSON.parse(readFileSync(tokenFile, 'utf8')).rail.token).toBe('tok-1');
  });

  it('does not loop when the refreshed token is also rejected', async () => {
    seedCache('bus', 'tok-revoked', T0 - HOUR);
    let n = 0;
    const { fetchImpl, calls } = mockFetch((call) =>
      /authenticateUser/.test(call.url) ? json(200, { Authenticated: 'True', UserToken: `tok-${++n}` }) : invalidToken('bus'),
    );
    const err = await client(fetchImpl).getGTFS('bus').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NjtApiError);
    expect((err as NjtApiError).isInvalidToken).toBe(true);
    expect(authCalls(calls)).toHaveLength(1);
    expect(gtfsCalls(calls)).toHaveLength(2);
  });

  it('does not retry when a brand-new token is rejected', async () => {
    const { fetchImpl, calls } = mockFetch((call) =>
      /getToken/.test(call.url) ? json(200, { Authenticated: 'True', UserToken: 'tok-x' }) : invalidToken('rail'),
    );
    await expect(client(fetchImpl).getGTFS('rail')).rejects.toThrow(/Invalid token/);
    expect(authCalls(calls)).toHaveLength(1);
    expect(gtfsCalls(calls)).toHaveLength(1);
  });

  it('does not retry on other errors (e.g. the daily limit)', async () => {
    const { fetchImpl, calls } = mockFetch(() => json(500, { errorMessage: 'Daily usage limit:10. Your current daily usage: 11' }));
    const err = (await client(fetchImpl).getGTFS('rail').catch((e: unknown) => e)) as NjtApiError;
    expect(err).toBeInstanceOf(NjtApiError);
    expect(err.isDailyLimit).toBe(true);
    expect(calls).toHaveLength(1);
    expect(() => readFileSync(tokenFile)).toThrow(); // nothing cached
  });

  it('rejects a 200 response that is not a zip', async () => {
    seedCache('rail', 'tok-ok', T0);
    const { fetchImpl } = mockFetch(() => new Response('<html>oops</html>', { status: 200 }));
    await expect(client(fetchImpl).getGTFS('rail')).rejects.toThrow(/not a zip/);
  });
});

describe('NjtClient env overrides and credentials', () => {
  it('NJT_RAIL_TOKEN / NJT_BUS_TOKEN win over the cache and never trigger auth', async () => {
    seedCache('rail', 'tok-cached', T0);
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set(['tok-env-rail', 'tok-env-bus', 'tok-cached'])));
    const c = client(fetchImpl, { env: { ...env, NJT_RAIL_TOKEN: 'tok-env-rail', NJT_BUS_TOKEN: 'tok-env-bus' } });
    expect((await c.getGTFS('rail')).tokenFrom).toBe('env');
    expect((await c.getGTFS('bus')).tokenFrom).toBe('env');
    expect(calls.map((x) => x.fields.token)).toEqual(['tok-env-rail', 'tok-env-bus']);
    expect(authCalls(calls)).toHaveLength(0);
  });

  it('an invalid env token is reported, not silently refreshed', async () => {
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    const c = client(fetchImpl, { env: { ...env, NJT_RAIL_TOKEN: 'tok-env-bad' } });
    await expect(c.getGTFS('rail')).rejects.toThrow(/NJT_RAIL_TOKEN was rejected/);
    expect(authCalls(calls)).toHaveLength(0);
  });

  it('ignores empty env tokens (as in .env.example)', async () => {
    const { fetchImpl } = mockFetch(fakeServer(new Set()));
    const r = await client(fetchImpl, { env: { ...env, NJT_RAIL_TOKEN: '' } }).getGTFS('rail');
    expect(r.tokenFrom).toBe('new');
  });

  it('throws a clear error with no credentials and makes no request', async () => {
    const { fetchImpl, calls } = mockFetch(fakeServer(new Set()));
    await expect(client(fetchImpl, { env: {} }).getGTFS('bus')).rejects.toThrow(/NJT_USERNAME and NJT_PASSWORD/);
    expect(calls).toHaveLength(0);
  });

  it('reports failed authentication (bus 200 Authenticated "False", rail 500 errorMessage)', async () => {
    const bus = mockFetch(() => json(200, { Authenticated: 'False', UserToken: '' }));
    await expect(client(bus.fetchImpl).getGTFS('bus')).rejects.toThrow(/authentication failed \(HTTP 200\)/);
    const rail = mockFetch(() => json(500, { errorMessage: 'Missing user account.' }));
    await expect(client(rail.fetchImpl).getGTFS('rail')).rejects.toThrow(/Missing user account/);
    expect(() => readFileSync(tokenFile)).toThrow();
  });

  it('never logs the password or the full token', async () => {
    const lines: string[] = [];
    const secretEnv = { NJT_USERNAME: 'fake-user', NJT_PASSWORD: 'fake-super-secret-password' };
    let n = 0;
    const { fetchImpl } = mockFetch((call) =>
      /getToken/.test(call.url)
        ? json(200, { Authenticated: 'True', UserToken: n++ === 0 ? 'abcdefghijklmnopqrstuvwxyz0123456789' : 'zz' })
        : zipResponse(),
    );
    await new NjtClient({ fetchImpl, tokenFile, env: secretEnv, now: () => T0, log: (m) => lines.push(m) }).getGTFS('rail');
    const out = lines.join('\n');
    expect(out).not.toContain('fake-super-secret-password');
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
    expect(out).toContain('abcd…89');
  });
});

describe('mask', () => {
  it('hides all but a few characters', () => {
    expect(mask('')).toBe('<empty>');
    expect(mask('short')).toBe('***(5)');
    expect(mask('0123456789abcdef')).toBe('0123…ef (16 chars)');
  });
});
