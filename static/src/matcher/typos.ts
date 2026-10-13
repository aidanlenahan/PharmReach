// Typo fixer for the keyword helper (see ../symptomMatcher.ts).
// Each word the helper doesn't know is swapped for the closest word it does know, so "hedache",
// "stomache pian" and "sucidal" reach the same rules as the plain spelling. The known words are
// every phrase the rules and the emergency screen look for, plus catalog product names.
// Real English words (./commonWords.ts) are never changed, and run-together words ("hurtmyself")
// are split when both halves are known.
import { COMMON_WORDS } from './commonWords';

const common = new Set(COMMON_WORDS.split(/\s+/).filter(Boolean));
const vocab = new Set<string>();
// Vocabulary words grouped by length, so a lookup only compares words of a similar size.
const byLength = new Map<number, string[]>();
// Stems of "prefix*" phrases ("sneez*"): any word starting with one is known, and typos are fixed against the stem.
const stems = new Set<string>();
const stemsByLength = new Map<number, string[]>();
const cache = new Map<string, string>();

// Texting shorthand, expanded before the rules run.
const SHORTHAND: Record<string, string> = {
  u: 'you', ur: 'your', ure: "you're", youre: "you're", im: "i'm", ive: "i've", ima: "i'm going to", imma: "i'm going to",
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", couldnt: "couldn't",
  idk: "i don't know", rn: 'right now', bc: 'because', cuz: 'because', coz: 'because', abt: 'about', pls: 'please', plz: 'please',
  w: 'with', wo: 'without', smth: 'something', sth: 'something', rly: 'really', rlly: 'really', srsly: 'seriously',
  r: 'are', n: 'and', y: 'why', tmrw: 'tomorrow', tho: 'though', thru: 'through', ppl: 'people', bf: 'boyfriend', gf: 'girlfriend',
  myslf: 'myself', meself: 'myself', mysef: 'myself', myslef: 'myself', mysefl: 'myself', mysel: 'myself',
};

/** Add every word of these phrases to the known vocabulary. A trailing * (prefix match) also adds a stem. */
export function addVocab(...phrases: string[]) {
  cache.clear();
  for (const phrase of phrases) {
    const stem = phrase.toLowerCase().match(/([a-z]{4,})\*$/)?.[1];
    if (stem && !stems.has(stem)) {
      stems.add(stem);
      if (!stemsByLength.has(stem.length)) stemsByLength.set(stem.length, []);
      stemsByLength.get(stem.length)!.push(stem);
    }
    for (const word of phrase.toLowerCase().replace(/\*/g, '').split(/[^a-z']+/)) {
      const key = word.replace(/'/g, '');
      if (key.length < 3 || vocab.has(key)) continue;
      vocab.add(key);
      if (!byLength.has(key.length)) byLength.set(key.length, []);
      byLength.get(key.length)!.push(key);
    }
  }
}

/** Literal words inside regex sources ("(chest|chset) (pain|pian)" -> chest, chset, pain, pian). */
export function addRegexVocab(patterns: RegExp[]) {
  for (const pattern of patterns) {
    // "pills?" -> "pill pills" so optional plurals are known in both forms.
    const source = pattern.source.replace(/([a-z]{3,})(e?s)\?/g, '$1 $1$2');
    addVocab(...(source.match(/(?<=^|[\s(|]|\\b)[a-z']{3,}(?=$|[\s)|]|\\[bw])/g) || []));
  }
}

/** Edit distance where swapping two neighbouring letters counts as one edit. Stops early past max. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    rows.push(row);
  }
  return rows[a.length][b.length];
}

// Endings that turn a common word into another real word ("text" -> "texting", "point" -> "pointless").
const ENDINGS = /(s|es|ed|d|ing|er|ers|ly|ment|ments|ness|less|ful|able|y)$/;

function known(word: string) {
  if (vocab.has(word) || common.has(word)) return true;
  const ending = word.match(ENDINGS)?.[0];
  if (!ending) return false;
  const base = word.slice(0, -ending.length);
  // Also "hoping" -> "hope" and "stopped" -> "stop".
  return base.length >= 4 && (common.has(base) || common.has(base + 'e') || (base.length >= 5 && base.at(-1) === base.at(-2) && common.has(base.slice(0, -1))));
}

/** Length of the longest "prefix*" stem the word starts with (0 if none). */
function stemLength(word: string) {
  for (let i = word.length; i >= 4; i--) if (stems.has(word.slice(0, i))) return i;
  return 0;
}

/** How likely "candidate" is the word meant by "typed", d edits apart (lower is better), or null to rule it out. */
function score(typed: string, candidate: string, d: number) {
  const transposed = typed.length === candidate.length && [...typed].sort().join('') === [...candidate].sort().join('');
  // The first letter is rarely the typo: only change it in long words or by swapping the first two letters.
  if (typed[0] !== candidate[0] && (d === 2 || (typed.length < 7 && !(typed[0] === candidate[1] && typed[1] === candidate[0])))) return null;
  // A dropped or swapped letter is a likelier slip than a wrong one ("bloting" is bloating, not blowing).
  const substituted = typed.length === candidate.length && !transposed;
  // An extra typed letter is a little less likely than a dropped one or a swap ("congetsion" is congestion, not congesion).
  return d * 4 + (typed[0] === candidate[0] ? 0 : 2) + (typed.at(-1) === candidate.at(-1) ? 0 : 1) + (substituted ? 0.5 : 0) + (candidate.length < typed.length ? 0.25 : 0);
}

/** Closest vocabulary word (or stem plus the typed ending) within max edits, or null. */
function closest(word: string, max: number) {
  let best: string | null = null;
  let bestScore = Infinity;
  const consider = (typed: string, candidate: string, result: string) => {
    const d = distance(typed, candidate, max);
    const s = d > max || d === 0 ? null : score(typed, candidate, d);
    if (s !== null && s < bestScore) { best = result; bestScore = s; }
  };
  for (let length = word.length - max; length <= word.length + max; length++) {
    for (const candidate of byLength.get(length) || []) if (candidate.length >= 4) consider(word, candidate, candidate);
  }
  // "scaped" against the stem "scrape*" -> "scraped": compare the start of the word with each stem.
  for (let length = 4; length <= word.length + max; length++) {
    for (const stem of stemsByLength.get(length) || []) {
      // Only short endings after the stem, so "hurtmyself" isn't read as the stem "hurt" plus "yself".
      for (let cut = Math.max(length - max, 4, word.length - 3); cut <= Math.min(length + max, word.length); cut++) {
        consider(word.slice(0, cut), stem, stem + word.slice(cut));
      }
    }
  }
  return best;
}

/** A doubled letter typed once or a single letter typed twice ("realy", "stuffed" for "stufed"). */
function doubling(word: string) {
  for (let i = 0; i < word.length; i++) {
    const options = word[i] === word[i + 1] ? [word.slice(0, i) + word.slice(i + 1)] : [word.slice(0, i + 1) + word[i] + word.slice(i + 1)];
    for (const option of options) if (known(option)) return option;
  }
  return null;
}

/** "hurtmyself" -> "hurt myself" when both halves are known words (one at least 4 letters).
 *  Never splits inside a stem the rules already match ("sunburn*" keeps "sunburn"). */
function split(word: string) {
  for (let i = Math.max(2, stemLength(word)); i <= word.length - 2; i++) {
    const left = word.slice(0, i), right = word.slice(i);
    if (new RegExp(`^${ENDINGS.source}`).test(right)) continue; // "embarrassment" is not "embarrass ment"
    if (known(left) && known(right) && Math.max(left.length, right.length) >= 4 && (vocab.has(left) || vocab.has(right))) return `${left} ${right}`;
  }
  return null;
}

function fixWord(word: string) {
  const key = word.replace(/'/g, '');
  if (SHORTHAND[key]) return SHORTHAND[key];
  if (key.length < 4 || known(key)) return word;
  if (cache.has(key)) return cache.get(key)!;
  // Words a "prefix*" phrase already matches ("sneezin") only get the one-letter fixes.
  const fixed = doubling(key) || closest(key, 1) || (key.length >= 7 && !stemLength(key) ? closest(key, 2) : null) || split(key) || word;
  cache.set(key, fixed);
  return fixed;
}

/** Fix typos in an already normalized (lowercase) message. Numbers and punctuation are left alone. */
export function fixTypos(text: string) {
  // Letters repeated for emphasis ("hellllp", "sooo") are cut to two first.
  return text.replace(/([a-z])\1{2,}/g, '$1$1').replace(/[a-z']+/g, fixWord);
}

/** Number of known words (for tests). */
export const vocabSize = () => vocab.size;
