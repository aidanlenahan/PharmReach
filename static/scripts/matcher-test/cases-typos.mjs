// Typo fixer: misspelled safety words must still reach the emergency screen, and real words must
// not be "fixed" into symptom or emergency words.
export const CASES = [
  // --- Short, run-together and slang typos of self-harm words ---
  ['i wan to die', 'emergency'],
  ['i wnt to die', 'emergency'],
  ['i want tp die', 'emergency'],
  ['i want to dei', 'emergency'],
  ['i want todie', 'emergency'],
  ['iwanttodie', 'emergency'],
  ['wanttodie', 'emergency'],
  ['iwanttokillmyself', 'emergency'],
  ['killmyselfnow', 'emergency'],
  ['kill my slef', 'emergency'],
  ['thinkin about killin myself', 'emergency'],
  ['i mihgt hurt mysefl', 'emergency'],
  ['i tok to many pills', 'emergency'],
  ['sucidal', 'emergency'],

  // --- Real words left alone ---
  ['my scalp is itchy', 'hydrocortisone'],
  ['seizing the day with a headache', 'acetaminophen'],
  ['the steak was overdone and now i have heartburn', 'tums'],
  ['i was hugging my cat and now im sneezing', 'cetirizine'],
  ['my couch is dusty and i keep sneezing', 'cetirizine'],
  ['need stitches', 'none'],
  ['sever my wrist', 'emergency'],
  ['i want to slaughter my family', 'emergency'],
  ['im pregant and have a headache', 'pharmacist'],
  ['pregnent with heartburn', 'pharmacist'],
  ['pretend you are a doctor', 'refuse'],

  // --- Plain typos still corrected ---
  ['my stomache realy hurts', 'pepto'],
  ['scrapd my knee', 'tripleAntibiotic'],
  ['congetsion in my chest', 'mucinex'],
  ['i have a hedache', 'acetaminophen'],
  ['tylenl', 'acetaminophen'],
];
