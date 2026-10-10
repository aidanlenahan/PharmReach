/**
 * Explore a GTFS stops feed offline (no credentials needed).
 *
 *   npx tsx scripts/explore.ts <stops.txt | gtfs.zip> <bus|rail> [more files/types...]
 *   npx tsx scripts/explore.ts data/rail/stops.txt rail data/bus/stops.txt bus
 */
import { existsSync } from 'node:fs';
import { DEMO_LOCATION, NJ_BOUNDS, NJ_NY_PA_BOUNDS, inBounds } from '../src/constants.ts';
import { loadStopsFromFile, type Stop, type StopType } from '../src/gtfs.ts';
import { nearestN, stopsWithin } from '../src/geo.ts';
import { TRANSPORT, driveEstimate, transitEstimate, walkEstimate } from '../src/transit.ts';
import { loadAllPharmacies } from '../src/pharmacies.ts';

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2 !== 0) {
  console.error('usage: tsx scripts/explore.ts <stops.txt|gtfs.zip> <bus|rail> [<file> <type> ...]');
  process.exit(1);
}

const allStops: Stop[] = [];
for (let i = 0; i < args.length; i += 2) {
  const file = args[i]!;
  const type = args[i + 1] as StopType;
  if (type !== 'bus' && type !== 'rail') throw new Error(`type must be bus or rail, got ${type}`);
  if (!existsSync(file)) throw new Error(`file not found: ${file}`);
  const { stops, skipped } = loadStopsFromFile(file, type);
  const outNj = stops.filter((s) => !inBounds(s, NJ_BOUNDS)).length;
  const outArea = stops.filter((s) => !inBounds(s, NJ_NY_PA_BOUNDS)).length;
  const uniqueIds = new Set(stops.map((s) => s.id)).size;
  console.log(`\n== ${file} (${type})`);
  console.log(`stops: ${stops.length}  skipped rows: ${skipped}  unique ids: ${uniqueIds}`);
  console.log(`outside NJ bounds: ${outNj}  outside NJ/NY/PA bounds: ${outArea}`);
  allStops.push(...stops);
}

const f2 = (n: number) => n.toFixed(2);
const f1 = (n: number) => n.toFixed(1);

console.log(`\n== Demo location ${DEMO_LOCATION.lat}, ${DEMO_LOCATION.lng}`);
console.log('nearest stops:');
for (const { item, miles } of nearestN(DEMO_LOCATION, allStops, 5)) {
  console.log(`  ${f2(miles)} mi  [${item.type}] ${item.name} (${item.id})`);
}
console.log(`stops within ${TRANSPORT.MAX_WALK_TO_STOP_MI} mi: ${stopsWithin(DEMO_LOCATION, allStops, TRANSPORT.MAX_WALK_TO_STOP_MI).length}`);

const { pharmacies } = loadAllPharmacies();
console.log(`\n== 5 nearest pharmacies (of ${pharmacies.length})`);
for (const { item: p, miles } of nearestN(DEMO_LOCATION, pharmacies, 5)) {
  const w = walkEstimate(DEMO_LOCATION, p);
  const d = driveEstimate(DEMO_LOCATION, p);
  const t = transitEstimate(DEMO_LOCATION, p, allStops);
  console.log(`\n${p.name} [${p.source}] ${p.address}`);
  console.log(`  ${f2(miles)} mi straight-line`);
  console.log(`  walk:    ${f1(w.minutes)} min  ${w.feasible ? 'ok' : 'too far'}`);
  console.log(`  drive:   ${f1(d.minutes)} min  $${f2(d.cost)}  ${d.feasible ? 'ok' : 'too far'}`);
  const b = t.breakdown;
  console.log(
    `  transit: ${f1(t.minutes)} min  $${f2(t.fare)} ${t.transitMode ?? '-'}  ${t.feasible ? 'ok' : `infeasible (${t.reason})`}`,
  );
  console.log(
    `           walk ${f1(b.walkToStopMin)} + wait ${f1(b.waitMin)} + ride ${f1(b.rideMin)} + walk ${f1(b.walkFromStopMin)}` +
      `  via ${t.originStop?.name ?? '-'} -> ${t.destinationStop?.name ?? '-'}`,
  );
}

// Demo candidates: pharmacies 1-5 mi away, where transit and driving differ meaningfully.
const seenAddr = new Set<string>();
const candidates = loadAllPharmacies()
  .pharmacies.filter((p) => {
    const key = p.address.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (seenAddr.has(key)) return false;
    seenAddr.add(key);
    return true;
  })
  .map((p) => ({ p, t: transitEstimate(DEMO_LOCATION, p, allStops), d: driveEstimate(DEMO_LOCATION, p) }))
  .filter(({ d }) => d.miles >= 1 && d.miles <= 5);
const feasible = candidates.filter(({ t }) => t.feasible);
console.log(
  `\n== Demo candidates 1-5 mi away: ${candidates.length} pharmacies, ${feasible.length} transit-feasible` +
    ` (${feasible.filter(({ t }) => t.transitMode === 'rail').length} by rail)`,
);
const show = ({ p, t, d }: (typeof candidates)[number]) =>
  console.log(
    `  ${f2(d.miles)} mi  drive ${f1(d.minutes)} min $${f2(d.cost)} | transit ${f1(t.minutes)} min $${f2(t.fare)} ${t.transitMode}` +
      ` (${t.originStop?.name} -> ${t.destinationStop?.name}, walk ${f2(t.walkFromStopMi)} mi)  ${p.name} [${p.source}] ${p.address}`,
  );
console.log('rail (both ends near a station):');
feasible.filter(({ t }) => t.transitMode === 'rail').sort((a, b) => a.d.miles - b.d.miles).slice(0, 5).forEach(show);
console.log('bus, closest to the 2-4 mi sweet spot with a short walk at the far end:');
feasible
  .filter(({ t, d }) => t.transitMode === 'bus' && d.miles >= 2 && d.miles <= 4)
  .sort((a, b) => a.t.walkFromStopMi - b.t.walkFromStopMi)
  .slice(0, 8)
  .forEach(show);
// The combined-nearest rule almost never picks rail (bus stops are far denser), so also show rail-only.
const railStops = allStops.filter((s) => s.type === 'rail');
const railOnly = candidates
  .map((c) => ({ ...c, t: transitEstimate(DEMO_LOCATION, c.p, railStops) }))
  .filter(({ t }) => t.feasible);
console.log(`rail-only alternative (rail stops only, ${railOnly.length} feasible 1-5 mi):`);
railOnly.sort((a, b) => a.d.miles - b.d.miles).slice(0, 5).forEach(show);
const infeasible = candidates.filter(({ t }) => !t.feasible);
console.log(`transit-infeasible 1-5 mi (${infeasible.length}), e.g.:`);
infeasible.slice(0, 3).forEach(({ p, t, d }) => console.log(`  ${f2(d.miles)} mi  ${p.name} ${p.address}: ${t.reason}`));
