"""Transit data freshness for the API, read from the refresh job's status file.

Cheap enough for every request: the status JSON is parsed only when its mtime changes,
and otherwise only a few stat() calls are made. Never raises.
"""
import json
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import FEED_FILENAMES, FEEDS, OTP_DATA_DIR, STATUS_FILE

STALE_AFTER = timedelta(hours=48)
SERVICE_END_MARGIN = timedelta(days=3)
UNAVAILABLE = 'live NJ Transit data is temporarily unavailable.'

_lock = threading.Lock()
_cache = {'key': None, 'value': None}

try:
    from zoneinfo import ZoneInfo
    _LOCAL_TZ = ZoneInfo('America/New_York')
except Exception:  # pragma: no cover - tzdata missing
    _LOCAL_TZ = timezone.utc


def _parse_time(value):
    try:
        moment = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _parse_date(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _iso(moment):
    return moment.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def _read_status(path):
    try:
        stat = path.stat()
    except OSError:
        return None
    key = (str(path), stat.st_ino, stat.st_mtime_ns, stat.st_size)
    with _lock:
        if _cache['key'] == key:
            return _cache['value']
    try:
        value = json.loads(path.read_text())
        if not isinstance(value, dict):
            value = None
    except (OSError, ValueError):
        value = None
    with _lock:
        _cache['key'], _cache['value'] = key, value
    return value


def _graph_rebuild_pending(data_dir):
    try:
        graph = (data_dir / 'graph.obj').stat().st_mtime
    except OSError:
        return None
    newest = None
    for name in FEED_FILENAMES.values():
        try:
            mtime = (data_dir / name).stat().st_mtime
        except OSError:
            continue
        newest = mtime if newest is None else max(newest, mtime)
    return newest is not None and newest > graph


def transit_data_status(status_file=STATUS_FILE, data_dir=OTP_DATA_DIR, now=None):
    """Summary for API responses: {updated_at, source, stale, fallback, message, ...}.

    source: njt-api (token API), public-zip (NJT's public download), existing (last refresh
    failed, older feed kept), or manual (no refresh has run; feeds staged by hand).
    """
    try:
        return _transit_data_status(Path(status_file), Path(data_dir), now or datetime.now(timezone.utc))
    except Exception as error:  # status must never break an API response
        return {'updated_at': None, 'source': None, 'stale': True, 'fallback': True, 'service_end': None,
                'rebuild_pending': None, 'message': f'Transit schedule status is unavailable; {UNAVAILABLE}',
                'feeds': {}, 'error': type(error).__name__}


def _transit_data_status(status_file, data_dir, now):
    status = _read_status(status_file) or {}
    entries = status.get('feeds') if isinstance(status.get('feeds'), dict) else {}
    today = now.astimezone(_LOCAL_TZ).date()
    feeds = {}
    for feed in FEEDS:
        entry = entries.get(feed) if isinstance(entries.get(feed), dict) else None
        if entry is None:
            # No refresh has run yet (feeds staged by hand): use the staged file's mtime.
            try:
                mtime = (data_dir / FEED_FILENAMES[feed]).stat().st_mtime
            except OSError:
                continue
            entry = {'source': 'manual', 'last_success': _iso(datetime.fromtimestamp(mtime, timezone.utc)), 'last_attempt': None}
        last_success = _parse_time(entry.get('last_success'))
        service_end = _parse_date(entry.get('service_end'))
        reasons = []
        if entry.get('last_attempt') and entry.get('source') == 'existing':
            reasons.append('refresh_failed')
        if last_success is None or now - last_success > STALE_AFTER:
            reasons.append('old')
        if service_end is not None and service_end - today < SERVICE_END_MARGIN:
            reasons.append('service_ending' if service_end >= today else 'service_ended')
        feeds[feed] = {
            'source': entry.get('source'),
            'api': entry.get('api'),
            'updated_at': _iso(last_success) if last_success else None,
            'service_end': service_end.isoformat() if service_end else None,
            'stale': bool(reasons),
            'reasons': reasons,
        }
    if not feeds:
        return {'updated_at': None, 'source': None, 'stale': False, 'fallback': False, 'service_end': None,
                'rebuild_pending': None, 'message': None, 'feeds': {}}
    sources = {f['source'] for f in feeds.values()}
    source = next((s for s in ('existing', 'public-zip', 'manual') if s in sources), 'njt-api')
    updated = [_parse_time(f['updated_at']) for f in feeds.values()]
    updated_at = None if None in updated else min(updated)
    ends = [_parse_date(f['service_end']) for f in feeds.values() if f['service_end']]
    service_end = min(ends) if ends else None
    stale = any(f['stale'] for f in feeds.values())
    # Fallback = the token API was unreachable/erroring (not merely unconfigured, or its feed
    # rejected by validation policy such as the short G2 bus horizon), or a refresh kept old data.
    fallback = source == 'existing' or (source == 'public-zip' and any(f.get('api') == 'error' for f in feeds.values()))
    message = None
    if stale or fallback:
        when = updated_at.astimezone(_LOCAL_TZ).strftime('%b %-d, %Y') if updated_at else 'at an unknown time'
        if service_end is not None and service_end < today:
            message = f'Transit schedules on file ended {service_end.strftime("%b %-d, %Y")}; {UNAVAILABLE}'
        elif source == 'public-zip' and not stale:
            message = f"Transit schedules last updated {when} from NJ TRANSIT's public download; {UNAVAILABLE}"
        else:
            message = f'Transit schedules last updated {when}; {UNAVAILABLE}'
    return {
        'updated_at': _iso(updated_at) if updated_at else None,
        'source': source,
        'stale': stale,
        'fallback': fallback,
        'service_end': service_end.isoformat() if service_end else None,
        'rebuild_pending': _graph_rebuild_pending(data_dir),
        'message': message,
        'feeds': feeds,
    }
