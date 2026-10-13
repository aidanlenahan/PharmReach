// Matcher tests: node scripts/matcher-test/run.mjs [filter]
// Cases come from every cases*.mjs file here. Each case is [message, expected]. expected is 'emergency', 'pharmacist', 'refuse', 'none'
// (no screen and no products), or a key of P in src/matcher/shared.ts that must be among the top 3 picks.
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

const { screen, matchSymptoms, clean } = await import('../../src/symptomMatcher.ts');
const { P } = await import('../../src/matcher/shared.ts');
import { readdirSync } from 'node:fs';
const CASES = [];
for (const file of readdirSync(new URL('.', import.meta.url)).filter((f) => /^cases.*\.mjs$/.test(f)).sort()) {
  CASES.push(...(await import(`./${file}`)).CASES);
}

const filter = process.argv[2];
let failed = 0, total = 0;
for (const [message, expected] of CASES) {
  if (filter && !message.includes(filter)) continue;
  total++;
  const flag = screen(message);
  let got;
  if (flag) got = flag;
  else {
    const { ids, refuse } = matchSymptoms(message);
    got = refuse ? 'refuse' : ids.length ? ids.slice(0, 3) : 'none';
  }
  const ok = ['emergency', 'pharmacist', 'refuse', 'none'].includes(expected)
    ? got === expected
    : Array.isArray(got) && got.includes(P[expected]);
  if (!ok) {
    failed++;
    const shown = Array.isArray(got) ? got.map((id) => Object.keys(P).find((k) => P[k] === id) || id).join(',') : got;
    console.log(`FAIL  ${JSON.stringify(message)}\n      expected ${expected}, got ${shown}\n      cleaned: ${clean(message)}`);
  }
}
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
