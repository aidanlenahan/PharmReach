#!/usr/bin/env python3
"""Build the local Hoboken address-search index from a New Jersey OSM PBF.

Install the build-time dependency with `python3 -m pip install osmium`.
The app itself uses only the generated JSON and has no geocoding dependency.
"""
import argparse
import json
import math
from pathlib import Path

try:
    import osmium
except ImportError as error:
    raise SystemExit('Install the build dependency with: python3 -m pip install osmium') from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--osm', type=Path, default=Path(__file__).resolve().parents[1] / 'otp/data/new-jersey.osm.pbf')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data/address-index.json')
    args = parser.parse_args()
    if not args.osm.is_file():
        parser.error(f'OSM PBF not found: {args.osm}')

    # Hoboken plus a small border margin to cover addresses right around town.
    bounds = (40.733, 40.761, -74.050, -74.008)
    records = {}

    def add(tags, latitude, longitude, kind, osm_id):
        number, street = tags.get('addr:housenumber'), tags.get('addr:street')
        if not number or not street or not math.isfinite(latitude) or not math.isfinite(longitude):
            return
        if not (bounds[0] <= latitude <= bounds[1] and bounds[2] <= longitude <= bounds[3]):
            return
        city = (tags.get('addr:city') or '').casefold()
        if city and city != 'hoboken':
            return
        number, street = number.strip(), street.strip()
        city = tags.get('addr:city') or 'Hoboken'
        label = f'{number} {street}, {city}, NJ'
        key = (number.casefold(), street.casefold(), round(latitude, 6), round(longitude, 6))
        records.setdefault(key, {
            'address': label,
            'house_number': number,
            'street': street,
            'latitude': round(latitude, 7),
            'longitude': round(longitude, 7),
            'osm_type': kind,
            'osm_id': str(osm_id),
        })

    class AddressHandler(osmium.SimpleHandler):
        def node(self, obj):
            if obj.location.valid():
                add(obj.tags, obj.location.lat, obj.location.lon, 'node', obj.id)

        def way(self, obj):
            points = [(node.lat, node.lon) for node in obj.nodes if node.location.valid()]
            if points:
                add(obj.tags,
                    sum(point[0] for point in points) / len(points),
                    sum(point[1] for point in points) / len(points),
                    'way', obj.id)

    AddressHandler().apply_file(str(args.osm), locations=True)
    addresses = sorted(records.values(), key=lambda item: (item['street'].casefold(), item['house_number'].casefold(), item['latitude']))
    aliases = []
    # Stevens uses this campus mailing address, while the staged OSM extract
    # labels the matching point as "1 Castle Point". Keep the full official
    # spelling searchable and reuse that OSM point's coordinates.
    campus_point = next((item for item in addresses
                         if item['house_number'] == '1' and item['street'].casefold() == 'castle point'), None)
    if campus_point:
        for spelling in ('1 Castle Point Terrace, Hoboken, NJ 07030', '1 Castle Point Ter, Hoboken, NJ 07030'):
            aliases.append({
                'address': spelling,
                'house_number': '1',
                'street': spelling.split(',')[0].removeprefix('1 ').strip(),
                'latitude': campus_point['latitude'],
                'longitude': campus_point['longitude'],
                'osm_type': campus_point.get('osm_type'),
                'osm_id': campus_point.get('osm_id'),
                'address_source': 'https://www.stevens.edu/page-basic/campus-travel-information',
            })
    payload = {
        'source': 'OpenStreetMap contributors',
        'license': 'ODbL 1.0',
        'bounds': {'south': bounds[0], 'north': bounds[1], 'west': bounds[2], 'east': bounds[3]},
        'addresses': addresses,
        'aliases': aliases,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Wrote {len(addresses)} local address points to {args.output}')


if __name__ == '__main__':
    main()
