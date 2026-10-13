import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

// This frame paints from the HTML before the app's JavaScript arrives.
// React replaces it when mounting; API-specific skeletons then fill the page.
export function loadingFrame(rootDir: string): Plugin {
  const line = '<span class="boot-block boot-line"></span>';
  const short = '<span class="boot-block boot-short"></span>';
  const title = '<span class="boot-block boot-title"></span>';
  const search = `<div class="boot-search">${line}</div>`;
  const chips = `<div class="boot-chips">${'<span class="boot-block"></span>'.repeat(3)}</div>`;
  const row = `<div class="boot-row"><div>${line}${short}</div><div>${short}</div><div>${short}</div></div>`;
  const rows = `<div class="boot-panel">${row.repeat(4)}</div>`;
  return {
    name: 'page-loading-frame',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const filename = basename(context.filename);
        const home = filename === 'index.html';
        const kind = home ? 'home' : filename === 'results.html' ? 'results' : filename === 'products.html' ? 'products' : 'standard';
        const body = home
          ? `<div class="boot-hero-copy">${short}${title}${title}${line}${line}${short}${search}</div><div class="boot-panel boot-preview"><div class="boot-preview-head">${title}</div>${chips}${row.repeat(3)}</div>`
          : kind === 'products'
            ? `${title}${line}${search}${chips}<div class="boot-cards">${`<div class="boot-panel boot-card">${short}${title}${line}${short}</div>`.repeat(6)}</div>`
            : `${kind === 'results' ? search : title}${line}${kind === 'results' ? title : search}${rows}`;
        const frame = `<div class="page-boot"><div class="boot-shell"><header class="boot-header"><a class="boot-brand" href="./"><img src="/logo.svg" width="42" height="42" alt="">PharmReach</a><div class="boot-nav" aria-hidden="true">${'<span class="boot-block"></span>'.repeat(3)}</div></header><span class="boot-status" role="status">Loading page…</span><main class="boot-main boot-main-${kind}" aria-hidden="true">${body}</main></div></div>`;
        return {
          html: html.replace('<div id="app"></div>', `<div id="app">${frame}</div>`).replace('<noscript>', '<noscript><style>.page-boot{display:none}</style>'),
          tags: [{ tag: 'style', attrs: { 'data-loading-frame': '' }, children: readFileSync(resolve(rootDir, 'src/components/boot-frame.css'), 'utf8'), injectTo: 'head-prepend' }],
        };
      },
    },
  };
}
