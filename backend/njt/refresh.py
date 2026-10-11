#!/usr/bin/env python3
"""Refresh NJ TRANSIT rail + bus GTFS feeds for OTP, with validation and safe fallback.

Rail and bus are refreshed as one set, from the first source where every feed validates:
  1. NJT's public zips (rail_data.zip / bus_data.zip). They include light rail and run
     months ahead. Requests are conditional (ETag / Last-Modified), so an unchanged feed
     costs a 304 and no download.
  2. The NJT token API, only as a last resort: when the public zips fail *and* the staged
     feeds are missing or run out within --min-horizon-days. Its bus feed covers only a
     few days and its rail feed has no light rail, so it is accepted with a 1-day horizon
     just to keep transit routing alive until the public zips come back.
Validation: zip integrity, required GTFS files, stop counts, sizes, and service dates.
Only then is each staged feed atomically replaced (previous copy kept as *.prev). If no
source gives a complete valid set, existing feeds are left untouched. Sources are never
mixed: NJT puts light rail in the API's bus feed but in the public rail zip. Results go to the status
file read by backend/serve.py. A replaced feed only reaches routing after the OTP
graph is rebuilt (--rebuild, or `bash backend/otp/otp.sh build`) and OTP restarted.
"""
import argparse
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from envfile import load_env  # noqa: E402
from njt import CACHE_DIR, FEEDS, FEED_FILENAMES, OTP_DATA_DIR, STATUS_FILE, TOKEN_FILE  # noqa: E402
from njt.api import DOWNLOAD_TIMEOUT, NjtClient, NjtConfigError, NjtError, http_request, is_zip_file, iso, log, utcnow  # noqa: E402
from njt.gtfs import MIN_HORIZON_DAYS, FeedInvalid, feed_summary, validate_feed  # noqa: E402

PUBLIC_URLS = {'rail': 'https://www.njtransit.com/rail_data.zip', 'bus': 'https://www.njtransit.com/bus_data.zip'}
OTP_SCRIPT = Path(__file__).resolve().parent.parent / 'otp' / 'otp.sh'
GRAPH_INPUT_SUFFIXES = ('.osm.pbf', '.gtfs.zip', '-config.json')
SOURCES = ('public-zip', 'njt-api')
# The API set is a stopgap (bus covers ~5 days), so it only has to reach tomorrow.
LAST_RESORT_HORIZON_DAYS = 1


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def read_status(path):
    try:
        status = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return {}
    return status if isinstance(status, dict) else {}


def write_json_atomic(path, payload, mode=0o644):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'w') as handle:
            json.dump(payload, handle, indent=2)
            handle.write('\n')
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def keep_previous(dest):
    """Keep the current feed as <name>.prev (hard link when possible) before replacing it."""
    if not dest.exists():
        return
    prev = dest.with_name(dest.name + '.prev')
    try:
        prev.unlink()
    except FileNotFoundError:
        pass
    try:
        os.link(dest, prev)
    except OSError:
        shutil.copy2(dest, prev)


def fetch_public(feed, tmp, transport, validators=None, meta=None):
    """Download the public zip to `tmp`. Returns False on 304 (unchanged since `validators`)."""
    headers = {}
    if validators and validators.get('etag'):
        headers['If-None-Match'] = validators['etag']
    if validators and validators.get('last_modified'):
        headers['If-Modified-Since'] = validators['last_modified']
    try:
        status, content_type, body = transport(PUBLIC_URLS[feed], None, dest=tmp, timeout=DOWNLOAD_TIMEOUT, headers=headers, meta=meta)
    except OSError as error:
        raise NjtError(f'{type(error).__name__}: {error}', feed) from error
    if status == 304 and headers:
        return False
    if status != 200:
        raise NjtError(f'HTTP {status}', feed, status)
    if not is_zip_file(tmp):
        raise NjtError(f'not a zip ({content_type or "no content-type"})', feed, status)
    return True


def public_validators(old, dest):
    """ETag / Last-Modified from the last public download, if the staged file is still that download."""
    if not old or not (old.get('etag') or old.get('last_modified')):
        return None
    if not dest.is_file() or dest.stat().st_size != old.get('size') or sha256_of(dest) != old.get('sha256'):
        return None
    return {'etag': old.get('etag'), 'last_modified': old.get('last_modified')}


def existing_set_current(dests, today, min_horizon_days):
    """True when every staged feed exists and still has service at least `min_horizon_days` ahead."""
    for dest in dests.values():
        end = feed_summary(dest).get('service_end') if dest.is_file() else None
        if not end or (date.fromisoformat(end) - today).days < min_horizon_days:
            return False
    return True


def _remove(path):
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def refresh_feeds(feeds, out_dir, client, transport, previous, sources=SOURCES, dry_run=False, now=None, min_horizon_days=None):
    """Refresh `feeds` as one consistent set. Returns {feed: status entry}; never raises for download/validation failures.

    Sources are tried in order and a source is used only if *every* requested feed from it
    validates: NJT splits light rail differently between the API (bus G2 feed) and the
    public zips (rail feed), so mixing sources would drop or duplicate light rail. If no
    source yields a complete valid set, every existing feed is left untouched.
    """
    now = now or utcnow()
    if min_horizon_days is None:
        min_horizon_days = MIN_HORIZON_DAYS
    dests = {feed: out_dir / FEED_FILENAMES[feed] for feed in feeds}
    errors = {feed: [] for feed in feeds}
    meta = {feed: {} for feed in feeds}
    api_state = 'skipped'
    chosen, candidates = None, {}
    for source in sources:
        horizon = min_horizon_days
        if source == 'njt-api' and 'public-zip' in sources:
            if existing_set_current(dests, now.date(), min_horizon_days):
                log(f'njt-api: not needed; the staged feeds still run at least {min_horizon_days} days ahead')
                break
            horizon = min(min_horizon_days, LAST_RESORT_HORIZON_DAYS)
        candidates = {}
        for feed in feeds:
            dest = dests[feed]
            if source == 'public-zip':
                validators = public_validators(previous.get(feed), dest)
            fd, tmp_name = tempfile.mkstemp(prefix=f'.{dest.name}.', suffix='.part', dir=out_dir)
            os.close(fd)
            tmp = Path(tmp_name)
            try:
                if source == 'njt-api':
                    client.download_gtfs(feed, tmp)
                elif not fetch_public(feed, tmp, transport, validators, meta[feed]):
                    # 304: upstream unchanged. Re-check the staged copy (its service horizon shrinks daily).
                    _remove(tmp)
                    summary = validate_feed(dest, feed, today=now.date(), min_horizon_days=horizon)
                    meta[feed] = {k: v for k, v in (('ETag', validators.get('etag')), ('Last-Modified', validators.get('last_modified'))) if v}
                    candidates[feed] = (None, summary)
                    log(f'{feed}: {source} unchanged since last download (304); staged feed still valid')
                    continue
                summary = validate_feed(tmp, feed, previous_size=dest.stat().st_size if dest.is_file() else None,
                                        today=now.date(), min_horizon_days=horizon)
                candidates[feed] = (tmp, summary)
                log(f'{feed}: {source} valid ({summary["size"]:,} bytes, {summary["stops"]} stops, service {summary["service_start"]} to {summary["service_end"]})')
                continue
            except NjtConfigError as error:
                failure, state, verb = error, 'not-configured', 'skipped'
            except FeedInvalid as error:
                failure, state, verb = error, 'rejected', 'rejected'
            except (NjtError, OSError) as error:
                failure, state, verb = error, 'error', 'failed'
            _remove(tmp)
            errors[feed].append(f'{source}: {failure}')
            log(f'{feed}: {source} {verb}: {failure}')
            if source == 'njt-api' and api_state != 'error':
                api_state = state
            if state == 'not-configured':
                break  # same reason for every feed; don't log it twice
        if len(candidates) == len(feeds):
            chosen = source
            if source == 'njt-api':
                api_state = 'ok'
            break
        for tmp, _ in candidates.values():
            if tmp is not None:
                _remove(tmp)
        if candidates:
            log(f'{source}: only {", ".join(sorted(candidates))} valid; not mixing sources, trying the next one')
            for feed in candidates:
                errors[feed].append(f'{source}: not used because {", ".join(sorted(set(feeds) - set(candidates)))} from it failed')

    entries = {}
    for feed in feeds:
        dest = dests[feed]
        old = previous.get(feed) or {}
        entry = {'file': dest.name, 'last_attempt': iso(now), 'last_success': old.get('last_success'),
                 'replaced_at': old.get('replaced_at'), 'api': api_state}
        if chosen:
            tmp, summary = candidates[feed]
            if tmp is None:  # 304: the staged file is the current upstream copy
                digest, changed = old.get('sha256'), False
            else:
                try:
                    digest = sha256_of(tmp)
                    changed = not dest.is_file() or sha256_of(dest) != digest
                    if changed and not dry_run:
                        os.chmod(tmp, 0o644)
                        keep_previous(dest)
                        os.replace(tmp, dest)
                        entry['replaced_at'] = iso(now)
                finally:
                    _remove(tmp)
            if chosen == 'public-zip':
                entry.update(etag=meta[feed].get('ETag'), last_modified=meta[feed].get('Last-Modified'))
            log(f'{feed}: using {chosen}' + ('' if changed else ' (identical to current feed)')
                + (' [dry run, not installed]' if dry_run and changed else ''))
            entry.update(source=chosen, last_success=iso(now), error='; '.join(errors[feed]) or None,
                         changed=changed, sha256=digest, **summary)
        else:
            existing = feed_summary(dest) if dest.is_file() else {'size': None, 'service_start': None, 'service_end': None}
            log(f'{feed}: no complete valid set from any source; keeping the existing feed' + ('' if dest.is_file() else ' (none staged)'))
            entry.update(source='existing', error='; '.join(errors[feed]) or 'no sources enabled', changed=False,
                         etag=old.get('etag'), last_modified=old.get('last_modified'), sha256=old.get('sha256'), **existing)
        entries[feed] = entry
    return entries


def graph_rebuild_pending(data_dir):
    graph = data_dir / 'graph.obj'
    feeds = [p for p in data_dir.glob('*.gtfs.zip') if not p.name.startswith('.')]
    if not feeds:
        return False
    if not graph.is_file():
        return True
    return max(p.stat().st_mtime for p in feeds) > graph.stat().st_mtime


def rebuild_graph(data_dir):
    """Build graph.obj in a staging dir (hard links to the inputs), then swap it in atomically."""
    staging = data_dir / '.graph-build'
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir()
    try:
        for path in data_dir.iterdir():
            if path.is_file() and not path.name.startswith('.') and path.name.endswith(GRAPH_INPUT_SUFFIXES):
                try:
                    os.link(path, staging / path.name)
                except OSError:
                    shutil.copy2(path, staging / path.name)
        log(f'rebuilding OTP graph in {staging} (this can take a long time and several GB of memory)')
        result = subprocess.run(['bash', str(OTP_SCRIPT), 'build'], env={**os.environ, 'OTP_DATA_DIR': str(staging)},
                                stdin=subprocess.DEVNULL, timeout=4 * 3600)
        built = staging / 'graph.obj'
        if result.returncode != 0 or not built.is_file() or built.stat().st_size == 0:
            raise RuntimeError(f'otp.sh build exited {result.returncode}' + ('' if built.is_file() else ', no graph.obj produced'))
        graph = data_dir / 'graph.obj'
        keep_previous(graph)
        os.replace(built, graph)
        log('graph.obj replaced; restart the OTP server so it loads the new graph')
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def main(argv=None):
    load_env()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--feed', action='append', choices=FEEDS, help='Refresh only this feed (repeatable; default: rail and bus)')
    parser.add_argument('--out-dir', type=Path, default=OTP_DATA_DIR, help=f'Where staged feeds live (default: {OTP_DATA_DIR})')
    parser.add_argument('--status-file', type=Path, help=f'Status JSON (default: {STATUS_FILE}, or <out-dir>/transit-status.json with a custom --out-dir)')
    parser.add_argument('--dry-run', action='store_true', help='Download and validate only; replace nothing and write no status')
    parser.add_argument('--no-api', action='store_true', help='Skip the NJT token API (public zips only)')
    parser.add_argument('--no-public', action='store_true', help='Skip the public zip fallback')
    parser.add_argument('--min-horizon-days', type=int, default=int(os.environ.get('NJT_MIN_HORIZON_DAYS') or MIN_HORIZON_DAYS),
                        help=f'Reject feeds whose service ends sooner than this many days ahead (default {MIN_HORIZON_DAYS}, env NJT_MIN_HORIZON_DAYS)')
    parser.add_argument('--rebuild', action='store_true', help='Rebuild the OTP graph if a feed is newer than graph.obj (needs Docker and several GB of free memory)')
    args = parser.parse_args(argv)

    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    status_file = args.status_file or (STATUS_FILE if out_dir == OTP_DATA_DIR.resolve() else out_dir / 'transit-status.json')
    feeds = args.feed or list(FEEDS)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_DIR / 'njt-refresh.lock', 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log('another refresh is already running; exiting')
            return 3

        client = NjtClient(token_file=TOKEN_FILE, transport=http_request, now=utcnow, logger=log)
        status = read_status(status_file)
        status.setdefault('feeds', {})
        sources = [src for src in SOURCES if not (src == 'njt-api' and args.no_api) and not (src == 'public-zip' and args.no_public)]
        entries = refresh_feeds(feeds, out_dir, client, http_request, status['feeds'], sources=sources,
                                dry_run=args.dry_run, min_horizon_days=args.min_horizon_days)
        status['feeds'].update(entries)
        ok = all(entry['source'] != 'existing' for entry in entries.values())
        other_sources = {entry.get('source') for name, entry in status['feeds'].items() if name not in feeds and isinstance(entry, dict)}
        if other_sources - {entry['source'] for entry in entries.values()} - {'existing', None}:
            log('WARNING: rail and bus now come from different sources; light rail may be missing or duplicated. Refresh both feeds together.')
        graph = status.setdefault('graph', {})
        graph['rebuild_pending'] = graph_rebuild_pending(out_dir)
        if args.rebuild and graph['rebuild_pending'] and not args.dry_run:
            graph['last_rebuild_attempt'] = iso(utcnow())
            try:
                rebuild_graph(out_dir)
                graph.update(last_rebuild=iso(utcnow()), last_rebuild_error=None, rebuild_pending=False)
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                graph['last_rebuild_error'] = str(error)[:300]
                log(f'graph rebuild failed; the previous graph.obj is untouched: {error}')
                ok = False
        elif graph['rebuild_pending']:
            log('feeds are newer than graph.obj: rebuild with --rebuild or `bash backend/otp/otp.sh build`, then restart OTP')
        status['updated_at'] = iso(utcnow())
        if args.dry_run:
            print(json.dumps(status, indent=2))
        else:
            write_json_atomic(status_file, status)
            log(f'status written to {status_file}')
        return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
