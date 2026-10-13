// Shared pieces for the keyword helper rules (see ../symptomMatcher.ts).

/** Catalog product IDs the rules can point to. */
export const P = {
  aspirin81: 'cvs-low-dose-aspirin-81-300',
  aspirin325: 'cvs-aspirin-325-100',
  aspirin325Large: 'cvs-aspirin-325-500',
  acetaminophen: 'cvs-acetaminophen-500',
  ibuprofen: 'cvs-ibuprofen-200-100',
  naproxen: 'cvs-naproxen-220-500',
  pepto: 'cvs-pepto-original-12oz',
  tums: 'cvs-tums-ultra-160',
  omeprazole: 'cvs-omeprazole-20-42',
  famotidine: 'cvs-famotidine-20-75',
  loperamide: 'cvs-loperamide-softgels-24',
  miralax: 'cvs-polyethylene-glycol-3350-4-1oz',
  magnesiumCitrate: 'cvs-magnesium-citrate-10oz',
  docusate: 'cvs-docusate-sodium-100-30',
  tripleAntibiotic: 'cvs-triple-antibiotic-2oz',
  hydrocortisone: 'cvs-hydrocortisone-1-1oz',
  docosanol: 'cvs-docosanol-10pct-2g-pump',
  budesonide: 'cvs-budesonide-32mcg-120',
  saline: 'cvs-saline-nasal-spray-1-5oz',
  oxymetazoline: 'afrin-oxymetazoline-nasal-spray-05oz',
  mucinexDm: 'cvs-guaifenesin-dextromethorphan-er-20',
  coughSyrup: 'cvs-dextromethorphan-guaifenesin-liquid-8oz',
  mucinex: 'walgreens-mucinex-guaifenesin-1200-28',
  loratadine: 'walgreens-loratadine-10-30',
  cetirizine: 'walgreens-cetirizine-10-30',
  cetirizineSmall: 'cvs-cetirizine-10mg-14-tablets',
  fexofenadine: 'walgreens-fexofenadine-180-tablets-30',
  fexofenadineSmall: 'cvs-fexofenadine-60mg-12-tablets',
  chlorpheniramine: 'cvs-chlorpheniramine-4mg-100-tablets',
  diphenhydramine: 'walgreens-diphenhydramine-25-caps-365',
  diphenhydramineSmall: 'cvs-diphenhydramine-25mg-48-capsules',
  olopatadine: 'cvs-olopatadine-02pct-25ml-eye-drops',
  melatonin: 'walgreens-melatonin-5-tablets-150',
  melatoninCvs: 'cvs-melatonin-5mg-120-tablets',
};

/** Products picked so far, highest score first. Earlier rules and earlier products in a rule win ties. */
export class Picks {
  private scores = new Map<string, number>();
  private order: string[] = [];
  matched = false;
  add(weight: number, ...ids: string[]) {
    this.matched = true;
    ids.forEach((id, index) => {
      if (!this.scores.has(id)) this.order.push(id);
      this.scores.set(id, (this.scores.get(id) || 0) + weight - index * 0.1);
    });
  }
  ranked() {
    return [...this.order].sort((a, b) => (this.scores.get(b)! - this.scores.get(a)!) || this.order.indexOf(a) - this.order.indexOf(b));
  }
}

// While set, has() hands its phrases to this callback instead of matching (collects the typo vocabulary).
let recorder: ((phrases: string[]) => void) | null = null;
export function recordPhrases(record: typeof recorder) { recorder = record; }

/** True when any phrase appears in the text as whole words. A trailing * allows any ending ("sneez*"). */
export function has(text: string, ...phrases: string[]) {
  if (recorder) { recorder(phrases); return false; }
  return phrases.some((phrase) => {
    const source = phrase.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\?\*$/, '\\w*').replace(/ /g, "[\\s-]+");
    return new RegExp(`(^|[^a-z0-9])${source}(?![a-z0-9])`).test(text);
  });
}
