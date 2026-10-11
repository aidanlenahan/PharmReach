// Style samples: recolor the existing stylesheets at runtime so a palette can be previewed
// without editing any CSS. Each original color keeps its OKLCH lightness (so contrast and
// layout stay identical); only its hue and chroma move onto the palette.

export type Palette = { id: string; name: string; note: string; colors: [string, string, string, string, string] };

// Colors run darkest to lightest: [base, deep, mid, accent, highlight].
export const palettes: Palette[] = [
  { id: 'midnight-teal', name: 'Midnight Teal', note: 'Navy foundation with a bright aqua accent.', colors: ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#6fffe9'] },
  { id: 'slate-sky', name: 'Slate Sky', note: 'Cool slate neutrals with a clear sky blue.', colors: ['#0f172a', '#1e293b', '#334155', '#0ea5e9', '#bae6fd'] },
  { id: 'graphite-indigo', name: 'Graphite Indigo', note: 'Neutral graphite with a confident indigo.', colors: ['#111827', '#1f2937', '#4b5563', '#6366f1', '#c7d2fe'] },
  { id: 'forest-sage', name: 'Forest Sage', note: 'Deep evergreen with calm sage tones.', colors: ['#1b2a24', '#2f3e46', '#52796f', '#52b788', '#d8f3dc'] },
  { id: 'deep-ocean', name: 'Deep Ocean', note: 'Saturated blues from midnight to surf.', colors: ['#03045e', '#023e8a', '#0077b6', '#00b4d8', '#caf0f8'] },
  { id: 'violet-dusk', name: 'Violet Dusk', note: 'Muted plum with a soft violet accent.', colors: ['#1e1b2e', '#2d2640', '#5b4b75', '#8b5cf6', '#ddd6fe'] },
  { id: 'monochrome', name: 'Monochrome', note: 'Pure grayscale, no hue at all.', colors: ['#0a0a0a', '#262626', '#525252', '#737373', '#e5e5e5'] },
];

export const getPalette = (id: string | null) => palettes.find((palette) => palette.id === id);

type Lch = [number, number, number];

const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function rgbToOklch(r: number, g: number, b: number): Lch {
  const [lr, lg, lb] = [r, g, b].map((c) => toLinear(c / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}

function oklchToLinear([L, C, H]: Lch) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

// Reduce chroma until the color fits in sRGB.
function oklchToRgb([L, C, H]: Lch) {
  const inGamut = (c: number) => oklchToLinear([L, c, H]).every((v) => v >= -0.0001 && v <= 1.0001);
  let lo = 0, hi = C;
  if (!inGamut(C)) for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (inGamut(mid)) lo = mid; else hi = mid; }
  else lo = C;
  return oklchToLinear([L, lo, H]).map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255));
}

const hexToRgb = (hex: string) => {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4, 6].map((i) => i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255);
};

// Stock status colors (in stock, limited, unavailable) carry meaning, so they never change.
const preservedSelector = /availability|legend-dot|map-dot|pharmacy-marker|limited|unavailable|preference-warning|status-message|landing-preview-offer > div > small/;
const preservedHue = (L: number, C: number, H: number) => C > 0.04 && L > 0.3 && (H < 45 || H > 340 || (H > 60 && H < 100));

function remapper(palette: Palette) {
  const [base, , , accent, highlight] = palette.colors.map((hex) => { const [r, g, b] = hexToRgb(hex); return rgbToOklch(r, g, b); });
  return (r: number, g: number, b: number): [number, number, number] | null => {
    const [L, C, H] = rgbToOklch(r, g, b);
    if (preservedHue(L, C, H)) return null;
    if (C < 0.04) {
      // Neutrals take a tint of the base color, stronger as they get darker.
      const tint = Math.min(1, Math.max(0.15, (0.9 - L) / 0.6));
      return oklchToRgb([L, base[1] * tint, base[2]]) as [number, number, number];
    }
    const target = L > 0.82 ? highlight : accent;
    return oklchToRgb([L, Math.min(Math.max(C, target[1] * 0.6), target[1]), target[2]]) as [number, number, number];
  };
}

const colorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(([^)]*)\)/g;

function recolorValue(value: string, map: ReturnType<typeof remapper>) {
  return value.replace(colorPattern, (match, args?: string) => {
    let rgba: number[];
    if (args === undefined) rgba = hexToRgb(match);
    else {
      const parts = args.split(/[\s,/]+/).filter(Boolean);
      if (parts.length < 3 || parts.slice(0, 3).some((p) => p.endsWith('%'))) return match;
      const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      rgba = [...parts.slice(0, 3).map(Number), alpha * 255];
    }
    const mapped = map(rgba[0], rgba[1], rgba[2]);
    if (!mapped) return match;
    const alpha = Math.round(rgba[3]) / 255;
    return alpha >= 1 ? `rgb(${mapped.join(' ')})` : `rgb(${mapped.join(' ')} / ${+alpha.toFixed(3)})`;
  });
}

function recolorRules(rules: CSSRuleList, map: ReturnType<typeof remapper>) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (!preservedSelector.test(rule.selectorText)) {
        const style = rule.style;
        for (const property of Array.from(style)) {
          if (property === '--stock-green') continue;
          const value = style.getPropertyValue(property);
          const next = recolorValue(value, map);
          if (next !== value) style.setProperty(property, next, style.getPropertyPriority(property));
        }
      }
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) recolorRules((rule as CSSGroupingRule).cssRules, map);
  }
}

export function applyPalette(palette: Palette) {
  const map = remapper(palette);
  const done = new WeakSet<CSSStyleSheet>();
  const recolorSheets = () => {
    for (const sheet of Array.from(document.styleSheets)) {
      if (done.has(sheet)) continue;
      try { recolorRules(sheet.cssRules, map); done.add(sheet); } catch { /* not loaded yet or cross-origin */ }
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    const content = meta?.getAttribute('content');
    if (meta && content && !content.startsWith('rgb')) meta.setAttribute('content', recolorValue(content, map));
  };
  recolorSheets();
  // Vite injects CSS as modules load (and on hot reload), so catch sheets that arrive later.
  new MutationObserver(() => recolorSheets()).observe(document.head, { childList: true, subtree: true, characterData: true });
  document.addEventListener('load', recolorSheets, true);
}
