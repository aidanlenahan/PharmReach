// Keyword-based medication helper for the static site. This is NOT AI: it is a fixed list of
// if-statements that look for symptom words in the message and point to catalog products.
// The safety screens (emergency / ask a pharmacist) are ported from backend/chat.py and run first,
// and every reply is built from the same templates the Gemini helper used.
import { inStockCatalog, loadCatalog } from './staticApi';
import { Picks, has, recordPhrases } from './matcher/shared';
import { EMERGENCY_PATTERNS, EMERGENCY_WORDS } from './matcher/emergency';
import { addRegexVocab, addVocab, fixTypos } from './matcher/typos';
import { coldSoreRules, skinRules } from './matcher/rules/skin';
import { painRules } from './matcher/rules/pain';
import { stomachRules } from './matcher/rules/stomach';
import { allergyRules } from './matcher/rules/allergy';
import { respiratoryRules } from './matcher/rules/respiratory';
import { sleepRules } from './matcher/rules/sleep';
import { productsRules } from './matcher/rules/products';

export type ChatSuggestion = { id: string; name: string; strength: string; category: string; results_url: string; product_url: string | null };
export type ChatStatus = 'match' | 'no_match' | 'refuse' | 'fallback' | 'emergency' | 'pharmacist' | 'error' | 'unavailable' | 'rate_limited' | 'busy' | 'invalid';
export type ChatReply = { status: ChatStatus; message: string; suggestions: ChatSuggestion[] };

const MAX_SUGGESTIONS = 3;

const TEMPLATES = {
  emergency: 'This could be a medical emergency. Call 911 now or go to the nearest emergency room. '
    + 'If you are thinking about suicide or self-harm, call or text 988 (Suicide & Crisis Lifeline). '
    + 'PharmReach cannot help with emergencies. PharmReach is not liable for anything emergency related. Always rely on emergency services, not this website.',
  pharmacist: 'Please ask a pharmacist or your doctor about this. Questions about prescriptions, pregnancy or '
    + 'breastfeeding, children, dosing, or mixing medicines need a professional. '
    + 'Any pharmacy counter can help, usually at no cost.',
  match: 'Over-the-counter options in our catalog for {category}:',
  match_footer: 'Pick one to compare nearby stores. Always read the label, and ask a pharmacist if you are unsure it is right for you.',
  no_match: "I couldn't match that to an over-the-counter product we track. Try describing a common symptom, "
    + 'like a headache, allergies, or heartburn, or search by product name. A pharmacist can also help.',
  refuse: 'I can only suggest over-the-counter products from the PharmReach catalog for common, minor symptoms. '
    + 'For anything else, please ask a pharmacist or doctor.',
  unavailable: 'The medication helper is not available right now. You can still search by product name.',
};

// --- Safety screens (ported from backend/chat.py; emergency list in matcher/emergency.ts) ---

const PHARMACIST_PATTERNS = [
  /prescri/, /\brx\b/, /refill/, /antibiotics?\b(?! ointment)/, /opioid/, /oxycodone/, /adderall/, /xanax/, /insulin/,
  /pregnan/, /breast ?feed/, /nursing/, /trying to conceive/,
  /\b(child|children|kid|kids|baby|babies|infant|toddler|newborn|son|daughter|teen|teenager)\b/, /\b\d{1,2}[- ]?(year|yr|month)s?[- ]?old\b/,
  /\bdos(e|es|age|ing)\b/, /how (much|many) (should|can|do)/, /\bmg (should|can|do)\b/, /max(imum)? (dose|amount)/,
  /interact/, /mix(ing)? (with|it|them)/, /together with/, /with alcohol/, /while drinking/,
];
const SAFE_PHRASES = [/baby aspirin/g, /triple[- ]antibiotic/g, /antibiotic ointment/g];

export function normalize(message: string) {
  return message.replaceAll('’', "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

// The typo fixer only knows the words the rules use: run every rule once in record mode to collect them.
let vocabReady = false;
function loadVocab() {
  if (vocabReady) return;
  vocabReady = true;
  recordPhrases((phrases) => addVocab(...phrases));
  try { runRules('', new Picks()); } finally { recordPhrases(null); }
  addRegexVocab([...EMERGENCY_PATTERNS, ...PHARMACIST_PATTERNS]);
  addVocab(...EMERGENCY_WORDS);
}

/** Normalized message with typos fixed ("my stomache hurst" -> "my stomach hurts"). */
export function clean(message: string) {
  loadVocab();
  return fixTypos(normalize(message));
}

export function screen(message: string): 'emergency' | 'pharmacist' | null {
  // The emergency screen checks the message as typed and with typos fixed; either one matching counts.
  const typed = normalize(message), fixed = clean(message);
  if (EMERGENCY_PATTERNS.some((pattern) => pattern.test(typed) || pattern.test(fixed))) return 'emergency';
  for (let text of [typed, fixed]) {
    for (const phrase of SAFE_PHRASES) text = text.replace(phrase, ' ');
    if (PHARMACIST_PATTERNS.some((pattern) => pattern.test(text))) return 'pharmacist';
  }
  return null;
}

/** Map a message to products with plain keyword checks. Returns ranked product IDs (may be empty). */
export function matchSymptoms(message: string): { ids: string[]; refuse: boolean } {
  const t = clean(message);
  const picks = new Picks();

  // Requests the helper must not answer: diagnosis and "what do I have" questions.
  if (has(t, 'diagnose', 'diagnosis', 'what do i have', 'what is wrong with me', "what's wrong with me", 'am i sick', 'do i have cancer', 'is it cancer', 'std', 'sti')) {
    return { ids: [], refuse: true };
  }
  // Attempts to change the helper's rules.
  if (has(t, 'ignore previous', 'ignore all', 'ignore your', 'system prompt', 'your instructions', 'pretend to be', 'act as', 'jailbreak')) {
    return { ids: [], refuse: true };
  }

  runRules(t, picks);
  return { ids: picks.ranked(), refuse: false };
}

function runRules(t: string, picks: Picks) {
  t = coldSoreRules(t, picks);
  productsRules(t, picks);
  painRules(t, picks);
  stomachRules(t, picks);
  allergyRules(t, picks);
  respiratoryRules(t, picks);
  skinRules(t, picks);
  sleepRules(t, picks);
}

// Catalog aliases also hold descriptions ("heartburn relief", "allergy medicine"); those are left to the symptom rules.
const DESCRIPTIVE = /relief|medicine|reliever|reducer|heartburn|stomach|diarrh|constipation|congestion|cough|allerg|antacid|laxative|softener|sleep|itch|first aid|spray|drops|cream|ointment|rinse|steroid|expectorant|decongestant|antihistamine|non-drowsy|24-hour|cold sore/;

/** Product names or brands typed directly ("tylenol", "zyrtec") match catalog names and aliases. */
function catalogTerms(m: Record<string, any>): string[] {
  return [m.name, ...(m.aka || '').split(' · '), ...(m.search_terms || [])].map((term: string) => normalize(term || ''));
}

function nameMatches(message: string, catalog: Record<string, any>[]) {
  const t = clean(message);
  return catalog.filter((m) => catalogTerms(m)
    .some((term: string) => term.length >= 4 && !DESCRIPTIVE.test(term) && has(t, term))).map((m) => m.id);
}

function retailerUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)(cvs|walgreens)\.com$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

/** Answer one helper message entirely in the browser. */
export async function answer(message: string): Promise<ChatReply> {
  const reply = (status: ChatStatus): ChatReply => ({ status, message: TEMPLATES[status as keyof typeof TEMPLATES] || TEMPLATES.no_match, suggestions: [] });
  const flag = screen(message);
  if (flag) return reply(flag);
  let catalog: Record<string, any>[];
  try { catalog = inStockCatalog(await loadCatalog()); }
  catch { return reply('unavailable'); }
  // Brand and product names are known words too, so "tylenl" or "zyrtek" still find the product.
  for (const m of catalog) addVocab(...catalogTerms(m).filter((term) => !DESCRIPTIVE.test(term)));
  const stocked = new Set(catalog.map((m) => m.id));

  const { ids: symptomIds, refuse } = matchSymptoms(message);
  if (refuse) return reply('refuse');
  // Product names typed directly come first, then symptom matches.
  const ids = [...new Set([...nameMatches(message, catalog), ...symptomIds])].filter((id) => stocked.has(id));
  // Two package sizes of the same product would crowd the list; keep the first of each name + strength.
  const seen = new Set<string>();
  const picked = ids.map((id) => catalog.find((m) => m.id === id)!).filter((m) => {
    // Same product in another pack size: compare the name and the leading dose ("5 mg").
    const key = `${m.name}|${(m.strength || '').match(/^[\d.,]+\s*[a-z%]+/i)?.[0] || m.strength}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_SUGGESTIONS);
  if (!picked.length) return reply('no_match');

  const suggestions = picked.map((m) => ({
    id: m.id, name: m.name, strength: m.strength || '', category: m.category || '',
    results_url: '/results?medication=' + encodeURIComponent(m.id),
    product_url: retailerUrl(m.product_source),
  }));
  const heading = suggestions[0].category || 'your symptom';
  return { status: 'match', message: TEMPLATES.match.replace('{category}', heading.toLowerCase()) + '\n' + TEMPLATES.match_footer, suggestions };
}
