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

The first command builds and saves `graph.obj`; the second serves it on `127.0.0.1:8080`. After rebuilding, restart an already running OTP container so it reloads the new graph. The container image defaults to OTP 2.10.0. Override `OTP_IMAGE`, `OTP_JAVA_HEAP` (default `4G`), `OTP_DATA_DIR`, or `OTP_PORT` if needed. Graph building can require several GB of memory and time. The statewide NJ extract builds a larger graph than Hoboken alone, but gives broad coverage around NJ TRANSIT routes.

In a second terminal, stop the mock-only server if it already owns port 4173, then run the app with OTP routing enabled:

```sh
bash backend/otp/run_demo_with_otp.sh
```

This starts the website backend on `127.0.0.1:4173` and queries the local OTP endpoint server-side. The launcher enables schedule controls automatically when a `*.gtfs.zip` is present; without feeds it hides “Leave at”. Add a starting coordinate in the results page to enable live street routes. With GTFS staged, this also enables schedule-aware transit itineraries and the “Leave at” control; without GTFS, transit is unavailable. OTP fare products are used when the feed returns one unambiguous USD fare; otherwise the UI shows fare unavailable. Set `TRANSIT_FARE` only to apply an explicit flat approximation. NJ TRANSIT fares vary by route, zones, and rail origin/destination. OTP routing does not replace medication stock or pricing data.

## Refreshing data

GTFS schedules expire and should be refreshed from NJ TRANSIT's official bus and rail download links. Re-run `prepare.py` with the new files, rebuild the graph, restart OTP, and restart the PharmReach server. The NJ TRANSIT API credential is not needed for these downloads or at runtime; do not put it in `.env` for this workflow.

## References

- [OTP 2.10 container image guide](https://docs.opentripplanner.org/en/v2.10.0/Container-Image/)
- [OTP 2.10 basic tutorial](https://docs.opentripplanner.org/en/v2.10.0/Basic-Tutorial/)
- [OTP GTFS GraphQL API](https://docs.opentripplanner.org/api/dev-2.x/graphql-gtfs/introduction)
- [NJ TRANSIT developer portal](https://developer.njtransit.com/registration/loginsein)
- [NJ TRANSIT terms](https://developer.njtransit.com/terms/)
