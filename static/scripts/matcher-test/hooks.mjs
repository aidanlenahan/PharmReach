// Node resolve hook for the matcher tests: extensionless "./x" imports -> "./x.ts", and the
// browser-only catalog module (./staticApi) is swapped for an empty stub.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if (specifier.endsWith('/staticApi')) return { url: new URL('./stub-staticApi.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
}
