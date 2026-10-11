# PharmReach — Product Requirements

> **Status (2026-10-11):** MVP built and live at https://pharmreach.tech. This doc has been updated to match what we built. Where the original plan changed, the change is noted inline. Task tracking lives in [todo.md](./todo.md).

## Overview

PharmReach helps someone find a nearby pharmacy that has their over-the-counter medicine in stock, then compare the easiest and cheapest ways to get there.

The HackRU 2026 MVP uses dated, real CVS and Walgreens/Duane Reade inventory and price snapshots, plus live OpenTripPlanner routing over OpenStreetMap and NJ TRANSIT schedules. It is a demo. It is not medical advice and does not guarantee pharmacy stock.

*Changed from plan:* we went from prescriptions with simulated stock to OTC products with real snapshots, and moved the demo from New Brunswick to Hoboken.

## Goals

- Let a user search for a medicine and pick a strength/form/amount.
- Show nearby pharmacies with that product in stock.
- Help the user compare reachable pharmacies by travel time, arrival time, and total cost.
- Keep the demo reliable and easy to present, using a fixed Hoboken default origin and rehearsed products.

## Users and primary flow

1. On the first visit, the user sets travel preferences: driving (with optional gas mileage), a walking limit, cycling, and allowed transit types.
2. The user shares their location, types a Hoboken address, or enters coordinates.
3. The user searches for a medicine and opens results, which rank stores by the chosen travel mode and sort.
4. If the user doesn't know the name, the Gemini helper suggests up to three catalog products from a symptom description. Picking one opens its results.

## MVP requirements

### Location and map — done

- Leaflet map with OpenStreetMap tiles and attribution. Pharmacy pins are colored by stock, the user's starting point has its own pin, and the selected route is drawn.
- Browser geolocation (only after the user presses the button), with manual address or coordinate entry as a fallback.
- Addresses are geocoded against a bundled Hoboken OSM address index on our server. *Changed from plan:* we dropped Nominatim, so typed addresses never leave our server.
- Ctrl/⌘ + scroll zooms the map, so normal scrolling still moves the page.

### Medicine search — done

- Autocomplete over the catalog, matching name, brand aliases, strength, and search terms (for example "81mg" finds "81 mg").
- Pick a variant by strength, form, and amount on the results page.
- A products page lets users browse the catalog by category.

### Transportation and ranking — done

- Four modes: walking, transit, driving, and cycling. *Changed from plan:* bike was a stretch goal and made it into the MVP.
- Transit can be limited to bus, subway/light rail, commuter rail, and ferry. *Changed from plan:* we split these instead of using one combined transit mode.
- Trip times come from OpenTripPlanner, with schedule-aware transit and an optional "Leave at" time. *Changed from plan:* this replaces the straight-line heuristic. If OTP is unavailable, stores still show price and stock with no route. Travel times are never made up.
- Each user sets their own walking limit (time or distance, zero allowed). Modes they can't use are hidden.
- Total cost = medicine price + travel cost. Transit uses the OTP fare or a capped NJ TRANSIT estimate. Driving uses the user's MPG × $3.10/gal when set, otherwise a per-store estimate.
- Sorts: best match, soonest arrival, travel time, medicine, travel, or total cost, pharmacy name, and availability, in ascending or descending order. Out-of-stock or unreachable options always rank last.

### Gemini helper — done

- Helps users who don't know a medicine's name.
- Suggestions are limited to in-stock catalog IDs by the response schema and checked again on the server. Every reply is written from server templates.
- Emergencies get a fixed 911/988 message. Prescription, pregnancy, and child-dosing questions are sent to a pharmacist. None of these reach the model.
- Each suggestion links to its results page and the retailer's product page.
- The UI says the helper is not medical advice and that data comes from snapshots. The Gemini key stays on the server.

### Privacy — done

- A privacy page covers browser storage, chat processing, and outside providers, and can clear all saved data.
- Logs leave out chat text, IPs, product IDs, and query strings. There is no analytics or advertising.

## Data

Stored as JSON in `backend/data/` instead of a database. *Changed from plan:* we dropped SQLite.

- `cvs-data.json`: catalog (products, aliases, variants, categories), CVS stores, and CVS inventory with price, stock, and evidence.
- `walgreens-data.json`: Walgreens/Duane Reade stores and verified inventory, merged at request time.
- `address-index.json`: Hoboken address points from OSM.
- Transit: NJ TRANSIT bus and rail GTFS loaded into the OTP graph and refreshed by a systemd timer.

Coverage (2026-10-11): 34 products (27 with checked stock) and 38 stores (18 CVS, 20 Walgreens/Duane Reade) across Hoboken, Jersey City, Union City, West New York, North Bergen, Secaucus, Kearny, and Bayonne.

### Sources

- Pharmacy locations: retailer store locators, one record per branch, with sourced coordinates. *Changed from plan:* we stopped using Overpass/NPPES.
- Products, prices, and stock: retailer product and store-inventory pages, recorded by hand with the attended capture scripts.
- Routing and transit: OpenStreetMap plus NJ TRANSIT static GTFS, served by OpenTripPlanner.
- Map tiles: OpenStreetMap.

## Quality, safety, and demo requirements

- [x] App runs locally on a laptop (`python3 backend/serve.py`, with or without OTP).
- [x] HTTPS on the hosted demo, so browser geolocation works (Cloudflare Tunnel).
- [x] Clear disclaimers about snapshot stock and non-medical guidance.
- [x] Deployed on pharmreach.tech (Proxmox VM, systemd, Cloudflare Tunnel).
- [ ] Rehearse 2–3 product searches from the fixed Hoboken demo origin.
- [ ] Record a demo video and submit to Devpost.

## Out of scope for the MVP

- Real-time NJ TRANSIT data (we use static schedules).
- Prescriptions, prescription transfers, or ordering.
- Google Maps/business listings and pharmacy website integration.
- Crowd-sourced stock corrections.
- Insurance, copay, or budgeting integrations.
- User accounts, a mobile app, or a PWA.

## Post-MVP and stretch ideas

Done during the MVP:

- ~~Bike as a fourth transportation mode.~~
- ~~Separate transit types with their own fares.~~
- ~~User-adjustable walking limit.~~
- ~~Accurate transit ETAs through OpenTripPlanner.~~

Still open, in priority order:

1. Gemini transportation help that maps a user's situation (for example, no car or a bad knee) to travel preferences.
2. Pharmacy hours for every chain (CVS only today), an "open now" filter, and a call-pharmacy action.
3. More stores and automated, authorized inventory refreshes.
4. Live gas prices instead of the fixed $3.10/gal.

Longer term: a mobile app/PWA, user accounts, Google Maps/business integration, crowd-sourced corrections, and insurance/copay budgeting.
