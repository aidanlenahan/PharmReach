# Pharmacy Searcher — Implementation TODO

Product scope and requirements live in [PRD.md](./PRD.md); stack decisions live in [TECHSTACK.md](./TECHSTACK.md). Work through the phases in order, with the stack and shared contracts established before feature implementation.

## Phase 0 — Set up the tech stack and repository

- [ ] Confirm the stack and MVP constants in `TECHSTACK.md` with the team.
- [x] Initialize the all-TypeScript Next.js App Router application.
- [x] Set up Node 20+, package scripts, TypeScript, and the agreed CSS approach.
- [x] Add the core dependencies: Leaflet 1.9.4/react-leaflet, leaflet.markercluster (`react-leaflet-cluster`), Fuse.js, SQLite (`better-sqlite3`), and Gemini (`@google/genai`).
- [x] Create the initial app/API folder structure and a working local development command.
- [x] Add `.env.example` (`GEMINI_API_KEY`, `NEXT_PUBLIC_CARTO_KEY`); keep actual credentials in local/VM-only `.env` files.
- [ ] Move the CARTO key hardcoded in `bigPharma/` scripts and HTML into `.env` before committing `bigPharma/`, and restrict the key to our domain.
- [ ] Add or confirm `CLAUDE.md` and `AGENTS.md` with the stack, constants, and folder ownership from `TECHSTACK.md`.
- [ ] Verify a clean install and that the starter app runs locally.

## Phase 1 — Proof of concept: NJ Transit API

Before building on NJ Transit data, confirm we can reach the API, get the static GTFS stops, and run the scope's basic transit logic on them. All work for this phase lives in `poc/njtransit/`, kept separate from the app. Promote code into the app only after the phase passes.

- [x] Create `poc/njtransit/` with its own README, `.env.example`, and test command; gitignore its `.env` and downloaded feed data.
- [ ] Register for NJ Transit developer access and store the credentials in `poc/njtransit/.env`.
- [x] Write a minimal client that authenticates and downloads the bus and rail static GTFS feeds.
- [x] Parse `stops.txt` from each feed and confirm the fields we need (`stop_id`, `stop_name`, `stop_lat`, `stop_lon`) and the bus/rail distinction.
- [ ] Write connectivity tests covering successful authentication, rejection of bad credentials, feed download, and a non-empty stop list. (Written; the successful-auth tests skip until real credentials are in `poc/njtransit/.env`.)
- [x] Write data tests checking that coordinates fall within New Jersey bounds, IDs are unique, and the expected New Brunswick stops are present (for example, New Brunswick rail station).
- [x] Write scope-logic tests from the fixed New Brunswick demo location: nearest stop, stops within the walking-comfort radius, and a heuristic transit ETA to a few pharmacies from `bigPharma/`.
- [x] Record rate limits, token expiry, and terms of use, then decide whether to snapshot the feeds once or fetch them at seed time.
- [x] Write a go/no-go summary in the POC README. If the API doesn't work for our scope, identify a fallback GTFS source.
- [x] Cache the API token in `poc/njtransit/data/` along with when it was issued, and reuse it until it expires. Rail `getToken` is limited to 10 calls per day and tokens last about 24 hours, so running the live tests repeatedly must not request a new token every time.

## Phase 2 — Define shared contracts and prepare data

- [ ] Implement `lib/types.ts` as the shared source of truth for pharmacy, drug, inventory, search request/result, and transport mode types.
- [ ] Create the SQLite schema and database initialization/seeding path.
- [ ] Build the drug JSON dataset with generic names, brand names, and strengths.
- [ ] Import New Jersey pharmacy locations into the database, starting from the data already pulled in `bigPharma/` (OSM `pharmacies_osm.csv` or geocoded NPPES `nj_pharmacies_geocoded.csv`).
- [ ] Import NJ Transit static GTFS bus and rail stops from `stops.txt`, using the public `rail_data.zip`/`bus_data.zip` snapshot (Phase 1 go/no-go: no token needed). Reuse `poc/njtransit/src/gtfs.ts` and `download.ts`.
- [ ] Pick one pharmacy source or remove duplicates (OSM and NPPES overlap, e.g. 303 George St).
- [ ] Transit heuristic: compute bus-only and rail-only estimates and take the faster feasible one (combined nearest-stop snapping almost always picks bus).
- [ ] Generate deterministic simulated inventory and prices with a fixed seed.
- [ ] Verify seeded data covers the rehearsed demo drugs and locations.

## Phase 3 — Build location, map, and medication search

- [ ] Implement current-location lookup with browser geolocation.
- [ ] Add manual address entry and Nominatim geocoding as the fallback.
- [ ] Port the `bigPharma/pharmacy_map.html` prototype to a client-only react-leaflet component with CARTO Voyager tiles and OSM/CARTO attribution.
- [ ] Display pharmacy markers as clustered canvas circle markers, plus the selected user location.
- [ ] Implement drug autocomplete with fuzzy matching and strength selection.
- [ ] Add preference controls for walking, transit, and driving.

## Phase 4 — Implement search, transportation, and ranking

- [ ] Implement distance and radius calculations, including nearest transit-stop lookup.
- [ ] Apply the preset walk, transit-stop, and driving comfort thresholds from `TECHSTACK.md`.
- [ ] Estimate walking, driving, and heuristic transit ETAs.
- [ ] Calculate medication plus transportation cost.
- [ ] Rank in-stock pharmacy results by preferred-mode reachability, cost, and ETA.
- [ ] Implement `POST /api/search` with the shared request/result types.
- [ ] Connect the search UI to the API and show ranked pharmacy results on the map and in a list.

## Phase 5 — Add the Gemini medication helper

- [ ] Implement `POST /api/chat` with server-side Gemini access.
- [ ] Constrain structured drug suggestions to IDs and names in the local drug dataset.
- [ ] Build the chat UI and interactive suggestion buttons.
- [ ] Selecting a suggestion should populate and run the corresponding medication search.
- [ ] Show the non-medical-advice and simulated-stock disclaimers.

## Phase 6 — Integrate and validate the MVP

- [ ] Exercise the end-to-end flow for location, medication/strength selection, and ranked results.
- [ ] Check fallback behavior when geolocation is denied or address geocoding fails.
- [ ] Verify transportation preferences affect reachability and ranking as expected.
- [ ] Verify unavailable/out-of-stock inventory cannot appear as an in-stock match.
- [ ] Verify the Gemini helper cannot suggest a drug absent from the local dataset.
- [ ] Test the responsive layout and confirm the hosted HTTPS flow supports geolocation.
- [ ] Fix integration issues and freeze MVP scope before taking on stretch work.

## Phase 7 — Prepare and ship the demo

- [ ] Prepare the fixed New Brunswick demo location and rehearse 2–3 drug searches.
- [ ] Configure the Proxmox VM, Node runtime, and process manager.
- [ ] Configure Cloudflare Tunnel, the `.tech` domain, and HTTPS.
- [ ] Add and verify the deployment script and production environment configuration.
- [ ] Take a Proxmox snapshot after setup and confirm the app remains runnable locally.
- [ ] Record a demo video and complete the Devpost submission.

## Phase 8 — Stretch work (only after MVP feature freeze)

Pick up in the priority order in the [PRD](./PRD.md), starting with Gemini transportation help.

### NJ Transit API hardening (post-MVP)

The MVP uses the public static GTFS zips (`njtransit.com/rail_data.zip`, `bus_data.zip`) snapshotted into SQLite, so it needs no token. These tasks only matter once we call the token API, for example for real-time data or scheduled feed refreshes. See `poc/njtransit/API_NOTES.md`.

- [ ] **Token expiry (do this first):** store the token server-side with its issue time, refresh it before the ~24 h expiry, and on an `Invalid token` response, get a new token once and retry. Never request a new token on every call.
- [ ] Stay under the 10/day rail `getToken` + `isValidToken` limit: refresh tokens from one place (a single scheduled job), and log or alert when we get close.
- [ ] Rate-limit and back off outgoing NJT requests (100,000/day portal cap); cache responses and have the app read from our own store, as the terms require, not proxy NJT directly.
- [ ] Refresh the static GTFS on a schedule (the feeds were last updated 2026-09-17 and cover service through 2027-03-13), and check the service end date so the stop data doesn't go stale.
- [ ] Fall back to the public zips or the Mobility Database mirror when the token API is down or the credentials stop working. Keep real-time transit, business-data integration, crowd-sourced corrections, insurance/budgeting, accounts, and mobile/PWA work out of the hackathon MVP.