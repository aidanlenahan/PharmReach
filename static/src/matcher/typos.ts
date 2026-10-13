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
const cache = new Map<string, string>();

// Texting shorthand, expanded before the rules run.
const SHORTHAND: Record<string, string> = {
  u: 'you', ur: 'your', ure: "you're", youre: "you're", im: "i'm", ive: "i've", ima: "i'm going to", imma: "i'm going to",
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", couldnt: "couldn't",
  idk: "i don't know", rn: 'right now', bc: 'because', cuz: 'because', coz: 'because', abt: 'about', pls: 'please', plz: 'please',
  w: 'with', wo: 'without', smth: 'something', sth: 'something', rly: 'really', rlly: 'really', srsly: 'seriously',
  tmrw: 'tomorrow', tho: 'though', thru: 'through', ppl: 'people', bf: 'boyfriend', gf: 'girlfriend',
  myslf: 'myself', meself: 'myself', mysef: 'myself', myslef: 'myself', mysefl: 'myself', mysel: 'myself',
};

/** Add every word of these phrases to the known vocabulary. A trailing * (prefix match) is dropped. */
export function addVocab(...phrases: string[]) {
  cache.clear();
  for (const phrase of phrases) {
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

const known = (word: string) => vocab.has(word) || common.has(word);

/** Closest vocabulary word within max edits, or null. Ties go to the word with the same first, then last letter. */
function closest(word: string, max: number) {
  let best: string | null = null;
  let bestScore = Infinity;
  for (let length = word.length - max; length <= word.length + max; length++) {
    for (const candidate of byLength.get(length) || []) {
      if (candidate.length < 4) continue;
      const d = distance(word, candidate, max);
      if (d > max) continue;
      // Two edits only when the first letter matches; the first letter is rarely the typo.
      if (d === 2 && candidate[0] !== word[0]) continue;
      const score = d * 4 + (candidate[0] === word[0] ? 0 : 2) + (candidate.at(-1) === word.at(-1) ? 0 : 1);
      if (score < bestScore) { best = candidate; bestScore = score; }
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

/** "hurtmyself" -> "hurt myself" when both halves are known words (one at least 4 letters). */
function split(word: string) {
  for (let i = 2; i <= word.length - 2; i++) {
    const left = word.slice(0, i), right = word.slice(i);
    if (known(left) && known(right) && Math.max(left.length, right.length) >= 4 && (vocab.has(left) || vocab.has(right))) return `${left} ${right}`;
  }
  return null;
}

function fixWord(word: string) {
  const key = word.replace(/'/g, '');
  if (SHORTHAND[key]) return SHORTHAND[key];
  if (key.length < 4 || known(key)) return word;
  if (cache.has(key)) return cache.get(key)!;
  const fixed = doubling(key) || closest(key, 1) || split(key) || (key.length >= 7 ? closest(key, 2) : null) || word;
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
