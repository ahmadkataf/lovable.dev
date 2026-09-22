"""Spread the correct option of generated exam papers evenly over a–d.
A paper whose right answers cluster on one letter can be passed by guessing that letter.
Only multiple-choice and ask-about questions are moved; options that name other letters
("both a and c") keep their order. The real past paper is never touched.
Usage: python3 scripts/balance-exam-answers.py src/books/g8/exams/term1-e.ts [...]"""
import random, re, sys

STR = r"""'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*\""""
LETTER_REF = re.compile(r"\b(both|all|none|neither)\b.*\b[a-d]\b|\b[a-d] and [a-d]\b", re.I)

def balance(path, seed):
    src = open(path).read()
    if re.search(r"\breal:\s*true", src):
        print(path, 'is a real paper — left as printed'); return
    rnd = random.Random(seed)
    counts = [0, 0, 0, 0]
    out, pos, moved = [], 0, 0
    pat = re.compile(r"kind: '(mcq|ask)'(?P<mid>.*?)options: \[(?P<opts>(?:\s*(?:" + STR + r")\s*,?)+)\], answer: (?P<ans>\d)")
    for m in pat.finditer(src):
        opts = re.findall(STR, m.group('opts'))
        ans = int(m.group('ans'))
        if len(opts) != 4 or any(LETTER_REF.search(o) for o in opts):
            counts[ans] += 1; continue
        # put the right option on the letter used least so far
        least = min(counts)
        target = rnd.choice([i for i, c in enumerate(counts) if c == least])
        right = opts[ans]
        others = [o for i, o in enumerate(opts) if i != ans]
        rnd.shuffle(others)
        new = others[:target] + [right] + others[target:]
        counts[target] += 1
        if target != ans: moved += 1
        opts_src = ', '.join(new)
        out.append(src[pos:m.start('opts')]); out.append(opts_src)
        out.append(src[m.end('opts'):m.start('ans')]); out.append(str(target))
        pos = m.end('ans')
    out.append(src[pos:])
    open(path, 'w').write(''.join(out))
    print(f'{path}: moved {moved} answers; a/b/c/d now {"/".join(map(str, counts))} (plus fixed items)')

for i, p in enumerate(sys.argv[1:]):
    balance(p, 1000 + i)
