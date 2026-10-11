"""Tiny stdlib .env loader for local runs.

Reads KEY=VALUE lines from the repository-root .env (if present) into
os.environ without overriding variables that are already set, so values
from systemd's EnvironmentFile or the shell always win. Never logs values.
"""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
_loaded = set()


def load_env(path=None):
    """Load a .env file once per path. Returns the names that were newly set."""
    path = Path(path) if path else REPO_ROOT / '.env'
    key = str(path)
    if key in _loaded:
        return []
    _loaded.add(key)
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except OSError:
        return []
    added = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        if line.startswith('export '):
            line = line[len('export '):].lstrip()
        name, value = line.split('=', 1)
        name, value = name.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        if name and name.replace('_', 'a').isalnum() and name not in os.environ:
            os.environ[name] = value
            added.append(name)
    return added
