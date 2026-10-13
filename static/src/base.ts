// Where the site is mounted, worked out at runtime so one build works at
// aidanlenahan.github.io/pharmreach/, pharmreach.alenahan.net/ or anywhere else.
// Every bundle lives in <base>assets/, so the base is one level up from this module.
// (The URL is read through a variable so Vite doesn't treat it as an asset import.)
const moduleUrl = import.meta.url;
export const BASE = import.meta.env.DEV ? '/' : new URL('..', moduleUrl).pathname;

/** Site-relative path ("/results?x=1") -> URL under the base ("/pharmreach/results?x=1"). */
export function href(path: string) {
  return BASE + path.replace(/^\/+/, '');
}

/** Current page as a site-relative path without .html: "/", "/results", ... */
export function currentPath() {
  const path = location.pathname.startsWith(BASE) ? '/' + location.pathname.slice(BASE.length) : location.pathname;
  return path.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

/** Turn a full same-origin URL back into a site-relative path, or null if it's outside the site. */
export function sitePath(url: URL) {
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return null;
  return ('/' + url.pathname.slice(BASE.length)).replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/+$/, '$1');
}
