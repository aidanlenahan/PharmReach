"""NJ TRANSIT GTFS token API client, feed refresh job, and feed status for the server.

- api.py      token cache + authenticated getGTFS downloads (urllib, stdlib only)
- gtfs.py     GTFS zip validation and service-date extraction
- refresh.py  scheduled refresh job (python3 backend/njt/refresh.py --help)
- status.py   cheap status reader used by backend/serve.py
"""
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = BACKEND_ROOT / 'data' / 'cache'
TOKEN_FILE = CACHE_DIR / 'njt-tokens.json'
STATUS_FILE = CACHE_DIR / 'transit-status.json'
OTP_DATA_DIR = BACKEND_ROOT / 'otp' / 'data'
FEEDS = ('rail', 'bus')
FEED_FILENAMES = {'rail': 'nj-transit-rail.gtfs.zip', 'bus': 'nj-transit-bus.gtfs.zip'}
