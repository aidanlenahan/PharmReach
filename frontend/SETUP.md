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

Python serves only `frontend/dist/` plus `/api`. Backend snapshots are in `backend/data/` and are never part of the static build. Paths resolve relative to the source files, independent of the shell working directory. The launcher connects to loopback OTP on 8080 and detects staged GTFS files. It never builds or starts OTP automatically.

## Persistent Linux service and domain

After building, install the system service and tunnel configuration:

```bash
sudo bash infra/systemd/install.sh
```

This starts and enables `hackru.service` at boot, restarts Python if it exits, and switches `pharmreach.tech` to loopback port 4173. The OTP ingress is `otp.pharmreach.tech` on 8080. Preview ingress is removed; deleting its DNS record is a separate Cloudflare operation. The previous active tunnel config is backed up before replacement.

```bash
sudo systemctl restart hackru
journalctl -u hackru -f
```

Rebuild the frontend after UI changes. Restart `hackru` after Python changes; inventory snapshots are re-read on each request. Optional launcher overrides go in `/etc/hackru.env`: `OTP_URL`, `OTP_DATA_DIR`, `TRANSIT_FARE`.

## OTP

Data, feeds, and `graph.obj` live in `backend/otp/data/` and are ignored by Git.

```bash
bash backend/otp/otp.sh build  # only when graph needs rebuilding
bash backend/otp/otp.sh serve  # leave running separately
```

The existing OTP container can remain running during this folder migration. Before its next restart, use the new data path. The app service does not manage the OTP container lifecycle; see `backend/otp/README.md`.

## Error responses

Unknown public paths return HTTP 404 with `frontend/public/404.html`. Requests for private source, data, configuration, dotfiles, traversal paths, symlink escapes, or directory listings return HTTP 403 with `frontend/public/403.html`. Unknown API endpoints keep their JSON 404 response. All current app pages are public; no account login or role system is configured. Build after editing the error pages, then restart `hackru` after server changes.
