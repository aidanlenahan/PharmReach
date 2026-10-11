#!/usr/bin/env python3
"""PharmReach pharmacy snapshot API and static frontend server."""
import argparse
import json
import math
import re
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit, unquote
from routing import fetch_opentripplanner_routes, fetch_routes, route_priority, unrouted_route, RoutingError, RoutingUnavailable
import routing
import chat
from njt.status import transit_data_status

ROOT = Path(__file__).resolve().parent
DATA_ROOT = ROOT / 'data'
FRONTEND_ROOT = ROOT.parent / 'frontend' / 'dist'
# Pages are built as <name>.html but published without the extension.
CLEAN_PAGES = frozenset({'find-medicine', 'results', 'settings', 'privacy', 'onboarding', 'products'})
SORT_OPTIONS = ('Best match', 'Soonest arrival', 'Travel time', 'Medication cost', 'Travel cost', 'Total cost', 'Pharmacy', 'Availability')
MODES = ('walk', 'transit', 'drive', 'bike')
DEFAULT_ORIGIN = '40.744,-74.0324'
# Regular gas, roughly the NJ average. Prices a drive when the user sets their MPG.
GAS_PRICE_PER_GALLON = 3.10


def load_data():
    # Read source snapshots on each request so independent chain updates need no restart.
    data = json.loads((DATA_ROOT / 'cvs-data.json').read_text())
    walgreens = json.loads((DATA_ROOT / 'walgreens-data.json').read_text())
    data['pharmacies'].extend(walgreens.get('pharmacies', []))
    for medication_id, stores in walgreens.get('inventory', {}).items():
        data['inventory'].setdefault(medication_id, {}).update(stores)
    source_info = data.setdefault('source_info', {})
    source_info['merchant'] = 'CVS + Walgreens'
    source_info['merchants'] = ['CVS', 'Walgreens']
    source_info['walgreens_checked_on'] = walgreens.get('source_info', {}).get('checked_on')
    source_info['walgreens_inventory_note'] = walgreens.get('source_info', {}).get('inventory_note')
    source_info['walgreens_price_note'] = walgreens.get('source_info', {}).get('price_note')
    return data


def has_confirmed_inventory(medication_id, data):
    """Whether at least one chain has a checked status for this product."""
    return any(
        str(item.get('stock', 'Unknown')).strip().casefold() != 'unknown'
        for item in data.get('inventory', {}).get(medication_id, {}).values()
    )


def checked_pharmacies(data, medication_id):
    """Stores with a checked (not Unknown) stock status for this product."""
    return [
        pharmacy for pharmacy in data['pharmacies']
        if (item := data['inventory'].get(medication_id, {}).get(pharmacy['id']))
        and str(item.get('stock', 'Unknown')).strip().casefold() != 'unknown'
    ]


def _address_tokens(value):
    # The street portion is before the first comma or middle dot. Ignore city/ZIP suffixes.
    text = re.split(r'[,·]', value, maxsplit=1)[0].casefold().replace('street', 'st').replace('avenue', 'ave').replace('boulevard', 'blvd').replace('road', 'rd')
    raw_tokens = re.findall(r'[a-z0-9]+', text)
    unit = next((i for i, token in enumerate(raw_tokens) if token in ('apt', 'apartment', 'unit', 'suite', 'ste', 'floor', 'fl')), len(raw_tokens))
    tokens = raw_tokens[:unit]
    return tokens


def geocode_local_address(query):
    """Find an address in the bundled OSM index or a verified CVS branch; no geocoder call."""
    query = (query or '').strip()
    if not query or len(query) > 256:
        return []
    index_path = DATA_ROOT / 'address-index.json'
    if not index_path.is_file():
        return []
    index = json.loads(index_path.read_text())
    indexed_addresses = index.get('addresses', []) + index.get('aliases', [])
    known_addresses = {' '.join(_address_tokens(item.get('address', ''))) for item in indexed_addresses}
    for pharmacy in load_data().get('pharmacies', []):
        street_address = (pharmacy.get('address') or '').split(' · ')[0]
        tokens = _address_tokens(street_address)
        if len(tokens) < 2:
            continue
        label = f"{street_address}, {pharmacy.get('city', 'Hoboken')}, {pharmacy.get('state', 'NJ')}"
        normalized_label = ' '.join(_address_tokens(label))
        if normalized_label not in known_addresses:
            index.setdefault('addresses', []).append({
                'address': label,
                'house_number': tokens[0],
                'street': ' '.join(tokens[1:]),
                'latitude': pharmacy['latitude'],
                'longitude': pharmacy['longitude'],
            })
            known_addresses.add(normalized_label)
    indexed_addresses = index.get('addresses', []) + index.get('aliases', [])
    query_tokens = _address_tokens(query)
    if not query_tokens:
        return []
    normalized_query = ' '.join(query_tokens)
    has_number = bool(re.fullmatch(r'\d+(?:-\d+)?[a-z]?', query_tokens[0]))
    if not has_number:
        return []
    matches = []
    for item in indexed_addresses:
        address_tokens = _address_tokens(f"{item['house_number']} {item['street']}")
        normalized_address = ' '.join(address_tokens)
        if has_number:
            if not address_tokens or address_tokens[0] != query_tokens[0]:
                continue
            street_query = query_tokens[1:]
            if not street_query:
                score = 1
            elif normalized_address == normalized_query:
                score = 0
            elif address_tokens[1:1 + len(street_query)] == street_query or (street_query and address_tokens[1].startswith(street_query[0]) and address_tokens[2:2 + len(street_query[1:])] == street_query[1:]):
                score = 1
            else:
                continue
        else:
            if normalized_address == normalized_query:
                score = 0
            elif normalized_address.startswith(normalized_query + ' '):
                score = 1
            elif normalized_query in normalized_address:
                score = 2
            else:
                continue
        matches.append((score, item['address'].casefold(), item))
    matches.sort(key=lambda result: (result[0], result[1]))
    if not matches and has_number and len(query_tokens) > 1:
        requested_number = re.match(r'\d+', query_tokens[0])
        street_query = query_tokens[1:]
        same_street = []
        for item in indexed_addresses:
            street_tokens = _address_tokens(item['street'])
            if street_tokens[:len(street_query)] != street_query and not (street_query and street_tokens[0].startswith(street_query[0]) and street_tokens[1:len(street_query)] == street_query[1:]):
                continue
            number_match = re.match(r'\d+', item['house_number'])
            if number_match:
                same_street.append((int(number_match.group()), item))
        if requested_number and same_street:
            target = int(requested_number.group())
            lower = [entry for entry in same_street if entry[0] < target]
            upper = [entry for entry in same_street if entry[0] > target]
            if lower and upper:
                low_number, low = max(lower, key=lambda entry: entry[0])
                high_number, high = min(upper, key=lambda entry: entry[0])
                if high_number - low_number <= 200:
                    ratio = (target - low_number) / (high_number - low_number)
                    latitude = low['latitude'] + (high['latitude'] - low['latitude']) * ratio
                    longitude = low['longitude'] + (high['longitude'] - low['longitude']) * ratio
                    return [{
                        'address': f"{low['street']}, Hoboken, NJ",
                        'latitude': round(latitude, 7),
                        'longitude': round(longitude, 7),
                        'approximate': True,
                    }]
    return [{
        'address': item['address'],
        'latitude': item['latitude'],
        'longitude': item['longitude'],
        'approximate': False,
    } for _, _, item in matches[:8]]


def same_location(origin, pharmacy, tolerance_meters=12):
    match = re.fullmatch(r'\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*', origin or '')
    if not match:
        return False
    latitude, longitude = map(float, match.groups())
    north_meters = (latitude - pharmacy['latitude']) * 111_320
    east_meters = (longitude - pharmacy['longitude']) * 111_320 * math.cos(math.radians(pharmacy['latitude']))
    return math.hypot(north_meters, east_meters) <= tolerance_meters


def build_routes(pharmacy, item):
    price = item['price']
    stock_status = item.get('stock', 'Unknown')
    stocked = stock_status == 'In stock'
    routes = {}
    for mode in MODES:
        # Newer store records carry no mock travel estimates; leave those
        # unavailable until OTP routes them rather than inventing numbers.
        if pharmacy.get(mode) is None or (mode == 'transit' and pharmacy.get('depart') is None):
            routes[mode] = unrouted_route('no_estimate')['methods'][mode]
            continue
        available = stocked
        # CVS inventory pages do not provide a transit fare. Leave it unknown until OTP does.
        cost = None if mode == 'transit' else pharmacy.get('driveCost') if mode == 'drive' else 0.0
        duration = pharmacy[mode]
        wait = pharmacy['depart'] if mode == 'transit' else 0
        if mode == 'transit':
            steps = [
                {'title': 'Walk to the nearest stop', 'detail': '4 minutes to George St & Albany St.'},
                {'title': 'Take the local bus', 'detail': f"Next departure in {wait} minutes. Ride about {max(1, duration - 8)} minutes."},
                {'title': f"Walk to {pharmacy['name']}", 'detail': f"4-minute walk from the stop to {pharmacy['address']}."},
            ]
        else:
            action = {'walk': 'Walk', 'drive': 'Drive', 'bike': 'Cycle'}[mode]
            steps = [
                {'title': f'{action} from your starting location', 'detail': f"Trip of {pharmacy['distance']} miles, about {duration} minutes."},
                {'title': f"Arrive at {pharmacy['name']}", 'detail': pharmacy['address']},
            ]
        routes[mode] = {
            'available': available,
            'duration_minutes': duration,
            'depart_in_minutes': wait,
            'arrival_in_minutes': duration + wait,
            'travel_cost': cost,
            'total_cost': round(price + cost, 2) if cost is not None else None,
            'steps': steps,
        }
    return routes


def get_pharmacies(data, medication_id, mode='transit', sort='Best match', direction='asc', origin='', routing_url=None, transit_types=None, variant_id='', otp_url=None, transit_fare=None, leave_at=None, mpg=None):
    origin_is_default = not origin
    origin = origin or DEFAULT_ORIGIN
    medication_record = next((m for m in data['medications'] if m['id'] == medication_id), None)
    if medication_record is None:
        raise ValueError('Unknown medication. Choose a medication from the search suggestions.')
    variants = medication_record.get('variants') or [{'id': medication_record['id'], 'strength': medication_record['strength'], 'form': '', 'quantity': medication_record['quantity'], 'price_multiplier': 1}]
    selected_variant = next((v for v in variants if v['id'] == variant_id), variants[0])
    medication = {**medication_record,
        'strength': ' '.join(part for part in (selected_variant['strength'], selected_variant['form']) if part),
        'quantity': selected_variant['quantity'],
        'quantity_label': selected_variant.get('quantity_label', medication_record.get('quantity_label', f"{selected_variant['quantity']} count")),
        'selected_variant_id': selected_variant['id'],
        'variants': [{'id': v['id'], 'strength': v['strength'], 'form': v.get('form', ''), 'quantity': v['quantity'], 'quantity_label': v.get('quantity_label', f"{v['quantity']} count")} for v in variants]}
    if mode not in MODES:
        raise ValueError('Unknown comparison mode.')
    if sort == 'Travel / shipping cost':
        sort = 'Travel cost'
    if sort not in SORT_OPTIONS:
        raise ValueError('Unknown sort option.')
    if direction not in ('asc', 'desc'):
        raise ValueError('Unknown sort direction.')
    records = []
    # Keep the source snapshots intact for later review, but don't show stores
    # whose only data for this product is an unverified Unknown status.
    visible_pharmacies = checked_pharmacies(data, medication_id)
    # Nearest-first: only the nearest ROUTE_STORE_LIMIT stores go to OTP; every
    # visible store is still returned. A non-coordinate origin has no straight
    # line (OTP mode then raises RoutingError from fetch, as before).
    try:
        to_route, beyond_limit, straight_line = route_priority(origin, visible_pharmacies)
    except RoutingError:
        to_route, beyond_limit, straight_line = visible_pharmacies, [], {}
    for number, pharmacy in enumerate(visible_pharmacies, 1):
        base_item = data['inventory'][medication_id][pharmacy['id']]
        item = {**base_item,
            'price': round(base_item['price'] * selected_variant.get('price_multiplier', 1), 2)}
        miles = straight_line.get(pharmacy['id'])
        records.append({**pharmacy, **item, 'map_number': number, 'straight_line_miles': round(miles, 2) if miles is not None else None, 'methods': build_routes(pharmacy, item)})

    routing_source = 'mock'
    unrouted = 0
    beyond_limit_count = 0
    if (otp_url or routing_url) and origin:
        if otp_url:
            try:
                routing_result = fetch_opentripplanner_routes(otp_url, origin, to_route, transit_types, transit_fare, leave_at)
            except RoutingUnavailable as error:
                # OTP is down or loading: keep the real price and stock rows with
                # routes marked unavailable. Never substitute mock travel estimates.
                print(f'Routing unavailable, serving stock and prices only: {error}', flush=True)
                routing_result = {'routes': {pharmacy['id']: unrouted_route() for pharmacy in to_route}, 'partial': True, 'cached': False, 'unrouted': len(to_route)}
            # Farther stores were never sent to OTP: no times or costs, and not cached.
            for pharmacy in beyond_limit:
                routing_result['routes'][pharmacy['id']] = unrouted_route('beyond_route_limit')
            beyond_limit_count = len(beyond_limit)
            provider = 'otp'
        else:
            routing_result = fetch_routes(routing_url, origin, visible_pharmacies, transit_types)
            provider = routing_result.get('provider', 'custom')
        routed = routing_result['routes']
        routing_source = ('cached_' if routing_result['cached'] else '') + (provider if provider == 'otp' else 'partial' if routing_result['partial'] else 'live')
        unrouted = routing_result.get('unrouted', 0)
        for record in records:
            if same_location(origin, record):
                record['distance'] = 0
                is_stocked = record['stock'] == 'In stock'
                for method in ('walk', 'transit', 'drive', 'bike'):
                    record['methods'][method] = {
                        **record['methods'][method],
                        'available': is_stocked,
                        'duration_minutes': 0,
                        'depart_in_minutes': 0,
                        'arrival_in_minutes': 0,
                        'travel_cost': 0,
                        'total_cost': record['price'] if is_stocked else None,
                        'walking_minutes': 0,
                        'walking_miles': 0,
                        'at_destination': True,
                        'steps': [{'title': 'You are here', 'detail': 'This address matches your starting point.'}],
                    }
                continue
            routed_record = routed[record['id']]
            distance = routed_record['distance_miles']
            record['distance'] = round(distance, 2) if distance is not None else None
            for method, route in routed_record['methods'].items():
                route = dict(route)
                route['available'] = route['available'] and record['stock'] == 'In stock'
                if route['available']:
                    if route.get('arrival_in_minutes') is None:
                        route['arrival_in_minutes'] = route['duration_minutes'] + route['depart_in_minutes']
                    route['total_cost'] = round(record['price'] + route['travel_cost'], 2) if route.get('travel_cost') is not None else None
                record['methods'][method] = route

    if mpg:
        for record in records:
            route = record['methods']['drive']
            miles = route.get('distance_miles', record.get('distance'))
            if route.get('at_destination') or miles is None:
                continue
            route['travel_cost'] = round(miles / mpg * GAS_PRICE_PER_GALLON, 2)
            route['travel_cost_type'] = 'mpg'
            if route.get('available'):
                route['total_cost'] = round(record['price'] + route['travel_cost'], 2)

    def rank(record):
        route = record['methods'][mode]
        if sort == 'Pharmacy':
            score = record['name'].casefold()
        elif sort == 'Availability':
            score = {'In stock': 0, 'Limited stock': 1, 'Unknown': 2, 'Out of stock': 3}[record['stock']]
        elif sort == 'Medication cost':
            score = record['price']
        elif sort == 'Travel cost':
            score = route.get('travel_cost') if route.get('travel_cost') is not None else float('inf')
        elif sort == 'Total cost':
            score = route.get('total_cost') if route.get('total_cost') is not None else float('inf')
        elif sort == 'Travel time':
            score = route.get('duration_minutes', float('inf'))
        elif sort == 'Soonest arrival':
            score = route.get('arrival_in_minutes', float('inf'))
        else:
            score = record['price'] * .5 + route.get('arrival_in_minutes', float('inf')) * .32 + (8 if record['stock'] == 'Limited stock' else 0)
        return (score, record['name'].casefold())

    records.sort(key=rank, reverse=direction == 'desc')
    # Keep unfillable results last in either direction.
    records.sort(key=lambda record: not record['methods'][mode]['available'])
    return {'mock': True, 'source_info': data.get('source_info', {}), 'routing_source': routing_source, 'scheduling_supported': bool(otp_url and origin and Handler.otp_transit_supported), 'origin': origin, 'origin_is_default': origin_is_default, 'medication': medication, 'compare_mode': mode, 'sort': sort, 'direction': direction, 'leave_at': leave_at, 'unrouted_count': unrouted, 'beyond_limit_count': beyond_limit_count, 'pharmacies': records}


def parse_leave_at(value):
    """Validate an optional timezone-aware leave-at timestamp for OTP."""
    if not value:
        return None
    try:
        departure = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (TypeError, ValueError) as error:
        raise ValueError('Choose a valid departure date and time.') from error
    if departure.tzinfo is None or departure.utcoffset() is None:
        raise ValueError('Departure time must include a timezone.')
    now = datetime.now(timezone.utc)
    departure = departure.astimezone(timezone.utc)
    if departure < now - timedelta(minutes=1):
        raise ValueError('Choose a departure time that has not passed.')
    if departure > now + timedelta(days=30):
        raise ValueError('Choose a departure time within the next 30 days.')
    return departure.isoformat(timespec='seconds').replace('+00:00', 'Z')


def parse_mpg(value):
    """The user's gas mileage from ?mpg=, or None to keep the default driving estimate."""
    if not value:
        return None
    try:
        mpg = float(value)
    except ValueError:
        raise ValueError('Enter gas mileage as a number of miles per gallon.') from None
    if not (1 <= mpg <= 200):
        raise ValueError('Enter gas mileage between 1 and 200 MPG.')
    return mpg


class Handler(SimpleHTTPRequestHandler):
    routing_url = None
    otp_url = None
    otp_transit_supported = False
    transit_fare = None
    def send_json(self, body, status=200):
        payload = json.dumps(body).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(payload)

    def send_response_only(self, code, message=None):
        self.response_status = code
        super().send_response_only(code, message)

    def cache_control(self):
        path = urlsplit(self.path).path
        # API answers, HTML pages, redirects and errors must always be fresh.
        if getattr(self, 'response_status', 200) not in (200, 304) or path.startswith('/api/'):
            return 'no-store'
        suffix = Path(path).suffix.casefold()
        if not suffix or suffix == '.html':
            return 'no-store'
        # Vite puts content-hashed bundles in /assets/; a new build gets new names.
        if path.startswith('/assets/'):
            return 'public, max-age=31536000, immutable'
        # Unhashed images and fonts change rarely; other files (error.css) briefly.
        if suffix in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.woff', '.woff2'):
            return 'public, max-age=86400'
        return 'public, max-age=300'

    def log_request(self, code='-', size='-'):
        # Query strings can include starting coordinates and medication choices.
        # Log only the method, endpoint and status, without visitor identifiers.
        print(f'http method={self.command} path={urlsplit(self.path).path} status={code}', file=sys.stderr, flush=True)

    def end_headers(self):
        self.send_header('Cache-Control', self.cache_control())
        super().end_headers()

    def list_directory(self, path):
        self.send_error(403, 'Directory listing is unavailable.')
        return None

    def forbidden_path(self):
        path = unquote(urlsplit(self.path).path).replace('\\', '/')
        parts = [part.casefold() for part in path.split('/') if part]
        private = {'backend', 'frontend', 'src', 'data', 'scripts', 'infra', 'otp',
                   'node_modules', 'docs', 'app', 'lib', 'components', 'admin',
                   'serve.py', 'routing.py', 'package.json', 'package-lock.json',
                   'pnpm-lock.yaml', 'cvs-data.json', 'walgreens-data.json',
                   'walgreens-new-products.json', 'address-index.json'}
        return any(part.startswith('.') or part in private for part in parts) or path.casefold().endswith(('.py', '.pyc', '.pem', '.key', '.map'))

    def clean_url_route(self):
        """Returns ('redirect', location) for /<page>.html, ('serve', file path) for /<page>, else None."""
        request = urlsplit(self.path)
        query = f'?{request.query}' if request.query else ''
        if request.path == '/index.html':
            return 'redirect', '/' + query
        name = request.path.removeprefix('/').removesuffix('.html')
        if name in CLEAN_PAGES:
            if request.path.endswith('.html'):
                return 'redirect', f'/{name}{query}'
            return 'serve', f'/{name}.html{query}'
        return None

    def send_head(self):
        if self.forbidden_path():
            self.send_error(403)
            return None
        route = self.clean_url_route()
        if route and route[0] == 'redirect':
            self.send_response(301)
            self.send_header('Location', route[1])
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        if route:
            self.path = route[1]
        root = Path(self.directory).resolve()
        target = Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(root):
            self.send_error(403)
            return None
        return super().send_head()

    def send_error(self, code, message=None, explain=None):
        if code in (403, 404):
            try:
                payload = (Path(self.directory) / f'{code}.html').read_bytes()
            except OSError:
                return super().send_error(code, message, explain)
            self.send_response(code)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(payload)
            return
        return super().send_error(code, message, explain)

    def redirect_legacy_hostname(self):
        if self.headers.get('Host', '').split(':', 1)[0].lower() != 'hackru.alenahan.net':
            return False
        request = urlsplit(self.path)
        destination = 'https://pharmreach.tech' + (request.path or '/')
        if request.query:
            destination += '?' + request.query
        self.send_response(301)
        self.send_header('Location', destination)
        self.send_header('Content-Length', '0')
        self.end_headers()
        return True

    def do_HEAD(self):
        if urlsplit(self.path).path.startswith('/api/'):
            return self.do_GET()
        if not self.redirect_legacy_hostname():
            super().do_HEAD()

    def do_POST(self):
        if self.forbidden_path() or urlsplit(self.path).path != '/api/chat':
            return self.send_json({'error': 'Unknown API endpoint.'}, 404)
        # Gemini medication helper; validation, screening and templates live in chat.py.
        status, body = chat.handle_http(self.headers, self.rfile, self.client_address[0], load_data)
        return self.send_json(body, status)

    def do_GET(self):
        if self.redirect_legacy_hostname():
            return
        if self.forbidden_path():
            return self.send_error(403)
        request = urlsplit(self.path)
        if not request.path.startswith('/api/'):
            return super().do_GET()
        query = parse_qs(request.query)
        def param(name, default=''):
            return query.get(name, [default])[0]
        try:
            if request.path == '/api/health':
                return self.send_json({'ok': True, 'mock': True, 'data_source': 'CVS + Walgreens snapshots', 'region': 'NJ', 'chat_configured': chat.is_configured(), 'transit_data': transit_data_status()})
            if request.path == '/api/geocode':
                return self.send_json({'source': 'local OpenStreetMap address index', 'matches': geocode_local_address(param('q'))})
            data = load_data()
            if request.path == '/api/catalog-summary':
                medications = [m for m in data['medications'] if has_confirmed_inventory(m['id'], data)]
                checked_stores = {
                    store_id for medication in medications
                    for store_id, item in data['inventory'].get(medication['id'], {}).items()
                    if item.get('stock', 'Unknown') != 'Unknown'
                }
                pharmacies = [p for p in data['pharmacies'] if p['id'] in checked_stores]
                return self.send_json({
                    'product_count': len(medications),
                    'store_count': len(pharmacies),
                    'cities': sorted({p['city'] for p in pharmacies if p.get('city')}),
                })
            if request.path == '/api/medications':
                query_terms = re.findall(r'[a-z0-9]+', param('q').casefold())
                def searchable_text(medication):
                    fields = [medication.get('name', ''), medication.get('strength', ''), medication.get('aka', '')]
                    fields.extend(medication.get('search_terms', []))
                    text = ' '.join(re.findall(r'[a-z0-9]+', ' '.join(fields).casefold()))
                    # "81mg" should find "81 mg" (the search box shows doses without the space).
                    return text + ' ' + re.sub(r'(\d) (mg|mcg|g|ml|iu)\b', r'\1\2', text)
                matches = [
                    {**m, 'store_count': sum(
                        str(data['inventory'][m['id']][pharmacy['id']].get('stock', '')).strip().casefold()
                        in ('in stock', 'limited stock')
                        for pharmacy in checked_pharmacies(data, m['id'])
                    )}
                    for m in data['medications']
                    if has_confirmed_inventory(m['id'], data)
                    and (not query_terms or all(term in searchable_text(m) for term in query_terms))
                ]
                return self.send_json({'mock': True, 'source_info': data.get('source_info', {}), 'medications': matches})
            if request.path == '/api/pharmacies':
                return self.send_json({**get_pharmacies(data, param('medication'), param('mode', 'transit'), param('sort', 'Best match'), param('direction', 'asc'), param('origin')[:512], self.routing_url, [t for t in param('transit_types').split(',') if t in ('bus', 'subway', 'commuter', 'ferry')], param('variant'), self.otp_url, self.transit_fare, parse_leave_at(param('leave_at')), parse_mpg(param('mpg'))), 'transit_data': transit_data_status()})
            return self.send_json({'error': 'Unknown API endpoint.'}, 404)
        except RoutingError as error:
            return self.send_json({'error': str(error)}, 502)
        except ValueError as error:
            return self.send_json({'error': str(error)}, 400)
        except (OSError, KeyError, TypeError) as error:
            self.log_error('Pharmacy snapshot error: %s', error)
            return self.send_json({'error': 'Could not load the pharmacy snapshots. Check cvs-data.json and walgreens-data.json on the server.'}, 500)


# The results page sends transit_types only after onboarding enables transit,
# and then (by default) all four types. No types means street routes only.
WARMUP_TRANSIT_TYPES = (['bus', 'subway', 'commuter', 'ferry'], [])
WARMUP_READY_TIMEOUT_SECONDS = 600


def warmup_stores(data, origin=DEFAULT_ORIGIN):
    """Stores a default-origin search would send to OTP, nearest first.

    Uses the same route_priority() selection as get_pharmacies(), per
    medication, so warmed cache keys are exactly the ones real searches use.
    Returns (medication ids, stores to warm, number of distinct visible stores).
    """
    medications = [m['id'] for m in data['medications'] if has_confirmed_inventory(m['id'], data)]
    selected = {}
    visible = set()
    for medication_id in medications:
        pharmacies = checked_pharmacies(data, medication_id)
        visible.update(pharmacy['id'] for pharmacy in pharmacies)
        to_route, _, miles = route_priority(origin, pharmacies)
        for pharmacy in to_route:
            selected.setdefault(pharmacy['id'], (miles[pharmacy['id']], pharmacy))
    stores = [pharmacy for _, pharmacy in sorted(selected.values(), key=lambda pair: (pair[0], pair[1]['id']))]
    return medications, stores, len(visible)


def warm_route_cache(otp_url, transit_fare, interval):
    """Pre-route the default origin so the first demo searches hit the OTP route cache.

    Runs in a daemon thread: waits for OTP to load, routes each store one at a
    time (OTP cache entries are per store), then replays every medication
    through get_pharmacies() to confirm real search keys hit. Only the stores a
    default search would route (the nearest ROUTE_STORE_LIMIT per medication)
    are warmed. Re-warms every `interval` seconds (0 = once); only expired or
    departed stores are re-routed.
    """
    def medications_and_stores():
        data = load_data()
        medications, stores, visible_count = warmup_stores(data)
        return data, medications, stores, visible_count

    def warm_once():
        data, medications, stores, visible_count = medications_and_stores()
        started = time.monotonic()
        routed = errors = checked = misses = consecutive_errors = 0
        for transit_types in WARMUP_TRANSIT_TYPES:
            for pharmacy in stores:
                if consecutive_errors >= 3:
                    break
                try:
                    result = fetch_opentripplanner_routes(otp_url, DEFAULT_ORIGIN, [pharmacy], list(transit_types), transit_fare)
                    routed += not result['cached']
                    consecutive_errors = 0
                except RoutingError:
                    errors += 1
                    consecutive_errors += 1
        if consecutive_errors < 3:
            # Same calls as /api/pharmacies with no origin; each should be a cache hit.
            for transit_types in WARMUP_TRANSIT_TYPES:
                for medication_id in medications:
                    try:
                        result = get_pharmacies(data, medication_id, otp_url=otp_url, transit_types=list(transit_types), transit_fare=transit_fare)
                        checked += 1
                        misses += not result['routing_source'].startswith('cached_')
                    except RoutingError:
                        errors += 1
        aborted = ' (stopped after 3 OTP errors in a row)' if consecutive_errors >= 3 else ''
        print(f'Route warm-up: {len(stores)} of {visible_count} stores (nearest {routing.ROUTE_STORE_LIMIT} per search) x {len(WARMUP_TRANSIT_TYPES)} transit settings, {routed} routed, '
              f'{checked} searches checked ({misses} misses), {errors} errors, {time.monotonic() - started:.1f}s{aborted}', flush=True)

    def wait_for_otp():
        deadline = time.monotonic() + WARMUP_READY_TIMEOUT_SECONDS
        delay = 5
        while True:
            try:
                _, _, stores, _ = medications_and_stores()
                if stores:
                    fetch_opentripplanner_routes(otp_url, DEFAULT_ORIGIN, stores[:1], [], transit_fare)
                return True
            except RoutingError:
                if time.monotonic() + delay > deadline:
                    return False
                time.sleep(delay)
                delay = min(delay * 2, 60)

    try:
        ready = wait_for_otp()
    except Exception as error:  # Never let warm-up take the server down.
        ready = False
        print(f'Route warm-up error: {error!r}', flush=True)
    if ready:
        print('Route warm-up: OpenTripPlanner is ready.', flush=True)
    elif interval:
        print(f'Route warm-up: OpenTripPlanner not ready after {WARMUP_READY_TIMEOUT_SECONDS}s; retrying every {interval}s.', flush=True)
    else:
        print(f'Route warm-up skipped: OpenTripPlanner not ready after {WARMUP_READY_TIMEOUT_SECONDS}s.', flush=True)
    while ready or interval:
        if ready:
            try:
                warm_once()
            except Exception as error:
                print(f'Route warm-up error: {error!r}', flush=True)
        if not interval:
            return
        ready = True
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--routing-url', help='Optional HTTP(S) service URL accepting the route batch contract in README.md')
    parser.add_argument('--otp-url', help='Optional trusted OpenTripPlanner 2 GTFS GraphQL endpoint, e.g. http://127.0.0.1:8080/otp/gtfs/v1')
    parser.add_argument('--transit-fare', type=float, help='Optional flat transit-fare override in dollars; otherwise use OTP feed fare when available')
    parser.add_argument('--otp-transit', action='store_true', help='Enable schedule controls when the loaded OTP graph includes transit feeds')
    parser.add_argument('--no-warmup', action='store_true', help='With --otp-url, skip pre-routing the default origin at startup')
    parser.add_argument('--warmup-interval', type=int, default=300, help='Seconds between route cache re-warms with --otp-url (0 = warm once; default 300)')
    args = parser.parse_args()
    if args.routing_url and args.otp_url:
        parser.error('Choose either --routing-url or --otp-url')
    for option, value in (('--routing-url', args.routing_url), ('--otp-url', args.otp_url)):
        if value and urlsplit(value).scheme not in ('http', 'https'):
            parser.error(f'{option} must be an HTTP(S) URL')
    if args.transit_fare is not None and not (0 <= args.transit_fare <= 100):
        parser.error('--transit-fare must be between 0 and 100 dollars')
    if args.warmup_interval < 0:
        parser.error('--warmup-interval must be 0 or more seconds')
    Handler.routing_url = args.routing_url
    Handler.otp_url = args.otp_url
    Handler.otp_transit_supported = args.otp_transit
    Handler.transit_fare = args.transit_fare
    # The React source is compiled by Vite. Python serves the built app and API.
    frontend_root = FRONTEND_ROOT
    if not (frontend_root / 'index.html').is_file():
        parser.error('Frontend build missing: run cd frontend && corepack pnpm install && corepack pnpm build')
    handler = partial(Handler, directory=str(frontend_root))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print(f'PharmReach demo: http://127.0.0.1:{args.port}', flush=True)
        print('Pharmacy snapshot API (CVS + Walgreens): /api/medications and /api/pharmacies', flush=True)
        if not (frontend_root / 'index.html').is_file():
            print('Frontend build missing. Run `cd frontend && corepack pnpm install && corepack pnpm build` first.', flush=True)
        print('Press Ctrl+C to stop. Refresh after editing frontend files.', flush=True)
        if args.otp_url and not args.no_warmup:
            threading.Thread(target=warm_route_cache, args=(args.otp_url, args.transit_fare, args.warmup_interval), name='route-warmup', daemon=True).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
