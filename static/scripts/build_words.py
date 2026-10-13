# Usage: python3 scripts/build_words.py en_50k.txt public/english-words.txt dropped.txt
# Source list: https://github.com/hermitdave/FrequencyWords (content/2018/en/en_50k.txt, OpenSubtitles counts).
# Builds static/public/english-words.txt from a word-frequency list (most frequent first, "word count" per line).
# Drops rare spellings that look like slips of a far more common word ("realy", "untill") and rare
# run-togethers with tiny words ("wantto", "inthe"), so the typo fixer still corrects them.
import sys, string
rows = [l.split()[0] for l in open(sys.argv[1])]
rank = {}
for i, w in enumerate(rows):
    if w.isalpha() and w.isascii() and w not in rank: rank[w] = i
def slips(w):
    for i in range(1, len(w)):
        if w[i] == w[i - 1]: yield w[:i] + w[i + 1:], 100     # doubled letter
        else: yield w[:i] + w[i - 1] + w[i:], 100              # letter not doubled
    for i in range(1, len(w) + 1):
        for c in string.ascii_lowercase: yield w[:i] + c + w[i:], 1000  # dropped letter
    for i in range(1, len(w)): yield w[:i] + w[i + 1:], 1000   # extra letter
    for i in range(1, len(w) - 1): yield w[:i] + w[i + 1] + w[i] + w[i + 2:], 1000  # swapped
TINY = {'to', 'you', 'the', 'me', 'it'}
# Misspellings the filter can't catch.
EXCLUDE = {'brest', 'hury', 'meself'}
out, dropped = [], []
for w, r in sorted(rank.items(), key=lambda x: x[1]):
    if len(w) < 4 or w in EXCLUDE: continue
    bad = None
    if r > 5000:
        for v, ratio in slips(w):
            if v != w and len(v) >= 4 and v in rank and rank[v] * ratio < r and not (w.startswith(v) or v.startswith(w)): bad = v; break
    if not bad and r > 20000:
        for i in range(2, len(w) - 1):
            a, b = w[:i], w[i:]
            if (a in TINY or b in TINY) and min(len(a), len(b)) >= 2 and a in rank and b in rank and rank[a] < 3000 and rank[b] < 3000: bad = a + ' ' + b; break
    (dropped if bad else out).append(f'{w}->{bad}' if bad else w)
open(sys.argv[2], 'w').write('\n'.join(out) + '\n')
open(sys.argv[3], 'w').write('\n'.join(dropped) + '\n')
print(len(out), len(dropped))
