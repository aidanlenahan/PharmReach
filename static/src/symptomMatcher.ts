// Keyword-based medication helper for the static site. This is NOT AI: it is a fixed list of
// if-statements that look for symptom words in the message and point to catalog products.
// The safety screens (emergency / ask a pharmacist) are ported from backend/chat.py and run first,
// and every reply is built from the same templates the Gemini helper used.
import { inStockCatalog, loadCatalog, loadWordList } from './staticApi';
import { Picks, has, precompile, recordPhrases } from './matcher/shared';
import { EMERGENCY_PATTERNS, EMERGENCY_WORDS } from './matcher/emergency';
import { addCommonWords, addRegexVocab, addVocab, fixTypos, wordsReady } from './matcher/typos';
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

// Over-the-counter medicines by name, for the dosing, mixing and alcohol checks below.
const OTC = String.raw`(tylenol|acetaminophen|paracetamol|advil|motrin|ibuprofen|aleve|naproxen|aspirin|excedrin|benadryl|diphenhydramine`
  + String.raw`|zyrtec|cetirizine|claritin|loratadine|allegra|fexofenadine|xyzal|chlor\w*|sudafed|pseudoephedrine|phenylephrine`
  + String.raw`|nyquil|dayquil|zzzquil|unisom|mucinex|guaifenesin|robitussin|delsym|dextromethorphan|pepto|imodium|loperamide`
  + String.raw`|tums|rolaids|pepcid|famotidine|zantac|prilosec|omeprazole|nexium|miralax|colace|dulcolax|melatonin|afrin|flonase`
  + String.raw`|antihistamines?|painkillers?|pain ?relievers?|sleeping pills?|sleep aids?|cold medicine|allergy (pills?|meds?|medicine))`;
// Prescription medicines (and kinds of them) people mention alongside an OTC question.
const RX = String.raw`\b(warfarin|coumadin|eliquis|apixaban|xarelto|rivaroxaban|plavix|clopidogrel|heparin|blood thinners?`
  + String.raw`|sertraline|zoloft|prozac|fluoxetine|lexapro|escitalopram|citalopram|celexa|paxil|paroxetine|wellbutrin|bupropion`
  + String.raw`|effexor|venlafaxine|cymbalta|duloxetine|trazodone|antidepressants?|ssris?|maois?|lithium|seroquel|abilify|lamictal`
  + String.raw`|lisinopril|losartan|amlodipine|metoprolol|atenolol|hydrochlorothiazide|hctz|diuretics?|water pills?`
  + String.raw`|metformin|ozempic|atorvastatin|lipitor|simvastatin|rosuvastatin|crestor|statins?|levothyroxine|synthroid`
  + String.raw`|prednisone|amoxicillin|augmentin|azithromycin|z ?pack|cipro|ciprofloxacin|doxycycline|keflex|cephalexin|penicillin`
  + String.raw`|gabapentin|lyrica|tramadol|oxy|oxys|oxycontin|percocet|vicodin|hydrocodone|codeine|morphine|fentanyl|suboxone|methadone`
  + String.raw`|alprazolam|klonopin|clonazepam|valium|diazepam|ativan|lorazepam|benzos?|ambien|zolpidem|ritalin|vyvanse|adderall`
  + String.raw`|birth control|chemo|chemotherapy)\b`;
const PHARMACIST_PATTERNS = [
  /prescri/, /\brx\b/, /refill/, /antibiotics?\b(?! (ointment|cream))/, /opioid/, /oxycodone/, /adderall/, /xanax/, /insulin/,
  new RegExp(RX), /\b(blood pressure|bp|heart|thyroid|diabetes|cholesterol|seizure|anxiety|depression|adhd|psych) (med|meds|medication|medications|medicine|pills?)\b/,
  /\b(on|taking|take) (other|any|some|my|regular|daily|prescription) (meds|medications?)\b/,
  /pregnan/, /\bpreg(?!am)/, /\bpragn/, /breast ?feed/, /\bnursing\b(?! (a|an|this|the|my) (hangover|cold|sore|cough|headache|migraine|fever|flu|injury|wound|bruise|sprain|stomach|back|knee|ankle|throat))/, /trying to conceive/,
  /\b(child|children|kid|kids|baby|babies|infant|toddler|newborn|son|daughter|teen|teenager|teething)\b/,
  /\b([0-9]|1[0-7]|[6-9][0-9]|1[0-9][0-9])[- ]?(year|yr)s?[- ]?old\b/, /\b\d{1,2}[- ]?(month|week|day)s?[- ]?old\b/,
  // Stomach ulcers: NSAIDs and Pepto (a salicylate) can make them worse. Mouth ulcers are removed in SAFE_PHRASES.
  /\bulcers?\b/,
  // Infected wounds or piercings need someone to look at them, not just a cream.
  /\b(infected|infection is spreading)\b/,
  // Dosing: how much, how often, how many at once, more than the label.
  /\bdos(e|es|age|ages|ing)\b/, /how (much|many)\b.{0,40}\b(should|can|could|do|to|is it ok to|is it safe to) (i|we|you|he|she|they|one|take|give)\b/,
  /how (much|many) \w+ (is|are) (safe|ok|okay|too much|too many)/, /how (much|many) (mg|milligrams?|ml|pills?|tablets?|capsules?|caps)\b/,
  /\bmg (should|can|do)\b/, /max(imum)? (dose|amount)/, /how often\b/, /\bevery how many\b/, /how many (hours|times)\b/,
  /how (long|soon)\b.{0,30}\b(between|apart|before i can|until i can|can i take|to wait|should i wait)\b/, /\b(hours|time) apart\b/,
  /\b(\d+|two|three|four|five|six|several|a few) \w+( \w+)? (at once|at a time|in one go)\b/,
  /\b((can|could|should|may) i|(ok|okay|safe|fine|alright) to) (take|have|use|give)\b.{0,20}\b(\d+|two|three|four|five|six|another|more|a second|extra|double)\b(?! (days?|weeks?|hours?|minutes?|times? a))/,
  /\bdouble (up|dose)\b/, /\b\d+ ?(mg|milligrams?|ml|pills?|tablets?|capsules?|caps)\b.{0,30}\b(too much|too many|safe|ok|okay|at once|at a time)\b/,
  /\b(too much|too many|more than)\b.{0,30}\b\d+ ?(mg|milligrams?|ml|pills?|tablets?|capsules?|caps)\b/,
  // Mixing medicines: "take tylenol and advil together", "zyrtec with benadryl", "pepto after taking imodium".
  /interact/, /\bmix(ing)? (with|it|them|\w+ (and|with))\b/, /\b(take|taking|took|mix|mixing|combine|combining|use|using)\b.{0,50}\b(together|at the same time|same time|with each other|alongside|on top of|in combination)\b/,
  new RegExp(String.raw`\b${OTC}\b.{0,25}\b(and|with|plus|after|then|on top of|while (on|taking)|if i (already )?(took|take|had|am taking))\b.{0,20}\b${OTC}\b`),
  new RegExp(String.raw`\b(take|taking|took|mix|mixing|combine|combining|use|using|had|have)\b.{0,30}\b${OTC}\b.{0,10}(&|\+)\s*${OTC}\b`),
  // Alcohol with a medicine.
  /with alcohol/, /while drinking/,
  new RegExp(String.raw`\b(drink|drinking|drank|alcohol|beers?|wine|liquor|booze|drunk)\b(?! (of |some |more |lots of |plenty of |enough )?(water|tea|fluids|juice|coffee|milk|gatorade|electrolytes|enough|lots|more|plenty))\b.{0,30}\b(on|after|with|while|before|and|then)\b.{0,25}\b(${OTC}|taking|meds|medicine|pills?)\b`),
  new RegExp(String.raw`\b(${OTC}|meds|medicine|pills?)\b.{0,30}\b(after|with|while|before|and|then)\b.{0,20}\b(drink|drinking|drank|alcohol|beers?|wine|liquor|booze|drunk)\b(?! (of |some |more |lots of |plenty of |enough )?(water|tea|fluids|juice|coffee|milk|gatorade|electrolytes|enough|lots|more|plenty))`),
];
// Removed before the pharmacist check: phrases that use those words in an unrelated sense.
const SAFE_PHRASES = [
  /baby aspirin/g, /triple[- ]antibiotic/g, /antibiotic (ointment|cream)/g, /(mouth|canker|tongue|lip|cheek) ulcers?/g,
  /(not|n't|nt|never|to prevent|to avoid|to stop it from|so it won't|keep (it|them|\w+|a \w+|the \w+) from) (get |getting |become |becoming |be |being )?infected/g,
  /prescription[- ]strength/g, /(not|isn't|isnt|without|no|non|doesn't need|don't need) (a |an )?prescription/g, /non-prescription/g,
  /dose of (reality|sunshine|fresh air|humor|humour)/g, /like a baby/g, /son of a (gun|bitch|b)\b/g, /baby ?sit\w*/g, /daughter ?boards?/g,
  /refill(ing|ed)? (my |the |a |our )?(water|cup|glass|coffee|drink|bottle|tank|gas|mug|plate)\w*/g,
  /(how much|what) (does|do|is) .{0,30}(cost|price)/g, /how much (is|are) (a |the )?\w+ (at|in|from) /g,
  // Children as the cause or the setting, not the patient: "a cold from my kids", "i teach kids", "my son gave me his cold".
  /\b(from|by|around) (my|the|our|his|her|their) (kids?|sons?|daughters?|child|children|baby|toddlers?)\b(?! (has|have|is|are|got|gets|feels|seems|keeps|can't|cant|won't|wont|needs?|ate|swallowed|drank|took))/g,
  /\b(teach|teaching|coach|coaching|babysit|babysitting|chasing|hugging|carrying|lifting|picking up|playing with|wrangling) (the |my |our |some |his |her )?(kids?|sons?|daughters?|child|children|baby|babies|toddlers?)\b/g,
  /\b(my|the|our) (kids?|sons?|daughters?|child|children|baby|toddlers?) (gave|passed|brought|got) (me|us)\b/g,
];

export function normalize(message: string) {
  return message.replaceAll('’', "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

// The typo fixer only knows the words the rules use: run every rule once in record mode to collect them.
let vocabReady = false;
const phraseLists: string[][] = [];
function loadVocab() {
  if (vocabReady) return;
  vocabReady = true;
  recordPhrases((phrases) => { addVocab(...phrases); phraseLists.push(phrases); });
  try { runRules('', new Picks()); } finally { recordPhrases(null); }
  addRegexVocab([...EMERGENCY_PATTERNS, ...PHARMACIST_PATTERNS]);
  addVocab(...EMERGENCY_WORDS);
  // Pharmacist words the patterns only hold as fragments (/pregnan/), so "pregant" becomes pregnant.
  addVocab('pregnant pregnancy breastfeeding prescription prescribed antibiotics dosage interaction');
}

/** Normalized message with typos fixed ("my stomache hurst" -> "my stomach hurts"). */
export function clean(message: string) {
  loadVocab();
  return fixTypos(normalize(message));
}

export function screen(message: string): 'emergency' | 'pharmacist' | null {
  // The emergency screen checks the message as typed and with typos fixed; either one matching counts.
  const typed = normalize(message), fixed = clean(message);
  // Without the word list the fixer won't guess, so the emergency screen also tries an eager guess.
  const guessed = wordsReady() ? fixed : fixTypos(typed, true);
  if (EMERGENCY_PATTERNS.some((pattern) => pattern.test(typed) || pattern.test(fixed) || pattern.test(guessed))) return 'emergency';
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
  // ("what do i have to do to stop sneezing" and "what do i have that helps" are ordinary requests.)
  if (has(t, 'diagnose', 'diagnosis', 'what is wrong with me', "what's wrong with me", 'am i sick', 'do i have cancer', 'is it cancer', 'std', 'sti')
    || /\bwhat do i have\b(?! (to|that|for|in|at|on hand|here|left))/.test(t)) {
    return { ids: [], refuse: true };
  }
  // Attempts to change the helper's rules.
  if (has(t, 'ignore previous', 'ignore all previous', 'ignore all prior', 'ignore all instructions', 'ignore all rules', 'ignore all your', 'ignore the rules',
    'ignore your', 'system prompt', 'your instructions', 'pretend to be', 'pretend you are', 'jailbreak', 'developer mode')
    || /\b(you|now|please|pls|and|to) act as\b|^act as\b|\bact as (a|an|my) (doctor|pharmacist|physician|nurse|ai|assistant|chatbot|bot|model|unrestricted|unfiltered)\b/.test(t)) {
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

let catalogVocab = false;
let wordsLoaded = false;

// The big English list keeps real words from being "fixed"; until it loads, only shorthand is expanded.
async function loadWords() {
  if (wordsLoaded) return;
  const words = await loadWordList();
  if (words) { addCommonWords(words); wordsLoaded = true; }
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Load the word list and compile every pattern ahead of the first message. The browser compiles a
 *  regex the first time it runs (about a second for all of them on a phone), so this runs in small
 *  batches with pauses between, keeping the page responsive while the user types. */
export async function warmUp() {
  await loadWords();
  await pause();
  loadVocab();
  // Each pattern runs twice: the browser first interprets a regex and compiles it fully on a later run.
  const samples = ['i have a headache and a sore throat, my stomach hurts and i cant sleep', 'my back is sore'];
  const work = [
    ...EMERGENCY_PATTERNS.map((pattern) => () => samples.forEach((sample) => pattern.test(sample))),
    ...PHARMACIST_PATTERNS.map((pattern) => () => samples.forEach((sample) => pattern.test(sample))),
    ...phraseLists.map((phrases) => () => samples.forEach((sample) => precompile(phrases, sample))),
  ];
  for (let i = 0; i < work.length; i += 20) {
    await pause();
    work.slice(i, i + 20).forEach((run) => run());
  }
}

/** Answer one helper message entirely in the browser. */
export async function answer(message: string): Promise<ChatReply> {
  const reply = (status: ChatStatus): ChatReply => ({ status, message: TEMPLATES[status as keyof typeof TEMPLATES] || TEMPLATES.no_match, suggestions: [] });
  await loadWords();
  const flag = screen(message);
  if (flag) return reply(flag);
  let catalog: Record<string, any>[];
  try { catalog = inStockCatalog(await loadCatalog()); }
  catch { return reply('unavailable'); }
  // Brand and product names are known words too, so "tylenl" or "zyrtek" still find the product (added once).
  if (!catalogVocab) {
    catalogVocab = true;
    for (const m of catalog) addVocab(...catalogTerms(m).filter((term) => !DESCRIPTIVE.test(term)));
  }
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
