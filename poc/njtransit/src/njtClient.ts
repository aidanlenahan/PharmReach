/**
 * NJ Transit token API client for the static GTFS zips (see API_NOTES.md sections 1-3).
 *
 *   rail: POST raildata.njtransit.com/api/GTFSRT/getToken      (username, password) -> { Authenticated, UserToken }
 *         POST raildata.njtransit.com/api/GTFSRT/getGTFS       (token)              -> zip
 *   bus:  POST pcsdata.njtransit.com/api/GTFSG2/authenticateUser (username, password) -> { Authenticated, UserToken }
 *         POST pcsdata.njtransit.com/api/GTFSG2/getGTFS          (token)              -> zip
 *
 * Every call is multipart/form-data. Errors come back as HTTP 500 + JSON { errorMessage }.
 *
 * Token caching: rail getToken + isValidToken share a limit of 10 calls/day, so tokens are cached in
 * data/tokens.json as { [api]: { token, issuedAt } } and reused until TOKEN_MAX_AGE_MS (23h) old.
 * On an "Invalid token" response the client gets one new token and retries once. NJT_RAIL_TOKEN /
 * NJT_BUS_TOKEN in the environment override the cache (and are never refreshed automatically).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, POC_ROOT } from './constants.ts';
import { isZip } from './download.ts';

export type NjtApi = 'rail' | 'bus';
export const NJT_APIS: readonly NjtApi[] = ['rail', 'bus'];

export interface ApiConfig {
  base: string;
  authPath: string;
  gtfsPath: string;
  tokenEnv: 'NJT_RAIL_TOKEN' | 'NJT_BUS_TOKEN';
}

export const API_CONFIG: Record<NjtApi, ApiConfig> = {
  rail: {
    base: 'https://raildata.njtransit.com',
    authPath: '/api/GTFSRT/getToken',
    gtfsPath: '/api/GTFSRT/getGTFS',
    tokenEnv: 'NJT_RAIL_TOKEN',
  },
  bus: {
    base: 'https://pcsdata.njtransit.com',
    authPath: '/api/GTFSG2/authenticateUser',
    gtfsPath: '/api/GTFSG2/getGTFS',
    tokenEnv: 'NJT_BUS_TOKEN',
  },
};

export const TOKEN_MAX_AGE_MS = 23 * 60 * 60 * 1000;
export const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');

export interface CachedToken {
  token: string;
  /** ISO timestamp of when the token was issued (fetched). */
  issuedAt: string;
}
export type TokenCache = Partial<Record<NjtApi, CachedToken>>;

/** Show only enough of a secret to tell values apart in logs. */
export function mask(secret: string | undefined | null): string {
  if (!secret) return '<empty>';
  if (secret.length <= 8) return `***(${secret.length})`;
  return `${secret.slice(0, 4)}…${secret.slice(-2)} (${secret.length} chars)`;
}

/** Load poc/njtransit/.env into process.env if it exists (existing env vars win). */
export function loadEnv(file = path.join(POC_ROOT, '.env')): boolean {
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

export class NjtApiError extends Error {
  constructor(
    message: string,
    readonly api: NjtApi,
    readonly status: number,
    readonly errorMessage: string | null,
  ) {
    super(message);
    this.name = 'NjtApiError';
  }
  get isInvalidToken(): boolean {
    return /invalid token/i.test(this.errorMessage ?? '');
  }
  get isDailyLimit(): boolean {
    return /daily usage limit/i.test(this.errorMessage ?? '');
  }
}

export interface AuthResult {
  authenticated: boolean;
  token: string;
  status: number;
  /** errorMessage from a 500 response, if any. */
  errorMessage: string | null;
}

export interface NjtClientOptions {
  fetchImpl?: typeof fetch;
  tokenFile?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  log?: (msg: string) => void;
}

const nonEmpty = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : undefined);

async function readErrorMessage(res: Response): Promise<string | null> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as { errorMessage?: unknown };
    if (typeof j.errorMessage === 'string') return j.errorMessage;
  } catch {
    /* not JSON */
  }
  return text.trim() ? text.trim().slice(0, 300) : null;
}

export class NjtClient {
  private readonly fetchImpl: typeof fetch;
  private readonly tokenFile: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;
  private readonly inflight = new Map<NjtApi, Promise<string>>();
  /** Number of auth (getToken/authenticateUser) HTTP calls made, per API. */
  readonly authCalls: Record<NjtApi, number> = { rail: 0, bus: 0 };

  constructor(opts: NjtClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.tokenFile = opts.tokenFile ?? TOKEN_FILE;
    this.env = opts.env ?? process.env;
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? ((m) => console.log(m));
  }

  readCache(): TokenCache {
    if (!existsSync(this.tokenFile)) return {};
    try {
      return JSON.parse(readFileSync(this.tokenFile, 'utf8')) as TokenCache;
    } catch {
      return {};
    }
  }

  private writeCache(cache: TokenCache) {
    mkdirSync(path.dirname(this.tokenFile), { recursive: true });
    const tmp = `${this.tokenFile}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', { mode: 0o600 });
    renameSync(tmp, this.tokenFile);
    chmodSync(this.tokenFile, 0o600);
  }

  /** A cached token younger than TOKEN_MAX_AGE_MS, or null. */
  cachedToken(api: NjtApi): CachedToken | null {
    const c = this.readCache()[api];
    if (!c?.token) return null;
    const issued = Date.parse(c.issuedAt);
    if (!Number.isFinite(issued)) return null;
    const age = this.now() - issued;
    return age >= 0 && age < TOKEN_MAX_AGE_MS ? c : null;
  }

  private credentials(): { username: string; password: string } {
    const username = nonEmpty(this.env.NJT_USERNAME);
    const password = nonEmpty(this.env.NJT_PASSWORD);
    if (!username || !password) {
      throw new Error('NJT_USERNAME and NJT_PASSWORD must be set (in poc/njtransit/.env) to request an NJ Transit token');
    }
    return { username, password };
  }

  private url(api: NjtApi, p: string) {
    return API_CONFIG[api].base + p;
  }

  /**
   * Raw auth call. Makes exactly one HTTP request and does not touch the cache.
   * Rail counts toward the 10/day limit, so only use this directly for the bad-credentials test.
   */
  async authenticate(api: NjtApi, username: string, password: string): Promise<AuthResult> {
    this.authCalls[api]++;
    const form = new FormData();
    form.set('username', username);
    form.set('password', password);
    const res = await this.fetchImpl(this.url(api, API_CONFIG[api].authPath), {
      method: 'POST',
      headers: { accept: 'text/plain' },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return { authenticated: false, token: '', status: res.status, errorMessage: await readErrorMessage(res) };
    }
    const body = (await res.json()) as { Authenticated?: unknown; UserToken?: unknown };
    const token = typeof body.UserToken === 'string' ? body.UserToken : '';
    const authenticated = String(body.Authenticated).toLowerCase() === 'true' && token !== '';
    return { authenticated, token, status: res.status, errorMessage: null };
  }

  /** Request a new token with the .env credentials and store it in the cache. */
  private async refreshToken(api: NjtApi): Promise<string> {
    const pending = this.inflight.get(api);
    if (pending) return pending;
    const p = (async () => {
      const { username, password } = this.credentials();
      this.log(`njt ${api}: requesting a new token for user ${username} (password ${mask(password)})`);
      const r = await this.authenticate(api, username, password);
      if (!r.authenticated) {
        throw new NjtApiError(
          `njt ${api}: authentication failed (HTTP ${r.status}${r.errorMessage ? `: ${r.errorMessage}` : ''})`,
          api,
          r.status,
          r.errorMessage,
        );
      }
      const cache = this.readCache();
      cache[api] = { token: r.token, issuedAt: new Date(this.now()).toISOString() };
      this.writeCache(cache);
      this.log(`njt ${api}: got token ${mask(r.token)}, cached in ${path.relative(process.cwd(), this.tokenFile)}`);
      return r.token;
    })();
    this.inflight.set(api, p);
    try {
      return await p;
    } finally {
      this.inflight.delete(api);
    }
  }

  /** Env override, else cached token (< 23h), else a new token. */
  async getToken(api: NjtApi): Promise<{ token: string; from: 'env' | 'cache' | 'new' }> {
    const envToken = nonEmpty(this.env[API_CONFIG[api].tokenEnv]);
    if (envToken) return { token: envToken, from: 'env' };
    const cached = this.cachedToken(api);
    if (cached) return { token: cached.token, from: 'cache' };
    return { token: await this.refreshToken(api), from: 'new' };
  }

  /** One POST with a token. Returns the zip bytes or throws NjtApiError. */
  private async postGtfs(api: NjtApi, token: string): Promise<Uint8Array> {
    const form = new FormData();
    form.set('token', token);
    const res = await this.fetchImpl(this.url(api, API_CONFIG[api].gtfsPath), {
      method: 'POST',
      headers: { accept: '*/*' },
      body: form,
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) {
      const em = await readErrorMessage(res);
      throw new NjtApiError(`njt ${api}: getGTFS HTTP ${res.status}${em ? `: ${em}` : ''}`, api, res.status, em);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!isZip(bytes)) {
      const preview = Buffer.from(bytes.slice(0, 200)).toString('utf8');
      let em: string | null = null;
      try {
        em = (JSON.parse(preview) as { errorMessage?: string }).errorMessage ?? null;
      } catch {
        /* not JSON */
      }
      throw new NjtApiError(
        `njt ${api}: getGTFS returned ${bytes.byteLength} B that is not a zip (content-type ${res.headers.get('content-type')})`,
        api,
        res.status,
        em,
      );
    }
    return bytes;
  }

  /**
   * Download the static GTFS zip. If the token is rejected as invalid, get one new token and retry once.
   * An env-override token is never refreshed (that would silently spend the daily limit).
   */
  async getGTFS(api: NjtApi): Promise<{ zip: Uint8Array; tokenFrom: 'env' | 'cache' | 'new'; retried: boolean; url: string }> {
    const url = this.url(api, API_CONFIG[api].gtfsPath);
    const { token, from } = await this.getToken(api);
    try {
      return { zip: await this.postGtfs(api, token), tokenFrom: from, retried: false, url };
    } catch (err) {
      if (!(err instanceof NjtApiError) || !err.isInvalidToken) throw err;
      if (from === 'env') {
        throw new NjtApiError(
          `njt ${api}: ${API_CONFIG[api].tokenEnv} was rejected as invalid; unset it to use the cache / username login`,
          api,
          err.status,
          err.errorMessage,
        );
      }
      if (from === 'new') throw err; // a token we just got is already invalid: don't loop
      this.log(`njt ${api}: cached token ${mask(token)} rejected (${err.errorMessage}); refreshing once`);
      const fresh = await this.refreshToken(api);
      return { zip: await this.postGtfs(api, fresh), tokenFrom: 'new', retried: true, url };
    }
  }
}
