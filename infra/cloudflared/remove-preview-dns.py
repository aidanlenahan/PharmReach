#!/usr/bin/env python3
"""Remove only the retired preview DNS record using the existing cloudflared login."""
import base64
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

certificate = Path.home() / '.cloudflared/cert.pem'
encoded = re.sub(r'-----[^\n]+-----', '', certificate.read_text()).strip()
credentials = json.loads(base64.b64decode(encoded))
base = f"https://api.cloudflare.com/client/v4/zones/{credentials['zoneID']}/dns_records"
headers = {'Authorization': 'Bearer ' + credentials['apiToken']}

def request(url, method='GET'):
    with urlopen(Request(url, headers=headers, method=method), timeout=20) as response:
        body = json.load(response)
    if not body.get('success'):
        raise RuntimeError('Cloudflare API request failed')
    return body.get('result')

name = 'hackru-preview.alenahan.net'
records = request(base + '?name=' + name)
if not records:
    print('Preview record already absent.')
for record in records:
    if record['name'] != name or record['type'] != 'CNAME' or record['content'] != '02ebf828-e43e-4503-8eb8-7ccb01d87611.cfargotunnel.com':
        raise RuntimeError('Unexpected preview record; refusing to delete')
    request(base + '/' + record['id'], 'DELETE')
    print('Deleted', name)
assert not request(base + '?name=' + name)
for name in ('hackru.alenahan.net', 'hackru-otp.alenahan.net'):
    records = request(base + '?name=' + name)
    if not records:
        raise RuntimeError('Expected DNS record missing: ' + name)
    print('Preserved', name)
