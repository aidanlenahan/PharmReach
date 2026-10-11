# PharmReach — Implementation TODO

Product scope and requirements live in [PRD.md](./PRD.md); stack decisions live in [TECHSTACK.md](./TECHSTACK.md). Work through the phases in order, with the stack and shared contracts established before feature implementation.

> **Status (2026-10-11):** Live at https://pharmreach.tech. The app is a Python stdlib server (`backend/serve.py`) serving a Vite + React 19 frontend (`frontend/`), with OpenTripPlanner routing and real CVS/Walgreens snapshots (34 products, 38 stores across Hudson County). It replaced the Next.js/SQLite plan. Checked items describe what was actually built. `backend/` and `frontend/` are in git. `bigPharma/`, `poc/`, and `frontend/README.md` are gitignored/local only. Remaining work is mostly demo prep (Phases 6–7).

## Phase 0 — Set up the tech stack and repository

- [ ] Update `TECHSTACK.md` to the stack we built (Vite/React + Python stdlib + OTP); it still describes the Next.js/SQLite plan.
- [x] Initialize the Vite + React + TypeScript multi-page frontend (dropped the Next.js plan).
- [x] Set up Node 22.12+, pnpm scripts, TypeScript, and plain CSS.
- [x] Add the core dependencies: React, `lucide-react`, Leaflet 1.9.4 (CDN). The backend uses only the Python stdlib; Gemini goes over REST and data lives in JSON (no Fuse.js, SQLite, or `@google/genai`).
- [x] Create the initial app/API folder structure and a working local development command.
- [x] Add `.env.example`; keep actual credentials in local/VM-only `.env` files and `/etc/hackru.env`.
- [x] Move the CARTO key hardcoded in `bigPharma/` scripts and HTML into `bigPharma/.env` (scripts render a gitignored `pharmacy_map.local.html`; the committed HTML keeps a `__CARTO_KEY__` placeholder).
- [x] Restrict the CARTO key to our domain in the CARTO dashboard.
- [ ] Add `CLAUDE.md` and `AGENTS.md` with the actual stack and folder layout (neither exists yet).
- [x] Build the Vite frontend and run the app locally with `python3 backend/serve.py` (or `backend/otp/run_demo_with_otp.sh` for live OTP).
- [ ] Verify a clean install from scratch using `frontend/SETUP.md`.

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

- [x] Define the frontend types (`Mode`, `TransitType`, `TravelPreferences`, `Route`, `PharmacyRecord`) in `frontend/src/core.ts`.
- [x] Store pharmacy, product, and inventory snapshots as JSON in `backend/data/`, loaded by `serve.py` on each request.
- [x] Build the OTC product catalog with names, brand aliases (`aka`), strengths, and quantity variants.
- [x] Record verified Hoboken-area CVS (9) and Walgreens/Duane Reade (7) branches with sourced coordinates in the retailer snapshots.
- [x] Stage the NJ TRANSIT bus and rail GTFS zips into the OpenTripPlanner graph (`backend/otp/`).
- [x] Use the retailer store locators as the single pharmacy source, with one record per branch (no OSM/NPPES overlap).
- [x] Use OTP schedule-aware transit routing, filtered by the user's allowed transit types, with local estimates as the fallback.
- [x] Capture real CVS/Walgreens availability and online prices as dated snapshots with the attended capture scripts (`backend/scripts/`).
- [x] Curate the snapshot data around the Hoboken demo area and demo search terms (Pepto-Bismol, ibuprofen, Advil, Tylenol).

## Phase 3 — Build location, map, and medication search

- [x] Implement current-location lookup with browser geolocation.
- [x] Add manual address or lat/long entry, geocoded against a bundled OSM address index (`/api/geocode`) instead of Nominatim.
- [x] Build a Leaflet results map with OSM tiles and attribution that draws the selected pharmacy's route.
- [x] Show pharmacy markers as pins colored by stock status, with tooltips and click-to-select.
- [x] Show the user's starting location on the map (pin + legend entry).
- [x] Implement a medication combobox that matches every search term across name, strength, aka, and search terms, plus a strength/form/amount variant picker on results.
- [x] Add preference controls for walking, transit, driving (with optional MPG), and cycling.
- [x] Make Ctrl/⌘ + scroll zoom the maps so page scrolling isn't hijacked.
- [x] Serve pages at clean URLs (`/results`, `/settings`, …) with 301s from `.html`.

## Phase 4 — Implement search, transportation, and ranking

- [x] Derive route distance and walking miles from OTP itinerary legs, plus a check that flags when the start point is at the pharmacy.
- [ ] Apply the preset walk, transit-stop, and driving comfort thresholds from `TECHSTACK.md`. (Only the user's own walking limit is enforced today.)
- [x] Get walk, transit, drive, and bike ETAs from OpenTripPlanner, falling back to static per-pharmacy estimates.
- [x] Calculate medication plus transportation cost, including gas cost from the user's MPG ($3.10/gal).
- [x] Sort results by a user-chosen option (Best match, arrival, travel time, medication/travel/total cost, name, availability), keeping unavailable options last and hiding modes the user's preferences rule out.
- [x] Implement `GET /api/pharmacies` (plus `/api/medications`, `/api/geocode`, `/api/catalog-summary`) with TypeScript types on the frontend mirroring the response.
- [x] Connect the search UI to the API and show ranked pharmacy results on the map and in a list.

## Phase 5 — Gemini medication helper (chatbot)

Goal: a user describes a symptom (for example, "headache") and gets up to 3 OTC products from our catalog, each linking to the results page, which already ranks stores by their travel preferences. It is not a diagnosis tool. The model's output is locked down: it can only return product IDs from our catalog, and the server writes all text the user sees.

### Stage 5.0 — Decisions

- [x] ~~Decided on templated replies only; the model returns product IDs and the server writes all text.~~
- [x] ~~Decided to link to the results page only (plus the retailer product page), with no inline best store.~~
- [x] ~~Decided to put the chat next to the home search as "Don't know the name? Describe how you feel."~~

### Stage 5.1 — Key and config

- [x] ~~Load `GEMINI_API_KEY` in `serve.py` from the environment, with a small repo-root `.env` loader (`backend/envfile.py`).~~
- [x] ~~Add `GEMINI_API_KEY` to `/etc/hackru.env` on the VM so `hackru.service` picks it up.~~ (`/api/health` on prod reports `chat_configured: true`.)
- [x] ~~Pin the Gemini Flash model ID (`gemini-3.8-flash` in `backend/chat.py`, overridable with `GEMINI_MODEL`) and confirm the key works with a test call.~~
- [x] ~~Make `/api/health` report whether the chat helper is configured, without exposing the key.~~

### Stage 5.2 — Endpoint and guardrails

- [x] ~~Implement `POST /api/chat` with server-side Gemini access (stdlib `urllib`, no SDK).~~
- [x] ~~Validate input: JSON only, a capped body size, and one message of about 300 characters or less.~~
- [x] ~~Rate-limit per client IP and add a timeout on the Gemini call.~~
- [x] ~~Check messages before calling Gemini. Emergencies (chest pain, overdose, suicidal thoughts, trouble breathing) get a fixed 911/988 message. Prescription, pregnancy, and child-dosing questions get "ask a pharmacist." None of these reach the model.~~
- [x] ~~Log requests (no keys, trimmed messages) for demo debugging.~~

### Stage 5.3 — Constrained model output

- [x] ~~Write a fixed system instruction: map symptoms to OTC catalog categories only, never diagnose or give dosing, and ignore instructions in the user's message.~~
- [x] ~~Use `responseMimeType: application/json` with a `responseSchema`: `status` enum (`match` / `no_match` / `refuse`), `category` enum (the catalog categories), and `product_ids`, an enum of in-stock catalog IDs (max 3).~~
- [x] ~~Constrain structured drug suggestions to IDs and names in the local drug dataset: on the server, drop unknown IDs and products with no confirmed stock, and return a fixed fallback for invalid JSON.~~
- [x] ~~Build every reply the user sees from server templates, using product names and categories from our data (no free text from the model).~~
- [x] ~~Set Gemini safety settings to the strictest level.~~

### Stage 5.4 — Chat UI

- [x] ~~Build the chat UI and interactive suggestion buttons (plain text rendering only, no HTML or markdown).~~
- [x] ~~Selecting a suggestion should populate and run the corresponding medication search (`/results?medication=<id>`, using saved travel preferences).~~
- [x] ~~Add a secondary link on each suggestion to the retailer product page (`product_source`).~~
- [x] ~~Show the non-medical-advice and snapshot-data disclaimers (none exist in the UI yet).~~
- [x] ~~Handle loading, error, rate-limited, and "helper unavailable" states.~~

### Stage 5.5 — Abuse and quality tests

- [x] ~~Script a test set: common symptoms (headache, allergies, heartburn, cough, can't sleep, diarrhea) map to sensible catalog products.~~
- [x] ~~Prompt-injection tests ("ignore previous instructions", role-play, asking for the system prompt, non-catalog drugs, prescriptions) return only `no_match`/`refuse` or catalog IDs.~~
- [x] ~~Emergency and off-topic inputs get the fixed responses.~~
- [ ] Check the chat end to end on pharmreach.tech (deployed and configured; not yet tried by hand).

## Phase 6 — Integrate and validate the MVP

- [ ] Exercise the end-to-end flow for location, medication/strength selection, and ranked results.
- [ ] Check fallback behavior when geolocation is denied or address geocoding fails. (Handled in `LocationPanel.tsx`; not yet tested by hand.)
- [ ] Verify transportation preferences affect reachability and ranking as expected.
- [x] Enforce in code that routes are unavailable unless the item is in stock, and that out-of-stock options rank last.
- [x] ~~Verify the Gemini helper cannot suggest a drug absent from the local dataset.~~
- [ ] Test the responsive layout and confirm the hosted HTTPS flow supports geolocation.
- [ ] Fix integration issues and freeze MVP scope before taking on stretch work.

## Phase 7 — Prepare and ship the demo

- [ ] Prepare the fixed Hoboken demo location (backend default origin) and rehearse 2–3 product searches.
- [x] Configure the VM with the Python runtime and a systemd service (`hackru.service`) running `backend/otp/run_demo_with_otp.sh` with auto-restart.
- [x] Configure Cloudflare Tunnel, the `.tech` domain (pharmreach.tech), and HTTPS.
- [x] Add `infra/systemd/install.sh` and the `hackru.service.in` template with `/etc/hackru.env` overrides, documented in `frontend/SETUP.md`.
- [ ] Take a Proxmox snapshot after setup and confirm the app remains runnable locally.
- [ ] Record a demo video and complete the Devpost submission.

## Phase 8 — Stretch work (only after MVP feature freeze)

Pick up in the priority order in the [PRD](./PRD.md), starting with Gemini transportation help.

### NJ Transit API hardening (post-MVP)

The MVP uses the public static GTFS zips (`njtransit.com/rail_data.zip`, `bus_data.zip`) loaded into the OTP graph, so it needs no token. These tasks only matter once we call the token API, for example for real-time data or scheduled feed refreshes. See `poc/njtransit/API_NOTES.md`.

- [x] ~~**Token expiry:** cache rail and bus tokens with their issue time in `backend/data/cache/njt-tokens.json`, reuse them for 20 h, and on an `Invalid token` response get a new token once and retry (`backend/njt/api.py`).~~
- [x] ~~Refresh tokens from a single systemd timer (`infra/systemd/njt-refresh.{service.in,timer}`, about every 20 h) that writes them to the gitignored cache, never to `.env`. Long-lived credentials stay in `.env` / `/etc/hackru.env`. Token requests are capped at 8 per rolling 24 h, with a warning from the 6th; `isValidToken` is never called.~~
- [ ] Rate-limit and back off outgoing NJT requests (100,000/day portal cap); cache responses and have the app read from our own store, as the terms require, not proxy NJT directly.
- [x] ~~Refresh the static GTFS on the same timer (`backend/njt/refresh.py`). New feeds replace the old ones only after they validate (zip integrity, required files, stop counts, size, and at least 7 days of service ahead); the previous feed is kept as `*.prev`.~~
- [x] ~~Fall back to the token API when the public zips fail and the staged feeds are about to run out, and otherwise keep the existing feeds. `transit_data` in `/api/health` and `/api/pharmacies` reports the source and staleness, and the results page shows a disclaimer when schedules are stale.~~
- [x] ~~Run `sudo bash infra/systemd/install.sh` to enable `njt-refresh.timer` and restart `hackru`.~~ (Timer is active; prod reports fresh public-zip feeds through 2027-03-13.)
- [ ] Put `NJT_USERNAME`/`NJT_PASSWORD` in `/etc/hackru.env` (optional; only needed for the token-API fallback).
- [x] ~~Decided to use the public zips first (conditional downloads, so unchanged feeds cost a 304) and the token API only as a last resort, when the public zips fail and the staged feeds run out within 7 days. The API's bus feed covers about 5 days and its rail feed has no light rail.~~
- [ ] Graph rebuilds after a feed refresh are manual (stop `otp`, run `python3 backend/njt/refresh.py --rebuild`, start `otp`), or set `NJT_REFRESH_ARGS=--rebuild` if the VM has the memory.
- [ ] Keep real-time transit, business-data integration, crowd-sourced corrections, insurance/budgeting, accounts, and mobile/PWA work out of the hackathon MVP.
