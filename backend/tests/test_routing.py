"""Tests for backend/routing.py: OTP parsing, polyline, route cache, fetch_opentripplanner_routes.

No OTP, network or Gemini: routing.urlopen / routing._otp_query are mocked. The OTP
fixtures in fixtures/ are raw GraphQL responses captured from the local OTP
(Hoboken origin 40.744,-74.0324) together with the variables routing.py sent.

Run: python3 -m unittest discover -s backend/tests
"""
import copy
import http.client
import io
import json
import sys
import threading
import time
import types
import unittest
from pathlib import Path
from unittest import mock
from urllib.error import URLError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import routing  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / 'fixtures'
OTP_URL = 'http://otp.test/otp/gtfs/v1'
ORIGIN = {'latitude': 40.744, 'longitude': -74.0324}
ORIGIN_TEXT = '40.744,-74.0324'
ALL_TYPES = ['bus', 'subway', 'commuter', 'ferry']


def load_fixture(name):
    return json.loads((FIXTURES / f'{name}.json').read_text())


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


class FakeOTP:
    """Replays OTP responses in order and records the GraphQL variables of each request."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append(json.loads(request.data))
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return FakeResponse(json.dumps(response).encode())


def run_fixture(fixture, allowed_modes=None, transit_fare=None, responses=None):
    """Run routing._otp_query against a fixture; returns (result, fake)."""
    if allowed_modes is None:
        allowed_modes = routing._otp_transit_modes(fixture['transit_types'])
    fake = FakeOTP(*(responses if responses is not None else [call['response'] for call in fixture['calls']]))
    with mock.patch.object(routing, 'urlopen', fake):
        result = routing._otp_query(OTP_URL, dict(ORIGIN), fixture['store'], allowed_modes, transit_fare, fixture['leave_at'])
    return result, fake


def transit_bus_leg(fixture):
    """The vehicle leg of the winning (first) transit edge in the scheduled bus fixture."""
    return fixture['calls'][0]['response']['data']['transit']['edges'][0]['node']['legs'][1]


def usd_fare(use_id, amount):
    return {'id': use_id, 'product': {'id': 'p-' + use_id, 'name': 'Regular', 'price': {'amount': amount, 'currency': {'code': 'USD', 'digits': 2}}}}


class OtpQueryParsingTests(unittest.TestCase):
    """_otp_query against captured OTP responses."""

    def setUp(self):
        self.bus = load_fixture('otp_hoboken_to_sip_scheduled_bus')
        self.no_transit = load_fixture('otp_hoboken_to_sip_leave_now_no_transit')
        self.walk_better = load_fixture('otp_hoboken_to_clinton_walking_better')

    def test_request_payload_matches_captured_variables(self):
        # The fixtures were captured with exactly these variables; a payload change must be deliberate.
        for fixture in (self.bus, self.no_transit, self.walk_better):
            _, fake = run_fixture(fixture)
            self.assertEqual([request['variables'] for request in fake.requests], [call['variables'] for call in fixture['calls']])
            for request in fake.requests:
                self.assertEqual(request['query'], routing._OTP_QUERY)

    def test_scheduled_payload_shape(self):
        _, fake = run_fixture(self.bus)
        variables = fake.requests[0]['variables']
        self.assertEqual(variables['dateTime'], {'earliestDeparture': '2026-10-12T17:00:00Z'})
        self.assertEqual(variables['origin'], {'label': 'Starting location', 'location': {'coordinate': ORIGIN}})
        self.assertEqual(variables['destination']['location']['coordinate'], {'latitude': 40.7311906, 'longitude': -74.0663821})
        self.assertEqual(variables['transitModes']['transit']['transit'], [{'mode': m} for m in ('BUS', 'SUBWAY', 'TRAM', 'RAIL', 'FERRY')])
        self.assertIsNone(variables['transitPreferences'])
        self.assertEqual(variables['walkModes'], {'direct': ['WALK'], 'directOnly': True})
        self.assertEqual(variables['driveModes'], {'direct': ['CAR'], 'directOnly': True})
        self.assertEqual(variables['bikeModes'], {'direct': ['BICYCLE'], 'directOnly': True})

    def test_leave_now_has_null_datetime_and_empty_types_still_query_all_modes(self):
        _, fake = run_fixture(self.no_transit, allowed_modes=[])
        variables = fake.requests[0]['variables']
        self.assertIsNone(variables['dateTime'])
        # OTP rejects an empty transit mode list, so all modes are sent and filtered afterwards.
        self.assertEqual(variables['transitModes']['transit']['transit'], [{'mode': m} for m in ('BUS', 'SUBWAY', 'TRAM', 'RAIL', 'FERRY')])

    def test_scheduled_bus_transit_route(self):
        result, _ = run_fixture(self.bus)
        transit = result['methods']['transit']
        # Winner is the earliest arrival (route 87): board 13:20:41 after a 733 s walk, arrive 13:50:13, searched at 13:00.
        self.assertTrue(transit['available'])
        self.assertEqual(transit['duration_minutes'], 42)
        self.assertEqual(transit['depart_in_minutes'], 8)
        self.assertEqual(transit['arrival_in_minutes'], 50)
        self.assertEqual(transit['walking_minutes'], 17)  # walkTime 994 s
        self.assertAlmostEqual(transit['walking_miles'], 1248.64 / 1609.344, places=6)
        self.assertEqual(transit['transit_types'], ['bus'])
        self.assertIs(transit['walk_is_faster'], False)
        # Route 87 has no feed fare and no local estimate: unknown, with no cost type.
        self.assertIsNone(transit['travel_cost'])
        self.assertNotIn('travel_cost_type', transit)
        self.assertEqual(transit['steps'], [
            {'title': 'Walk from Starting location', 'detail': 'To OBSERVER HWY AT WILLOW AVE via sidewalk'},
            {'title': 'Ride 87', 'detail': 'OBSERVER HWY AT WILLOW AVE to BERGEN AVE AT ACADEMY ST'},
            {'title': 'Walk from BERGEN AVE AT ACADEMY ST', 'detail': 'To CVS Pharmacy via Academy Street'},
        ])

    def test_street_modes(self):
        result, _ = run_fixture(self.bus)
        walk, drive, bike = (result['methods'][mode] for mode in ('walk', 'drive', 'bike'))
        self.assertEqual((walk['duration_minutes'], walk['depart_in_minutes'], walk['walking_minutes']), (57, 0, 57))
        self.assertAlmostEqual(walk['walking_miles'], 4268.02 / 1609.344, places=6)
        self.assertEqual(walk['travel_cost'], 0)
        self.assertEqual(walk['steps'], [{'title': 'Walk from Starting location', 'detail': 'To CVS Pharmacy via sidewalk'}])
        self.assertEqual((drive['duration_minutes'], drive['walking_minutes'], drive['walking_miles']), (10, 0, 0))
        self.assertEqual(drive['travel_cost'], 1.4)  # pharmacy['driveCost']
        self.assertEqual(drive['steps'], [{'title': 'Drive from Starting location', 'detail': 'To CVS Pharmacy via 6th Street'}])
        self.assertEqual((bike['duration_minutes'], bike['travel_cost']), (24, 0))
        self.assertEqual(bike['steps'][0]['title'], 'Cycle from Starting location')
        for route in (walk, drive, bike):
            self.assertTrue(route['available'])
            self.assertNotIn('transit_types', route)
            self.assertNotIn('arrival_in_minutes', route)
            self.assertNotIn('travel_cost_type', route)
        # distance_miles is the shortest leg-distance sum across routed modes (the walk here).
        self.assertAlmostEqual(result['distance_miles'], 4268.02 / 1609.344, places=6)

    def test_geometry_is_one_encoded_linestring(self):
        result, _ = run_fixture(self.bus)
        edge = self.bus['calls'][0]['response']['data']['transit']['edges'][0]['node']
        expected = []
        for leg in edge['legs']:
            for point in routing._decode_polyline(leg['legGeometry']['points']):
                if not expected or point != expected[-1]:
                    expected.append(point)
        geometry = result['methods']['transit']['geometry']
        self.assertEqual(set(geometry), {'type', 'polyline'})
        self.assertEqual(geometry['type'], 'LineString')
        self.assertEqual(routing._decode_polyline(geometry['polyline']), expected)
        for mode in routing.MODES:
            points = routing._decode_polyline(result['methods'][mode]['geometry']['polyline'])
            self.assertGreaterEqual(len(points), 2)
            # [longitude, latitude] order, starting at the origin and ending at the store.
            self.assertAlmostEqual(points[0][0], ORIGIN['longitude'], delta=0.003)
            self.assertAlmostEqual(points[0][1], ORIGIN['latitude'], delta=0.003)
            self.assertAlmostEqual(points[-1][0], -74.0663821, delta=0.003)
            self.assertAlmostEqual(points[-1][1], 40.7311906, delta=0.003)

    def test_leave_now_without_transit_service(self):
        result, _ = run_fixture(self.no_transit)
        self.assertEqual(result['methods']['transit'], {'available': False, 'unavailable_reason': 'no_transit_route'})
        for mode in ('walk', 'drive', 'bike'):
            self.assertTrue(result['methods'][mode]['available'])
        self.assertEqual(result['methods']['walk']['duration_minutes'], 57)

    def test_walking_better_without_alternative(self):
        result, fake = run_fixture(self.walk_better)
        self.assertEqual(len(fake.requests), 2)
        self.assertIsNone(fake.requests[0]['variables']['transitPreferences'])
        self.assertEqual(fake.requests[1]['variables']['transitPreferences'], {'street': {'walk': {'reluctance': 20.0}}})
        self.assertEqual(result['methods']['transit'], {'available': False, 'unavailable_reason': 'walking_faster_no_alternative'})
        self.assertEqual(result['methods']['walk']['duration_minutes'], 6)

    def test_walking_better_with_transit_alternative(self):
        first = self.walk_better['calls'][0]['response']
        alternative = copy.deepcopy(first)
        alternative['data']['transit'] = self.bus['calls'][0]['response']['data']['transit']
        result, fake = run_fixture(self.walk_better, responses=[first, alternative])
        transit = result['methods']['transit']
        self.assertTrue(transit['available'])
        self.assertIs(transit['walk_is_faster'], True)
        self.assertEqual(transit['transit_types'], ['bus'])

    def test_walking_better_alternative_failure_keeps_explanation(self):
        first = self.walk_better['calls'][0]['response']
        result, _ = run_fixture(self.walk_better, responses=[first, URLError('down')])
        self.assertEqual(result['methods']['transit']['unavailable_reason'], 'walking_faster_no_alternative')

    def test_disallowed_transit_types_are_filtered(self):
        for allowed in ([], ['FERRY'], ['RAIL']):
            result, _ = run_fixture(self.bus, allowed_modes=allowed)
            self.assertEqual(result['methods']['transit'], {'available': False, 'unavailable_reason': 'no_transit_route'}, allowed)
            self.assertTrue(result['methods']['walk']['available'])

    def test_fare_from_feed(self):
        bus = copy.deepcopy(self.bus)
        transit_bus_leg(bus)['fareProducts'] = [usd_fare('use-1', 1.6)]
        result, _ = run_fixture(bus)
        self.assertEqual(result['methods']['transit']['travel_cost'], 1.6)
        self.assertEqual(result['methods']['transit']['travel_cost_type'], 'otp')

    def test_configured_fare_overrides_feed(self):
        bus = copy.deepcopy(self.bus)
        transit_bus_leg(bus)['fareProducts'] = [usd_fare('use-1', 1.6)]
        result, _ = run_fixture(bus, transit_fare=2.5)
        self.assertEqual(result['methods']['transit']['travel_cost'], 2.5)
        self.assertEqual(result['methods']['transit']['travel_cost_type'], 'configured')
        # The configured fare applies only to transit.
        self.assertEqual(result['methods']['walk']['travel_cost'], 0)

    def test_ambiguous_feed_fare_falls_back_to_estimate(self):
        bus = copy.deepcopy(self.bus)
        leg = transit_bus_leg(bus)
        leg['fareProducts'] = [usd_fare('a', 1.6), usd_fare('b', 2.0)]
        leg['route']['shortName'] = '126'
        result, _ = run_fixture(bus)
        self.assertEqual(result['methods']['transit']['travel_cost'], 3.0)
        self.assertEqual(result['methods']['transit']['travel_cost_type'], 'estimated_max')


class FareHelperTests(unittest.TestCase):
    def test_itinerary_fare(self):
        walk = {'transitLeg': False}
        self.assertIsNone(routing._otp_itinerary_fare([walk]))
        self.assertEqual(routing._otp_itinerary_fare([walk, {'transitLeg': True, 'fareProducts': [usd_fare('a', 1.6)]}]), 1.6)
        # One ticket use spanning two legs counts once; distinct uses add up.
        self.assertEqual(routing._otp_itinerary_fare([{'transitLeg': True, 'fareProducts': [usd_fare('a', 1.6)]}, {'transitLeg': True, 'fareProducts': [usd_fare('a', 1.6)]}]), 1.6)
        self.assertEqual(routing._otp_itinerary_fare([{'transitLeg': True, 'fareProducts': [usd_fare('a', 1.6)]}, {'transitLeg': True, 'fareProducts': [usd_fare('b', 2.25)]}]), 3.85)
        for bad in ([], None, [usd_fare('a', 1), usd_fare('b', 2)], [usd_fare('a', -1)], [usd_fare('a', True)], [usd_fare('a', float('nan'))],
                    [{'id': 'a', 'product': {'price': {'amount': 2, 'currency': {'code': 'EUR'}}}}], [{'product': usd_fare('x', 2)['product']}]):
            self.assertIsNone(routing._otp_itinerary_fare([{'transitLeg': True, 'fareProducts': bad}]), bad)
        # Same use id with conflicting prices is ambiguous.
        self.assertIsNone(routing._otp_itinerary_fare([{'transitLeg': True, 'fareProducts': [usd_fare('a', 1.6)]}, {'transitLeg': True, 'fareProducts': [usd_fare('a', 2.0)]}]))

    def test_njt_estimated_max_fare(self):
        def bus(short, stops=('A', 'B')):
            return {'transitLeg': True, 'mode': 'BUS', 'route': {'shortName': short, 'mode': 'BUS'}, 'from': {'name': stops[0]}, 'to': {'name': stops[1]}}
        hblr = {'transitLeg': True, 'route': {'longName': 'Hudson-Bergen Light Rail', 'mode': 'TRAM'}}
        self.assertIsNone(routing._njt_estimated_max_fare([{'transitLeg': False}]))
        self.assertEqual(routing._njt_estimated_max_fare([bus('22')]), 3.0)
        self.assertEqual(routing._njt_estimated_max_fare([bus('89'), bus('126')]), 6.0)
        self.assertEqual(routing._njt_estimated_max_fare([hblr]), 2.65)
        self.assertEqual(routing._njt_estimated_max_fare([bus('22'), hblr]), 5.65)
        self.assertIsNone(routing._njt_estimated_max_fare([bus('87')]))
        self.assertIsNone(routing._njt_estimated_max_fare([bus('126', ('Hoboken Terminal', 'Port Authority Bus Terminal'))]))
        self.assertIsNone(routing._njt_estimated_max_fare([{'transitLeg': True, 'route': {'mode': 'RAIL'}}]))
        self.assertIsNone(routing._njt_estimated_max_fare([{'transitLeg': True, 'route': {'mode': 'FERRY'}}]))

    def test_transit_type_mapping(self):
        self.assertEqual(routing._otp_transit_modes(ALL_TYPES), ['BUS', 'SUBWAY', 'TRAM', 'RAIL', 'FERRY'])
        self.assertEqual(routing._otp_transit_modes(['subway', 'bus', 'bus', 'nope']), ['SUBWAY', 'TRAM', 'BUS'])
        self.assertEqual(routing._otp_transit_modes(None), [])


class PolylineTests(unittest.TestCase):
    def test_known_google_example(self):
        self.assertEqual(routing._decode_polyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]])
        self.assertEqual(routing._encode_polyline([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]), '_p~iF~ps|U_ulLnnqC_mqNvxq`@')

    def test_round_trip_is_lossless(self):
        import random
        rng = random.Random(26)
        for _ in range(50):
            points = [[round(rng.uniform(-180, 180), 5), round(rng.uniform(-90, 90), 5)] for _ in range(rng.randint(2, 40))]
            self.assertEqual(routing._decode_polyline(routing._encode_polyline(points)), points)
        local = [[-74.0324, 40.744], [-74.0324, 40.744], [-74.03241, 40.74401], [-74.0, 40.0], [0.0, 0.0], [0.00001, -0.00001]]
        self.assertEqual(routing._decode_polyline(routing._encode_polyline(local)), local)

    def test_otp_fixture_polylines_round_trip(self):
        fixture = load_fixture('otp_hoboken_to_sip_scheduled_bus')
        data = fixture['calls'][0]['response']['data']
        encoded = [leg['legGeometry']['points'] for alias in ('walk', 'transit', 'drive', 'bike') for edge in data[alias]['edges'] for leg in edge['node']['legs']]
        self.assertTrue(encoded)
        for value in encoded:
            points = routing._decode_polyline(value)
            self.assertGreaterEqual(len(points), 2)
            self.assertEqual(routing._encode_polyline(points), value)

    def test_decode_rejects_bad_input(self):
        self.assertEqual(routing._decode_polyline(None), [])
        self.assertEqual(routing._decode_polyline(''), [])
        self.assertEqual(routing._decode_polyline('_p~iF~ps|U'), [])  # a single point is not a line
        self.assertEqual(routing._decode_polyline('_p~iF~ps|U_ulL'), [])  # truncated
        self.assertEqual(routing._encode_polyline([]), '')


class FakeClock:
    """Stands in for the `time` module inside routing (monotonic and wall clocks)."""

    def __init__(self, monotonic=1000.0, wall=1_800_000_000.0):
        self.mono = monotonic
        self.wall = wall

    def monotonic(self):
        return self.mono

    def time(self):
        return self.wall

    def advance(self, seconds):
        self.mono += seconds
        self.wall += seconds


def transit_route(depart=8, arrival=50, available=True):
    route = {'distance_miles': 2.0, 'methods': {mode: {'available': True, 'duration_minutes': 10, 'depart_in_minutes': 0, 'travel_cost': 0, 'steps': []} for mode in routing.MODES}}
    route['methods']['transit'] = ({'available': True, 'duration_minutes': arrival - depart, 'depart_in_minutes': depart, 'arrival_in_minutes': arrival,
                                    'travel_cost': 2.65, 'steps': [], 'transit_types': ['bus']} if available else {'available': False, 'unavailable_reason': 'no_transit_route'})
    return route


class CacheTests(unittest.TestCase):
    def setUp(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)
        self.clock = FakeClock()
        patcher = mock.patch.object(routing, 'time', self.clock)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_get_marks_cached_and_ttl_expires(self):
        routing._cache_put('k', {'partial': False, 'x': 1}, ttl=10)
        self.assertEqual(routing._cache_get('k'), {'partial': False, 'x': 1, 'cached': True})
        self.clock.advance(9.9)
        self.assertIsNotNone(routing._cache_get('k'))
        self.clock.advance(0.1)  # expires <= now
        self.assertIsNone(routing._cache_get('k'))
        self.assertNotIn('k', routing._CACHE)

    def test_default_ttls(self):
        routing._cache_put('full', {'partial': False})
        routing._cache_put('partial', {'partial': True})
        self.assertEqual(routing._CACHE['full'][0], self.clock.mono + routing._CACHE_TTL_SECONDS)
        self.assertEqual(routing._CACHE['partial'][0], self.clock.mono + routing._CACHE_PARTIAL_TTL_SECONDS)
        self.clock.advance(routing._CACHE_PARTIAL_TTL_SECONDS)
        self.assertIsNone(routing._cache_get('partial'))
        self.assertIsNotNone(routing._cache_get('full'))

    def test_lru_eviction(self):
        with mock.patch.object(routing, '_CACHE_MAX_ENTRIES', 3):
            for key in ('a', 'b', 'c'):
                routing._cache_put(key, {'partial': False, 'key': key})
            self.assertIsNotNone(routing._cache_get('a'))  # refreshes a
            routing._cache_put('d', {'partial': False, 'key': 'd'})
            self.assertEqual(list(routing._CACHE), ['c', 'a', 'd'])
            routing._cache_put('c', {'partial': False, 'key': 'c2'})  # re-put moves to the end
            routing._cache_put('e', {'partial': False, 'key': 'e'})
            self.assertEqual(list(routing._CACHE), ['d', 'c', 'e'])
            self.assertEqual(routing._cache_get('c')['key'], 'c2')

    def test_lru_eviction_at_entry_cap(self):
        # The entry cap is now a backstop (20,000) behind the byte budget; filling it
        # for real is slow, so use the old 384 cap. The default is checked separately.
        self.assertEqual(routing._CACHE_MAX_ENTRIES, 20_000)
        with mock.patch.object(routing, '_CACHE_MAX_ENTRIES', 384):
            for index in range(384 + 5):
                routing._cache_put(f'k{index}', {'partial': False})
            self.assertEqual(len(routing._CACHE), 384)
        self.assertNotIn('k4', routing._CACHE)
        self.assertIn('k5', routing._CACHE)

    def put_route(self, route, ttl=600):
        routing._cache_put('r', {'route': route, 'computed_at': self.clock.time()}, ttl=ttl)

    def test_leave_now_transit_is_retimed(self):
        self.put_route(transit_route(depart=8, arrival=50))
        self.clock.advance(180)
        transit = routing._otp_cache_get('r', leave_now=True)['methods']['transit']
        self.assertEqual((transit['depart_in_minutes'], transit['arrival_in_minutes']), (5, 47))
        self.assertEqual(transit['duration_minutes'], 42)  # unchanged
        self.clock.advance(90)  # 4.5 minutes in: round(3.5) / round(45.5) use banker's rounding
        transit = routing._otp_cache_get('r', leave_now=True)['methods']['transit']
        self.assertEqual((transit['depart_in_minutes'], transit['arrival_in_minutes']), (round(8 - 4.5), round(50 - 4.5)))
        # The stored entry itself is never modified.
        self.assertEqual(routing._CACHE['r'][1]['route']['methods']['transit']['depart_in_minutes'], 8)

    def test_leave_now_drops_entry_after_departure_plus_grace(self):
        self.put_route(transit_route(depart=8, arrival=50))
        self.clock.advance(8 * 60 + routing._OTP_DEPARTURE_GRACE_SECONDS)
        transit = routing._otp_cache_get('r', leave_now=True)['methods']['transit']
        self.assertEqual(transit['depart_in_minutes'], 0)
        self.assertEqual(transit['arrival_in_minutes'], 41)
        self.clock.advance(0.5)
        self.assertIsNone(routing._otp_cache_get('r', leave_now=True))
        self.assertNotIn('r', routing._CACHE)

    def test_leave_now_depart_zero_lives_only_for_the_grace(self):
        self.put_route(transit_route(depart=0, arrival=20))
        self.clock.advance(routing._OTP_DEPARTURE_GRACE_SECONDS + 1)
        self.assertIsNone(routing._otp_cache_get('r', leave_now=True))

    def test_scheduled_entries_are_not_retimed(self):
        route = transit_route(depart=8, arrival=50)
        self.put_route(route, ttl=routing._OTP_SCHEDULED_TTL_SECONDS)
        self.clock.advance(20 * 60)
        self.assertEqual(routing._otp_cache_get('r', leave_now=False), route)
        self.clock.advance(routing._OTP_SCHEDULED_TTL_SECONDS - 20 * 60)
        self.assertIsNone(routing._otp_cache_get('r', leave_now=False))

    def test_unavailable_transit_is_not_retimed_or_dropped(self):
        route = transit_route(available=False)
        self.put_route(route)
        self.clock.advance(500)
        self.assertEqual(routing._otp_cache_get('r', leave_now=True), route)


def store(index, **extra):
    return {'id': f's{index}', 'name': f'Store {index}', 'address': f'{index} Main St', 'latitude': 40.74 + index / 1000, 'longitude': -74.03, **extra}


class FetchOpenTripPlannerTests(unittest.TestCase):
    def setUp(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)
        # A fresh semaphore per test so a leaked slot can't affect other tests.
        self.slots = threading.BoundedSemaphore(routing._OTP_MAX_CONCURRENT)
        for name, value in (('_OTP_SLOTS', self.slots), ('_OTP_SEARCH_BUDGET_SECONDS', 0.3)):
            patcher = mock.patch.object(routing, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.release = threading.Event()
        self.addCleanup(self.release.set)
        self.calls = []

    def fake_query(self, failing=(), hanging=()):
        def query(service_url, coordinates, pharmacy, allowed_modes, transit_fare, leave_at):
            self.calls.append((service_url, coordinates, pharmacy['id'], allowed_modes, transit_fare, leave_at))
            if pharmacy['id'] in hanging:
                self.release.wait(5)
                raise TimeoutError('timed out')
            if pharmacy['id'] in failing:
                raise failing[pharmacy['id']] if isinstance(failing, dict) else URLError('refused')
            route = transit_route()
            route['distance_miles'] = float(pharmacy['id'][1:])
            return route
        return query

    def fetch(self, pharmacies, query, **kwargs):
        with mock.patch.object(routing, '_otp_query', query):
            return routing.fetch_opentripplanner_routes(OTP_URL, ORIGIN_TEXT, pharmacies, **kwargs)

    def assert_all_slots_free(self):
        acquired = 0
        try:
            for _ in range(routing._OTP_MAX_CONCURRENT):
                self.assertTrue(self.slots.acquire(timeout=5), 'an OTP slot was never released')
                acquired += 1
            self.assertFalse(self.slots.acquire(blocking=False))
        finally:
            for _ in range(acquired):
                self.slots.release()

    def test_all_stores_ok_then_cached(self):
        stores = [store(1), store(2), store(3), store(4)]
        result = self.fetch(stores, self.fake_query(), transit_types=['subway', 'bus'])
        self.assertEqual(list(result['routes']), ['s1', 's2', 's3', 's4'])
        self.assertEqual(result['routes']['s3']['distance_miles'], 3.0)
        self.assertEqual((result['cached'], result['provider'], result['unrouted'], result['partial']), (False, 'otp', 0, False))
        self.assertEqual(len(self.calls), 4)
        url, coordinates, _, allowed, fare, leave_at = self.calls[0]
        self.assertEqual((url, coordinates, allowed, fare, leave_at), (OTP_URL, ORIGIN, ['SUBWAY', 'TRAM', 'BUS'], None, None))
        self.assertEqual(len(routing._CACHE), 4)
        # The same search again (transit type order ignored) is served from cache.
        again = self.fetch(stores, self.fake_query(), transit_types=['bus', 'subway'])
        self.assertEqual(len(self.calls), 4)
        self.assertTrue(again['cached'])
        self.assertEqual(again['routes']['s3']['distance_miles'], 3.0)
        # A different transit setting is a different key.
        self.fetch(stores[:1], self.fake_query(), transit_types=[])
        self.assertEqual(len(self.calls), 5)
        self.assert_all_slots_free()

    def test_partial_flag_reflects_unavailable_modes(self):
        def query(*args):
            return transit_route(available=False)
        result = self.fetch([store(1)], query)
        self.assertTrue(result['partial'])
        self.assertEqual(result['unrouted'], 0)

    def test_some_stores_fail_or_time_out(self):
        stores = [store(1), store(2), store(3), store(4)]
        started = time.monotonic()
        result = self.fetch(stores, self.fake_query(failing={'s2': URLError('refused')}, hanging={'s3'}))
        self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(list(result['routes']), ['s1', 's2', 's3', 's4'])
        self.assertEqual(result['unrouted'], 2)
        self.assertTrue(result['partial'])
        for store_id in ('s2', 's3'):
            self.assertEqual(result['routes'][store_id], routing.unrouted_route())
            for method in result['routes'][store_id]['methods'].values():
                self.assertEqual(method['unavailable_reason'], 'route_timeout')
                self.assertFalse(method['available'])
        self.assertTrue(result['routes']['s1']['methods']['transit']['available'])
        # Failed stores are not cached; the next search retries only them.
        self.assertEqual(len(routing._CACHE), 2)
        self.release.set()
        self.assert_all_slots_free()
        self.calls.clear()
        retry = self.fetch(stores, self.fake_query())
        self.assertEqual(sorted(call[2] for call in self.calls), ['s2', 's3'])
        self.assertEqual(retry['unrouted'], 0)
        self.assertFalse(retry['cached'])

    def test_every_listed_error_type_marks_store_unrouted(self):
        for error in (URLError('x'), TimeoutError(), OSError(), ValueError(), KeyError('k'), TypeError()):
            routing._CACHE.clear()
            result = self.fetch([store(1), store(2)], self.fake_query(failing={'s1': error}))
            self.assertEqual(result['unrouted'], 1, error)
            self.assertTrue(result['routes']['s1']['unrouted'])

    def test_http_incomplete_read_marks_store_unrouted(self):
        # Regression: a truncated OTP body (http.client.IncompleteRead) used to escape
        # fetch_opentripplanner_routes and fail the whole search with a 500.
        result = self.fetch([store(1), store(2)], self.fake_query(failing={'s1': http.client.IncompleteRead(b'')}))
        self.assertEqual(result['unrouted'], 1)

    def test_all_stores_fail_raises_routing_unavailable(self):
        stores = [store(1), store(2)]
        with self.assertRaises(routing.RoutingUnavailable) as caught:
            self.fetch(stores, self.fake_query(failing={'s1': URLError('x'), 's2': ValueError('bad')}))
        self.assertIsInstance(caught.exception, routing.RoutingError)
        self.assertEqual(routing._CACHE, {})
        self.assert_all_slots_free()

    def test_all_stores_time_out_raises_routing_unavailable(self):
        with self.assertRaises(routing.RoutingUnavailable):
            self.fetch([store(1), store(2)], self.fake_query(hanging={'s1', 's2'}))
        self.release.set()
        self.assert_all_slots_free()

    def test_cached_stores_prevent_unavailable_when_the_rest_fail(self):
        self.fetch([store(1)], self.fake_query())
        result = self.fetch([store(1), store(2)], self.fake_query(failing={'s2': URLError('x')}))
        self.assertEqual(result['unrouted'], 1)
        self.assertFalse(result['routes']['s1'].get('unrouted', False))

    def test_bad_origin_is_routing_error_not_unavailable(self):
        for origin in ('Hoboken, NJ', '', None, '91,0', '40.7,-181', 'nan,nan', '40.7;-74.0'):
            with self.assertRaises(routing.RoutingError) as caught:
                with mock.patch.object(routing, '_otp_query', self.fake_query()):
                    routing.fetch_opentripplanner_routes(OTP_URL, origin, [store(1)])
            self.assertNotIsInstance(caught.exception, routing.RoutingUnavailable, origin)
        self.assertEqual(self.calls, [])

    def test_origin_whitespace_accepted(self):
        self.assertEqual(routing._coordinate_origin('  40.744 , -74.0324 '), ORIGIN)

    def test_slots_bound_concurrency_and_are_released_after_failures(self):
        active = []
        peak = []
        lock = threading.Lock()
        def query(service_url, coordinates, pharmacy, *rest):
            with lock:
                active.append(pharmacy['id'])
                peak.append(len(active))
            try:
                if pharmacy['id'] in ('s1', 's3', 's5'):
                    raise OSError('reset')
                return transit_route()
            finally:
                with lock:
                    active.remove(pharmacy['id'])
        with mock.patch.object(routing, '_OTP_SEARCH_BUDGET_SECONDS', 5):
            result = self.fetch([store(i) for i in range(1, 9)], query)
        self.assertEqual(result['unrouted'], 3)
        self.assertLessEqual(max(peak), routing._OTP_MAX_CONCURRENT)
        self.assert_all_slots_free()

    def test_slot_wait_respects_budget(self):
        # Every slot is taken elsewhere: the search gives up within its budget.
        for _ in range(routing._OTP_MAX_CONCURRENT):
            self.slots.acquire()
        try:
            started = time.monotonic()
            with self.assertRaises(routing.RoutingUnavailable):
                self.fetch([store(1)], self.fake_query())
            self.assertLess(time.monotonic() - started, 2)
            self.assertEqual(self.calls, [])
        finally:
            for _ in range(routing._OTP_MAX_CONCURRENT):
                self.slots.release()

    def test_ttl_by_search_kind(self):
        recorded = []
        real_put = routing._cache_put
        def spy(key, value, ttl=None):
            recorded.append(ttl)
            return real_put(key, value, ttl)
        with mock.patch.object(routing, '_cache_put', spy):
            self.fetch([store(1)], self.fake_query(), transit_types=[])
            self.fetch([store(1)], self.fake_query(), transit_types=['bus'])
            self.fetch([store(1)], self.fake_query(), transit_types=['bus'], leave_at='2030-01-01T12:00:00Z')
        self.assertEqual(recorded, [routing._OTP_STREET_TTL_SECONDS, routing._OTP_TRANSIT_TTL_SECONDS, routing._OTP_SCHEDULED_TTL_SECONDS])

    def test_leave_now_cache_hit_is_retimed_through_fetch(self):
        clock = FakeClock(monotonic=time.monotonic(), wall=time.time())
        with mock.patch.object(routing, 'time', clock):
            self.fetch([store(1)], self.fake_query(), transit_types=['bus'])
            clock.advance(120)
            hit = self.fetch([store(1)], self.fake_query(), transit_types=['bus'])
            self.assertTrue(hit['cached'])
            self.assertEqual(hit['routes']['s1']['methods']['transit']['depart_in_minutes'], 6)
            clock.advance(9 * 60)  # past departure + grace: re-routed
            miss = self.fetch([store(1)], self.fake_query(), transit_types=['bus'])
            self.assertFalse(miss['cached'])
            self.assertEqual(miss['routes']['s1']['methods']['transit']['depart_in_minutes'], 8)
        self.assertEqual(len(self.calls), 2)

    def test_end_to_end_with_fixture_through_urlopen(self):
        fixture = load_fixture('otp_hoboken_to_sip_scheduled_bus')
        fake = FakeOTP(fixture['calls'][0]['response'])
        with mock.patch.object(routing, 'urlopen', fake):
            result = routing.fetch_opentripplanner_routes(OTP_URL, ORIGIN_TEXT, [fixture['store']], ALL_TYPES, None, fixture['leave_at'])
        self.assertEqual(fake.requests[0]['variables'], fixture['calls'][0]['variables'])
        transit = result['routes']['cvs-104-sip']['methods']['transit']
        self.assertEqual((transit['depart_in_minutes'], transit['arrival_in_minutes']), (8, 50))
        self.assertEqual(result['unrouted'], 0)

    def test_graphql_errors_count_as_store_failure(self):
        fake = FakeOTP({'errors': [{'message': 'boom'}]}, {'data': None})
        with mock.patch.object(routing, 'urlopen', fake), mock.patch.object(routing, '_OTP_MAX_CONCURRENT', 1):
            with self.assertRaises(routing.RoutingUnavailable):
                routing.fetch_opentripplanner_routes(OTP_URL, ORIGIN_TEXT, [store(1), store(2)])

    def test_unrouted_route_shape(self):
        route = routing.unrouted_route()
        self.assertEqual(route['distance_miles'], None)
        self.assertIs(route['unrouted'], True)
        self.assertEqual(set(route['methods']), set(routing.MODES))
        for method in route['methods'].values():
            self.assertEqual(method, {'available': False, 'unavailable_reason': 'route_timeout', 'travel_cost': None, 'total_cost': None, 'steps': []})
        self.assertIsNot(routing.unrouted_route()['methods']['walk'], route['methods']['walk'])


class CacheBudgetAndCopyTests(unittest.TestCase):
    def setUp(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)

    @staticmethod
    def size_of(key, value):
        return len(key) + len(json.dumps(value, separators=(',', ':')))

    def test_byte_total_tracks_puts_replacements_and_removals(self):
        a, b = {'partial': False, 'x': 'a' * 100}, {'partial': False, 'x': 'b' * 50}
        routing._cache_put('a', a)
        routing._cache_put('b', b)
        self.assertEqual(routing._CACHE.bytes, self.size_of('a', a) + self.size_of('b', b))
        routing._cache_put('a', b)  # replacement counts the new size only
        self.assertEqual(routing._CACHE.bytes, 2 * self.size_of('a', b))
        routing._CACHE.pop('a')
        self.assertEqual(routing._CACHE.bytes, self.size_of('b', b))
        routing._CACHE.clear()
        self.assertEqual(routing._CACHE.bytes, 0)

    def test_byte_budget_evicts_least_recently_used(self):
        value = {'partial': False, 'x': 'v' * 1000}
        entry = self.size_of('k0', value)
        with mock.patch.object(routing, '_CACHE_MAX_BYTES', entry * 3):
            for key in ('k0', 'k1', 'k2'):
                routing._cache_put(key, value)
            self.assertIsNotNone(routing._cache_get('k0'))  # refreshes k0
            routing._cache_put('k3', value)
            self.assertEqual(list(routing._CACHE), ['k2', 'k0', 'k3'])
            self.assertLessEqual(routing._CACHE.bytes, entry * 3)
            # One big entry pushes out as many old ones as it needs.
            big = {'partial': False, 'x': 'v' * (3 * entry // 2)}
            routing._cache_put('big', big)
            self.assertEqual(list(routing._CACHE), ['k3', 'big'])
            # An entry larger than the whole budget is not kept (and empties the cache on the way).
            routing._cache_put('huge', {'partial': False, 'x': 'v' * (4 * entry)})
            self.assertEqual(list(routing._CACHE), [])
            self.assertEqual(routing._CACHE.bytes, 0)

    def test_entry_cap_is_a_backstop(self):
        with mock.patch.object(routing, '_CACHE_MAX_ENTRIES', 2):
            for key in ('a', 'b', 'c'):
                routing._cache_put(key, {'partial': False})
        self.assertEqual(list(routing._CACHE), ['b', 'c'])

    def test_default_budget_is_32_mb(self):
        self.assertEqual(routing._CACHE_MAX_BYTES, 32 * 1024 * 1024)

    def test_get_returns_copies(self):
        route = transit_route()
        routing._cache_put('r', {'route': route, 'computed_at': time.time()}, ttl=600)
        route['methods']['walk']['duration_minutes'] = 999  # the caller's object is not the cached one
        first = routing._otp_cache_get('r', leave_now=False)
        first['methods']['walk']['steps'].append({'title': 'x', 'detail': 'y'})
        first['methods']['drive']['available'] = False
        first['distance_miles'] = None
        second = routing._otp_cache_get('r', leave_now=False)
        self.assertEqual(second, transit_route())
        self.assertIsNot(first, second)
        plain = routing._cache_get('r')
        plain['route']['methods']['bike'] = None
        self.assertEqual(routing._cache_get('r')['route'], transit_route())

    def test_fetch_results_do_not_share_cache_objects(self):
        def query(service_url, coordinates, pharmacy, *args):
            return transit_route()
        with mock.patch.object(routing, '_otp_query', query):
            fresh = routing.fetch_opentripplanner_routes(OTP_URL, ORIGIN_TEXT, [store(1)], ['bus'])
            fresh['routes']['s1']['methods']['walk']['duration_minutes'] = 999
            hit = routing.fetch_opentripplanner_routes(OTP_URL, ORIGIN_TEXT, [store(1)], ['bus'])
            self.assertTrue(hit['cached'])
            self.assertEqual(hit['routes']['s1']['methods']['walk']['duration_minutes'], 10)
            hit['routes']['s1']['methods']['walk']['duration_minutes'] = 777
            again = routing.fetch_opentripplanner_routes(OTP_URL, ORIGIN_TEXT, [store(1)], ['bus'])
            self.assertEqual(again['routes']['s1']['methods']['walk']['duration_minutes'], 10)


class OriginRoundingAndPriorityTests(unittest.TestCase):
    def setUp(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)

    def test_origin_is_rounded_to_four_decimals(self):
        self.assertEqual(routing._coordinate_origin('40.74401234,-74.03244999'), ORIGIN)
        self.assertEqual(routing._coordinate_origin('40.74405,-74.03235'), {'latitude': round(40.74405, 4), 'longitude': round(-74.03235, 4)})
        with self.assertRaises(routing.RoutingError):
            routing._coordinate_origin('90.00001,0')  # validated before rounding

    def test_nearby_origins_share_keys_and_query_the_rounded_point(self):
        calls = []
        def query(service_url, coordinates, pharmacy, *args):
            calls.append(coordinates)
            return transit_route()
        with mock.patch.object(routing, '_otp_query', query):
            first = routing.fetch_opentripplanner_routes(OTP_URL, '40.74401,-74.03241', [store(1)], ['bus'])
            second = routing.fetch_opentripplanner_routes(OTP_URL, '40.74404,-74.03238', [store(1)], ['bus'])
            third = routing.fetch_opentripplanner_routes(OTP_URL, '40.7441,-74.0324', [store(1)], ['bus'])
        self.assertEqual((first['cached'], second['cached'], third['cached']), (False, True, False))
        # OTP was asked about exactly the rounded point the cache key names.
        self.assertEqual(calls, [ORIGIN, {'latitude': 40.7441, 'longitude': -74.0324}])
        self.assertEqual(len(routing._CACHE), 2)
        self.assertTrue(all('"latitude":40.744,"longitude":-74.0324' in key or '"latitude":40.7441' in key for key in routing._CACHE))

    def test_haversine(self):
        self.assertEqual(routing.haversine_miles(40.744, -74.0324, 40.744, -74.0324), 0)
        # Hoboken to Newark Penn is about 6.6 miles in a straight line.
        self.assertAlmostEqual(routing.haversine_miles(40.744, -74.0324, 40.7347, -74.1644), 6.9, delta=0.4)
        self.assertAlmostEqual(routing.haversine_miles(0, 0, 1, 0), 69.09, delta=0.05)

    def test_route_priority_orders_and_splits(self):
        stores = [store(index) for index in (9, 1, 5, 2, 8)]  # latitude 40.74 + index / 1000, origin 40.744
        to_route, beyond, miles = routing.route_priority(ORIGIN_TEXT, stores, limit=3)
        self.assertEqual([p['id'] for p in to_route], ['s5', 's2', 's1'])
        self.assertEqual([p['id'] for p in beyond], ['s8', 's9'])
        self.assertEqual(set(miles), {'s1', 's2', 's5', 's8', 's9'})
        self.assertEqual(len(to_route) + len(beyond), len(stores))
        with mock.patch.object(routing, 'ROUTE_STORE_LIMIT', 2):
            self.assertEqual(len(routing.route_priority(ORIGIN_TEXT, stores)[0]), 2)
        # Equal distance: the id breaks the tie, so the split is deterministic.
        twins = [{'id': 'b', 'latitude': 40.75, 'longitude': -74.03}, {'id': 'a', 'latitude': 40.75, 'longitude': -74.03}]
        self.assertEqual([p['id'] for p in routing.route_priority(ORIGIN_TEXT, twins, limit=1)[0]], ['a'])
        with self.assertRaises(routing.RoutingError):
            routing.route_priority('Hoboken, NJ', stores)

    def test_default_limit(self):
        self.assertEqual(routing.ROUTE_STORE_LIMIT, 25)

    def test_beyond_limit_route_shape(self):
        route = routing.unrouted_route('beyond_route_limit')
        self.assertEqual(route['distance_miles'], None)
        for method in route['methods'].values():
            self.assertEqual(method, {'available': False, 'unavailable_reason': 'beyond_route_limit', 'travel_cost': None, 'total_cost': None, 'steps': []})

if __name__ == '__main__':
    unittest.main()
