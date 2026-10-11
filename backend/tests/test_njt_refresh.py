"""Tests for backend/njt: token cache, refresh job, validation, fallback, status. No network.

Run: python3 -m unittest discover -s backend/tests
"""
import io
import json
import os
import stat
import sys
import tempfile
import unittest
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from njt import api, gtfs, refresh, status  # noqa: E402

ENV = {'NJT_USERNAME': 'user@example.com', 'NJT_PASSWORD': 'hunter2-secret'}
SMALL_LIMITS = {'rail': {'min_bytes': 100, 'min_stops': 2}, 'bus': {'min_bytes': 100, 'min_stops': 2}}
T0 = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)


def make_gtfs(stops=3, end=None, omit=(), marker=''):
    end = end or (date.today() + timedelta(days=60))
    start = min(date.today(), end - timedelta(days=7))
    files = {
        'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nNJT,NJ TRANSIT,https://njtransit.com,America/New_York\n',
        'routes.txt': 'route_id,agency_id,route_short_name,route_type\nR1,NJT,1,3\n',
        'trips.txt': 'route_id,service_id,trip_id\nR1,S1,T1\n',
        'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,S0,1\n',
        'stops.txt': '﻿stop_id,stop_name,stop_lat,stop_lon\n' + ''.join(f'S{i},Stop {i}{marker},40.7,-74.0\n' for i in range(stops)),
        'calendar_dates.txt': f'service_id,date,exception_type\nS1,{start:%Y%m%d},1\nS1,{end:%Y%m%d},1\n',
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, text in files.items():
            if name not in omit:
                archive.writestr(name, text)
    return buffer.getvalue()


class FakeTransport:
    """Maps URL -> list of (status, content_type, body[, response_headers]) responses, consumed in order."""

    def __init__(self, routes=None):
        self.routes = {k: list(v) for k, v in (routes or {}).items()}
        self.calls = []
        self.headers = []

    def __call__(self, url, fields=None, dest=None, timeout=None, accept=None, headers=None, meta=None):
        self.calls.append((url, dict(fields) if fields else None))
        self.headers.append((url, dict(headers or {})))
        if not self.routes.get(url):
            raise OSError(f'no fake response for {url}')
        response = self.routes[url].pop(0)
        if isinstance(response, Exception):
            raise response
        code, ctype, body = response[:3]
        if meta is not None and len(response) > 3 and code == 200:
            meta.update(response[3])
        if dest is not None and code == 200:
            Path(dest).write_bytes(body)
            return code, ctype, None
        return code, ctype, body

    def count(self, url):
        return sum(1 for u, _ in self.calls if u == url)


def url(feed, kind):
    return api.API_CONFIG[feed]['base'] + api.API_CONFIG[feed][kind]


def token_ok(token):
    return (200, 'application/json', json.dumps({'Authenticated': 'True', 'UserToken': token}).encode())


INVALID = (500, 'application/json', b'{"errorMessage":"Invalid token."}')


class Clock:
    def __init__(self, moment):
        self.moment = moment

    def __call__(self):
        return self.moment


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__('shutil').rmtree(self.dir, ignore_errors=True))
        self.token_file = self.dir / 'cache' / 'njt-tokens.json'
        self.clock = Clock(T0)
        self.logs = []
        for patcher in (mock.patch.dict(gtfs.LIMITS, SMALL_LIMITS), mock.patch.object(refresh, 'log', self.logs.append)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def client(self, transport, env=ENV):
        return api.NjtClient(token_file=self.token_file, env=env, transport=transport, now=self.clock, logger=self.logs.append)


class TokenTests(Base):
    def test_token_reused_until_20h_then_renewed(self):
        transport = FakeTransport({url('rail', 'auth'): [token_ok('tok-1'), token_ok('tok-2')]})
        client = self.client(transport)
        self.assertEqual(client.get_token('rail'), ('tok-1', True))
        self.clock.moment = T0 + timedelta(hours=19, minutes=59)
        self.assertEqual(client.get_token('rail'), ('tok-1', False))
        self.assertEqual(transport.count(url('rail', 'auth')), 1)
        self.clock.moment = T0 + timedelta(hours=20, minutes=1)
        self.assertEqual(client.get_token('rail'), ('tok-2', True))
        self.assertEqual(transport.count(url('rail', 'auth')), 2)

    def test_cache_file_private_and_has_no_credentials(self):
        client = self.client(FakeTransport({url('bus', 'auth'): [token_ok('bus-tok')]}))
        client.get_token('bus')
        self.assertEqual(stat.S_IMODE(self.token_file.stat().st_mode), 0o600)
        text = self.token_file.read_text()
        self.assertNotIn(ENV['NJT_PASSWORD'], text)
        self.assertNotIn(ENV['NJT_USERNAME'], text)
        self.assertEqual(json.loads(text)['tokens']['bus']['issued_at'], '2026-10-11T12:00:00Z')
        self.assertFalse(any('bus-tok' in line for line in self.logs))

    def test_daily_cap_refuses_without_calling_api(self):
        recent = [api.iso(T0 - timedelta(hours=h)) for h in range(1, 9)]  # 8 calls in the last 24h
        self.token_file.parent.mkdir(parents=True)
        self.token_file.write_text(json.dumps({'auth_calls': {'rail': recent}}))
        transport = FakeTransport({url('rail', 'auth'): [token_ok('x')]})
        with self.assertRaises(api.NjtConfigError):
            self.client(transport).get_token('rail')
        self.assertEqual(transport.calls, [])

    def test_old_calls_do_not_count_and_warning_near_cap(self):
        old = [api.iso(T0 - timedelta(hours=30))] * 20
        recent = [api.iso(T0 - timedelta(hours=h)) for h in range(1, 6)]  # 5 recent -> 6th warns
        self.token_file.parent.mkdir(parents=True)
        self.token_file.write_text(json.dumps({'auth_calls': {'rail': old + recent}}))
        client = self.client(FakeTransport({url('rail', 'auth'): [token_ok('x')]}))
        self.assertEqual(client.get_token('rail'), ('x', True))
        self.assertTrue(any('WARNING' in line for line in self.logs))
        self.assertEqual(len(json.loads(self.token_file.read_text())['auth_calls']['rail']), 6)

    def test_missing_credentials(self):
        transport = FakeTransport()
        with self.assertRaises(api.NjtConfigError):
            self.client(transport, env={}).get_token('rail')
        self.assertEqual(transport.calls, [])

    def test_failed_auth_reports_njt_message(self):
        transport = FakeTransport({url('rail', 'auth'): [(500, 'application/json', b'{"errorMessage":"Daily usage limit:10. Your current daily usage: 11"}')]})
        with self.assertRaises(api.NjtError) as ctx:
            self.client(transport).get_token('rail')
        self.assertIn('Daily usage limit', str(ctx.exception))
        self.assertNotIn(ENV['NJT_PASSWORD'], str(ctx.exception))


class DownloadTests(Base):
    def test_invalid_cached_token_is_renewed_once_and_retried(self):
        zip_bytes = make_gtfs()
        transport = FakeTransport({
            url('rail', 'auth'): [token_ok('old'), token_ok('new')],
            url('rail', 'gtfs'): [INVALID, (200, 'application/zip', zip_bytes)],
        })
        client = self.client(transport)
        client.get_token('rail')  # cache 'old'
        dest = self.dir / 'out.zip'
        result = client.download_gtfs('rail', dest)
        self.assertEqual(result, {'retried': True, 'token': 'new'})
        self.assertEqual(dest.read_bytes(), zip_bytes)
        self.assertEqual([f['token'] for u, f in transport.calls if u == url('rail', 'gtfs')], ['old', 'new'])
        self.assertEqual(transport.count(url('rail', 'auth')), 2)

    def test_fresh_token_rejected_does_not_loop(self):
        transport = FakeTransport({url('bus', 'auth'): [token_ok('t1'), token_ok('t2')], url('bus', 'gtfs'): [INVALID, INVALID]})
        with self.assertRaises(api.NjtError):
            self.client(transport).download_gtfs('bus', self.dir / 'out.zip')
        self.assertEqual(transport.count(url('bus', 'auth')), 1)
        self.assertEqual(transport.count(url('bus', 'gtfs')), 1)

    def test_second_invalid_after_retry_raises(self):
        transport = FakeTransport({url('rail', 'auth'): [token_ok('a'), token_ok('b')], url('rail', 'gtfs'): [INVALID, INVALID]})
        client = self.client(transport)
        client.get_token('rail')
        with self.assertRaises(api.NjtError):
            client.download_gtfs('rail', self.dir / 'out.zip')
        self.assertEqual(transport.count(url('rail', 'auth')), 2)
        self.assertEqual(transport.count(url('rail', 'gtfs')), 2)


class ValidationTests(Base):
    def write(self, data):
        path = self.dir / 'feed.zip'
        path.write_bytes(data)
        return path

    def test_accepts_good_feed(self):
        summary = gtfs.validate_feed(self.write(make_gtfs(stops=5)), 'rail')
        self.assertEqual(summary['stops'], 5)
        self.assertIsNotNone(summary['service_end'])

    def test_rejects_truncated_zip(self):
        data = make_gtfs()
        with self.assertRaises(gtfs.FeedInvalid):
            gtfs.validate_feed(self.write(data[: len(data) // 2]), 'rail')

    def test_rejects_missing_files_and_empty_stops_and_expired(self):
        for kwargs in ({'omit': ('stop_times.txt',)}, {'omit': ('calendar_dates.txt',)}, {'stops': 0},
                       {'end': date.today() - timedelta(days=1)}):
            with self.subTest(kwargs=kwargs), self.assertRaises(gtfs.FeedInvalid):
                gtfs.validate_feed(self.write(make_gtfs(**kwargs)), 'rail')

    def test_rejects_much_smaller_than_current(self):
        path = self.write(make_gtfs())
        with self.assertRaises(gtfs.FeedInvalid):
            gtfs.validate_feed(path, 'rail', previous_size=path.stat().st_size * 10)


class RefreshFeedTests(Base):
    def setUp(self):
        super().setUp()
        self.out = self.dir / 'otp'
        self.out.mkdir()
        self.dest = self.out / 'nj-transit-rail.gtfs.zip'
        self.old = make_gtfs(marker=' old')
        self.dest.write_bytes(self.old)

    def run_feed(self, routes, env=ENV, previous=None, **kwargs):
        transport = FakeTransport(routes)
        entries = refresh.refresh_feeds(['rail'], self.out, self.client(transport, env), transport, previous or {}, now=T0, **kwargs)
        return entries['rail'], transport

    def expiring(self):
        """Stage a feed whose service ends in 2 days, so the API last resort is allowed."""
        self.old = make_gtfs(marker=' old', end=T0.date() + timedelta(days=2))
        self.dest.write_bytes(self.old)

    def leftovers(self):
        return [p.name for p in self.out.iterdir() if p.name.endswith('.part')]

    def test_successful_public_download_replaces_and_keeps_prev(self):
        new = make_gtfs(stops=4, marker=' new')
        entry, transport = self.run_feed({refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', new, {'ETag': '"v2"', 'Last-Modified': 'Thu, 17 Sep 2026 17:55:35 GMT'})]})
        self.assertEqual((entry['source'], entry['api']), ('public-zip', 'skipped'))
        self.assertTrue(entry['changed'])
        self.assertIsNone(entry['error'])
        self.assertEqual(entry['last_success'], '2026-10-11T12:00:00Z')
        self.assertEqual(entry['stops'], 4)
        self.assertEqual((entry['etag'], entry['last_modified']), ('"v2"', 'Thu, 17 Sep 2026 17:55:35 GMT'))
        self.assertEqual(self.dest.read_bytes(), new)
        self.assertEqual((self.out / 'nj-transit-rail.gtfs.zip.prev').read_bytes(), self.old)
        self.assertEqual(transport.count(url('rail', 'auth')), 0)
        self.assertEqual(self.leftovers(), [])

    def test_unchanged_public_feed_costs_a_304(self):
        previous = {'rail': {'source': 'public-zip', 'etag': '"v1"', 'last_modified': 'Thu, 17 Sep 2026 17:55:35 GMT',
                             'size': len(self.old), 'sha256': refresh.sha256_of(self.dest)}}
        entry, transport = self.run_feed({refresh.PUBLIC_URLS['rail']: [(304, '', b'')]}, previous=previous)
        self.assertEqual(transport.headers[0][1], {'If-None-Match': '"v1"', 'If-Modified-Since': 'Thu, 17 Sep 2026 17:55:35 GMT'})
        self.assertEqual((entry['source'], entry['changed'], entry['etag']), ('public-zip', False, '"v1"'))
        self.assertEqual(entry['last_success'], '2026-10-11T12:00:00Z')
        self.assertEqual(self.dest.read_bytes(), self.old)
        self.assertFalse((self.out / 'nj-transit-rail.gtfs.zip.prev').exists())
        self.assertEqual(self.leftovers(), [])

    def test_no_conditional_request_when_staged_file_differs(self):
        previous = {'rail': {'source': 'public-zip', 'etag': '"v1"', 'size': len(self.old), 'sha256': 'not-this-file'}}
        _, transport = self.run_feed({refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', make_gtfs(marker=' new'))]}, previous=previous)
        self.assertEqual(transport.headers[0][1], {})

    def test_unchanged_but_expiring_feed_falls_back_to_api(self):
        self.expiring()
        previous = {'rail': {'etag': '"v1"', 'size': len(self.old), 'sha256': refresh.sha256_of(self.dest)}}
        entry, _ = self.run_feed({refresh.PUBLIC_URLS['rail']: [(304, '', b'')], url('rail', 'auth'): [token_ok('t')],
                                  url('rail', 'gtfs'): [(200, 'application/zip', make_gtfs(marker=' api'))]}, previous=previous)
        self.assertEqual((entry['source'], entry['api']), ('njt-api', 'ok'))
        self.assertIn('days ahead', entry['error'])

    def test_invalid_download_keeps_old_file(self):
        bad = make_gtfs()[:300]
        entry, transport = self.run_feed({refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', bad)]})
        self.assertEqual(entry['source'], 'existing')
        self.assertIn('public-zip', entry['error'])
        self.assertEqual(self.dest.read_bytes(), self.old)
        self.assertFalse((self.out / 'nj-transit-rail.gtfs.zip.prev').exists())
        self.assertEqual(self.leftovers(), [])
        self.assertIsNotNone(entry['service_end'])  # summarised from the kept feed

    def test_api_not_called_while_staged_feed_is_current(self):
        entry, transport = self.run_feed({refresh.PUBLIC_URLS['rail']: [(503, 'text/plain', b'busy')]})
        self.assertEqual((entry['source'], entry['api']), ('existing', 'skipped'))
        self.assertEqual(transport.count(url('rail', 'auth')), 0)
        self.assertEqual(self.dest.read_bytes(), self.old)

    def test_api_last_resort_when_public_fails_and_feed_expiring(self):
        self.expiring()
        short = make_gtfs(stops=6, marker=' api', end=T0.date() + timedelta(days=3))
        entry, _ = self.run_feed({refresh.PUBLIC_URLS['rail']: [(503, 'text/plain', b'busy')], url('rail', 'auth'): [token_ok('t')],
                                  url('rail', 'gtfs'): [(200, 'application/zip', short)]})
        self.assertEqual((entry['source'], entry['api']), ('njt-api', 'ok'))  # 3 days accepted as a stopgap
        self.assertIn('HTTP 503', entry['error'])
        self.assertEqual(self.dest.read_bytes(), short)

    def test_public_works_without_credentials(self):
        new = make_gtfs(stops=6, marker=' public')
        entry, transport = self.run_feed({refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', new)]}, env={})
        self.assertEqual(entry['source'], 'public-zip')
        self.assertEqual(transport.count(url('rail', 'auth')), 0)

    def test_everything_fails_leaves_data_untouched(self):
        self.expiring()
        entry, _ = self.run_feed({
            refresh.PUBLIC_URLS['rail']: [(200, 'text/html', b'<html>maintenance</html>')],
            url('rail', 'auth'): [OSError('network down')],
        })
        self.assertEqual(entry['source'], 'existing')
        self.assertIn('public-zip', entry['error'])
        self.assertIn('njt-api', entry['error'])
        self.assertEqual(self.dest.read_bytes(), self.old)
        self.assertEqual(self.leftovers(), [])

    def test_identical_feed_is_not_replaced(self):
        entry, _ = self.run_feed({refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', self.old)]})
        self.assertEqual(entry['source'], 'public-zip')
        self.assertFalse(entry['changed'])
        self.assertFalse((self.out / 'nj-transit-rail.gtfs.zip.prev').exists())

    def test_dry_run_replaces_nothing(self):
        new = make_gtfs(stops=4, marker=' new')
        entry, _ = self.run_feed({refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', new)]}, dry_run=True)
        self.assertEqual(entry['source'], 'public-zip')
        self.assertEqual(self.dest.read_bytes(), self.old)


class FeedSetTests(Base):
    def setUp(self):
        super().setUp()
        self.out = self.dir / 'otp'
        self.out.mkdir()

    def run_set(self, routes, **kwargs):
        transport = FakeTransport(routes)
        return refresh.refresh_feeds(['rail', 'bus'], self.out, self.client(transport), transport, {}, now=T0, **kwargs), transport

    def test_public_set_is_used_and_api_untouched(self):
        entries, transport = self.run_set({
            refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', make_gtfs(marker=' pub rail'))],
            refresh.PUBLIC_URLS['bus']: [(200, 'application/zip', make_gtfs(marker=' pub bus'))],
        })
        self.assertEqual({f: e['source'] for f, e in entries.items()}, {'rail': 'public-zip', 'bus': 'public-zip'})
        self.assertEqual(transport.count(url('rail', 'auth')) + transport.count(url('bus', 'auth')), 0)
        self.assertIn(b' pub rail', zipfile.ZipFile(self.out / 'nj-transit-rail.gtfs.zip').read('stops.txt'))

    def test_api_only_mode_respects_horizon(self):
        short = make_gtfs(end=T0.date() + timedelta(days=1))
        routes = lambda: {
            url('rail', 'auth'): [token_ok('r')], url('rail', 'gtfs'): [(200, 'application/zip', make_gtfs())],
            url('bus', 'auth'): [token_ok('b')], url('bus', 'gtfs'): [(200, 'application/zip', short)],
        }
        entries, _ = self.run_set(routes(), sources=('njt-api',))
        self.assertEqual({f: e['source'] for f, e in entries.items()}, {'rail': 'existing', 'bus': 'existing'})
        self.assertEqual(entries['bus']['api'], 'rejected')
        entries, _ = self.run_set(routes(), sources=('njt-api',), min_horizon_days=1)
        self.assertEqual({f: e['source'] for f, e in entries.items()}, {'rail': 'njt-api', 'bus': 'njt-api'})

    def test_partial_sets_are_never_mixed(self):
        entries, _ = self.run_set({
            url('rail', 'auth'): [token_ok('r')], url('rail', 'gtfs'): [(200, 'application/zip', make_gtfs())],
            url('bus', 'auth'): [token_ok('b')], url('bus', 'gtfs'): [(500, 'application/json', b'{"errorMessage":"boom"}')],
            refresh.PUBLIC_URLS['rail']: [(404, 'text/html', b'')],
            refresh.PUBLIC_URLS['bus']: [(200, 'application/zip', make_gtfs())],
        })
        self.assertEqual({f: e['source'] for f, e in entries.items()}, {'rail': 'existing', 'bus': 'existing'})
        self.assertEqual(sorted(self.out.iterdir()), [])


class MainAndStatusTests(Base):
    def test_main_writes_status_and_server_summary(self):
        out = self.dir / 'otp'
        out.mkdir()
        (out / 'nj-transit-bus.gtfs.zip').write_bytes(make_gtfs(marker=' old bus'))
        (out / 'graph.obj').write_bytes(b'graph')
        os.utime(out / 'graph.obj', (0, 0))
        transport = FakeTransport({
            url('rail', 'auth'): [token_ok('r')], url('rail', 'gtfs'): [(200, 'application/zip', make_gtfs(stops=7))],
            url('bus', 'auth'): [token_ok('b')], url('bus', 'gtfs'): [INVALID],
            refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', make_gtfs(stops=7))],
            refresh.PUBLIC_URLS['bus']: [(503, 'text/plain', b'busy')],
        })
        status_file = self.dir / 'transit-status.json'
        with mock.patch.object(refresh, 'http_request', transport), \
                mock.patch.object(refresh, 'CACHE_DIR', self.dir / 'cache'), \
                mock.patch.object(refresh, 'TOKEN_FILE', self.token_file), \
                mock.patch.object(refresh, 'load_env', lambda: []), \
                mock.patch.object(refresh, 'utcnow', self.clock), \
                mock.patch.dict(os.environ, ENV):
            code = refresh.main(['--out-dir', str(out), '--status-file', str(status_file)])
        self.assertEqual(code, 1)  # no complete set: both feeds kept
        saved = json.loads(status_file.read_text())
        rail, bus = saved['feeds']['rail'], saved['feeds']['bus']
        self.assertEqual(rail['source'], 'existing')
        self.assertIn('not used because bus', rail['error'])
        self.assertFalse((out / 'nj-transit-rail.gtfs.zip').exists())  # valid API rail alone is not installed
        self.assertEqual(bus['source'], 'existing')
        self.assertIsNone(bus['last_success'])
        self.assertIn('Invalid token', bus['error'])
        self.assertIn('HTTP 503', bus['error'])
        self.assertTrue(bus['service_end'])  # summarised from the kept feed
        self.assertEqual(bus['api'], 'error')
        self.assertTrue(saved['graph']['rebuild_pending'])  # staged bus feed is newer than graph.obj
        self.assertEqual([p.name for p in out.iterdir() if p.name.endswith('.part')], [])
        for secret in ('hunter2-secret', '"r"', '"b"'):
            self.assertNotIn(secret, status_file.read_text())

        summary = status.transit_data_status(status_file, out, now=T0 + timedelta(hours=1))
        self.assertEqual(summary['source'], 'existing')
        self.assertTrue(summary['stale'])
        self.assertTrue(summary['fallback'])
        self.assertTrue(summary['rebuild_pending'])
        self.assertIn('temporarily unavailable', summary['message'])
        self.assertIn('refresh_failed', summary['feeds']['bus']['reasons'])

    def test_main_success_writes_status(self):
        out = self.dir / 'otp'
        out.mkdir()
        transport = FakeTransport({
            refresh.PUBLIC_URLS['rail']: [(200, 'application/zip', make_gtfs(stops=7), {'ETag': '"r1"'})],
            refresh.PUBLIC_URLS['bus']: [(200, 'application/zip', make_gtfs(stops=9), {'ETag': '"b1"'})],
        })
        status_file = self.dir / 'transit-status.json'
        with mock.patch.object(refresh, 'http_request', transport), \
                mock.patch.object(refresh, 'CACHE_DIR', self.dir / 'cache'), \
                mock.patch.object(refresh, 'TOKEN_FILE', self.token_file), \
                mock.patch.object(refresh, 'load_env', lambda: []), \
                mock.patch.object(refresh, 'utcnow', self.clock), \
                mock.patch.dict(os.environ, ENV):
            code = refresh.main(['--out-dir', str(out), '--status-file', str(status_file)])
        self.assertEqual(code, 0)
        self.assertFalse(self.token_file.exists())  # no token spent
        text = status_file.read_text()
        saved = json.loads(text)
        for feed, stops in (('rail', 7), ('bus', 9)):
            entry = saved['feeds'][feed]
            self.assertEqual((entry['source'], entry['stops'], entry['error'], entry['api']), ('public-zip', stops, None, 'skipped'))
            self.assertEqual(entry['last_attempt'], '2026-10-11T12:00:00Z')
            self.assertEqual(entry['last_success'], '2026-10-11T12:00:00Z')
            self.assertTrue(entry['changed'] and entry['service_end'] and entry['sha256'] and entry['size'])
        self.assertTrue(saved['graph']['rebuild_pending'])  # no graph.obj yet
        self.assertNotIn('hunter2-secret', text)
        summary = status.transit_data_status(status_file, out, now=T0 + timedelta(hours=1))
        self.assertEqual((summary['source'], summary['stale'], summary['fallback'], summary['message']), ('public-zip', False, False, None))


class StatusTests(Base):
    def write_status(self, feeds):
        # Replace atomically like the refresh job does, so the reader's cache sees a new file.
        path = self.dir / 'transit-status.json'
        part = self.dir / 'transit-status.json.part'
        part.write_text(json.dumps({'feeds': feeds}))
        os.replace(part, path)
        return path

    def entry(self, source='njt-api', age=timedelta(hours=1), end_days=60, failed=False):
        success = api.iso(T0 - age)
        return {'source': source, 'last_attempt': api.iso(T0) if failed else success, 'last_success': success,
                'service_end': (T0.date() + timedelta(days=end_days)).isoformat()}

    def summary(self, feeds):
        return status.transit_data_status(self.write_status(feeds), self.dir, now=T0)

    def test_fresh_api_data_is_not_stale(self):
        result = self.summary({'rail': self.entry(), 'bus': self.entry()})
        self.assertEqual((result['source'], result['stale'], result['fallback'], result['message']), ('njt-api', False, False, None))
        self.assertEqual(result['updated_at'], '2026-10-11T11:00:00Z')

    def test_old_success_is_stale(self):
        result = self.summary({'rail': self.entry(age=timedelta(hours=49)), 'bus': self.entry()})
        self.assertTrue(result['stale'])
        self.assertEqual(result['updated_at'], '2026-10-09T11:00:00Z')
        self.assertIn('last updated Oct 9, 2026', result['message'])

    def test_service_end_near_or_passed_is_stale(self):
        self.assertTrue(self.summary({'rail': self.entry(end_days=1)})['stale'])
        result = self.summary({'rail': self.entry(end_days=-2)})
        self.assertTrue(result['stale'])
        self.assertIn('ended', result['message'])

    def test_public_zip_after_api_error_is_fallback_not_stale(self):
        result = self.summary({'rail': {**self.entry(source='public-zip'), 'api': 'error'}, 'bus': {**self.entry(source='public-zip'), 'api': 'error'}})
        self.assertEqual((result['source'], result['stale'], result['fallback']), ('public-zip', False, True))
        self.assertIn("public download", result['message'])

    def test_public_zip_by_policy_is_not_fallback(self):
        for api_state in ('rejected', 'not-configured', 'skipped'):
            with self.subTest(api_state=api_state):
                result = self.summary({'rail': {**self.entry(source='public-zip'), 'api': api_state}})
                self.assertEqual((result['source'], result['stale'], result['fallback'], result['message']), ('public-zip', False, False, None))

    def test_no_status_and_no_feeds(self):
        result = status.transit_data_status(self.dir / 'missing.json', self.dir, now=T0)
        self.assertEqual((result['source'], result['stale'], result['message']), (None, False, None))

    def test_no_status_uses_feed_mtime_as_manual(self):
        feed = self.dir / 'nj-transit-rail.gtfs.zip'
        feed.write_bytes(b'x')
        old = (T0 - timedelta(days=5)).timestamp()
        os.utime(feed, (old, old))
        result = status.transit_data_status(self.dir / 'missing.json', self.dir, now=T0)
        self.assertEqual(result['source'], 'manual')
        self.assertTrue(result['stale'])
        self.assertFalse(result['fallback'])

    def test_corrupt_status_file_does_not_raise(self):
        path = self.dir / 'transit-status.json'
        path.write_text('{not json')
        result = status.transit_data_status(path, self.dir, now=T0)
        self.assertIn('stale', result)


if __name__ == '__main__':
    unittest.main()
