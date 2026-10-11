"""Optional route service adapter. No external requests unless explicitly configured."""
import copy
import json
import os
import math
import re
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

MODES = ('walk', 'transit', 'drive', 'bike')

class RoutingError(Exception):
    pass


class RoutingUnavailable(RoutingError):
    """OTP answered no store in time (down, loading or overloaded); the inputs were fine."""

class _SizedCache(OrderedDict):
    """LRU store of (expires, value, size) entries that keeps a running byte total."""

    def __init__(self):
        super().__init__()
        self.bytes = 0

    def __setitem__(self, key, entry):
        old = self.get(key)
        if old is not None:
            self.bytes -= old[2]
        super().__setitem__(key, entry)
        self.bytes += entry[2]

    def __delitem__(self, key):
        self.bytes -= self[key][2]
        super().__delitem__(key)

    def pop(self, key, *default):
        if key in self:
            self.bytes -= self[key][2]
        return super().pop(key, *default)

    def popitem(self, last=True):
        key, entry = super().popitem(last=last)
        self.bytes -= entry[2]
        return key, entry

    def clear(self):
        super().clear()
        self.bytes = 0


_CACHE = _SizedCache()
_CACHE_LOCK = threading.Lock()
_CACHE_TTL_SECONDS = 900
_CACHE_PARTIAL_TTL_SECONDS = 120
# OTP routes are cached per (origin, pharmacy) so searches for different
# medications share the stores they have in common.
# Street-only results (no transit types allowed) depend only on the static
# street graph, so they can live for an hour.
_OTP_STREET_TTL_SECONDS = 3600
# "Leave now" transit is relative to the time of the search. A cached itinerary
# stays the best choice until its departure passes (a later search can only
# lose options), so hits shift the relative minutes and miss once the
# departure is more than the grace period in the past. The TTL caps drift from
# realtime updates and from "no route yet" answers near service changes.
_OTP_TRANSIT_TTL_SECONDS = 600
_OTP_DEPARTURE_GRACE_SECONDS = 60
# A fixed leave_at is part of the key and the minutes are relative to it, so the
# itinerary does not age. The API rejects leave_at values in the past.
_OTP_SCHEDULED_TTL_SECONDS = 1800
# The cache is bounded by an estimate of its size: each entry counts the length
# of its JSON form (geometry is already a compact polyline string), measured
# once at put time. Python's in-memory size is a few times that. Default 32 MB,
# set with ROUTE_CACHE_MB. The entry cap is only a backstop for tiny entries.
_CACHE_MAX_BYTES = max(1, int(float(os.environ.get('ROUTE_CACHE_MB', '32')) * 1024 * 1024))
_CACHE_MAX_ENTRIES = 20_000
# OTP shares the VM's 3 CPUs. Requests queue here, not inside OTP, so a burst
# of searches can't pile up work that nobody is still waiting for.
_OTP_MAX_CONCURRENT = max(1, int(os.environ.get('OTP_MAX_CONCURRENT', '3')))
_OTP_SLOTS = threading.BoundedSemaphore(_OTP_MAX_CONCURRENT)
# One search waits this long in total; stores still unrouted are reported, not guessed.
_OTP_SEARCH_BUDGET_SECONDS = 12
# Each search sends only this many stores to OTP, nearest to the origin first
# (straight-line). Farther stores are still returned with price and stock,
# marked beyond_route_limit, so the list scales to thousands of stores.
ROUTE_STORE_LIMIT = max(1, int(os.environ.get('ROUTE_STORE_LIMIT', '25')))
# Origins are rounded to 4 decimals (about 11 m) for both the cache key and the
# OTP query, so a cache hit is exactly the route that was computed.
_ORIGIN_DECIMALS = 4


def _cache_key(service_url, payload):
    return service_url + '\n' + json.dumps(payload, sort_keys=True, separators=(',', ':'))


def _cache_get(key):
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached is None:
            return None
        expires, value, _ = cached
        if expires <= now:
            del _CACHE[key]
            return None
        _CACHE.move_to_end(key)
    # A copy, so callers that change route dicts can't corrupt the cache.
    value = copy.deepcopy(value)
    value['cached'] = True
    return value


def _otp_cache_get(key, leave_now):
    """Return a cached per-pharmacy OTP route, re-timed for "leave now" searches."""
    cached = _cache_get(key)
    if cached is None:
        return None
    route = cached['route']
    if not leave_now:
        return route
    transit = route['methods'].get('transit') or {}
    if not transit.get('available'):
        return route
    elapsed = time.time() - cached['computed_at']
    depart = transit.get('depart_in_minutes') or 0
    if elapsed > depart * 60 + _OTP_DEPARTURE_GRACE_SECONDS:
        # The cached departure has passed; never show an itinerary the user missed.
        with _CACHE_LOCK:
            _CACHE.pop(key, None)
        return None
    elapsed_minutes = elapsed / 60
    shifted = {**transit, 'depart_in_minutes': max(0, round(depart - elapsed_minutes))}
    if transit.get('arrival_in_minutes') is not None:
        shifted['arrival_in_minutes'] = max(0, round(transit['arrival_in_minutes'] - elapsed_minutes))
    return {**route, 'methods': {**route['methods'], 'transit': shifted}}


def _cache_put(key, value, ttl=None):
    if ttl is None:
        ttl = _CACHE_PARTIAL_TTL_SECONDS if value['partial'] else _CACHE_TTL_SECONDS
    size = len(key) + len(json.dumps(value, separators=(',', ':'), default=str))
    value = copy.deepcopy(value)  # the caller keeps (and may change) its own object
    with _CACHE_LOCK:
        _CACHE[key] = (time.monotonic() + ttl, value, size)
        _CACHE.move_to_end(key)
        # Least recently used first. An entry larger than the whole budget is not kept.
        while _CACHE and (_CACHE.bytes > _CACHE_MAX_BYTES or len(_CACHE) > _CACHE_MAX_ENTRIES):
            _CACHE.popitem(last=False)


def _coordinate_origin(origin):
    match = re.fullmatch(r'\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*', origin or '')
    if not match:
        raise RoutingError('Live OpenTripPlanner routes need a latitude, longitude starting point. Use your location or enter coordinates.')
    latitude, longitude = (float(value) for value in match.groups())
    if not math.isfinite(latitude) or not math.isfinite(longitude) or abs(latitude) > 90 or abs(longitude) > 180:
        raise RoutingError('The starting coordinates are outside the valid latitude/longitude range.')
    return {'latitude': round(latitude, _ORIGIN_DECIMALS), 'longitude': round(longitude, _ORIGIN_DECIMALS)}


def haversine_miles(latitude1, longitude1, latitude2, longitude2):
    """Great-circle (straight-line) distance in miles."""
    phi1, phi2 = math.radians(latitude1), math.radians(latitude2)
    a = (math.sin((phi2 - phi1) / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(longitude2 - longitude1) / 2) ** 2)
    return 2 * 3958.8 * math.asin(min(1.0, math.sqrt(a)))


def route_priority(origin, pharmacies, limit=None):
    """Order stores nearest-first from the origin and split at the route limit.

    Returns (to_route, beyond_limit, straight_line_miles_by_id). to_route is in
    nearest-first order, so OTP plans the closest stores first. Raises
    RoutingError for an origin that is not valid coordinates.
    """
    coordinates = _coordinate_origin(origin)
    limit = ROUTE_STORE_LIMIT if limit is None else limit
    miles = {pharmacy['id']: haversine_miles(coordinates['latitude'], coordinates['longitude'], pharmacy['latitude'], pharmacy['longitude'])
             for pharmacy in pharmacies}
    ordered = sorted(pharmacies, key=lambda pharmacy: (miles[pharmacy['id']], pharmacy['id']))
    return ordered[:limit], ordered[limit:], miles


def _otp_timestamp(value):
    """Parse an OTP ISO timestamp, returning None when it is missing or invalid."""
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed if parsed.tzinfo is not None and parsed.utcoffset() is not None else None
    except ValueError:
        return None


def _leg_timestamp(leg, endpoint):
    time_data = (leg.get(endpoint) or {})
    estimated = (time_data.get('estimated') or {}).get('time')
    return _otp_timestamp(estimated) or _otp_timestamp(time_data.get('scheduledTime'))


def _encode_polyline(points):
    """Encode [longitude, latitude] points (1e-5 precision, as decoded) back to a Google polyline."""
    chunks = []
    previous_latitude = previous_longitude = 0
    for longitude, latitude in points:
        latitude, longitude = round(latitude * 1e5), round(longitude * 1e5)
        for delta in (latitude - previous_latitude, longitude - previous_longitude):
            value = ~(delta << 1) if delta < 0 else delta << 1
            while value >= 0x20:
                chunks.append(chr((0x20 | (value & 0x1f)) + 63))
                value >>= 5
            chunks.append(chr(value + 63))
        previous_latitude, previous_longitude = latitude, longitude
    return ''.join(chunks)


def _decode_polyline(encoded):
    """Decode OTP's Google-encoded route geometry into [longitude, latitude] points."""
    if not isinstance(encoded, str):
        return []
    points = []
    index = latitude = longitude = 0
    try:
        while index < len(encoded):
            values = []
            for _ in range(2):
                result = shift = 0
                while True:
                    value = ord(encoded[index]) - 63
                    index += 1
                    result |= (value & 0x1f) << shift
                    shift += 5
                    if value < 0x20:
                        break
                values.append(~(result >> 1) if result & 1 else result >> 1)
            latitude += values[0]
            longitude += values[1]
            points.append([longitude / 1e5, latitude / 1e5])
    except (IndexError, ValueError):
        return []
    return points if len(points) >= 2 else []


_OTP_QUERY = '''
query PharmReachRoutes($origin: PlanLabeledLocationInput!, $destination: PlanLabeledLocationInput!, $walkModes: PlanModesInput!, $transitModes: PlanModesInput!, $transitPreferences: PlanPreferencesInput, $driveModes: PlanModesInput!, $bikeModes: PlanModesInput!, $dateTime: PlanDateTimeInput) {
  walk: planConnection(origin: $origin, destination: $destination, modes: $walkModes, dateTime: $dateTime, first: 1) { searchDateTime routingErrors { code description } edges { node { duration walkTime walkDistance legs { mode transitLeg duration distance headsign from { name } to { name } route { shortName longName mode } legGeometry { points } steps { streetName distance absoluteDirection relativeDirection } } } } }
  transit: planConnection(origin: $origin, destination: $destination, modes: $transitModes, preferences: $transitPreferences, dateTime: $dateTime, first: 10) { searchDateTime routingErrors { code description } edges { node { duration waitingTime walkTime walkDistance legs { mode transitLeg duration distance headsign start { estimated { time } scheduledTime } end { estimated { time } scheduledTime } from { name } to { name } route { shortName longName mode } fareProducts { id product { id name ... on DefaultFareProduct { price { amount currency { code digits } } } ... on DependentFareProduct { price { amount currency { code digits } } } } } legGeometry { points } steps { streetName distance absoluteDirection relativeDirection } } } } }
  drive: planConnection(origin: $origin, destination: $destination, modes: $driveModes, dateTime: $dateTime, first: 1) { searchDateTime routingErrors { code description } edges { node { duration walkTime walkDistance legs { mode transitLeg duration distance from { name } to { name } route { shortName longName mode } legGeometry { points } steps { streetName distance absoluteDirection relativeDirection } } } } }
  bike: planConnection(origin: $origin, destination: $destination, modes: $bikeModes, dateTime: $dateTime, first: 1) { searchDateTime routingErrors { code description } edges { node { duration walkTime walkDistance legs { mode transitLeg duration distance from { name } to { name } route { shortName longName mode } legGeometry { points } steps { streetName distance absoluteDirection relativeDirection } } } } }
}
'''


def _otp_transit_modes(transit_types):
    mode_map = {
        'bus': ('BUS',),
        'subway': ('SUBWAY', 'TRAM'),
        'commuter': ('RAIL',),
        'ferry': ('FERRY',),
    }
    return list(dict.fromkeys(mode for kind in (transit_types or []) for mode in mode_map.get(kind, ())))


def _otp_itinerary_fare(legs):
    """Return a feed fare only when every transit leg has one unambiguous USD product."""
    transit_legs = [leg for leg in legs if leg.get('transitLeg') is True]
    if not transit_legs:
        return None
    prices = {}
    for leg in transit_legs:
        products = leg.get('fareProducts')
        # Multiple products can represent alternative tickets or a pass. Don't add
        # alternatives together; expose a price only when the itinerary is unambiguous.
        if not isinstance(products, list) or len(products) != 1:
            return None
        use = products[0]
        use_id = use.get('id')
        product = use.get('product') or {}
        price = product.get('price') or {}
        currency = price.get('currency') or {}
        amount = price.get('amount')
        if (not use_id or currency.get('code') != 'USD'
                or isinstance(amount, bool) or not isinstance(amount, (int, float))
                or not math.isfinite(amount) or amount < 0):
            return None
        if use_id in prices and prices[use_id] != float(amount):
            return None
        prices[use_id] = float(amount)
    return round(sum(prices.values()), 2)


def _njt_estimated_max_fare(legs):
    """Return a local fare estimate only for routes with usable fare bounds.

    The Hoboken-area buses supported here (22, 89, 126) stay within at most
    two North Jersey intrastate zones on the local itinerary. The current
    two-zone fare is $3.00 per standalone bus leg. HBLR uses its published
    $2.65 one-way fare. Do not substitute statewide maxima for unknown routes.
    """
    total = 0.0
    transit_legs = [leg for leg in legs if leg.get('transitLeg') is True]
    if not transit_legs:
        return None
    for leg in transit_legs:
        route = leg.get('route') or {}
        mode = (route.get('mode') or leg.get('mode') or '').upper()
        name = ' '.join(str(route.get(field) or '') for field in ('shortName', 'longName')).casefold()
        short_name = str(route.get('shortName') or '').strip()
        stop_names = ' '.join(str((leg.get(endpoint) or {}).get('name') or '') for endpoint in ('from', 'to')).casefold()
        if mode == 'BUS':
            if short_name in {'22', '89', '126'} and not any(token in stop_names for token in (
                'port authority', 'new york', 'nyc', ' george washington bridge',
            )):
                # Two-zone northern intrastate cap; transfer discounts are not assumed.
                total += 3.00
            else:
                return None
        elif mode in ('TRAM', 'SUBWAY') and any(line in name for line in ('hudson-bergen', 'hblr')):
            # Published HBLR one-way fare.
            total += 2.65
        else:
            # Rail station pairs, other bus zones, ferry, and unknown modes need
            # route-specific tariff information rather than a statewide maximum.
            return None
    return round(total, 2)


def _otp_query(service_url, origin, pharmacy, allowed_transit_modes, transit_fare, leave_at=None):
    transit_modes = [{'mode': mode} for mode in allowed_transit_modes]
    # OTP rejects an empty PlanTransitModesInput. Keep the query valid, then
    # route_for() filters any transit result when the user allowed no types.
    query_transit_modes = transit_modes or [{'mode': mode} for mode in ('BUS', 'SUBWAY', 'TRAM', 'RAIL', 'FERRY')]
    variables = {
        'origin': {'label': 'Starting location', 'location': {'coordinate': origin}},
        'destination': {'label': pharmacy['name'], 'location': {'coordinate': {'latitude': pharmacy['latitude'], 'longitude': pharmacy['longitude']}}},
        'walkModes': {'direct': ['WALK'], 'directOnly': True},
        'transitModes': {
            'direct': ['WALK'], 'transitOnly': True,
            'transit': {'access': ['WALK'], 'egress': ['WALK'], 'transfer': ['WALK'], 'transit': query_transit_modes},
        },
        'driveModes': {'direct': ['CAR'], 'directOnly': True},
        'bikeModes': {'direct': ['BICYCLE'], 'directOnly': True},
        'dateTime': {'earliestDeparture': leave_at} if leave_at else None,
    }
    def query(transit_reluctance=None):
        variables['transitPreferences'] = (
            {'street': {'walk': {'reluctance': transit_reluctance}}}
            if transit_reluctance is not None else None
        )
        request = Request(service_url, data=json.dumps({'query': _OTP_QUERY, 'variables': variables}).encode(), headers={'Content-Type': 'application/json', 'Accept': 'application/json'}, method='POST')
        with urlopen(request, timeout=8) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise ValueError('Response too large')
            result = json.loads(raw)
        if result.get('errors') or not isinstance(result.get('data'), dict):
            raise ValueError('OpenTripPlanner returned a GraphQL error')
        return result

    body = query()
    transit_connection = body['data'].get('transit') or {}
    transit_errors = transit_connection.get('routingErrors') or []
    transit_walk_is_faster = bool(
        transit_errors
        and isinstance(transit_errors[0], dict)
        and transit_errors[0].get('code') == 'WALKING_BETTER_THAN_TRANSIT'
    )
    transit_alternative_found = False
    if transit_walk_is_faster:
        # OTP normally removes transit when a direct walk wins. Ask once more
        # with walking weighted less favorably so a walk + transit alternative
        # can still be shown. The UI applies the user's walk time/distance cap.
        try:
            alternative = query(transit_reluctance=20.0)['data'].get('transit') or {}
            edges = alternative.get('edges') or []
            has_transit_alternative = any(
                isinstance(edge, dict)
                and isinstance(edge.get('node'), dict)
                and isinstance(edge['node'].get('legs'), list)
                and any(leg.get('transitLeg') is True for leg in edge['node']['legs'] if isinstance(leg, dict))
                for edge in edges
            )
            if not alternative.get('routingErrors') and has_transit_alternative:
                body['data']['transit'] = alternative
                transit_alternative_found = True
        except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
            # Keep the direct-walk explanation if the optional alternative is slow or unavailable.
            pass

    def plan(alias):
        connection = body['data'].get(alias)
        if not isinstance(connection, dict):
            raise ValueError('OpenTripPlanner omitted a route mode')
        routing_errors = connection.get('routingErrors') or []
        if routing_errors:
            return None, routing_errors[0].get('code') if isinstance(routing_errors[0], dict) else None
        edges = connection.get('edges')
        if not isinstance(edges, list) or not edges:
            return None, None
        candidates = []
        for edge in edges:
            node = edge.get('node') if isinstance(edge, dict) else None
            legs = node.get('legs') if isinstance(node, dict) else None
            if not isinstance(legs, list) or not legs:
                continue
            if alias == 'transit':
                transit_legs = [leg for leg in legs if isinstance(leg, dict) and leg.get('transitLeg') is True]
                used_modes = [((leg.get('route') or {}).get('mode') or leg.get('mode') or '').upper() for leg in transit_legs]
                # Respect the selected transit types while considering OTP's alternatives.
                if not transit_legs or not used_modes or not allowed_transit_modes or any(mode not in allowed_transit_modes for mode in used_modes):
                    continue
            candidates.append(node)
        if not candidates:
            return None, None
        if alias == 'transit':
            # Rank scheduled options by arrival from the requested departure time,
            # including any wait before the first leg. OTP duration omits that wait.
            search_time = _otp_timestamp(connection.get('searchDateTime'))
            def elapsed_arrival(node):
                legs = node.get('legs') or []
                arrival = _leg_timestamp(legs[-1], 'end') if legs else None
                if search_time and arrival:
                    return max(0, (arrival - search_time).total_seconds())
                value = node.get('duration')
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                    return float('inf')
                return float(value)
            node = min(candidates, key=elapsed_arrival)
        else:
            node = candidates[0]
        return (connection, node), None

    def make_steps(legs, mode):
        steps = []
        for leg in legs:
            transit = leg.get('transitLeg') is True
            route = leg.get('route') or {}
            from_name = (leg.get('from') or {}).get('name')
            to_name = (leg.get('to') or {}).get('name')
            if transit:
                route_name = route.get('shortName') or route.get('longName') or route.get('mode') or 'transit service'
                title = f"Ride {route_name}"
                detail = f"{from_name or 'Board'} to {to_name or leg.get('headsign') or 'your stop'}"
            else:
                leg_mode = leg.get('mode')
                action = {'WALK': 'Walk', 'BICYCLE': 'Cycle', 'CAR': 'Drive'}.get(leg_mode, {'walk': 'Walk', 'drive': 'Drive', 'bike': 'Cycle'}.get(mode, 'Continue'))
                title = f"{action} from {from_name}" if from_name else action
                detail = f"To {to_name}" if to_name else ''
                instruction = next((step.get('streetName') for step in (leg.get('steps') or []) if step.get('streetName')), None)
                if instruction:
                    detail = f"{detail} via {instruction}" if detail else f"Follow {instruction}"
            if detail:
                steps.append({'title': title, 'detail': detail})
        return steps or [{'title': 'Route to pharmacy', 'detail': 'Follow the mapped route to the pharmacy.'}]

    def geometry_for(legs):
        points = []
        for leg in legs:
            geometry = leg.get('legGeometry') or {}
            for point in _decode_polyline(geometry.get('points')):
                if not points or point != points[-1]:
                    points.append(point)
        # Re-encoded as one polyline: about a third of the JSON size, decoded by the results page.
        return {'type': 'LineString', 'polyline': _encode_polyline(points)} if len(points) >= 2 else None

    def route_for(alias, mode):
        result, routing_error = plan(alias)
        if result is None:
            unavailable = {'available': False}
            if mode == 'transit':
                unavailable['unavailable_reason'] = (
                    'walking_faster' if routing_error == 'WALKING_BETTER_THAN_TRANSIT' and transit_alternative_found
                    else 'walking_faster_no_alternative' if routing_error == 'WALKING_BETTER_THAN_TRANSIT'
                    else 'no_transit_route'
                )
            return unavailable
        connection, node = result
        legs = node['legs']
        duration = max(0, round(float(node['duration']) / 60))
        walking_minutes = max(0, round(float(node.get('walkTime') or 0) / 60))
        walking_miles = max(0, float(node.get('walkDistance') or 0) / 1609.344)
        distance_miles = sum(max(0, float(leg.get('distance') or 0)) for leg in legs) / 1609.344
        travel_cost_type = None
        if mode == 'transit':
            otp_fare = _otp_itinerary_fare(legs)
            if transit_fare is not None:
                travel_cost = transit_fare
                travel_cost_type = 'configured'
            elif otp_fare is not None:
                travel_cost = otp_fare
                travel_cost_type = 'otp'
            else:
                travel_cost = _njt_estimated_max_fare(legs)
                travel_cost_type = 'estimated_max' if travel_cost is not None else None
        else:
            travel_cost = pharmacy.get('driveCost', 0) if mode == 'drive' else 0
        depart_in_minutes = 0
        transit_types_used = []
        if mode == 'transit':
            used_modes = [((leg.get('route') or {}).get('mode') or leg.get('mode') or '').upper() for leg in legs if leg.get('transitLeg')]
            type_map = {'BUS': 'bus', 'SUBWAY': 'subway', 'TRAM': 'subway', 'RAIL': 'commuter', 'FERRY': 'ferry'}
            transit_types_used = list(dict.fromkeys(type_map[value] for value in used_modes if value in type_map))
            if not transit_types_used or any(value not in allowed_transit_modes for value in used_modes):
                return {'available': False}
            first_vehicle = next((leg for leg in legs if leg.get('transitLeg')), None)
            search_time = _otp_timestamp(connection.get('searchDateTime'))
            board_time = _leg_timestamp(first_vehicle or {}, 'start')
            departure_time = arrival_time = None
            if search_time and board_time:
                access_seconds = 0
                for leg in legs:
                    if leg is first_vehicle:
                        break
                    access_seconds += float(leg.get('duration') or 0)
                departure_time = board_time.timestamp() - access_seconds
                depart_in_minutes = max(0, round((departure_time - search_time.timestamp()) / 60))
            else:
                depart_in_minutes = max(0, round(float(node.get('waitingTime') or 0) / 60))
            final_arrival = _leg_timestamp(legs[-1], 'end') if legs else None
            if search_time and final_arrival:
                arrival_in_minutes = max(0, round((final_arrival - search_time).total_seconds() / 60))
                duration = max(0, round((final_arrival.timestamp() - (departure_time if departure_time is not None else search_time.timestamp())) / 60))
            else:
                arrival_in_minutes = duration + depart_in_minutes
        route = {
            'available': True,
            'duration_minutes': duration,
            'depart_in_minutes': depart_in_minutes,
            **({'arrival_in_minutes': arrival_in_minutes} if mode == 'transit' else {}),
            'travel_cost': max(0, float(travel_cost)) if travel_cost is not None else None,
            **({'travel_cost_type': travel_cost_type} if travel_cost_type else {}),
            'walking_minutes': walking_minutes,
            'walking_miles': walking_miles,
            'steps': make_steps(legs, mode),
        }
        geometry = geometry_for(legs)
        if geometry:
            route['geometry'] = geometry
        if mode == 'transit':
            route['transit_types'] = transit_types_used
            route['walk_is_faster'] = transit_walk_is_faster
        if mode == 'drive':
            # Lets the server price the trip from the user's gas mileage.
            route['distance_miles'] = round(distance_miles, 2)
        return route, distance_miles

    modes = {}
    distances = []
    for alias, mode in (('walk', 'walk'), ('transit', 'transit'), ('drive', 'drive'), ('bike', 'bike')):
        routed = route_for(alias, mode)
        if isinstance(routed, tuple):
            modes[mode], distance = routed
            distances.append(distance)
        else:
            modes[mode] = routed
    return {'distance_miles': min(distances) if distances else None, 'methods': modes}


def _otp_query_limited(deadline, *args):
    """Run one store's OTP query once a slot frees up, unless the search budget runs out first."""
    if not _OTP_SLOTS.acquire(timeout=max(0, deadline - time.monotonic())):
        raise TimeoutError('No OpenTripPlanner slot before the search budget ran out')
    try:
        return _otp_query(*args)
    finally:
        _OTP_SLOTS.release()


def unrouted_route(reason='route_timeout'):
    """A store with no OTP route: unavailable with no times or costs, never mock estimates.

    reason is 'route_timeout' (OTP did not answer in time) or 'beyond_route_limit'
    (farther than the nearest ROUTE_STORE_LIMIT stores, so never sent to OTP).
    """
    return {'distance_miles': None, 'unrouted': True, 'methods': {
        mode: {'available': False, 'unavailable_reason': reason, 'travel_cost': None, 'total_cost': None, 'steps': []}
        for mode in MODES
    }}


def fetch_opentripplanner_routes(service_url, origin, pharmacies, transit_types=None, transit_fare=None, leave_at=None):
    """Query a self-hosted OpenTripPlanner 2 GTFS GraphQL endpoint for live itineraries."""
    coordinates = _coordinate_origin(origin)
    allowed_modes = _otp_transit_modes(transit_types)
    leave_now = not leave_at
    ttl = (_OTP_SCHEDULED_TTL_SECONDS if leave_at
           else _OTP_TRANSIT_TTL_SECONDS if allowed_modes
           else _OTP_STREET_TTL_SECONDS)
    def key_for(pharmacy):
        # Route results ignore transit type order, so sort it for the key.
        return 'otp\n' + _cache_key(service_url, {
            'origin': coordinates,
            'destination': {'id': pharmacy['id'], 'coordinates': [pharmacy['longitude'], pharmacy['latitude']]},
            'transit_modes': sorted(allowed_modes),
            'transit_fare': transit_fare,
            'leave_at': leave_at,
        })
    routes = {}
    missing = []
    for pharmacy in pharmacies:
        cached = _otp_cache_get(key_for(pharmacy), leave_now)
        if cached is None:
            missing.append(pharmacy)
        else:
            routes[pharmacy['id']] = cached
    if missing:
        deadline = time.monotonic() + _OTP_SEARCH_BUDGET_SECONDS
        executor = ThreadPoolExecutor(max_workers=min(_OTP_MAX_CONCURRENT, len(missing)))
        futures = {
            executor.submit(_otp_query_limited, deadline, service_url, coordinates, pharmacy, allowed_modes, transit_fare, leave_at): pharmacy
            for pharmacy in missing
        }
        try:
            for future in as_completed(futures, timeout=_OTP_SEARCH_BUDGET_SECONDS):
                pharmacy = futures[future]
                try:
                    route = future.result()
                except Exception:  # noqa: BLE001 - one bad store response (cut-off read, odd JSON) must not sink the others
                    continue
                routes[pharmacy['id']] = route
                # Cache each store as it arrives so a retry after a partial failure is cheaper.
                _cache_put(key_for(pharmacy), {'route': route, 'computed_at': time.time()}, ttl=ttl)
        except FuturesTimeoutError:
            pass
        finally:
            # Don't hold the response for stragglers; queued stores never start.
            executor.shutdown(wait=False, cancel_futures=True)
        unrouted = [pharmacy for pharmacy in missing if pharmacy['id'] not in routes]
        if len(unrouted) == len(pharmacies):
            raise RoutingUnavailable('OpenTripPlanner could not return routes in time. Check the configured endpoint, or try again shortly.')
        for pharmacy in unrouted:
            # Never cached, so the next search retries these stores.
            routes[pharmacy['id']] = unrouted_route()
    routes = {pharmacy['id']: routes[pharmacy['id']] for pharmacy in pharmacies}
    unrouted_count = sum(route.get('unrouted', False) for route in routes.values())
    return {'routes': routes, 'partial': any(not route['methods'][mode]['available'] for route in routes.values() for mode in MODES), 'cached': not missing, 'provider': 'otp', 'unrouted': unrouted_count}


def fetch_routes(service_url, origin, pharmacies, transit_types=None):
    """POST a batch to the route service; medication/inventory data is excluded."""
    payload = {'origin': origin, 'destinations': [
        {'id': p['id'], 'address': p['address'], 'name': p['name'],
         'coordinates': [p['longitude'], p['latitude']]}
        for p in pharmacies
    ], 'modes': list(MODES), 'transit_types': transit_types or []}
    key = _cache_key(service_url, payload)
    cached = _cache_get(key)
    if cached is not None:
        return cached
    request = Request(service_url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'Accept': 'application/json'}, method='POST')
    try:
        with urlopen(request, timeout=8) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise ValueError('Response too large')
            body = json.loads(raw)
        results = body['routes']
        if not isinstance(results, dict):
            raise ValueError('Invalid route collection')
        clean = {}
        partial = False
        for pharmacy in pharmacies:
            record = results.get(pharmacy['id'])
            if record is None:
                partial = True
                clean[pharmacy['id']] = {'distance_miles': None, 'methods': {mode: {'available': False} for mode in MODES}}
                continue
            distance = record.get('distance_miles')
            if distance is not None and (isinstance(distance, bool) or not isinstance(distance, (int, float)) or not math.isfinite(distance) or distance < 0):
                raise ValueError('Invalid distance')
            route_collection = record.get('methods')
            if route_collection is None:
                route_collection = {}
                partial = True
            elif not isinstance(route_collection, dict):
                raise ValueError('Invalid method collection')
            methods = {}
            for mode in MODES:
                route = route_collection.get(mode)
                if route is None:
                    partial = True
                    methods[mode] = {'available': False}
                    continue
                if not isinstance(route['available'], bool):
                    raise ValueError('Invalid availability')
                if not route['available']:
                    methods[mode] = {'available': False}
                    continue
                for field in ('duration_minutes', 'depart_in_minutes', 'travel_cost', 'walking_minutes', 'walking_miles'):
                    value = route[field]
                    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                        raise ValueError('Invalid route value')
                steps = route['steps']
                if not isinstance(steps, list) or not all(isinstance(s, dict) and isinstance(s.get('title'), str) and isinstance(s.get('detail'), str) for s in steps):
                    raise ValueError('Invalid steps')
                if mode == 'transit':
                    types = route.get('transit_types')
                    if not isinstance(types, list) or not types or any(t not in ('bus', 'subway', 'commuter', 'ferry') for t in types):
                        raise ValueError('Transit routes require valid transit_types')
                methods[mode] = {k: route[k] for k in ('available', 'duration_minutes', 'depart_in_minutes', 'travel_cost', 'walking_minutes', 'walking_miles', 'steps')}
                geometry = route.get('geometry')
                if geometry is not None:
                    if not isinstance(geometry, dict) or geometry.get('type') != 'LineString' or not isinstance(geometry.get('coordinates'), list) or len(geometry['coordinates']) < 2:
                        raise ValueError('Invalid route geometry')
                    coordinates = []
                    for point in geometry['coordinates']:
                        if not isinstance(point, (list, tuple)) or len(point) < 2:
                            raise ValueError('Invalid route coordinate')
                        lon, lat = point[:2]
                        if (isinstance(lon, bool) or not isinstance(lon, (int, float)) or not math.isfinite(lon) or abs(lon) > 180
                            or isinstance(lat, bool) or not isinstance(lat, (int, float)) or not math.isfinite(lat) or abs(lat) > 90):
                            raise ValueError('Invalid route coordinate')
                        coordinates.append([lon, lat])
                    methods[mode]['geometry'] = {'type': 'LineString', 'coordinates': coordinates}
                if mode == 'transit':
                    methods[mode]['transit_types'] = route['transit_types']
            clean[pharmacy['id']] = {'distance_miles': distance, 'methods': methods}
        result = {'routes': clean, 'partial': partial, 'cached': False}
        _cache_put(key, result)
        return result
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
        raise RoutingError('The routing service is unavailable or returned incomplete routes. Try again shortly.') from error
