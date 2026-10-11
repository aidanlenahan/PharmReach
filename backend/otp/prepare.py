#!/usr/bin/env python3
"""Stage an OSM extract and optional locally obtained NJ TRANSIT GTFS feeds for OTP."""
import argparse
import shutil
import sys
import zipfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
DEFAULT_DATA = HERE / 'data'
GTFS_REQUIRED = {'agency.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'stops.txt'}
GTFS_SERVICE_CALENDARS = {'calendar.txt', 'calendar_dates.txt'}


def validate_gtfs(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError(f'{label} feed is missing or empty: {path}')
    try:
        with zipfile.ZipFile(path) as archive:
            names = {Path(name).name for name in archive.namelist() if not name.endswith('/')}
            missing = GTFS_REQUIRED - names
            if missing:
                raise ValueError(f'{label} feed is missing required GTFS files: {", ".join(sorted(missing))}')
            if not names.intersection(GTFS_SERVICE_CALENDARS):
                raise ValueError(f'{label} feed needs calendar.txt or calendar_dates.txt to define service dates')
            if archive.testzip() is not None:
                raise ValueError(f'{label} feed failed its ZIP integrity check')
    except zipfile.BadZipFile as error:
        raise ValueError(f'{label} feed is not a valid ZIP file: {path}') from error


def stage(source: Path, destination: Path, label: str, suffix: str) -> Path:
    source = source.expanduser().resolve()
    if not source.is_file() or source.stat().st_size == 0:
        raise ValueError(f'{label} input is missing or empty: {source}')
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f'{label}{suffix}'
    if source != target.resolve():
        shutil.copy2(source, target)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rail', type=Path, help='Optional NJ TRANSIT rail GTFS ZIP from an authorized account')
    parser.add_argument('--bus', type=Path, help='Optional NJ TRANSIT bus GTFS ZIP from an authorized account')
    parser.add_argument('--osm', required=True, type=Path, help='Path to an OpenStreetMap .osm.pbf extract covering the transit service area')
    parser.add_argument('--output', type=Path, default=DEFAULT_DATA, help=f'OTP graph directory (default: {DEFAULT_DATA})')
    args = parser.parse_args()

    try:
        if args.osm.suffix.lower() != '.pbf':
            raise ValueError('OSM input must be a .pbf file; OTP does not consume .osm XML here')

        output = args.output.expanduser().resolve()
        feeds = []
        for label, source in (('Rail', args.rail), ('Bus', args.bus)):
            if source:
                validate_gtfs(source.expanduser(), label)
                feeds.append(stage(source, output, f'nj-transit-{label.lower()}', '.gtfs.zip'))
        osm = stage(args.osm, output, 'new-jersey', '.osm.pbf')
    except (OSError, ValueError) as error:
        print(f'Cannot prepare OTP inputs: {error}', file=sys.stderr)
        return 2

    print(f'Prepared local OpenTripPlanner inputs in {output}:')
    for path in (osm, *feeds):
        print(f'  {path.name} ({path.stat().st_size:,} bytes)')
    if not feeds:
        print('No GTFS feeds staged: the graph supports street routing only (walk, drive, bike).')
    print('Feed archives were not unpacked or uploaded. Review NJ TRANSIT feed terms before sharing graph artifacts.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
