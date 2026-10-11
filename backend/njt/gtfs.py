"""GTFS zip validation and service-date extraction (stdlib only, streaming reads)."""
import csv
import io
import zipfile
import zlib
from datetime import date
from pathlib import Path

REQUIRED_FILES = {'agency.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'stops.txt'}
CALENDAR_FILES = {'calendar.txt', 'calendar_dates.txt'}
# Per-feed sanity floors. Current NJT feeds: rail ~6 MB / 230 stops, bus ~50 MB / 16.5k stops.
LIMITS = {
    'rail': {'min_bytes': 200_000, 'min_stops': 50},
    'bus': {'min_bytes': 2_000_000, 'min_stops': 2_000},
}
MAX_BYTES = 1024 * 1024 * 1024
# Reject a new feed that is far smaller than the one it would replace (likely partial).
MIN_SIZE_RATIO = 0.4
# Service must run at least this many days ahead: the app plans trips up to 30 days out, and a
# short feed leaves routing with no service if a later refresh fails. NJT's G2 bus API feed is a
# rolling ~5-day window (2 days back, 1-2 ahead), so it fails this check by default.
MIN_HORIZON_DAYS = 7


class FeedInvalid(ValueError):
    pass


def _member(names, wanted):
    """Find a member by basename (feeds are occasionally zipped inside a folder)."""
    for name in names:
        if not name.endswith('/') and name.rsplit('/', 1)[-1] == wanted:
            return name
    return None


def _rows(archive, member):
    with archive.open(member) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))


def _parse_day(value):
    value = (value or '').strip()
    if len(value) != 8 or not value.isdigit():
        return None
    try:
        return date(int(value[:4]), int(value[4:6]), int(value[6:]))
    except ValueError:
        return None


def service_range(archive, names=None):
    """(start, end) dates of service from feed_info, calendar, and calendar_dates; either may be None."""
    names = names if names is not None else archive.namelist()
    days = []
    feed_info = _member(names, 'feed_info.txt')
    if feed_info:
        for row in _rows(archive, feed_info):
            days += [d for d in (_parse_day(row.get('feed_start_date')), _parse_day(row.get('feed_end_date'))) if d]
            break
        if len(days) == 2:
            return min(days), max(days)
        days = []
    calendar = _member(names, 'calendar.txt')
    if calendar:
        for row in _rows(archive, calendar):
            days += [d for d in (_parse_day(row.get('start_date')), _parse_day(row.get('end_date'))) if d]
    calendar_dates = _member(names, 'calendar_dates.txt')
    if calendar_dates:
        for row in _rows(archive, calendar_dates):
            if (row.get('exception_type') or '').strip() == '1':
                day = _parse_day(row.get('date'))
                if day:
                    days.append(day)
    return (min(days), max(days)) if days else (None, None)


def feed_summary(path):
    """Cheap-ish summary for an existing feed: size and service range. Never raises."""
    path = Path(path)
    try:
        size = path.stat().st_size
        with zipfile.ZipFile(path) as archive:
            start, end = service_range(archive)
    except (OSError, zipfile.BadZipFile, ValueError, csv.Error, UnicodeDecodeError, EOFError, zlib.error):
        return {'size': None, 'service_start': None, 'service_end': None}
    return {'size': size, 'service_start': start.isoformat() if start else None, 'service_end': end.isoformat() if end else None}


def validate_feed(path, feed, previous_size=None, today=None, limits=None, min_horizon_days=None):
    """Validate a downloaded GTFS zip. Returns a summary dict; raises FeedInvalid with a short reason."""
    path = Path(path)
    limits = limits or LIMITS.get(feed, {'min_bytes': 1, 'min_stops': 1})
    today = today or date.today()
    try:
        size = path.stat().st_size
    except OSError as error:
        raise FeedInvalid(f'file missing: {error}') from error
    if size < limits['min_bytes']:
        raise FeedInvalid(f'too small ({size} bytes < {limits["min_bytes"]})')
    if size > MAX_BYTES:
        raise FeedInvalid(f'too large ({size} bytes)')
    if previous_size and size < previous_size * MIN_SIZE_RATIO:
        raise FeedInvalid(f'{size} bytes is under {int(MIN_SIZE_RATIO * 100)}% of the current feed ({previous_size} bytes); looks partial')
    try:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            basenames = {n.rsplit('/', 1)[-1] for n in names if not n.endswith('/')}
            missing = REQUIRED_FILES - basenames
            if missing:
                raise FeedInvalid(f'missing GTFS files: {", ".join(sorted(missing))}')
            if not basenames & CALENDAR_FILES:
                raise FeedInvalid('missing calendar.txt and calendar_dates.txt')
            bad = archive.testzip()
            if bad is not None:
                raise FeedInvalid(f'CRC check failed for {bad}')
            stops = 0
            for row in _rows(archive, _member(names, 'stops.txt')):
                if (row.get('stop_id') or '').strip():
                    stops += 1
            if stops < limits['min_stops']:
                raise FeedInvalid(f'only {stops} stops (expected at least {limits["min_stops"]})')
            for member in ('trips.txt', 'stop_times.txt', 'routes.txt'):
                if next(iter(_rows(archive, _member(names, member))), None) is None:
                    raise FeedInvalid(f'{member} has no rows')
            start, end = service_range(archive, names)
    except zipfile.BadZipFile as error:
        raise FeedInvalid(f'not a valid zip: {error}') from error
    except (csv.Error, UnicodeDecodeError, KeyError, EOFError, OSError, zlib.error) as error:
        raise FeedInvalid(f'unreadable GTFS: {type(error).__name__}: {error}') from error
    if end is None:
        raise FeedInvalid('no service dates found')
    if end < today:
        raise FeedInvalid(f'service ended {end.isoformat()}')
    horizon = MIN_HORIZON_DAYS if min_horizon_days is None else min_horizon_days
    if (end - today).days < horizon:
        raise FeedInvalid(f'service only runs to {end.isoformat()} (need at least {horizon} days ahead)')
    return {'size': size, 'stops': stops, 'service_start': start.isoformat() if start else None, 'service_end': end.isoformat()}
