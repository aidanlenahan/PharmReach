# Local OpenTripPlanner setup

This optional workflow connects the demo to a local OpenTripPlanner 2 graph. NJ TRANSIT publishes bus and rail GTFS ZIPs as direct downloads, so this setup does not need an account username/password or API token. Feed ZIPs and the generated graph are ignored by Git in `backend/otp/data/`.

## Prepare inputs

Install and start a Docker-compatible engine on macOS, such as OrbStack or Docker Desktop. The Hoboken demo has the New Jersey OpenStreetMap PBF and current NJ TRANSIT bus/rail GTFS feeds staged in `backend/otp/data/`. To refresh the feeds, download [bus_data.zip](https://www.njtransit.com/bus_data.zip) and [rail_data.zip](https://www.njtransit.com/rail_data.zip), then stage them alongside the OSM extract:

From the HackRU project root, stage and validate them:

```sh
python3 backend/otp/prepare.py \
  --osm backend/otp/data/new-jersey.osm.pbf

python3 backend/otp/prepare.py \
  --rail /path/to/rail_data.zip \
  --bus /path/to/bus_data.zip \
  --osm backend/otp/data/new-jersey.osm.pbf
```

The utility checks any provided GTFS archives for core schedule files, service calendars, and ZIP integrity, then copies them into OTP's required `*.gtfs.zip` names and the OSM extract into the ignored local data directory. It does not print feed contents or transmit any input. No portal credentials are needed for these published downloads.

## Build and run

```sh
bash backend/otp/otp.sh build
bash backend/otp/otp.sh serve
```

The first command builds and saves `graph.obj`; the second serves it on `127.0.0.1:8080` in a container named `pharmreach-otp`. After rebuilding, restart OTP so it reloads the new graph. The container image defaults to OTP 2.10.0. Override `OTP_IMAGE`, `OTP_DATA_DIR`, `OTP_PORT`, or `OTP_CONTAINER_NAME` if needed. Graph building can require several GB of memory and time. The statewide NJ extract builds a larger graph than Hoboken alone, but gives broad coverage around NJ TRANSIT routes.

In a second terminal, stop the mock-only server if it already owns port 4173, then run the app with OTP routing enabled:

```sh
bash backend/otp/run_demo_with_otp.sh
```

This starts the website backend on `127.0.0.1:4173` and queries the local OTP endpoint server-side. The launcher enables schedule controls automatically when a `*.gtfs.zip` is present; without feeds it hides “Leave at”. Add a starting coordinate in the results page to enable live street routes. With GTFS staged, this also enables schedule-aware transit itineraries and the “Leave at” control; without GTFS, transit is unavailable. OTP fare products are used when the feed returns one unambiguous USD fare; otherwise the UI shows fare unavailable. Set `TRANSIT_FARE` only to apply an explicit flat approximation. NJ TRANSIT fares vary by route, zones, and rail origin/destination. OTP routing does not replace medication stock or pricing data.

## Running as a service (server)

On the server, `infra/systemd/install.sh` installs `otp.service` (from `infra/systemd/otp.service.in`), which runs `otp.sh serve` in the foreground, restarts it whenever the container exits, and starts it at boot after Docker. The service user must be in the `docker` group. Use `sudo systemctl restart otp` after a rebuild and `journalctl -u otp -f` for logs. Loading the graph takes about 1–2 minutes; meanwhile searches show real prices and stock with routes marked unavailable (never estimated travel times).

## Memory

- `OTP_JAVA_HEAP` (serve, default `2G`). On the statewide NJ graph (`graph.obj` ~311 MB), the live heap after a full GC is ~1.0 GB, so 2G gives roughly 2x headroom for routing requests. The old 4G default let G1 hold ~3 GB committed and pushed the 5 GB VM into swap.
- `OTP_MEMORY_LIMIT` (serve, default heap + 700 MB, e.g. `2748m`). This is the container's hard cap. Swap is disabled for the container, and the JVM runs with `-XX:+ExitOnOutOfMemoryError`, so if it runs out of memory it exits and systemd restarts it.
- `OTP_BUILD_HEAP` (build, default `4G`). Building needs much more memory than serving. Stop `otp.service` while building on a small VM.

On the server, put overrides in `/etc/hackru.env` (e.g. `OTP_JAVA_HEAP=2560m`) and run `sudo systemctl restart otp`. After the graph grows (e.g. a larger extract), re-measure the live heap with a JDK sidecar, since the OTP image ships only a JRE:

```sh
pid=$(docker exec pharmreach-otp sh -c 'ps -eo pid=,comm= | awk "\$2==\"java\"{print \$1}"')
jdk="docker run --rm --pid=container:pharmreach-otp -e JAVA_TOOL_OPTIONS=-Xmx64m eclipse-temurin:25-jdk"
$jdk jcmd "$pid" GC.run && $jdk jcmd "$pid" GC.heap_info
```

Set the heap to about 1.3–2x the `used` figure.

## Refreshing data

GTFS schedules expire. `backend/njt/refresh.py` refreshes both feeds safely (run by `njt-refresh.timer` about every 20h on the server):

```sh
python3 backend/njt/refresh.py                 # refresh feeds in backend/otp/data/, write status
python3 backend/njt/refresh.py --dry-run --out-dir /tmp/njt   # download + validate only
python3 backend/njt/refresh.py --rebuild       # also rebuild graph.obj if a feed changed
```

- Sources, in order: NJ TRANSIT's public `rail_data.zip` / `bus_data.zip`, then the token API (`NJT_USERNAME` / `NJT_PASSWORD` from the repo `.env` or `/etc/hackru.env`) as a last resort. Rail and bus always come from the same source, because the API puts light rail (HBLR, Newark LR, RiverLINE) in its bus G2 feed while the public zips put it in the rail feed.
- Public downloads are conditional (`If-None-Match` / `If-Modified-Since` from the last download), so an unchanged feed costs a 304 and no transfer. NJT republishes the zips every few weeks, so most runs download nothing.
- Every download is validated (zip integrity, required GTFS files, stop counts, size vs. the current feed, service running at least `--min-horizon-days`, default 7, ahead) before it atomically replaces the staged feed; the previous file is kept as `*.gtfs.zip.prev`. If nothing validates, existing feeds are untouched.
- The API is only called when the public zips fail *and* the staged feeds are missing or run out within the horizon. As of Oct 2026 its bus G2 feed covers only a rolling ~5-day window and its rail feed has no light rail, so as a last resort it is accepted with a 1-day horizon just to keep transit routing alive (status `source: njt-api`, and the results page shows the disclaimer).
- Tokens are cached in `backend/data/cache/njt-tokens.json` (mode 600) and reused for 20h; rail token requests are capped at 8 per rolling 24h (NJT allows 10/day). Status goes to `backend/data/cache/transit-status.json` and appears as `transit_data` in `/api/health` and `/api/pharmacies`; the results page shows a disclaimer when it is stale or a fallback.
- A changed feed reaches routing only after a graph rebuild and an OTP restart (`sudo systemctl restart otp`). Building needs `OTP_BUILD_HEAP` (4G) on top of the serving container, so on a small VM stop `otp` first, run `refresh.py --rebuild` (or `otp.sh build`), then start `otp`. `--rebuild` builds into a staging directory and swaps `graph.obj` in only on success. `transit_data.rebuild_pending` is true while staged feeds are newer than `graph.obj`.

`prepare.py` still stages hand-downloaded files.

## Timeouts and load

- `router-config.json` (mounted read-only by `otp.sh serve`) sets `apiProcessingTimeout` to 8 s, so OTP abandons a route request after the backend stops waiting for it.
- The backend allows at most `OTP_MAX_CONCURRENT` route requests at once (default 3, one per CPU; set it in `/etc/hackru.env`). Each search waits up to 12 s in total. Stores still unrouted then are returned with their real price and stock, marked `route_timeout`, and are never cached, so the next search retries them. Only if no store at all gets a route does the API return a 502.
- Each search sends only the nearest `ROUTE_STORE_LIMIT` stores to OTP (default 25), ordered by straight-line distance from the origin. Every other visible store is still returned with its price, stock and `straight_line_miles`, marked `beyond_route_limit` with no times or costs, counted in `beyond_limit_count` (separate from the `unrouted_count` timeouts) and never cached. Start-up warm-up uses the same selection for the default origin.
- The route cache is bounded by size, not entry count: `ROUTE_CACHE_MB` (default 32) of serialized JSON per entry, least recently used evicted first, with a 20,000-entry backstop. Python's in-memory size is a few times the serialized size.
- Origins are rounded to 4 decimals (about 11 m) for both the cache key and the OTP query, so nearby searches share cache entries and a hit is exactly the route that was computed.

## References

- [OTP 2.10 container image guide](https://docs.opentripplanner.org/en/v2.10.0/Container-Image/)
- [OTP 2.10 basic tutorial](https://docs.opentripplanner.org/en/v2.10.0/Basic-Tutorial/)
- [OTP GTFS GraphQL API](https://docs.opentripplanner.org/api/dev-2.x/graphql-gtfs/introduction)
- [NJ TRANSIT developer portal](https://developer.njtransit.com/registration/loginsein)
- [NJ TRANSIT terms](https://developer.njtransit.com/terms/)
