#!/usr/bin/env python3
"""Publish the backend snapshots as static JSON for the GitHub Pages build.

Reads backend/data (unchanged) and writes static/public/data/:
  catalog.json        CVS + Walgreens merged the same way backend/serve.py load_data() does
  address-index.json  the OSM address index plus pharmacy street addresses (as geocode_local_address adds them)
  locations.json      store pins for the homepage map
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'backend' / 'data'
OUT = ROOT / 'static' / 'public' / 'data'


def load_data():
    data = json.loads((DATA / 'cvs-data.json').read_text())
    walgreens = json.loads((DATA / 'walgreens-data.json').read_text())
    data['pharmacies'].extend(walgreens.get('pharmacies', []))
    for medication_id, stores in walgreens.get('inventory', {}).items():
        data['inventory'].setdefault(medication_id, {}).update(stores)
    source_info = data.setdefault('source_info', {})
    source_info['merchant'] = 'CVS + Walgreens'
    source_info['merchants'] = ['CVS', 'Walgreens']
    for key in ('checked_on', 'inventory_note', 'price_note'):
        source_info[f'walgreens_{key}'] = walgreens.get('source_info', {}).get(key)
    # Research notes and archived products are never served by the API.
    return {key: data[key] for key in ('source_info', 'medications', 'pharmacies', 'inventory')}


def address_tokens(value):
    text = re.split(r'[,·]', value, maxsplit=1)[0].casefold().replace('street', 'st').replace('avenue', 'ave').replace('boulevard', 'blvd').replace('road', 'rd')
    tokens = re.findall(r'[a-z0-9]+', text)
    unit = next((i for i, token in enumerate(tokens) if token in ('apt', 'apartment', 'unit', 'suite', 'ste', 'floor', 'fl')), len(tokens))
    return tokens[:unit]


def address_index(data):
    index = json.loads((DATA / 'address-index.json').read_text())
    known = {' '.join(address_tokens(item.get('address', ''))) for item in index['addresses'] + index.get('aliases', [])}
    for pharmacy in data['pharmacies']:
        street = (pharmacy.get('address') or '').split(' · ')[0]
        tokens = address_tokens(street)
        if len(tokens) < 2:
            continue
        label = f"{street}, {pharmacy.get('city', 'Hoboken')}, {pharmacy.get('state', 'NJ')}"
        normalized = ' '.join(address_tokens(label))
        if normalized not in known:
            index['addresses'].append({'address': label, 'house_number': tokens[0], 'street': ' '.join(tokens[1:]),
                                       'latitude': pharmacy['latitude'], 'longitude': pharmacy['longitude']})
            known.add(normalized)
    fields = ('address', 'house_number', 'street', 'latitude', 'longitude')
    return {'source': index.get('source'), 'license': index.get('license'),
            'addresses': [{k: item[k] for k in fields} for item in index['addresses'] + index.get('aliases', [])]}


def locations(data):
    fields = ('id', 'name', 'merchant', 'address', 'latitude', 'longitude', 'location_source', 'coordinates_note')
    return {'locations': [{k: p.get(k) for k in fields} for p in data['pharmacies']]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = load_data()
    for name, body in (('catalog.json', data), ('address-index.json', address_index(data)), ('locations.json', locations(data))):
        (OUT / name).write_text(json.dumps(body, separators=(',', ':')))
    print(f"static data: {len(data['medications'])} products, {len(data['pharmacies'])} stores -> {OUT.relative_to(ROOT)}")


if __name__ == '__main__':
    main()
