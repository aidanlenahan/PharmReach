# Build, run, and deploy

Run commands from the repository root. Requires Python 3.9+, Node.js 22.12+, Corepack, and Docker for OTP.

## Development

```bash
python3 backend/serve.py  # requires one frontend build first
# In another terminal:
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Vite listens on 5173 and proxies `/api` to Python on 4173.

## Production

```bash
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm build
cd ..
bash backend/otp/run_demo_with_otp.sh
```

Python serves only `frontend/dist/` plus `/api`. Backend snapshots are in `backend/data/` and are never part of the static build. Paths resolve relative to the source files, independent of the shell working directory. The launcher connects to loopback OTP on 8080 and detects staged GTFS files. It never builds or starts OTP itself; on the server, `otp.service` runs it (see below).

## Persistent Linux service and domain

After building, install the system service and tunnel configuration:

```bash
sudo bash infra/systemd/install.sh
```

This installs and enables `otp.service` (the OTP container) and `hackru.service` at boot, starts OTP first, restarts Python if it exits, and switches `pharmreach.tech` to loopback port 4173. OTP listens on loopback port 8080 only and has no public hostname; use `ssh -L 8080:127.0.0.1:8080 <vm>` to reach it for debugging. Preview ingress is removed; deleting its DNS record is a separate Cloudflare operation. The previous active tunnel config is backed up before replacement.

```bash
sudo systemctl restart hackru
journalctl -u hackru -f
sudo systemctl restart otp     # after rebuilding graph.obj; takes ~1–2 min to load
journalctl -u otp -f
```

Rebuild the frontend after UI changes. Restart `hackru` after Python changes; inventory snapshots are re-read on each request. Optional overrides go in `/etc/hackru.env` (read by both units): `OTP_URL`, `OTP_DATA_DIR`, `TRANSIT_FARE`, and for OTP `OTP_JAVA_HEAP` (default `2G`) and `OTP_MEMORY_LIMIT` (default heap + 700 MB). Restart `otp` after changing them.

## Medication helper (Gemini)

`POST /api/chat` (the homepage "Don't know the name?" panel) calls Gemini from the server only; the key never reaches the browser or the logs. Add the key to `/etc/hackru.env` on the VM, then `sudo systemctl restart hackru`:

```bash
GEMINI_API_KEY=...               # required; without it /api/health reports "chat_configured": false
# GEMINI_MODEL=gemini-3.8-flash  # optional override of the model pinned in backend/chat.py
# CHAT_GLOBAL_RPM=5              # Gemini calls per minute across all users (free tier allows 5)
# CHAT_IP_RPM=10                 # /api/chat requests per minute per client IP
```

For local runs, `backend/envfile.py` also reads a repo-root `.env` (git-ignored); variables already set in the environment win. Unit tests: `python3 -m unittest discover -s backend/tests`. Live check against the real API (about 10 calls, paced for the free tier): `python3 backend/scripts/chat_eval.py`.

## OTP

Data, feeds, and `graph.obj` live in `backend/otp/data/` and are ignored by Git.

```bash
bash backend/otp/otp.sh build  # only when graph needs rebuilding (OTP_BUILD_HEAP, default 4G)
sudo systemctl restart otp     # serve via systemd (container name pharmreach-otp)
```

`otp.service` restarts the container on exit and on reboot. `hackru.service` wants OTP but does not require it: while OTP is down or loading, the app serves real prices and stock with routes marked unavailable (never estimated travel times). Running `otp.sh serve` by hand still works for local development; stop `otp.service` first so they don't fight over port 8080. See `backend/otp/README.md` for heap sizing.

## Transit data refresh

`install.sh` also installs `njt-refresh.timer`, which runs `backend/njt/refresh.py` about every 20h (and 15 min after boot) as the service user. Put the NJ TRANSIT developer login in `/etc/hackru.env` as `NJT_USERNAME=` and `NJT_PASSWORD=` (root-owned, mode 600). The job uses NJ TRANSIT's public zips and only calls the token API as a last resort, so the login is optional. Set `NJT_REFRESH_ARGS=--rebuild` there to rebuild the graph automatically after a feed changes (only if the VM has memory for a build next to OTP). See `backend/otp/README.md`.

```bash
systemctl list-timers njt-refresh.timer
sudo systemctl start njt-refresh.service   # run now
journalctl -u njt-refresh -n 50
```

## Error responses

Pages are published without `.html` (`/results`, `/settings`, …); the `.html` URLs redirect to them with a 301. Unknown public paths return HTTP 404 with `frontend/404.html`. Requests for private source, data, configuration, dotfiles, traversal paths, symlink escapes, or directory listings return HTTP 403 with `frontend/403.html`. Unknown API endpoints keep their JSON 404 response. All current app pages are public; no account login or role system is configured. Build after editing the error pages, then restart `hackru` after server changes.
