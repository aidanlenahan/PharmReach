# PharmReach demo frontend + pharmacy snapshot backend

## Run the frontend and API

All five app pages are rendered by React + TypeScript with Vite. The Python backend combines dated CVS and Walgreens inventory snapshots and route estimates.

For frontend development, start the API in one terminal:

```sh
python3 backend/serve.py
```

Then start Vite in another terminal:

```sh
cd frontend
corepack pnpm install
corepack pnpm dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` requests to the Python server at port 4173.

To build and serve the production frontend with the API from one origin:

```sh
cd frontend
corepack pnpm install
corepack pnpm build
cd ..
python3 backend/serve.py
```

The Python server serves the production build from `frontend/dist/`; run the Vite dev server while developing. Build the frontend before starting the Python server or OTP launcher. The required Node.js version is 22.12 or newer. Stop either server with Ctrl+C; choose a different API port with `--port 4180` and update `server.proxy` in `vite.config.ts` if needed.

## Directory layout

`frontend/` contains the Vite HTML entry points, `src/` React code and styles, and frontend build configuration. Python APIs, inventory data, capture scripts, and OTP tooling live in `../backend/`. Compiled assets go to ignored `dist/`. See [SETUP.md](SETUP.md) for persistent hosting.

## Pages and source

- `src/App.tsx`: selects the React page for the current URL and applies first-use setup routing.
- `src/HomePage.tsx` / `src/HomeSearch.tsx`: medication search, keyboard-accessible autocomplete, quick searches, and starting-location form.
- `src/ProductsPage.tsx`: searchable, category-filtered catalog with links into pharmacy comparison for each product.
- `src/ResultsPage.tsx`: results table, sort controls, route details, map, map links, and starting location.
- `src/SettingsPage.tsx`: travel and default-sort preferences.
- `src/OnboardingPage.tsx`: five-step travel setup and preference review.
- `src/core.ts`: typed API, preference, sorting, and starting-location utilities.
- `src/styles.css`: shared responsive design system.
- `vite.config.ts`: Vite development proxy and multi-page production build.
- `../backend/serve.py`: static serving for the built app, JSON API endpoints, route construction, and server-side ranking.
- `../backend/data/cvs-data.json`: CVS catalog, locations, pricing, and observed store availability. Re-read with every API request.
- `../backend/data/walgreens-data.json`: Walgreens and Duane Reade locations plus verified matches for selected shared products and two Walgreens-only allergy listings. Store counts, prices, and source links are included where collected; products without a verified row are not shown at a store.

## Mock API contract

`GET /api/health` returns `{ "ok": true, "data_source": "CVS + Walgreens snapshots", "region": "NJ" }`.

`GET /api/medications?q=zoloft` returns `{ "mock": true, "medications": [...] }`. Search matches medication names and aliases; an empty query returns the whole catalog.

`GET /api/pharmacies?medication=sertraline&variant=sertraline-100-tablet-30&mode=transit&sort=Total%20cost` returns the selected medication variant, comparison mode, sort, and ranked pharmacy records. Each pharmacy includes variant-specific `price` and `stock`, `map_number`, geocoded coordinates, and a `methods` object keyed by `walk`, `transit`, `drive`, `bike`. Each method includes availability, trip duration, departure wait, arrival estimate, travel cost, total cost, and route steps. Invalid or omitted variant IDs resolve to the medication's first (default) variant.

Supported modes: `walk`, `transit`, `drive`, `bike`. Product search uses the OTC catalog. Walgreens and Duane Reade appear when an exact matching product and store result were verified. `Unknown` means the store lookup was blocked or incomplete; a product-specific search with no listing at a selected store is marked `Out of stock`.

Supported sorts: `Best match`, `Soonest arrival`, `Travel time`, `Medication cost`, `Travel cost`, `Total cost`.

Sort uses the selected comparison method while the table displays every method. Transit arrival includes departure wait; trip duration excludes that wait. The departure note explains when to start (including “Recommended: leave now” when the walk to a stop lines up with service), rather than claiming the bus itself departs at that time. If OTP removes transit because a direct walk is faster, the adapter retries with a higher walking reluctance to find a slower walk-plus-transit alternative; the results page still enforces the user's walking time and distance limits and labels any slower alternative. Unavailable stock/method combinations rank last. Total cost equals medication price plus the selected method's cost. Invalid parameters return JSON errors with HTTP 400.

## Data sources and limits

Keep the API response shapes and replace `load_data`, `build_routes`, and `get_pharmacies` with your real data integrations. The frontend only calls the `/api/` endpoints. If the real backend runs on another port, proxy `/api/` through this server or change the shared API helper with an appropriate CORS configuration.

The local snapshot covers New Jersey CVS, Walgreens, and Duane Reade stores. OTC prices and store availability come from the retailers' visible product and inventory pages. Inventory is point-in-time and may change; online prices may differ from in-store prices. `Unknown` means the store-specific lookup was not completed, was blocked, or was ambiguous. For either retailer, when the exact product is searched at a selected store and the store explicitly reports out of stock or the direct store lookup returns no listing, record `Out of stock` with evidence and exclude it from stocked results. A branch missing from a broad/nearby list alone is not enough; keep it `Unknown` unless the exact store lookup is clear. The attended CVS and Walgreens helpers open official product pages in a visible browser and save operator-reviewed candidates separately for reconciliation. Walgreens' helper guides the operator to use Pickup, `Check other stores`, the `Stores near` ZIP lookup, and the in-stock filter to inspect the exact branch row; it does not click `Add for pickup` or collect page data programmatically. CVS's [business-service terms](https://business.cvs.com/terms-of-use.html) restrict automated collection; use only sources and methods you are authorized to use.

## Optional local transit routing

`../backend/otp/` contains a local OpenTripPlanner setup. The Hoboken demo graph combines a New Jersey OSM PBF with official NJ TRANSIT rail/bus GTFS feeds for street routes and scheduled transit. OTP runs in Docker and is served on loopback. It does not store or fetch NJ TRANSIT credentials. Follow [backend/otp/README.md](../backend/otp/README.md) to refresh the public feeds; the `Leave at` control appears when the server detects staged GTFS feeds and receives a starting coordinate.

CVS and Walgreens branch names, addresses, phone numbers, and coordinates link to their retailer and map sources in the corresponding data files. The results page uses Leaflet with OpenStreetMap tiles and visible attribution; pharmacy coordinates are stored with each record and no user origin is sent to the tile provider. When OTP is enabled, trip times, distances, and route geometry use its OSM street graph and available NJ TRANSIT schedules. For recognized NJ TRANSIT transit legs, the app uses an unambiguous OTP fare if supplied; otherwise it estimates supported Hoboken-area bus routes 22, 89, and 126 at up to $3.00 per leg (two-zone North Jersey fare) and HBLR at $2.65. One-zone bus fares and transfers can make actual totals lower. Other bus routes, rail station pairs, ferries, and unrecognized services remain without an estimate. Without OTP, the app uses local estimates. No prescription ordering or transfer is performed.

## Table sorting and map links

Desktop headers control comparison method and ascending/descending order. Method headings sort by arrival time; the smaller Trip, Cost, and Total controls sort by their respective values. Repeated clicks toggle direction. Card layouts use the method, sort, and order controls above the results. API requests accept `direction=asc` or `direction=desc`, and unavailable results remain last in both directions. `Pharmacy` and `Availability` are also supported sorts.

Route details include Google Maps and Apple Maps links for walking, transit, driving, and cycling. When a starting location is saved, the maps link includes it with the pharmacy destination and selected travel mode; medication data is not included. Apple uses the modern unified URL format (iOS 18.4/macOS 15.4 and later). Pharmacy map pins use geocoded coordinates recorded beside verified branch addresses; each record includes a separate `coordinates_source`. Transit comparison cells show only trip/arrival and a general transfer count; detailed stops and walk/ride instructions appear after opening a pharmacy. The selected result can display provider-supplied route geometry on the map when available.

## Starting location

Home and results have a starting-location input and a Use my location button. Permission is requested only after the user presses that button. Denied, unavailable, or timed-out location requests leave manual entry available. Coordinates are range-checked. Hoboken addresses are matched against a local OpenStreetMap address index and converted to coordinates on the app server; entered addresses are not sent to a geocoding provider. The index includes a local alias for Stevens' official `1 Castle Point Terrace` address because the staged OSM point is labeled `1 Castle Point`. Addresses outside the index can still be used in Maps links, but live OTP routing requires a matched address, coordinates, or device location. The selected origin is stored in session storage, shared across pages in the same tab; Clear removes it.

Google directions receive `origin`; Apple unified directions receive `source`. The pharmacy remains `destination`, and the chosen transport method is preserved. No location is transmitted to a maps provider until the user opens the link. When OTP is configured, route distances and trip times come from its street graph; otherwise the demo shows illustrative routes.

## Travel onboarding

First visits to search or results open `/onboarding`. The five screens collect driving ability, a walking limit (unlimited, minutes, or miles, including zero), cycling ability, and public transit with bus, subway/light rail, commuter rail, and ferry choices, then show a review. Choices are saved in local storage under `pharmreach:travel-preferences`. Settings shows a summary and a restart link; restarting keeps the existing answers until the new flow is completed. An interrupted flow does not overwrite saved preferences.

`src/core.ts` handles persistence, first-use navigation, default comparison method, and preference matching. Disallowed travel methods are removed from result columns, comparison controls, and route choices. Walking or transit routes exceeding the walking limit have no matching route; if no pharmacy has a matching method, its column is removed. The OTP transit fallback can show a walk-plus-transit option even when direct walking is faster, with the same walking time/distance limit applied. Unavailable routes remain last. The live Hoboken graph provides OSM-based walking, driving, cycling, and schedule-aware public transit routes. Apple Maps transit links include the selected transit types.

## Editable settings and empty results

Settings now supports individual changes to driving, cycling, public transit types, and walking limits without repeating onboarding. Travel preferences and default sort have separate Save controls. A zero walking limit is supported. Disallowed columns remain hidden. When no stocked route fits any enabled method, results show an adjustment/search empty state. The layout remains responsive after dynamic column removal. Preferences changed in another tab refresh results through the browser storage event.

## Optional real routing adapter

Run `python3 backend/serve.py --routing-url http://127.0.0.1:8000/routes` to enable a custom routing service, or configure an OpenTripPlanner 2 GTFS GraphQL endpoint directly:

```sh
python3 backend/serve.py --otp-url http://127.0.0.1:8080/otp/gtfs/v1
```

The OTP endpoint must have a graph loaded from OpenStreetMap. Street-only graphs provide walk, drive, and bike routes; local GTFS transit feeds are additionally required for public transit schedules. PharmReach requests current itineraries for walking, public transit, driving, and cycling, and translates route legs and encoded geometry into its API shape. It maps Bus to `BUS`, subway/light rail to `SUBWAY`/`TRAM`, commuter rail to `RAIL`, and ferry to `FERRY`, respecting the user's allowed transit types. Live routing needs the starting location as `latitude, longitude`; use the location button, enter coordinates, or enter a Hoboken street address covered by the local address index. The address index is generated from the staged NJ OSM extract; runtime lookup is local and needs no geocoding account or external request. Other addresses remain available for Maps links and for custom providers that geocode them. When OTP and GTFS are enabled and a starting point is set, results expose an optional local-time “Leave at” control; blank means now. A selected time is sent to OTP as an ISO 8601 offset timestamp and included in the URL so the same departure can be shared. Transit fare is read from OTP fare products when the feed provides an unambiguous USD fare. If it does not, recognized Hoboken-area bus routes 22, 89, and 126 use a local upper estimate of $3.00 per bus leg (the current two-zone North Jersey adult fare); HBLR uses its $2.65 adult fare. They are shown as `Estimated max`; one-zone bus rides cost less and transfers can reduce the total. Other buses, commuter rail station pairs, ferries, and unrecognized services remain without a fare estimate rather than using statewide maximums. The results details link to the [NJ TRANSIT fare guide](https://www.njtransit.com/fares/). An explicit `--transit-fare` remains a configurable flat override.

CVS inventory is read from `cvs-data.json`; Walgreens and Duane Reade matches are read from `walgreens-data.json` and merged at request time. Results send the tab’s saved `origin` to `/api/pharmacies`; origin is omitted from the browser URL. Changing origin reloads results. Medication, inventory, and pricing are excluded from upstream route requests. Pharmacy addresses and coordinates come from their respective branch records in the two retailer data files. The OTP integration sends origin coordinates and pharmacy coordinates/names. The Hoboken graph combines New Jersey OSM data and NJ TRANSIT bus/rail GTFS feeds for street routes, transit schedules, and route geometry.

Expected response: `{routes: {PHARMACY_ID: {distance_miles: NUMBER, methods: {MODE: {available: BOOLEAN, duration_minutes: NUMBER, depart_in_minutes: NUMBER, travel_cost: NUMBER | null, travel_cost_type?: "otp" | "estimated_max" | "configured", walking_minutes: NUMBER, walking_miles: NUMBER, steps: [{title: STRING, detail: STRING}], geometry?: {type: "LineString", coordinates: [[longitude, latitude], ...]}}}}}}`. Missing pharmacies or modes are treated as unavailable and returned as partial results; malformed available routes still return HTTP 502. Unavailable methods can return only `{available: false}`. Numbers must be nonnegative and finite. Transit walking minutes/miles must cover the whole journey. Route geometry is optional and, when returned, must be a GeoJSON LineString with at least two valid coordinates. The adapter derives arrival and total price, preserves medication stock availability. Upstream failures return HTTP 502 instead of silently substituting fixed times. Custom-provider requests time out after eight seconds; custom successful routes cache for 15 minutes and partial responses for two. OTP requests time out after eight seconds per pharmacy (12 seconds overall). OTP routes are cached per origin and pharmacy, so searches for different medications share stores: street-only results (no transit types) for an hour, scheduled `leave_at` results for 30 minutes, and "leave now" transit results for up to 10 minutes, with depart/arrival minutes re-timed on each hit and the entry dropped once its departure is more than a minute in the past. Custom-provider `routing_source` values are `live`, `partial`, `cached_live`, and `cached_partial`; OTP reports `otp` or `cached_otp`; without a provider it reports `mock`. No upstream network requests occur unless configured and an origin is provided.

The generic adapter remains available for a custom provider. OpenTripPlanner provides live street and scheduled transit routing from the local OSM and official GTFS feeds. NJ TRANSIT publishes separate bus and rail feed ZIPs; this local workflow downloads and serves them through OTP, without portal credentials or browser-to-NJT data requests. Refresh them using the instructions in `backend/otp/README.md`. Rebuild the local Hoboken address index from the OSM extract with `python3 -m pip install osmium` followed by `python3 backend/scripts/build_address_index.py`. The runtime app uses only the generated JSON, with address points attributed to OpenStreetMap contributors under ODbL 1.0. For an attended CVS inventory pass, run `python3 backend/scripts/cvs_attended_capture.py backend/data/cvs-data.json` from the repository root. It lists stores with the most `Unknown` items first, then products still unknown at the selected store(s), opens each product page in the default browser, and saves a separate review candidate after explicit confirmation. For Walgreens and Duane Reade, run `python3 backend/scripts/walgreens_attended_capture.py backend/data/walgreens-data.json backend/data/cvs-data.json`; it uses the same store-first workflow and guides the operator through Walgreens' visible Pickup/store ZIP lookup. Match the exact branch address before recording its result. Status `n` means the exact product was directly searched for at that selected store and returned no listing; the candidate records `Out of stock` plus evidence. Status `u` is reserved for unchecked, blocked, or ambiguous lookups, including a branch absent from a broad nearby list. Neither helper writes into the active catalog automatically.

CVS hours are a dated snapshot in `cvs-data.json`. Walgreens and Duane Reade hours are not currently included in the retailer inventory snapshot. Hours are not refreshed automatically and should be verified with the pharmacy. The Hoboken graph supplies route geometry for all routed modes; the map draws these routes after the user provides a matched address or coordinates.

Transit adapter requests also include `transit_types` (the user’s allowed types). Available transit methods must return a nonempty `transit_types` list using bus/subway/commuter/ferry; every leg must be allowed for the route to match. Per-pharmacy details gracefully handle cases where no route meets preferences. API failures expose a Try again button.

Responsive styles keep phone results as cards, constrain long names and method costs, stack comparison controls, and keep the route dialog within the dynamic viewport and safe area. Narrow phones wrap navigation and the home search action. Desktop retains a horizontally scrollable true table. Dynamic table sizing uses a CSS variable with a phone override.

## Current inventory coverage

On 2026-10-10, the site included 34 OTC products (27 CVS listings and seven Walgreens-only listings), nine New Jersey CVS locations, and seven Walgreens/Duane Reade locations. Product-specific direct searches with no listing are `Out of stock` for that store; unchecked, blocked, or unclear store searches remain `Unknown`. Search accepts familiar names such as Pepto-Bismol, ibuprofen, Advil, and Tylenol; CVS and Walgreens appear as sellers rather than prefixes in medication names. Walgreens pins for Shipyard Lane, River Drive South, and Central Avenue are approximate demo coordinates and are labeled in the source data. Verify inventory and prices with the retailer before relying on them.


### Medication helper

The floating Medication helper button appears on every page. Click it to open
the popup; use the expand button for a centered modal, and minimize to return
to the popup. Escape or the close button dismisses it. The last five questions,
replies, draft, and open/expanded state are kept in `sessionStorage` for this
browser tab and restored after same-origin page navigation. Storage failures
do not prevent chatting. A request still loading during navigation is marked
interrupted on the next page and can be retried. Each backend request evaluates
one question independently; previous turns are displayed but are not sent to Gemini.

The server reads `GEMINI_API_KEY` from the repository-root `.env`. Existing
environment variables take precedence, including systemd's optional
`/etc/hackru.env`. `GEMINI_MODEL` optionally overrides the default in
`backend/chat.py`. Restart `hackru` after changing server configuration.
`/api/health` reports `chat_configured`; the browser sends questions to
`POST /api/chat` and never receives the API key. Rebuild with
`npm run build --prefix frontend` to update the website's static assets.


The chat's `Disclaimer` button closes the popup or expanded chat and opens
a centered disclaimer modal. Escape or the close button dismisses it. The
footer retains the privacy policy link without the disclaimer text. The popup reserves its message
area and composer space to avoid shifting while a request is loading.

If `/api/chat` returns 502 while `/api/health` is healthy, inspect the backend
journal: `journalctl -u hackru --no-pager -n 50`. Gemini generation failures
are separate from tunnel availability; `chat_configured` indicates that a key
is set, not that the generation service is currently responding.


### Privacy

`/privacy` describes browser storage, chat processing, external providers,
retention limitations, and the privacy contact. Every page footer links to it;
the helper displays its Google Gemini disclosure before any question is sent.
The privacy page can clear saved preferences, sorting, starting location, and
this tab's chat. Application logs omit chat text, IPs, selected product IDs,
and request query strings. Historical logs are not deleted by this change.
No blanket cookie banner is added: the application has no advertising or
analytics integration, and third-party services are disclosed in the policy.
Recheck provider storage behavior before changing integrations or audience.


### Homepage and search

`/` is the marketing homepage; `/find-medicine` contains medicine search
and starting-location controls. Homepage calls to action read saved travel
preferences: `Try it out` opens onboarding with search as the return destination;
`Make a search` opens search directly. Direct search visits without completed
preferences also open onboarding. Completing setup without an explicit return
path now opens search. Product-result links retain the selected medication
through onboarding, and new-search links return to the search page.
