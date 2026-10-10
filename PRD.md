# Pharmacy Searcher — Product Requirements

## Overview

Pharmacy Searcher helps someone find a nearby pharmacy that has their prescription in stock, then compare the easiest and cheapest ways to get there.

The HackRU 2026 MVP uses simulated inventory and heuristic transportation estimates. It is a demo and is not a source of medical advice or a guarantee of pharmacy stock.

## Goals

- Let a user search for a medication and strength.
- Show nearby pharmacies with matching in-stock inventory.
- Help the user compare reachable pharmacies by estimated travel time and total cost.
- Make the demo reliable and easy to present using a fixed New Brunswick location and rehearsed medications.

## Users and primary flow

1. The user shares their current location or enters an address.
2. The user searches for a medication, selects a drug and strength, and chooses preferred travel modes.
3. The app finds matching pharmacy inventory, estimates travel feasibility, ETA, and cost, then ranks the results.
4. If the user does not know the medication's exact name, they can ask the Gemini helper for suggestions drawn only from the app's drug database. Selecting a suggestion starts a search.

## MVP requirements

### Location and map

- Display pharmacies on a Leaflet map using OpenStreetMap tiles.
- Use browser geolocation when available and allow manual address entry as a fallback.
- Geocode entered addresses with Nominatim.
- Use a basic distance/radius model to determine whether a location is within comfortable walking distance of a nearby bus or train stop.

### Prescription search

- Provide autocomplete over a hardcoded drug list, using fuzzy matching.
- Allow selection of a medication strength (for example, metformin 500 mg).
- Search simulated pharmacy inventory for the selected drug and strength.

### Transportation and ranking

- Support walking, transit (bus and train combined for the MVP), and driving. Bike is out of MVP scope.
- Let users choose preferred travel mode(s), and prioritize pharmacies reachable using those preferences.
- Estimate walking and driving feasibility with preset comfort thresholds.
- Estimate transit ETA heuristically from walking to a stop, average wait, straight-line ride time, and walking from the destination stop.
- Estimate total cost as medication price plus transportation cost (a flat transit fare or a per-mile driving estimate).
- Rank results using stock availability, transportation feasibility, cost, and ETA. Out-of-stock options must not outrank in-stock options.

### Gemini helper

- Help users who do not know a medication's exact name.
- Constrain suggested drugs to entries in the app's drug database.
- Return suggestions with interactive controls; selecting one starts a search for that medication.
- Clearly disclose that the helper is not medical advice and inventory is simulated.
- Keep Gemini credentials server-side.

## Data requirements

Minimum entities:

- `pharmacies(id, name, lat, lng, address)`
- `drugs(id, generic_name, brand_names, strengths)`
- `inventory(pharmacy_id, drug_id, strength, in_stock, price, last_updated)`
- `transit_stops(id, name, lat, lng, type)`

The implementation may use the richer schema in [TECHSTACK.md](./TECHSTACK.md), including pharmacy chain, inventory quantity, and bus/rail stop type.

### Initial data sources

- Pharmacy locations: OpenStreetMap Overpass API, pulled once into the database.
- Drug names: hardcoded JSON.
- Transit stops: NJ Transit static GTFS `stops.txt`.
- Map tiles: OpenStreetMap.
- Inventory and prices: deterministic simulated data generated with a fixed seed.

## Quality, safety, and demo requirements

- Keep the application runnable locally on a laptop.
- Use HTTPS for browser geolocation in the hosted demo.
- Show clear disclaimers for simulated stock and non-medical guidance.
- Prepare a fixed New Brunswick demo location and 2–3 rehearsed medications.
- Deploy the demo on the project's `.tech` domain using the infrastructure described in [TECHSTACK.md](./TECHSTACK.md).
- Prepare a demo video and Devpost submission.

## Out of scope for the MVP

- Real-time NJ Transit data or accurate trip planning.
- Google Maps/business listings and pharmacy website integration.
- Crowd-sourced stock corrections.
- Insurance, copay, or budgeting integrations.
- User accounts, a mobile app, or a PWA.

## Post-MVP and stretch ideas

If the MVP is complete before feature freeze, consider these in order:

1. Gemini transportation help that maps a user's described situation (for example, no car or a bad knee) to travel mode and comfort preferences.
2. Bike as a fourth transportation mode.
3. Separate bus and train modes with distinct fares and speeds.
4. User-adjustable comfort thresholds.
5. Pharmacy hours, an "open now" filter, and a call-pharmacy action.
6. Accurate transit ETAs through OpenTripPlanner or Google Directions.
7. NPI Registry pharmacy data, with geocoding.

Longer-term possibilities are a mobile app/PWA, user accounts, Google Maps/business integration, crowd-sourced corrections, and insurance/copay budgeting.
