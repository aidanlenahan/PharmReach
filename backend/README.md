# Pharmacy backend

- `serve.py`: threaded loopback HTTP server, API handlers, ranking, and static delivery of `../frontend/dist/`.
- `routing.py`: server-side OTP/custom-provider requests and route cache.
- `data/`: CVS/Walgreens snapshots and local address index.
- `scripts/`: attended inventory capture and address-index generation; not runtime dependencies.
- `otp/`: graph preparation, Docker launcher, and ignored graph/feed data.

Runtime uses the Python standard library. `osmium` is needed only to rebuild the address index. Run from any directory with `python3 /path/to/repo/backend/serve.py`. For live OTP use `bash backend/otp/run_demo_with_otp.sh` from the repository root. Build the frontend before starting.

With `--otp-url`, a background thread waits for OTP to load (up to 10 minutes), routes every stocked store from the default origin one at a time, confirms each medication's default `/api/pharmacies` search is a cache hit, and logs one `Route warm-up:` line. It re-warms every `--warmup-interval` seconds (default 300, `0` = once) so "leave now" transit entries whose departure has passed are refreshed; `--no-warmup` disables it.

Static caching: content-hashed `/assets/*` files are `public, max-age=31536000, immutable`; HTML, `/api/*`, redirects and errors are `no-store`; other images and fonts get one day and remaining static files five minutes.

See [deployment instructions](../frontend/SETUP.md) and [API and product behavior](../frontend/README.md).
