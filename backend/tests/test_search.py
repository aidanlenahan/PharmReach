"""Tests for backend/serve.py: get_pharmacies sorting/filtering/pricing, OTP-unavailable fallback,
geocode_local_address, parse_leave_at and static-file path safety. No OTP, network or Gemini.

Run: python3 -m unittest discover -s backend/tests
"""
import contextlib
import copy
import http.client
import io
import json
import sys
import threading
import unittest
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import URLError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import routing  # noqa: E402
import serve  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / 'fixtures'
OTP_URL = 'http://otp.test/otp/gtfs/v1'
MED = 'ibu'


def pharmacy(store_id, name, latitude, longitude):
    # Mock-route fields (walk/transit/...) are what build_routes() reads before OTP overrides them.
    return {'id': store_id, 'name': name, 'address': f'{name} St · Hoboken, NJ 07030', 'city': 'Hoboken', 'state': 'NJ',
            'latitude': latitude, 'longitude': longitude, 'distance': 0.5, 'walk': 11, 'transit': 9, 'depart': 3,
            'drive': 4, 'driveCost': 1.4, 'bike': 5}


# Alpha, Bravo, Golf, Hotel are in stock; Charlie is Limited stock; Delta Out of stock;
# Echo is in stock but OTP did not route it; Foxtrot is Unknown (hidden).
PHARMACIES = [
    pharmacy('s-a', 'Alpha', 40.7410, -74.0300),
    pharmacy('s-b', 'Bravo', 40.7420, -74.0300),
    pharmacy('s-c', 'Charlie', 40.7430, -74.0300),
    pharmacy('s-d', 'Delta', 40.7450, -74.0300),
    pharmacy('s-e', 'Echo', 40.7460, -74.0300),
    pharmacy('s-f', 'Foxtrot', 40.7470, -74.0300),
    pharmacy('s-g', 'Golf', 40.7480, -74.0300),
    pharmacy('s-h', 'Hotel', 40.7490, -74.0300),
]
STOCK = {'s-a': ('In stock', 10.0), 's-b': ('In stock', 8.0), 's-c': ('Limited stock', 5.0), 's-d': ('Out of stock', 4.0),
         's-e': ('In stock', 12.0), 's-f': ('Unknown', 1.0), 's-g': ('In stock', 9.0), 's-h': ('In stock', 7.0)}
VISIBLE = ['s-a', 's-b', 's-c', 's-d', 's-e', 's-g', 's-h']
# Visible stores by straight-line distance from serve.DEFAULT_ORIGIN (40.744,-74.0324).
NEAREST_TO_DEFAULT = ['s-d', 's-c', 's-e', 's-b', 's-a', 's-g', 's-h']


def make_data():
    return {
        'source_info': {'merchant': 'Test'},
        'medications': [
            {'id': MED, 'name': 'Ibuprofen', 'strength': '200 mg', 'quantity': 50, 'variants': [
                {'id': MED, 'strength': '200 mg', 'form': 'tablets', 'quantity': 50, 'price_multiplier': 1},
                {'id': 'ibu-100', 'strength': '200 mg', 'form': 'tablets', 'quantity': 100, 'quantity_label': '100 tablets', 'price_multiplier': 1.5},
            ]},
            {'id': 'plain', 'name': 'Plain', 'strength': '10 mg', 'quantity': 30},
        ],
        'pharmacies': copy.deepcopy(PHARMACIES),
        'inventory': {
            MED: {store_id: {'price': price, 'stock': stock} for store_id, (stock, price) in STOCK.items()},
            'plain': {'s-a': {'price': 3.0, 'stock': 'In stock'}},
        },
    }


def street(duration, cost=0.0):
    # OTP street routes carry no arrival_in_minutes; serve.py derives it.
    return {'available': True, 'duration_minutes': duration, 'depart_in_minutes': 0, 'travel_cost': cost, 'walking_minutes': duration, 'walking_miles': 0.5, 'steps': [{'title': 'Walk', 'detail': 'OTP step'}]}


def transit(duration, depart, arrival, cost):
    return {'available': True, 'duration_minutes': duration, 'depart_in_minutes': depart, 'arrival_in_minutes': arrival, 'travel_cost': cost,
            'walking_minutes': 3, 'walking_miles': 0.2, 'steps': [{'title': 'Ride 87', 'detail': 'OTP step'}], 'transit_types': ['bus']}


def otp_route(walk, transit_route, drive, drive_cost, bike, distance=1.0):
    return {'distance_miles': distance, 'methods': {'walk': street(walk), 'transit': transit_route, 'drive': street(drive, drive_cost), 'bike': street(bike)}}


NO_TRANSIT = {'available': False, 'unavailable_reason': 'no_transit_route'}
OTP_ROUTES = {
    's-a': otp_route(30, transit(20, 5, 25, 2.65), 8, 3.0, 12, 1.234),
    's-b': otp_route(40, transit(30, 2, 32, 3.0), 6, 1.5, 15),
    's-c': otp_route(5, transit(5, 0, 5, 1.0), 2, 0.5, 3),
    's-d': otp_route(5, transit(5, 0, 5, 1.0), 2, 0.5, 3),
    's-g': otp_route(10, NO_TRANSIT, 4, 4.0, 5),
    's-h': otp_route(20, transit(15, 15, 30, None), 12, 2.0, 9),
}

# Expected order of the available stores, ascending; 'desc' is the exact reverse for this data.
EXPECTED_ASC = {
    'transit': {
        'Best match': ['s-a', 's-h', 's-b'],
        'Soonest arrival': ['s-a', 's-h', 's-b'],
        'Travel time': ['s-h', 's-a', 's-b'],
        'Medication cost': ['s-h', 's-b', 's-a'],
        'Travel cost': ['s-a', 's-b', 's-h'],  # unknown fare (None) ranks as infinity
        'Total cost': ['s-b', 's-a', 's-h'],
        'Pharmacy': ['s-a', 's-b', 's-h'],
        'Availability': ['s-a', 's-b', 's-h'],
    },
    'drive': {
        'Best match': ['s-g', 's-b', 's-h', 's-a'],
        'Soonest arrival': ['s-g', 's-b', 's-a', 's-h'],
        'Travel time': ['s-g', 's-b', 's-a', 's-h'],
        'Medication cost': ['s-h', 's-b', 's-g', 's-a'],
        'Travel cost': ['s-b', 's-h', 's-a', 's-g'],
        'Total cost': ['s-h', 's-b', 's-a', 's-g'],  # Alpha and Golf tie at 13.0; name breaks it
        'Pharmacy': ['s-a', 's-b', 's-g', 's-h'],
        'Availability': ['s-a', 's-b', 's-g', 's-h'],
    },
    'walk': {
        'Best match': ['s-g', 's-h', 's-a', 's-b'],
        'Soonest arrival': ['s-g', 's-h', 's-a', 's-b'],
        'Travel time': ['s-g', 's-h', 's-a', 's-b'],
        'Medication cost': ['s-h', 's-b', 's-g', 's-a'],
        'Travel cost': ['s-a', 's-b', 's-g', 's-h'],
        'Total cost': ['s-h', 's-b', 's-g', 's-a'],
        'Pharmacy': ['s-a', 's-b', 's-g', 's-h'],
        'Availability': ['s-a', 's-b', 's-g', 's-h'],
    },
}


class StubFetch:
    """Replaces serve.fetch_opentripplanner_routes with canned per-store routes."""

    def __init__(self, routes=None, error=None):
        self.routes = routes if routes is not None else OTP_ROUTES
        self.error = error
        self.calls = []

    def __call__(self, otp_url, origin, pharmacies, transit_types=None, transit_fare=None, leave_at=None):
        self.calls.append({'otp_url': otp_url, 'origin': origin, 'ids': [p['id'] for p in pharmacies], 'transit_types': transit_types, 'transit_fare': transit_fare, 'leave_at': leave_at})
        if self.error:
            raise self.error
        routes = {p['id']: copy.deepcopy(self.routes[p['id']]) if p['id'] in self.routes else routing.unrouted_route() for p in pharmacies}
        return {'routes': routes, 'partial': True, 'cached': False, 'provider': 'otp', 'unrouted': sum(r.get('unrouted', False) for r in routes.values())}


def search(stub=None, **kwargs):
    stub = stub or StubFetch()
    kwargs.setdefault('otp_url', OTP_URL)
    # redirect_stdout: the RoutingUnavailable fallback prints a log line.
    with mock.patch.object(serve, 'fetch_opentripplanner_routes', stub), contextlib.redirect_stdout(io.StringIO()):
        return serve.get_pharmacies(make_data(), kwargs.pop('medication', MED), **kwargs)


def ids(result):
    return [record['id'] for record in result['pharmacies']]


class GetPharmaciesTests(unittest.TestCase):
    def test_every_sort_direction_and_mode(self):
        for mode, expected_by_sort in EXPECTED_ASC.items():
            self.assertEqual(set(expected_by_sort), set(serve.SORT_OPTIONS))
            for sort, expected in expected_by_sort.items():
                for direction in ('asc', 'desc'):
                    with self.subTest(mode=mode, sort=sort, direction=direction):
                        result = search(mode=mode, sort=sort, direction=direction)
                        self.assertEqual((result['compare_mode'], result['sort'], result['direction']), (mode, sort, direction))
                        self.assertEqual(sorted(ids(result)), VISIBLE)
                        available = [r['id'] for r in result['pharmacies'] if r['methods'][mode]['available']]
                        flags = [r['methods'][mode]['available'] for r in result['pharmacies']]
                        # Available stores first, then every unavailable/unrouted store, in either direction.
                        self.assertEqual(flags, sorted(flags, reverse=True))
                        self.assertEqual(available, expected if direction == 'asc' else expected[::-1])

    def test_full_order_including_unavailable_group(self):
        result = search(mode='transit', sort='Travel time')
        # Unavailable group keeps rank order too: Charlie/Delta keep their stub durations (5), Echo/Golf have none (inf).
        self.assertEqual(ids(result), ['s-h', 's-a', 's-b', 's-c', 's-d', 's-e', 's-g'])
        result = search(mode='transit', sort='Travel time', direction='desc')
        self.assertEqual(ids(result), ['s-b', 's-a', 's-h', 's-g', 's-e', 's-d', 's-c'])

    def test_bike_mode_sorts_too(self):
        self.assertEqual(ids(search(mode='bike', sort='Travel time'))[:4], ['s-g', 's-h', 's-a', 's-b'])

    def test_stock_gates_availability(self):
        for mode in serve.MODES:
            for sort in serve.SORT_OPTIONS:
                result = search(mode=mode, sort=sort)
                by_id = {r['id']: r for r in result['pharmacies']}
                # Out of stock never shows an available route, even though OTP routed it.
                self.assertFalse(any(m['available'] for m in by_id['s-d']['methods'].values()))
                # Current behavior: Limited stock is treated like out of stock for routing.
                self.assertFalse(any(m['available'] for m in by_id['s-c']['methods'].values()))
        self.assertNotIn('s-f', ids(search()))  # Unknown stock is hidden

    def test_route_fields_and_costs(self):
        result = search(mode='transit')
        by_id = {r['id']: r for r in result['pharmacies']}
        alpha = by_id['s-a']
        self.assertEqual(alpha['price'], 10.0)
        self.assertEqual(alpha['distance'], 1.23)
        self.assertEqual(alpha['map_number'], 1)
        self.assertEqual(alpha['methods']['transit']['total_cost'], 12.65)
        self.assertEqual(alpha['methods']['walk']['arrival_in_minutes'], 30)  # derived from duration + depart
        self.assertEqual(alpha['methods']['drive']['total_cost'], 13.0)
        self.assertIsNone(by_id['s-h']['methods']['transit']['total_cost'])  # unknown fare
        self.assertEqual(by_id['s-g']['methods']['transit'], NO_TRANSIT)
        self.assertEqual(result['routing_source'], 'otp')
        self.assertEqual(result['unrouted_count'], 1)  # Echo
        self.assertTrue(by_id['s-e']['methods']['walk']['unavailable_reason'] == 'route_timeout')
        self.assertIsNone(by_id['s-e']['distance'])
        self.assertIs(result['mock'], True)

    def test_variant_price_multiplier(self):
        result = search(mode='transit', variant_id='ibu-100', sort='Medication cost')
        by_id = {r['id']: r for r in result['pharmacies']}
        self.assertEqual({k: by_id[k]['price'] for k in ('s-a', 's-b', 's-h', 's-d')}, {'s-a': 15.0, 's-b': 12.0, 's-h': 10.5, 's-d': 6.0})
        self.assertEqual(by_id['s-a']['methods']['transit']['total_cost'], 17.65)
        self.assertEqual(by_id['s-a']['methods']['drive']['total_cost'], 18.0)
        self.assertEqual(result['medication']['selected_variant_id'], 'ibu-100')
        self.assertEqual(result['medication']['quantity'], 100)
        self.assertEqual(result['medication']['quantity_label'], '100 tablets')
        self.assertEqual(result['medication']['strength'], '200 mg tablets')
        # An unknown variant falls back to the first one.
        fallback = search(variant_id='nope')
        self.assertEqual(fallback['medication']['selected_variant_id'], MED)
        self.assertEqual({r['id']: r['price'] for r in fallback['pharmacies']}['s-a'], 10.0)
        # A medication without variants uses its own strength and quantity, multiplier 1.
        plain = search(medication='plain')
        self.assertEqual(plain['pharmacies'][0]['price'], 3.0)
        self.assertEqual(plain['medication']['quantity_label'], '30 count')

    def test_invalid_inputs_raise_value_error(self):
        for kwargs in ({'medication': 'nope'}, {'mode': 'teleport'}, {'sort': 'Nearest'}, {'direction': 'up'}, {'medication': ''}):
            with self.subTest(**kwargs), self.assertRaises(ValueError):
                search(**kwargs)

    def test_legacy_sort_alias(self):
        self.assertEqual(search(sort='Travel / shipping cost')['sort'], 'Travel cost')

    def test_fetch_arguments(self):
        stub = StubFetch()
        result = search(stub, transit_types=['bus'], transit_fare=2.0, leave_at='2030-01-01T12:00:00Z')
        # Stores go to OTP nearest-first from the origin (all 7 are within the default limit).
        self.assertEqual(stub.calls, [{'otp_url': OTP_URL, 'origin': serve.DEFAULT_ORIGIN, 'ids': NEAREST_TO_DEFAULT, 'transit_types': ['bus'], 'transit_fare': 2.0, 'leave_at': '2030-01-01T12:00:00Z'}])
        self.assertTrue(result['origin_is_default'])
        self.assertEqual(result['leave_at'], '2030-01-01T12:00:00Z')
        stub = StubFetch()
        result = search(stub, origin='40.75,-74.03')
        self.assertEqual(stub.calls[0]['origin'], '40.75,-74.03')
        self.assertFalse(result['origin_is_default'])

    def test_same_location_is_you_are_here(self):
        result = search(mode='transit', origin='40.7410,-74.0300', sort='Travel time')
        alpha = next(r for r in result['pharmacies'] if r['id'] == 's-a')
        self.assertEqual(alpha['distance'], 0)
        for method in alpha['methods'].values():
            self.assertTrue(method['available'])
            self.assertTrue(method['at_destination'])
            self.assertEqual((method['duration_minutes'], method['arrival_in_minutes'], method['travel_cost'], method['total_cost']), (0, 0, 0, 10.0))
            self.assertEqual(method['steps'], [{'title': 'You are here', 'detail': 'This address matches your starting point.'}])
        self.assertEqual(ids(result)[0], 's-a')
        # Within 12 m counts as the same place; an out-of-stock store there stays unavailable.
        self.assertTrue(serve.same_location('40.74505,-74.0300', PHARMACIES[3]))
        self.assertFalse(serve.same_location('40.7453,-74.0300', PHARMACIES[3]))
        self.assertFalse(serve.same_location('Hoboken', PHARMACIES[3]))
        delta = next(r for r in search(origin='40.7450,-74.0300')['pharmacies'] if r['id'] == 's-d')
        self.assertFalse(delta['methods']['walk']['available'])
        self.assertIsNone(delta['methods']['walk']['total_cost'])
        self.assertEqual(delta['methods']['walk']['steps'][0]['title'], 'You are here')

    def test_routing_error_for_bad_origin_propagates(self):
        with self.assertRaises(routing.RoutingError) as caught:
            search(stub=routing.fetch_opentripplanner_routes, origin='Hoboken, NJ')
        self.assertNotIsInstance(caught.exception, routing.RoutingUnavailable)

    def test_mock_mode_without_otp(self):
        # Pinned current behavior: with no routing service, mock estimates are served.
        result = search(otp_url=None, mode='transit')
        self.assertEqual(result['routing_source'], 'mock')
        self.assertEqual(result['unrouted_count'], 0)
        self.assertIn('George St', json.dumps(result))

    def test_mpg_prices_the_drive(self):
        routes = copy.deepcopy(OTP_ROUTES)
        routes['s-a']['methods']['drive']['distance_miles'] = 6.2
        result = search(StubFetch(routes), mode='drive', sort='Travel cost', mpg=31)
        by_id = {r['id']: r for r in result['pharmacies']}
        drive = by_id['s-a']['methods']['drive']
        # 6.2 mi / 31 MPG = 0.2 gal; other stores fall back to the routed distance (1.0 mi).
        self.assertEqual(drive['travel_cost'], round(0.2 * serve.GAS_PRICE_PER_GALLON, 2))
        self.assertEqual(drive['total_cost'], round(10.0 + drive['travel_cost'], 2))
        self.assertEqual(by_id['s-b']['methods']['drive']['travel_cost'], round(1 / 31 * serve.GAS_PRICE_PER_GALLON, 2))
        self.assertIsNone(by_id['s-e']['methods']['drive']['travel_cost'])  # unrouted stays unknown
        self.assertEqual(ids(result)[:4], ['s-b', 's-g', 's-h', 's-a'])  # Alpha is now the costliest drive
        # Without mpg the per-store estimate is kept.
        self.assertEqual({r['id']: r for r in search()['pharmacies']}['s-a']['methods']['drive']['travel_cost'], 3.0)

    def test_parse_mpg(self):
        self.assertIsNone(serve.parse_mpg(''))
        self.assertEqual(serve.parse_mpg('28.5'), 28.5)
        for value in ('abc', '0', '500'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                serve.parse_mpg(value)


class OtpUnavailableTests(unittest.TestCase):
    def assert_stock_only(self, result):
        data = make_data()
        self.assertEqual(sorted(ids(result)), VISIBLE)
        self.assertEqual(result['unrouted_count'], len(VISIBLE))
        self.assertEqual(result['routing_source'], 'otp')
        for record in result['pharmacies']:
            item = data['inventory'][MED][record['id']]
            self.assertEqual((record['price'], record['stock']), (item['price'], item['stock']))
            self.assertIsNone(record['distance'])
            for mode, method in record['methods'].items():
                self.assertFalse(method['available'], (record['id'], mode))
                self.assertEqual(method['unavailable_reason'], 'route_timeout')
                self.assertIsNone(method['travel_cost'])
                self.assertEqual(method['steps'], [])
        text = json.dumps(result)
        for mock_text in ('George St', 'Take the local bus', 'Walk to the nearest stop', 'Trip of'):
            self.assertNotIn(mock_text, text)

    def test_stubbed_routing_unavailable(self):
        for mode in ('walk', 'transit', 'drive'):
            for sort in serve.SORT_OPTIONS:
                with self.subTest(mode=mode, sort=sort):
                    self.assert_stock_only(search(StubFetch(error=routing.RoutingUnavailable('down')), mode=mode, sort=sort))

    def test_real_fetch_with_otp_down(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)
        def down(*args):
            raise URLError('connection refused')
        with mock.patch.object(routing, '_otp_query', down), mock.patch.object(routing, '_OTP_SEARCH_BUDGET_SECONDS', 0.5):
            result = search(stub=routing.fetch_opentripplanner_routes, mode='transit')
        self.assert_stock_only(result)
        self.assertEqual(routing._CACHE, {})


class RouteLimitTests(unittest.TestCase):
    """Only the nearest ROUTE_STORE_LIMIT stores are routed; every visible store is still returned."""

    def limited(self, limit=3, **kwargs):
        stub = kwargs.pop('stub', None) or StubFetch()
        with mock.patch.object(routing, 'ROUTE_STORE_LIMIT', limit):
            return search(stub, **kwargs), stub

    def test_default_limit_routes_every_current_store(self):
        stub = StubFetch()
        result = search(stub)
        self.assertGreaterEqual(routing.ROUTE_STORE_LIMIT, len(VISIBLE))
        self.assertEqual(sorted(stub.calls[0]['ids']), VISIBLE)
        self.assertEqual(result['beyond_limit_count'], 0)

    def test_nearest_stores_are_routed_and_none_dropped(self):
        result, stub = self.limited(3)
        self.assertEqual(stub.calls[0]['ids'], NEAREST_TO_DEFAULT[:3])
        self.assertEqual(sorted(ids(result)), VISIBLE)
        self.assertEqual(len(result['pharmacies']), len(VISIBLE))
        self.assertEqual(result['beyond_limit_count'], 4)
        self.assertEqual(result['unrouted_count'], 1)  # Echo timed out; beyond-limit stores are counted separately
        self.assertEqual(result['routing_source'], 'otp')

    def test_beyond_limit_fields(self):
        result, _ = self.limited(3, mode='transit')
        data = make_data()
        by_id = {r['id']: r for r in result['pharmacies']}
        for store_id in NEAREST_TO_DEFAULT[3:]:
            record = by_id[store_id]
            item = data['inventory'][MED][store_id]
            self.assertEqual((record['price'], record['stock']), (item['price'], item['stock']))
            self.assertIsNone(record['distance'])
            self.assertIsInstance(record['straight_line_miles'], float)
            for method in record['methods'].values():
                self.assertEqual(method, {'available': False, 'unavailable_reason': 'beyond_route_limit', 'travel_cost': None, 'total_cost': None, 'steps': []})
        self.assertEqual(by_id['s-e']['methods']['walk']['unavailable_reason'], 'route_timeout')
        self.assertEqual(by_id['s-d']['distance'], 1.0)  # routed: OTP distance as before
        text = json.dumps(result)
        for mock_text in ('George St', 'Take the local bus', 'Walk to the nearest stop', 'Trip of'):
            self.assertNotIn(mock_text, text)

    def test_every_store_has_straight_line_miles(self):
        result = search(origin='40.7410,-74.0300')
        by_id = {r['id']: r for r in result['pharmacies']}
        self.assertEqual(by_id['s-a']['straight_line_miles'], 0.0)
        expected = routing.haversine_miles(40.741, -74.03, 40.749, -74.03)
        self.assertEqual(by_id['s-h']['straight_line_miles'], round(expected, 2))
        self.assertAlmostEqual(expected, 0.553, places=3)  # 0.008 degrees of latitude
        # Mock mode (no OTP) has them too; a non-coordinate origin has none.
        self.assertTrue(all(r['straight_line_miles'] is not None for r in search(otp_url=None)['pharmacies']))
        self.assertTrue(all(r['straight_line_miles'] is None for r in search(otp_url=None, origin='Hoboken')['pharmacies']))
        self.assertEqual(search(otp_url=None)['beyond_limit_count'], 0)

    def test_ordering_keeps_available_first_and_groups_unrouted_consistently(self):
        for mode in ('walk', 'transit'):
            for sort in serve.SORT_OPTIONS:
                for direction in ('asc', 'desc'):
                    with self.subTest(mode=mode, sort=sort, direction=direction):
                        result, _ = self.limited(3, mode=mode, sort=sort, direction=direction)
                        flags = [r['methods'][mode]['available'] for r in result['pharmacies']]
                        self.assertEqual(flags, sorted(flags, reverse=True))
                        reasons = {r['id']: r['methods'][mode].get('unavailable_reason') for r in result['pharmacies']}
                        self.assertTrue(all(not result['pharmacies'][i]['methods'][mode]['available']
                                            for i, r in enumerate(result['pharmacies']) if reasons[r['id']] == 'beyond_route_limit'))
        # Travel-time sorts: beyond-limit stores rank exactly like timeouts (no time: infinity, then name).
        # Limit 3 routes Delta (out of stock), Charlie (limited) and Echo (timeout): nothing is available.
        # Charlie/Delta keep their routed 5 min; beyond-limit Alpha/Bravo/Golf/Hotel interleave with Echo by name.
        result, _ = self.limited(3, mode='walk', sort='Travel time')
        self.assertEqual(ids(result), ['s-c', 's-d', 's-a', 's-b', 's-e', 's-g', 's-h'])
        # Limit 5 also routes Bravo and Alpha (in stock), so they lead; Golf/Hotel (beyond) sort with Echo (timeout).
        result, _ = self.limited(5, mode='walk', sort='Travel time')
        self.assertEqual(ids(result), ['s-a', 's-b', 's-c', 's-d', 's-e', 's-g', 's-h'])
        self.assertEqual([r['id'] for r in result['pharmacies'] if r['methods']['walk']['available']], ['s-a', 's-b'])

    def test_otp_down_with_limit(self):
        result, _ = self.limited(3, stub=StubFetch(error=routing.RoutingUnavailable('down')))
        self.assertEqual(sorted(ids(result)), VISIBLE)
        self.assertEqual((result['unrouted_count'], result['beyond_limit_count']), (3, 4))
        reasons = {r['id']: r['methods']['walk']['unavailable_reason'] for r in result['pharmacies']}
        self.assertEqual({k for k, v in reasons.items() if v == 'route_timeout'}, set(NEAREST_TO_DEFAULT[:3]))
        self.assertEqual({k for k, v in reasons.items() if v == 'beyond_route_limit'}, set(NEAREST_TO_DEFAULT[3:]))
        self.assertFalse(any(m['available'] for r in result['pharmacies'] for m in r['methods'].values()))

    def test_beyond_limit_stores_are_never_cached(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)
        calls = []
        def query(service_url, coordinates, pharmacy, *args):
            calls.append(pharmacy['id'])
            return otp_route(10, transit(5, 1, 6, 2.0), 3, 1.0, 4)
        with mock.patch.object(routing, '_otp_query', query):
            result, _ = self.limited(3, stub=routing.fetch_opentripplanner_routes)
        self.assertEqual(sorted(calls), sorted(NEAREST_TO_DEFAULT[:3]))
        self.assertEqual(len(routing._CACHE), 3)
        self.assertEqual(result['beyond_limit_count'], 4)


class WarmupSelectionTests(unittest.TestCase):
    def test_warms_the_nearest_stores_per_medication(self):
        with mock.patch.object(routing, 'ROUTE_STORE_LIMIT', 3):
            medications, stores, visible_count = serve.warmup_stores(make_data())
        self.assertEqual(medications, [MED, 'plain'])
        self.assertEqual(visible_count, len(VISIBLE))
        # Ibuprofen's nearest 3, plus Alpha (the only store for 'plain'), nearest-first overall.
        self.assertEqual([p['id'] for p in stores], ['s-d', 's-c', 's-e', 's-a'])
        with mock.patch.object(routing, 'ROUTE_STORE_LIMIT', 25):
            _, stores, _ = serve.warmup_stores(make_data())
        self.assertEqual([p['id'] for p in stores], NEAREST_TO_DEFAULT)

    def test_warmed_keys_match_real_searches(self):
        routing._CACHE.clear()
        self.addCleanup(routing._CACHE.clear)
        def query(service_url, coordinates, pharmacy, *args):
            return otp_route(10, transit(5, 1, 6, 2.0), 3, 1.0, 4)
        data = make_data()
        with mock.patch.object(routing, 'ROUTE_STORE_LIMIT', 3), mock.patch.object(routing, '_otp_query', query):
            _, stores, _ = serve.warmup_stores(data)
            for pharmacy in stores:  # the warm-up's own call pattern: one store at a time
                routing.fetch_opentripplanner_routes(OTP_URL, serve.DEFAULT_ORIGIN, [pharmacy], ['bus'], None)
            with mock.patch.object(routing, '_otp_query', side_effect=AssertionError('cache miss')):
                for medication_id in (MED, 'plain'):
                    result = serve.get_pharmacies(data, medication_id, otp_url=OTP_URL, transit_types=['bus'])
                    self.assertEqual(result['routing_source'], 'cached_otp', medication_id)


class GeocodeTests(unittest.TestCase):
    """The first three tests use the bundled backend/data/address-index.json."""

    def test_bundled_match(self):
        expected = [{'address': '64 10th Street, Hoboken, NJ', 'latitude': 40.7486251, 'longitude': -74.0270282, 'approximate': False}]
        for query in ('64 10th Street', '64 10th St, Hoboken, NJ 07030', '  64 10TH STREET apt 3 '):
            self.assertEqual(serve.geocode_local_address(query), expected, query)

    def test_bundled_no_match(self):
        for query in ('', None, 'zzz nowhere', 'Clinton Street', '99999 Nowhere Lane', '!!!'):
            self.assertEqual(serve.geocode_local_address(query), [], query)

    def test_bundled_length_limit(self):
        padded = '64 10th Street, ' + 'x' * 240
        self.assertEqual(len(padded), 256)
        self.assertEqual(len(serve.geocode_local_address(padded)), 1)
        self.assertEqual(serve.geocode_local_address(padded + 'x'), [])
        self.assertEqual(serve.geocode_local_address('x' * 10_000), [])

    def fixture_geocode(self, query):
        with mock.patch.object(serve, 'DATA_ROOT', FIXTURES / 'geocode_data'):
            return serve.geocode_local_address(query)

    def test_store_addresses_are_indexed(self):
        self.assertEqual(self.fixture_geocode('100 14th St'), [{'address': '100 14th St, Jersey City, NJ', 'latitude': 40.732831, 'longitude': -74.035759, 'approximate': False}])

    def test_city_suffix_is_ignored(self):
        # Pinned current behavior (by design: "Ignore city/ZIP suffixes"); a statewide
        # index will need the city: "Hoboken" here still returns the Jersey City store.
        self.assertEqual(self.fixture_geocode('100 14th St, Hoboken')[0]['address'], '100 14th St, Jersey City, NJ')

    def test_interpolates_between_house_numbers(self):
        [result] = self.fixture_geocode('150 14th st')
        self.assertEqual(result['address'], '14th Street, Hoboken, NJ')
        self.assertTrue(result['approximate'])
        self.assertAlmostEqual(result['latitude'], 40.7537 + (40.7540 - 40.7537) * 34 / 84, places=6)
        self.assertEqual(self.fixture_geocode('500 14th st'), [])  # no upper neighbour

    @unittest.expectedFailure
    def test_interpolation_does_not_mix_cities(self):
        # BUG (serve.py:130-157): same-street interpolation ignores the city. "105 14th St"
        # interpolates between 100 14th St (Jersey City store) and 116 14th Street (Hoboken),
        # giving a point ~1.6 km south of Hoboken's 14th St (lat 40.7394), labelled
        # "14th st, Hoboken, NJ" (the label is hard-coded to Hoboken at serve.py:153).
        results = self.fixture_geocode('105 14th st')
        for result in results:
            self.assertGreater(result['latitude'], 40.75)


class ParseLeaveAtTests(unittest.TestCase):
    def test_empty_is_leave_now(self):
        self.assertIsNone(serve.parse_leave_at(''))
        self.assertIsNone(serve.parse_leave_at(None))

    def test_valid_is_normalized_to_utc_z(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).replace(microsecond=0)
        expected = future.strftime('%Y-%m-%dT%H:%M:%SZ')
        self.assertEqual(serve.parse_leave_at(future.strftime('%Y-%m-%dT%H:%M:%SZ')), expected)
        eastern = future.astimezone(timezone(timedelta(hours=-4)))
        self.assertEqual(serve.parse_leave_at(eastern.isoformat()), expected)
        # Up to a minute in the past is tolerated (clock skew).
        recent = datetime.now(timezone.utc) - timedelta(seconds=30)
        self.assertTrue(serve.parse_leave_at(recent.isoformat()).endswith('Z'))

    def test_rejects_past_far_future_naive_and_garbage(self):
        now = datetime.now(timezone.utc)
        for value in ((now - timedelta(minutes=5)).isoformat(), (now + timedelta(days=31)).isoformat(),
                      (now + timedelta(hours=1)).replace(tzinfo=None).isoformat(), 'tomorrow', '2026-13-40T99:00Z', '12:00'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                serve.parse_leave_at(value)


def handler_for(path):
    handler = serve.Handler.__new__(serve.Handler)
    handler.path = path
    return handler


class ForbiddenPathTests(unittest.TestCase):
    def test_forbidden(self):
        for path in ('/.env', '/.git/config', '/%2eenv', '/backend/serve.py', '/../backend/serve.py', '/%2e%2e/backend/serve.py',
                     '/..%2fbackend%2fserve.py', '/..\\backend\\serve.py', '/..%5cbackend%5cserve.py', '/data/cvs-data.json',
                     '/cvs-data.json', '/address-index.json', '/src/HomePage.tsx', '/frontend/dist/index.html', '/BACKEND/x',
                     '/assets/app.js.map', '/x.pem', '/x.key', '/x.pyc', '/nested/.hidden', '/package.json', '/otp/', '/api/../.env'):
            self.assertTrue(handler_for(path).forbidden_path(), path)

    def test_allowed(self):
        for path in ('/', '/index.html', '/results?medication=ibu', '/results.html?medication=ibu', '/assets/index-abc123.js', '/error.css', '/api/health', '/api/pharmacies?origin=../x'):
            self.assertFalse(handler_for(path).forbidden_path(), path)


class QuietHandler(serve.Handler):
    def log_message(self, *args):
        pass


@unittest.skipUnless((serve.FRONTEND_ROOT / 'index.html').is_file(), 'frontend/dist is not built')
class StaticServingTests(unittest.TestCase):
    """Starts the real handler on an ephemeral 127.0.0.1 port (never 4173)."""

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(serve.FRONTEND_ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, path, method='GET'):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_address[1], timeout=5)
        try:
            # http.client sends the path verbatim, so traversal attempts reach the handler unnormalized.
            connection.request(method, path)
            response = connection.getresponse()
            return response.status, response.read(), response
        finally:
            connection.close()

    def raw_request(self, path):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_address[1], timeout=5)
        try:
            connection.request('GET', path)
            response = connection.getresponse()
            return response.status, response.read(), response
        finally:
            connection.close()

    def test_clean_urls_serve_the_page(self):
        for name in ('find-medicine', 'results', 'settings', 'privacy', 'onboarding', 'products'):
            status, body, response = self.raw_request(f'/{name}?medication=ibu')
            self.assertEqual(status, 200, name)
            self.assertEqual(body, (serve.FRONTEND_ROOT / f'{name}.html').read_bytes(), name)
            self.assertEqual(response.getheader('Cache-Control'), 'no-store')

    def test_html_urls_redirect_to_clean_urls(self):
        for path, location in (('/results.html?medication=ibu&mode=walk', '/results?medication=ibu&mode=walk'),
                               ('/settings.html', '/settings'), ('/index.html', '/'), ('/index.html?x=1', '/?x=1')):
            status, _, response = self.raw_request(path)
            self.assertEqual(status, 301, path)
            self.assertEqual(response.getheader('Location'), location)

    def test_unknown_pages_stay_404(self):
        for path in ('/nothing', '/results/', '/api2'):
            self.assertEqual(self.raw_request(path)[0], 404, path)

    def test_index_is_served(self):
        status, body, response = self.request('/')
        self.assertEqual(status, 200)
        self.assertEqual(body, (serve.FRONTEND_ROOT / 'index.html').read_bytes())
        self.assertEqual(response.getheader('Cache-Control'), 'no-store')

    def test_nothing_outside_dist_is_served(self):
        secrets = [(serve.ROOT / 'serve.py').read_bytes()[:200], (serve.ROOT / 'routing.py').read_bytes()[:200]]
        paths = ['/../backend/serve.py', '/../../etc/passwd', '/%2e%2e/backend/serve.py', '/%2e%2e/%2e%2e/etc/passwd',
                 '/..%2fbackend%2fserve.py', '/..%2f..%2fetc%2fpasswd', '/..\\backend\\serve.py', '/..%5cbackend%5cserve.py',
                 '/assets/../../backend/routing.py', '/assets/%2e%2e/%2e%2e/backend/routing.py', '/.env', '/%2eenv', '/.git/config',
                 '/.gitignore', '/backend/serve.py', '/serve.py', '/routing.py', '/data/cvs-data.json', '/backend/data/address-index.json',
                 '/etc/passwd', '//etc/passwd', '/frontend/src/core.ts', '/src/core.ts', '/assets/', '/todo.md',
                 '/../todo.md', '/%2e%2e/todo.md', '/../.env.example']
        for path in paths:
            for method in ('GET', 'HEAD'):
                with self.subTest(path=path, method=method):
                    status, body, _ = self.request(path, method)
                    self.assertIn(status, (400, 403, 404))
                    for secret in secrets:
                        self.assertNotIn(secret, body)

    def test_served_files_come_from_dist(self):
        dist = serve.FRONTEND_ROOT.resolve()
        for file in sorted(path for path in dist.rglob('*') if path.is_file())[:30]:
            relative = file.relative_to(dist).as_posix()
            if any(part.startswith('.') for part in relative.split('/')) or relative.endswith('.map'):
                continue
            if relative.removesuffix('.html') in serve.CLEAN_PAGES or relative == 'index.html':
                continue  # these redirect to their clean URL; test_clean_urls_serve_the_page covers them
            status, body, _ = self.request('/' + relative)
            self.assertEqual((status, body), (200, file.read_bytes()), relative)

    def test_post_only_accepts_chat(self):
        status, body, _ = self.request('/.env', 'POST')
        self.assertEqual((status, json.loads(body)), (404, {'error': 'Unknown API endpoint.'}))
        status, _, _ = self.request('/api/pharmacies', 'POST')
        self.assertEqual(status, 404)

    def test_catalog_store_counts_use_confirmed_stock_at_known_stores(self):
        data = make_data()
        data['medications'].extend([
            {'id': 'out', 'name': 'Out-of-stock product', 'strength': ''},
            {'id': 'unchecked', 'name': 'Unchecked product', 'strength': ''},
        ])
        data['inventory']['out'] = {'s-a': {'stock': 'Out of stock'}}
        data['inventory']['unchecked'] = {'s-a': {'stock': 'Unknown'}}
        data['inventory'][MED]['s-f']['stock'] = ' unknown '
        data['inventory'][MED]['not-a-store'] = {'stock': 'In stock'}
        original = copy.deepcopy(data)
        with mock.patch.object(serve, 'load_data', return_value=data):
            status, body, _ = self.request('/api/medications')
            self.assertEqual(status, 200)
            counts = {item['id']: item['store_count'] for item in json.loads(body)['medications']}
            self.assertEqual(counts, {MED: 6, 'plain': 1, 'out': 0})
            status, body, _ = self.request('/api/medications?q=ibuprofen')
            self.assertEqual(status, 200)
            self.assertEqual([(item['id'], item['store_count']) for item in json.loads(body)['medications']], [(MED, 6)])
            for query in ('ibuprofen 200mg', 'ibuprofen 200 mg'):
                status, body, _ = self.request('/api/medications?q=' + query.replace(' ', '%20'))
                self.assertEqual([item['id'] for item in json.loads(body)['medications']], [MED], query)
        self.assertEqual(data, original)

    def test_unknown_api(self):
        status, body, response = self.request('/api/nope')
        self.assertEqual((status, json.loads(body)), (404, {'error': 'Unknown API endpoint.'}))
        self.assertEqual(response.getheader('Cache-Control'), 'no-store')


if __name__ == '__main__':
    unittest.main()


class PrivacyLoggingTests(unittest.TestCase):
    def test_request_log_excludes_query_and_visitor_data(self):
        handler = mock.Mock()
        handler.command = 'GET'
        handler.path = '/api/pharmacies?origin=40.7,-74.0&medication=private-product'
        stream = io.StringIO()
        with mock.patch('sys.stderr', stream):
            serve.Handler.log_request(handler, 200)
        line = stream.getvalue()
        self.assertIn('path=/api/pharmacies status=200', line)
        for private in ['origin=', '40.7', 'private-product', 'medication=']:
            self.assertNotIn(private, line)
