# NJ Transit proof of concept (Phase 1)

Standalone package for **Phase 1 of [`todo.md`](../../todo.md)**: confirm we can get NJ Transit
static GTFS stops and run Pharmacy Searcher's basic transit logic (from `TECHSTACK.md`
"Core Logic") on them before building it into the app. Nothing here is imported by the
Next.js app. Promote code into `lib/` only after the phase passes.

## Go / no-go (Phase 1)

**GO, using the public GTFS zips snapshotted into our own store (SQLite in Phase 2). The token API is optional for the MVP.**

- `rail_data.zip` and `bus_data.zip` download with no account (10 s for both), parse cleanly (230 rail and 16,564 bus
  stops, 0 rows skipped, unique IDs, all inside the NJ/NY/PA box), include New Brunswick station, and give a
  stop 0.08 mi from the demo location. Every Phase 1 scope-logic check passes on the real data.
- The data only changes every few weeks (Last-Modified 17 Sep 2026; service dates 2026-09-15 to 2027-03-13), and
  NJT's terms say to serve the data from our own server, not NJT's. So **snapshot once at seed time** (`npm run fetch`,
  then import `stops.txt` into SQLite) and re-run it when the feed changes. Don't fetch at request time.
- Fallback if NJT's URL breaks: the Mobility Database mirrors (`mdb-509` rail, `mdb-508` bus), byte-identical
  today. `download.ts` falls back to them automatically.
- The token-API client is written and unit-tested with mocks. Against the live API, the routes and the bus
  bad-credential rejection are verified with fake values only.

**Still blocked on real credentials** (none were available, none were guessed):
- A successful `getToken` / `authenticateUser` and `getGTFS` download (the `real credentials` live tests are skipped).
- Whether the API zips differ from the public ones (bus G2 is said to add `calendar.txt` and `trips_internal.txt`),
  the real rail token lifetime, and whether bus auth has a daily limit. See API_NOTES.md section 5.
- None of these block the MVP. They only matter if we later want GTFS-RT (live arrivals), which does need the token API.

## Layout

```
poc/njtransit/
  package.json, tsconfig.json     standalone package (ESM, strict TS)
  vitest.config.ts                offline tests (npm test), excludes test/live/
  vitest.live.config.ts           live tests (npm run test:live), loads .env via test/live/setup.ts
  .env.example                    NJT_USERNAME / NJT_PASSWORD, optional token overrides, NJT_TEST_RAIL_AUTH
  src/
    constants.ts                  DEMO_LOCATION, NJ bounds, paths
    gtfs.ts                       parseStops(), extractStopsTxt(), loadStopsFromFile()
    geo.ts                        haversineMiles(), nearestStop(), stopsWithin(), nearestN()
    transit.ts                    TRANSPORT constants, walk/drive/transit estimates
    pharmacies.ts                 loaders for bigPharma/ NPPES + OSM CSVs
    download.ts                   public GTFS zip download (with mirror fallback), saveFeed(), meta.json
    njtClient.ts                  token API client (rail GTFSRT, bus GTFSG2) with token cache + one retry
  scripts/
    fetch.ts                      CLI: npm run fetch / npm run fetch:api
    explore.ts                    feed explorer (stop counts, bounds, ETAs, 1-5 mi demo candidates)
  test/
    fixtures/stops_{rail,bus}.txt hand-made New Brunswick-area stops (BOM, malformed row, quoted commas)
    gtfs|geo|transit|pharmacies.test.ts
    download.test.ts              download/fallback/freshness with a mocked fetch
    njtClient.test.ts             token caching, 23h refresh, single retry, env override, masking (mocked fetch)
    realFeed.test.ts              runs only if data/{rail,bus}/stops.txt exist
    live/public.test.ts           public zips + mirrors respond with a zip (4-byte ranged GET)
    live/api.test.ts              route existence, bad credentials, real-credential download (skipped without creds)
  data/                           gitignored
    rail/, bus/                   feed.zip, stops.txt, meta.json from the public zips
    api/rail/, api/bus/           the same from the token API (npm run fetch:api)
    tokens.json                   cached API tokens { rail|bus: { token, issuedAt } }, mode 600
```

API notes (endpoints, auth, rate limits, terms) are in `API_NOTES.md`, maintained separately.

## Running

Node 22.12+.

```sh
npm install
npm run typecheck
npm run fetch               # public zips -> data/{rail,bus}/ (no account; skipped if < 7 days old)
npm test                    # offline, deterministic; realFeed.test.ts runs once data/ is fetched
npm run test:live           # live tests; the credentialed ones skip without NJT_USERNAME

# Explore a feed: stops.txt or a GTFS zip, any number of <file> <bus|rail> pairs. No credentials needed.
npx tsx scripts/explore.ts data/rail/stops.txt rail data/bus/stops.txt bus
npx tsx scripts/explore.ts test/fixtures/stops_rail.txt rail test/fixtures/stops_bus.txt bus
```

### Fetching feeds

```sh
npm run fetch                          # both public feeds
npm run fetch -- --type rail --force   # just rail, even if fresh
npm run fetch:api                      # token API -> data/api/{rail,bus}/ (needs .env creds)
npm run fetch:api -- --type bus
```

`scripts/fetch.ts` takes `--source public|api` (default `public`), `--type rail|bus|all` (default `all`) and
`--force`. Public downloads follow NJT's two redirects and fall back to the Mobility Database mirror if the
primary fails or doesn't return a zip. Each feed directory gets `feed.zip`, `stops.txt` and `meta.json`
(source and final URL, bytes, Last-Modified, downloadedAt, file list, `feed_info.txt` if present, and the service date
range from `calendar.txt`/`calendar_dates.txt`). Existing feeds under 7 days old are skipped unless `--force` is passed.
API feeds go to `data/api/` so they can be compared with the public ones.

### Token caching (`src/njtClient.ts`)

Rail `getToken` and `isValidToken` share a limit of **10 calls/day**, so a token is never requested per call:

- Tokens are stored in `data/tokens.json` as `{ "rail": { "token", "issuedAt" }, "bus": { ... } }` (file mode 600)
  and reused until they are **23 hours** old (NJT tokens last about 24h).
- If `getGTFS` answers "Invalid token" for a cached token, the client requests **one** new token and retries
  **once**. If the new token is also rejected, or a token that was just issued is rejected, it throws instead of looping.
  Other errors, such as `Daily usage limit`, are not retried.
- `NJT_RAIL_TOKEN` / `NJT_BUS_TOKEN` override the cache. They are never refreshed automatically: if one is rejected,
  you get an error telling you to unset it.
- Concurrent calls share one in-flight token request.
- Credentials come from `poc/njtransit/.env` (loaded with Node's `process.loadEnvFile`; no dotenv). Logs show only a
  masked token (`abcd…89 (36 chars)`) and a masked password, never the full values.
- `--force` on `fetch:api` re-downloads the zip. It does not force a new token.

### Live tests

| Test | Needs | Token-limit cost |
|---|---|---|
| Public zips + mirrors respond with a zip (4-byte ranged GET) | nothing | none |
| `GTFSRT/getGTFS` and `GTFSG2/getGTFS` reject a dummy token with "Invalid token" (not 404), plus a 404 control | nothing | none |
| Bus `authenticateUser` returns `Authenticated: "False"` for fake credentials | nothing | none documented |
| Rail `getToken` rejects fake credentials | `NJT_TEST_RAIL_AUTH=1` | 1 call |
| Authenticate (through the cache), `getGTFS`, parse a non-empty `stops.txt`, compare with the public stop count | `NJT_USERNAME` + `NJT_PASSWORD` in `.env` | at most 1 rail call per 23h |

To run the credentialed tests: `cp .env.example .env`, fill in `NJT_USERNAME` and `NJT_PASSWORD` (the
developer.njtransit.com login enrolled in the GTFS-RAIL and GTFS-BUS apps), then `npm run fetch` (for the
comparison) and `npm run test:live`. Add `NJT_TEST_RAIL_AUTH=1 npm run test:live` once to also check the rail bad-credentials path.

## Logic implemented

`TRANSPORT` in `src/transit.ts` uses the TECHSTACK values: walk 3 mph, max comfortable walk 0.5 mi,
max walk to stop 0.4 mi, bus 20 mph, train 35 mph, wait 10 min, max car 15 mi, car $0.70/mi.
Three values are additions:

- **Bus fare $2.90, train fare $7.50**: TECHSTACK gives ranges ($2–4, $5–10), so we hardcoded one value in each.
- **CAR_MPH = 25**: average city driving speed. TECHSTACK doesn't set one.

All distances are straight-line (haversine). Limits are inclusive, with a 1e-9 mi tolerance so a
distance exactly at a limit isn't rejected because of floating-point rounding.

- `walkEstimate`: miles, minutes, feasible if ≤ 0.5 mi.
- `driveEstimate`: miles, minutes at 25 mph, cost at $0.70/mi, feasible if ≤ 15 mi.
- `transitEstimate`: walk to the nearest stop + 10 min wait + (stop-to-stop straight line ÷ mode speed)
  + walk from the nearest stop. The nearest stop is chosen across bus and rail combined. Mode is rail only if both
  stops are rail, otherwise bus. The trip is infeasible if either walk is over 0.4 mi. It is also infeasible
  if both ends snap to the same stop, a rule we added: the ride would be zero and the user should just walk.
  The result includes the breakdown, distances, stops and fare. There are no schedules, routes or transfers.

## Status

Done:
- [x] Standalone package, `.env.example`, local `.gitignore` (`node_modules/`, `.env`, `data/`, `*.zip`)
- [x] `stops.txt` parser handling BOM, quoting, extra/missing columns and CRLF, with a count of skipped rows, plus zip extraction
- [x] Geo helpers and the TECHSTACK transit heuristic
- [x] Pharmacy loaders for both `bigPharma/` sources
- [x] Public GTFS download with mirror fallback, freshness check and `meta.json` (`npm run fetch`)
- [x] Token API client with a 23h token cache, single retry, env overrides and masking (`npm run fetch:api`)
- [x] Offline tests (80, including 8 against the real feeds) and live tests (8 run without creds, 5 skipped)
- [x] Snapshot vs fetch decided (snapshot at seed time), go/no-go written (above)

Blocked on real credentials:
- [ ] A successful authentication and API `getGTFS` download (`real credentials` live tests)

## Findings

### Real feeds (public zips, fetched 2026-10-10)

| Feed | Zip | Stops | Skipped | Outside NJ box | Outside NJ/NY/PA box | Service dates |
|---|---|---|---|---|---|---|
| rail | 6,380,384 B | 230 | 0 | 4 (Campbell Hall, Middletown NY, Otisville, Salisbury Mills-Cornwall) | 0 | 20260915–20270313 |
| bus | 49,841,237 B | 16,564 | 0 | 0 | 0 | 20260915–20270313 |

- Both zips are Last-Modified 17 Sep 2026 and have no `feed_info.txt` or `calendar.txt`; service dates come from `calendar_dates.txt`.
- `realFeed.test.ts` passed on the real data with **no assertion changes and no code fixes**: non-empty, unique IDs,
  all within NJ/NY/PA, a rail stop named `NEW BRUNSWICK` (id 103, 40.497278, −74.445751), and a stop within 0.4 mi of
  the demo location.
- Stop names are upper-case in both feeds (`NEW BRUNSWICK`, `GEORGE ST AT ALBANY ST`), so the app should title-case them for display.

### Demo location (40.4962, −74.4455)

- Nearest rail: **NEW BRUNSWICK (103), 0.08 mi**. The next rail stops are Jersey Ave 1.76 mi and Edison 2.41 mi.
- Nearest bus: **GEORGE ST AT ALBANY ST (15562), 0.12 mi**, then Somerset St at George St 0.14 mi and Easton Ave at Somerset St 0.17 mi.
- 8 stops (bus + rail) within 0.4 mi.

### Transit ETAs to the 5 nearest pharmacies (real stops)

| Pharmacy | Miles | Walk | Drive | Transit (heuristic) |
|---|---|---|---|---|
| Rite Aid, 366 George St | 0.11 | 2.2 min | 0.3 min, $0.08 | infeasible: both ends snap to NEW BRUNSWICK station (just walk) |
| Medverro, 46 Bayard St | 0.16 | 3.3 min | 0.4 min, $0.11 | 16.3 min, $2.90 bus (NB station to George St 55'S of New St) |
| Walgreens, 165 Somerset St | 0.21 | 4.2 min | 0.5 min, $0.15 | 14.1 min, $2.90 bus (to Easton Ave at Somerset St) |
| University Pharmacy and Surgical, 303 George St | 0.29 | 5.7 min | 0.7 min, $0.20 | 13.7 min, $2.90 bus |
| St Mina Pharmaceutical, 303 George St | 0.30 | 5.9 min | 0.7 min, $0.21 | 13.4 min, $2.90 bus |

All five are walkable, and transit is dominated by the 10 min wait. That is correct but makes for a weak demo.

### Demo pharmacy 1–5 mi away

Of 90 distinct pharmacy addresses 1–5 mi away, 44 are transit-feasible and 46 are not (far end over 0.4 mi from a stop,
e.g. the Route 1 Edison strip at 4.29 mi has its nearest stop 0.45 mi away).

**Recommended: CVS, 949 Livingston Ave, North Brunswick (2.21 mi).** Drive 5.3 min / $1.54 vs transit
18.9 min / $2.90 by bus (NB station to Livingston Ave at 14th St, 0.02 mi walk at the far end). Walking is out (2.2 mi). It's a
recognizable brand, transit is about 3.5x slower than driving, and both options are feasible, so the comparison is meaningful.
Alternatives: PKS Compounding, 1903 Route 27, Edison (2.80 mi, drive 6.7 vs transit 20.0 min) and Advanced Rx,
21 N Main St, Milltown (3.11 mi, 7.5 vs 21.5 min). For an infeasible-transit example, use BJ's, 1000 US Hwy 1, Edison (4.29 mi).

### Heuristic caveat found on real data (not changed; for Phase 2)

`transitEstimate` snaps each end to the nearest stop across bus and rail combined, and uses rail only if **both** ends
are rail. With 16,564 bus stops vs 230 rail stops, the destination almost always snaps to a bus stop, so a feasible rail trip
comes out for only 121 of 4,121 pharmacies statewide and for **none** within 1–5 mi. Example: Boyt Drug Store,
411 Main St, Metuchen (5.41 mi) comes out at 28.2 min by "bus" from NB station. A rail-only estimate
(NB to Metuchen station, 0.07 mi walk) gives **22.2 min at $7.50**. The origin also snaps to the rail station but is priced as a bus ride.
Suggested Phase 2 change: compute bus-only and rail-only estimates and return the faster feasible one (or both). This was left
as specified in TECHSTACK because it's a product decision, not a bug. `explore.ts` prints the rail-only alternative.

### Pharmacy data (`bigPharma/`)

- `nj_pharmacies_geocoded.csv` (NPPES): 3,731 rows. **3,586 loaded, 145 skipped** for empty lat/lon.
- `pharmacies_osm.csv` (OSM): **535 loaded, 0 skipped**.
- Combined: 4,121 pharmacies. **0 fall outside** the NJ bounds (lat 38.8–41.4, lng −75.6 to −73.8).
- **NPI is not unique per location.** 14 NPPES rows have `location_type=secondary`, and 9 NPIs cover
  21 loaded rows (12 extra rows). For example, T & F DRUGS INC has 5 locations under one NPI, and
  PHARMACY VALUE LLC has a primary and a secondary row with the same address. IDs are therefore
  `nppes:<row id>`, with the NPI kept in `npi`. The OSM IDs (`osm:node/…`) are unique.
- **The two sources overlap.** Loading both double-counts some stores. For example, 303 George St
  appears as both "University Pharmacy and Surgical" [osm] and "ST MINA PHARMACEUTICAL LLC" [nppes].
  Phase 2 needs to pick one source or de-duplicate by proximity and name.
- 20 pharmacies are within 1 mi of `DEMO_LOCATION` (40.4962, −74.4455). The 5 nearest:

  | Miles | Pharmacy | Source | Address |
  |---|---|---|---|
  | 0.11 | RITE AID OF NEW JERSEY INC | nppes | 366 George St, New Brunswick |
  | 0.16 | MEDVERRO LLC | nppes | 46 Bayard St Ste 308, New Brunswick |
  | 0.21 | WALGREEN CO | nppes | 165 Somerset St, New Brunswick |
  | 0.29 | University Pharmacy and Surgical | osm | 303 #105 George St, New Brunswick |
  | 0.30 | ST MINA PHARMACEUTICAL LLC | nppes | 303 George St, New Brunswick |

**Geo sanity:** New Brunswick station → Princeton Junction is **15.58 mi** straight-line (checked by hand:
12.45 mi N–S, 9.38 mi E–W). The ~14 mi figure in the brief was low; by rail it's about 24 track miles.
