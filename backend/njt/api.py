"""NJ TRANSIT token API client for static GTFS (see poc/njtransit/API_NOTES.md).

  rail: POST raildata.njtransit.com/api/GTFSRT/getToken        (username, password) -> {Authenticated, UserToken}
        POST raildata.njtransit.com/api/GTFSRT/getGTFS         (token)              -> zip
  bus:  POST pcsdata.njtransit.com/api/GTFSG2/authenticateUser (username, password) -> {Authenticated, UserToken}
        POST pcsdata.njtransit.com/api/GTFSG2/getGTFS          (token)              -> zip

Every call is multipart/form-data; errors come back as HTTP 500 + JSON {"errorMessage": ...}.

Tokens are runtime state, cached with their issue time in backend/data/cache/njt-tokens.json
(mode 600, atomic writes) and reused until TOKEN_MAX_AGE (20h). Rail getToken shares a 10/day
limit with isValidToken, so auth calls are counted in the cache and refused above
DAILY_AUTH_CAP within any rolling 24h window (stricter than a per-day count, whatever
timezone NJT resets in). isValidToken is never called. On an "Invalid token" response
the client fetches one new token and retries once. Credentials come only from the
environment (NJT_USERNAME / NJT_PASSWORD) and are never logged; tokens are only logged masked.
"""
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import TOKEN_FILE

API_CONFIG = {
    'rail': {'base': 'https://raildata.njtransit.com', 'auth': '/api/GTFSRT/getToken', 'gtfs': '/api/GTFSRT/getGTFS'},
    'bus': {'base': 'https://pcsdata.njtransit.com', 'auth': '/api/GTFSG2/authenticateUser', 'gtfs': '/api/GTFSG2/getGTFS'},
}
TOKEN_MAX_AGE = timedelta(hours=20)
DAILY_AUTH_CAP = 8          # NJT rail limit is 10/day for getToken + isValidToken combined
DAILY_AUTH_WARN = 6
AUTH_TIMEOUT = 60
DOWNLOAD_TIMEOUT = 300
MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024
USER_AGENT = 'PharmReach-GTFS-refresh/1.0'


def log(message):
    print(f'njt: {message}', file=sys.stderr, flush=True)


def mask(secret):
    """Show only enough of a secret to tell values apart in logs."""
    if not secret:
        return '<empty>'
    return f'***({len(secret)} chars)'


def utcnow():
    return datetime.now(timezone.utc)


def iso(moment):
    return moment.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def parse_iso(value):
    try:
        moment = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


class NjtError(Exception):
    """An NJ TRANSIT API call failed. `error_message` is NJT's errorMessage, if any."""

    def __init__(self, message, feed=None, status=None, error_message=None):
        super().__init__(message)
        self.feed = feed
        self.status = status
        self.error_message = error_message

    @property
    def invalid_token(self):
        return bool(re.search(r'invalid token', self.error_message or '', re.I))


class NjtConfigError(NjtError):
    """Missing credentials or a local cap was hit; no request was made."""


def encode_multipart(fields):
    boundary = f'----pharmreach{uuid.uuid4().hex}'
    parts = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode('utf-8'))
    parts.append(f'--{boundary}--\r\n'.encode('utf-8'))
    return b''.join(parts), f'multipart/form-data; boundary={boundary}'


def http_request(url, fields=None, dest=None, timeout=AUTH_TIMEOUT, accept='*/*', headers=None, meta=None):
    """POST multipart `fields` (or GET when None). Returns (status, content_type, body).

    With `dest`, a 2xx body is streamed to that path and body is None. Error bodies
    (4xx/5xx) are always returned in memory. Network failures raise OSError.
    Extra request `headers` (e.g. If-None-Match) are sent as given; a 304 comes back as
    (304, content_type, body). When `meta` is a dict, the response's ETag and
    Last-Modified headers are copied into it.
    """
    data, headers = None, {'Accept': accept, 'User-Agent': USER_AGENT, **(headers or {})}
    if fields is not None:
        data, headers['Content-Type'] = encode_multipart(fields)
    request = urllib.request.Request(url, data=data, headers=headers, method='POST' if fields is not None else 'GET')
    try:
        response = urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        body = error.read(64 * 1024)
        return error.code, error.headers.get('Content-Type', ''), body
    with response:
        content_type = response.headers.get('Content-Type', '')
        if meta is not None:
            meta.update({k: response.headers[k] for k in ('ETag', 'Last-Modified') if response.headers.get(k)})
        if dest is None:
            return response.status, content_type, response.read(16 * 1024 * 1024)
        total = 0
        with open(dest, 'wb') as handle:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    raise OSError(f'download exceeded {MAX_DOWNLOAD_BYTES} bytes')
                handle.write(chunk)
        return response.status, content_type, None


def error_message_from(body):
    text = (body or b'')[:4096].decode('utf-8', 'replace').strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and isinstance(parsed.get('errorMessage'), str):
            return parsed['errorMessage']
    except ValueError:
        pass
    return text[:200] or None


def is_zip_file(path):
    try:
        with open(path, 'rb') as handle:
            return handle.read(4) == b'PK\x03\x04'
    except OSError:
        return False


class NjtClient:
    def __init__(self, token_file=TOKEN_FILE, env=None, transport=http_request, now=utcnow, logger=log):
        self.token_file = Path(token_file)
        self.env = os.environ if env is None else env
        self.transport = transport
        self.now = now
        self.log = logger
        self.auth_calls = {'rail': 0, 'bus': 0}

    # ---- cache -------------------------------------------------------------
    def read_cache(self):
        try:
            cache = json.loads(self.token_file.read_text())
        except (OSError, ValueError):
            return {}
        return cache if isinstance(cache, dict) else {}

    def write_cache(self, cache):
        self.token_file.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix='.njt-tokens.', dir=self.token_file.parent)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, 'w') as handle:
                json.dump(cache, handle, indent=2)
                handle.write('\n')
            os.replace(tmp, self.token_file)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
        os.chmod(self.token_file, 0o600)

    def cached_token(self, feed):
        entry = self.read_cache().get('tokens', {}).get(feed) or {}
        issued = parse_iso(entry.get('issued_at'))
        if not entry.get('token') or issued is None:
            return None
        age = self.now() - issued
        return entry['token'] if timedelta(0) <= age < TOKEN_MAX_AGE else None

    def recent_auth_calls(self, feed, cache=None):
        cache = self.read_cache() if cache is None else cache
        cutoff = self.now() - timedelta(hours=24)
        calls = [parse_iso(v) for v in cache.get('auth_calls', {}).get(feed, [])]
        return [c for c in calls if c is not None and c > cutoff]

    def forget_token(self, feed):
        cache = self.read_cache()
        if cache.get('tokens', {}).pop(feed, None) is not None:
            self.write_cache(cache)

    # ---- auth --------------------------------------------------------------
    def credentials(self):
        username = (self.env.get('NJT_USERNAME') or '').strip()
        password = (self.env.get('NJT_PASSWORD') or '').strip()
        if not username or not password:
            raise NjtConfigError('NJT_USERNAME and NJT_PASSWORD are not set (repo .env or /etc/hackru.env)')
        return username, password

    def new_token(self, feed):
        """One auth request. Records the call (even a failed one) against the daily cap."""
        username, password = self.credentials()
        cache = self.read_cache()
        recent = self.recent_auth_calls(feed, cache)
        if len(recent) >= DAILY_AUTH_CAP:
            raise NjtConfigError(f'{feed}: refusing token request, {len(recent)} auth calls in the last 24h (cap {DAILY_AUTH_CAP})', feed)
        if len(recent) + 1 >= DAILY_AUTH_WARN:
            self.log(f'WARNING {feed}: this is auth call {len(recent) + 1} in the last 24h (cap {DAILY_AUTH_CAP}, NJT rail limit 10/day)')
        cache.setdefault('auth_calls', {})[feed] = [iso(c) for c in recent] + [iso(self.now())]
        self.write_cache(cache)
        self.auth_calls[feed] += 1
        config = API_CONFIG[feed]
        self.log(f'{feed}: requesting a new token')
        try:
            status, _, body = self.transport(config['base'] + config['auth'], {'username': username, 'password': password}, timeout=AUTH_TIMEOUT, accept='text/plain')
        except OSError as error:
            raise NjtError(f'{feed}: token request failed: {type(error).__name__}: {error}', feed) from error
        if status != 200:
            message = error_message_from(body)
            raise NjtError(f'{feed}: token request HTTP {status}' + (f': {message}' if message else ''), feed, status, message)
        try:
            payload = json.loads((body or b'').decode('utf-8'))
        except ValueError:
            payload = {}
        token = payload.get('UserToken') if isinstance(payload, dict) else None
        if str(payload.get('Authenticated') if isinstance(payload, dict) else '').lower() != 'true' or not isinstance(token, str) or not token:
            raise NjtError(f'{feed}: authentication failed (check NJT_USERNAME/NJT_PASSWORD and that the account is enrolled for this feed)', feed, status)
        cache = self.read_cache()
        cache.setdefault('tokens', {})[feed] = {'token': token, 'issued_at': iso(self.now())}
        self.write_cache(cache)
        self.log(f'{feed}: got token {mask(token)}, cached')
        return token

    def get_token(self, feed):
        """Return (token, fresh). Reuses a cached token younger than TOKEN_MAX_AGE."""
        token = self.cached_token(feed)
        if token:
            return token, False
        return self.new_token(feed), True

    # ---- download ----------------------------------------------------------
    def _post_gtfs(self, feed, token, dest):
        config = API_CONFIG[feed]
        try:
            status, content_type, body = self.transport(config['base'] + config['gtfs'], {'token': token}, dest=dest, timeout=DOWNLOAD_TIMEOUT)
        except OSError as error:
            raise NjtError(f'{feed}: getGTFS failed: {type(error).__name__}: {error}', feed) from error
        if status != 200:
            message = error_message_from(body)
            raise NjtError(f'{feed}: getGTFS HTTP {status}' + (f': {message}' if message else ''), feed, status, message)
        if not is_zip_file(dest):
            try:
                with open(dest, 'rb') as handle:
                    message = error_message_from(handle.read(4096))
            except OSError:
                message = None
            raise NjtError(f'{feed}: getGTFS returned a non-zip body ({content_type or "no content-type"})' + (f': {message}' if message else ''), feed, status, message)

    def download_gtfs(self, feed, dest):
        """Download the feed's static GTFS zip to `dest`. Retries once with a new token on 'Invalid token'."""
        token, fresh = self.get_token(feed)
        try:
            self._post_gtfs(feed, token, dest)
            return {'retried': False, 'token': 'new' if fresh else 'cached'}
        except NjtError as error:
            if not error.invalid_token or fresh:
                raise
            self.log(f'{feed}: cached token rejected ({error.error_message}); requesting a new one and retrying once')
            self.forget_token(feed)
        token = self.new_token(feed)
        self._post_gtfs(feed, token, dest)
        return {'retried': True, 'token': 'new'}
