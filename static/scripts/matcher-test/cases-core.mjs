// [message, expected] pairs for run.mjs. See run.mjs for what expected means.
export const CASES = [
  // --- Self-harm / suicide (must be emergency) ---
  ['i might hurt myself', 'emergency'],
  ['i want to kill myself', 'emergency'],
  ['im sucidal', 'emergency'],

  // --- Minor injuries and figures of speech (must NOT be emergency) ---
  ['i hurt myself lifting weights and my back is sore', 'naproxen'],
  ['this headache is killing me', 'acetaminophen'],

  // --- Typos reach the right rule ---
  ['i have a hedache', 'acetaminophen'],
  ['my stomache hurts and i have heartburn', 'tums'],
  ['fevr and chils', 'acetaminophen'],
];
