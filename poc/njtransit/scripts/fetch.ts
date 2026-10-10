/**
 * Fetch NJ Transit static GTFS feeds into data/.
 *
 *   npm run fetch                         # public zips (no account) -> data/{rail,bus}/
 *   npm run fetch -- --type rail --force  # re-download rail even if fresh
 *   npm run fetch:api                     # token API (needs NJT_USERNAME/NJT_PASSWORD in .env) -> data/api/{rail,bus}/
 *
 * Options: --source public|api (default public), --type rail|bus|all (default all), --force.
 * --force skips the 7-day freshness check. With --source api it does NOT force a new token: tokens
 * always come from data/tokens.json while under 23h old (rail getToken is limited to 10/day).
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DATA_DIR } from '../src/constants.ts';
import { API_DATA_DIR, FEED_TYPES, downloadPublicFeed, feedAgeMs, readMeta, saveFeed, type FeedMeta, type FeedType } from '../src/download.ts';
import { loadStopsFromFile } from '../src/gtfs.ts';
import { NjtClient, loadEnv } from '../src/njtClient.ts';

const { values } = parseArgs({
  options: {
    source: { type: 'string', default: 'public' },
    type: { type: 'string', default: 'all' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log('usage: tsx scripts/fetch.ts [--source public|api] [--type rail|bus|all] [--force]');
  process.exit(0);
}
if (values.source !== 'public' && values.source !== 'api') throw new Error(`--source must be public or api, got ${values.source}`);
if (!['rail', 'bus', 'all'].includes(values.type)) throw new Error(`--type must be rail, bus or all, got ${values.type}`);
const types: readonly FeedType[] = values.type === 'all' ? FEED_TYPES : [values.type as FeedType];

function summary(meta: FeedMeta | null, dir: string, type: FeedType) {
  if (!meta) return;
  const stopsFile = path.join(dir, type, 'stops.txt');
  const { stops, skipped } = loadStopsFromFile(stopsFile, type);
  const range = meta.serviceDateRange ? `${meta.serviceDateRange.start}..${meta.serviceDateRange.end}` : 'n/a';
  console.log(
    `${type}: ${stops.length} stops (${skipped} skipped), ${meta.bytes.toLocaleString()} B, service ${range}, ` +
      `feed_info ${meta.feedInfo ? JSON.stringify(meta.feedInfo) : 'none'} -> ${path.relative(process.cwd(), stopsFile)}`,
  );
}

let failed = false;
if (values.source === 'public') {
  for (const type of types) {
    try {
      const r = await downloadPublicFeed(type, { force: values.force });
      summary(r.meta, DATA_DIR, type);
    } catch (err) {
      failed = true;
      console.error((err as Error).message);
    }
  }
} else {
  loadEnv();
  const client = new NjtClient();
  for (const type of types) {
    try {
      const age = feedAgeMs(type, API_DATA_DIR);
      if (!values.force && age !== null && age < 7 * 24 * 3600 * 1000) {
        console.log(`${type}: API copy is fresh (${(age / 86_400_000).toFixed(1)} days old), skipping. Use --force.`);
        summary(readMeta(type, API_DATA_DIR), API_DATA_DIR, type);
        continue;
      }
      const r = await client.getGTFS(type);
      console.log(`${type}: getGTFS ok (token from ${r.tokenFrom}${r.retried ? ', after one refresh' : ''})`);
      summary(saveFeed(type, r.zip, { source: 'api', url: r.url }, API_DATA_DIR), API_DATA_DIR, type);
    } catch (err) {
      failed = true;
      console.error((err as Error).message);
    }
  }
}
process.exit(failed ? 1 : 0);
