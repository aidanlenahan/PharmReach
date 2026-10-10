# HackRU Planning Doc 2026

# Pharmacy Searcher

## MVP

Goal is to determine which nearby pharmacy has my prescription in stock, and the easiest/cheapest way to get there

### Map + location
* GPS map (Leaflet + OpenStreetMap tiles) showing pharmacies
* Use current location, with manual address entry as a fallback
* Basic radius algorithm: preset comfortable walking distance to nearest bus/train stop from current/entered location

### Prescription search
* Prescription input with autocompletion (drug list in DB/JSON, fuzzy search)
* Drug strength selection (e.g. metformin 500mg)
* Simulated pharmacy stock data that drives results for the searched rx within a distance

### Transportation + ranking
* 3 modes with preset comfort thresholds: **walk, transit (bus/train combined), car**
* User picks preferred mode(s); results respect reachability
* ETA estimate (heuristic: walk to stop + wait + ride + walk)
* Price estimate = rx price + transportation cost (flat transit fare, $/mi for car)
* Ranked pharmacy results based on stock availability, transportation feasibility, cost, ETA

### Gemini helper
* Chatbot helps users who don't know their medication's exact name
* Gemini responds with drug name suggestions **matched to our drug database only**
* Interactive buttons: selecting a suggested drug automatically runs the search for that rx
* "Not medical advice" + "stock data is simulated" disclaimers

### Data schema (minimum)
* `pharmacies(id, name, lat, lng, address)`
* `drugs(id, generic_name, brand_names, strengths)`
* `inventory(pharmacy_id, drug_id, strength, in_stock, price, last_updated)`
* `transit_stops(id, name, lat, lng, type)`

### Ship
* Deployed on `.tech` domain (Proxmox VM + Cloudflare Tunnel)
* Demo script with fixed location (New Brunswick) + 2–3 rehearsed drugs
* Devpost + demo video

### Data sources
* Pharmacy locations - OpenStreetMap Overpass API (has lat/lng; pulled once into DB)
* Drug names - hardcoded JSON
* Map tiles - OpenStreetMap
* Transit stops - NJ Transit GTFS static feed (`stops.txt`)

## Do-Later (High Priority) — pick up in order if ahead after feature freeze

1. Gemini transportation help: user describes their situation ("no car, bad knee") and Gemini sets mode/threshold preferences
2. Bike as a 4th transport mode
3. Split transit into bus vs. train with separate fares/speeds
4. User-adjustable comfort thresholds (sliders instead of presets)
5. Pharmacy hours / "open now" filter + call pharmacy button
6. Real NJ Transit API / true trip planning (OpenTripPlanner or Google Directions) for accurate transit ETAs
7. NPI Registry as the pharmacy data source (needs geocoding)

## Later (near) tasks

* mobile app/PWA
* user accounts?

## Way later tasks

* google maps/businesses integration for pharmacy website
* crowdsourcing and reporting incorrect info
* insurance and copay calculation along with budgeting (plaid/gemini integration)
