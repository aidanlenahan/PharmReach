# Pharmacy Searcher — Implementation TODO

Product scope and requirements live in [PRD.md](./PRD.md); stack decisions live in [TECHSTACK.md](./TECHSTACK.md). Work through the phases in order, with the stack and shared contracts established before feature implementation.

## Phase 0 — Set up the tech stack and repository

- [ ] Confirm the stack and MVP constants in `TECHSTACK.md` with the team.
- [ ] Initialize the all-TypeScript Next.js App Router application.
- [ ] Set up Node 20+, package scripts, TypeScript, and the agreed CSS approach.
- [ ] Add the core dependencies: Leaflet/react-leaflet, Fuse.js, SQLite (`better-sqlite3`), and Gemini (`@google/genai`).
- [ ] Create the initial app/API folder structure and a working local development command.
- [ ] Add `.env.example`; keep actual credentials in local/VM-only `.env` files.
- [ ] Add or confirm `CLAUDE.md` and `AGENTS.md` with the stack, constants, and folder ownership from `TECHSTACK.md`.
- [ ] Verify a clean install and that the starter app runs locally.

## Phase 1 — Define shared contracts and prepare data

- [ ] Implement `lib/types.ts` as the shared source of truth for pharmacy, drug, inventory, search request/result, and transport mode types.
- [ ] Create the SQLite schema and database initialization/seeding path.
- [ ] Build the drug JSON dataset with generic names, brand names, and strengths.
- [ ] Import New Jersey pharmacy locations from OpenStreetMap Overpass into the database.
- [ ] Import NJ Transit static GTFS bus and rail stops from `stops.txt`.
- [ ] Generate deterministic simulated inventory and prices with a fixed seed.
- [ ] Verify seeded data covers the rehearsed demo drugs and locations.

## Phase 2 — Build location, map, and medication search

- [ ] Implement current-location lookup with browser geolocation.
- [ ] Add manual address entry and Nominatim geocoding as the fallback.
- [ ] Build the pharmacy map with Leaflet and OpenStreetMap/CARTO tiles.
- [ ] Display pharmacy markers and the selected user location.
- [ ] Implement drug autocomplete with fuzzy matching and strength selection.
- [ ] Add preference controls for walking, transit, and driving.

## Phase 3 — Implement search, transportation, and ranking

- [ ] Implement distance and radius calculations, including nearest transit-stop lookup.
- [ ] Apply the preset walk, transit-stop, and driving comfort thresholds from `TECHSTACK.md`.
- [ ] Estimate walking, driving, and heuristic transit ETAs.
- [ ] Calculate medication plus transportation cost.
- [ ] Rank in-stock pharmacy results by preferred-mode reachability, cost, and ETA.
- [ ] Implement `POST /api/search` with the shared request/result types.
- [ ] Connect the search UI to the API and show ranked pharmacy results on the map and in a list.

## Phase 4 — Add the Gemini medication helper

- [ ] Implement `POST /api/chat` with server-side Gemini access.
- [ ] Constrain structured drug suggestions to IDs and names in the local drug dataset.
- [ ] Build the chat UI and interactive suggestion buttons.
- [ ] Selecting a suggestion should populate and run the corresponding medication search.
- [ ] Show the non-medical-advice and simulated-stock disclaimers.

## Phase 5 — Integrate and validate the MVP

- [ ] Exercise the end-to-end flow for location, medication/strength selection, and ranked results.
- [ ] Check fallback behavior when geolocation is denied or address geocoding fails.
- [ ] Verify transportation preferences affect reachability and ranking as expected.
- [ ] Verify unavailable/out-of-stock inventory cannot appear as an in-stock match.
- [ ] Verify the Gemini helper cannot suggest a drug absent from the local dataset.
- [ ] Test the responsive layout and confirm the hosted HTTPS flow supports geolocation.
- [ ] Fix integration issues and freeze MVP scope before taking on stretch work.

## Phase 6 — Prepare and ship the demo

- [ ] Prepare the fixed New Brunswick demo location and rehearse 2–3 drug searches.
- [ ] Configure the Proxmox VM, Node runtime, and process manager.
- [ ] Configure Cloudflare Tunnel, the `.tech` domain, and HTTPS.
- [ ] Add and verify the deployment script and production environment configuration.
- [ ] Take a Proxmox snapshot after setup and confirm the app remains runnable locally.
- [ ] Record a demo video and complete the Devpost submission.

## Phase 7 — Stretch work (only after MVP feature freeze)

Pick up in the priority order in the [PRD](./PRD.md), starting with Gemini transportation help. Keep real-time transit, business-data integration, crowd-sourced corrections, insurance/budgeting, accounts, and mobile/PWA work out of the hackathon MVP.