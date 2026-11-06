#!/usr/bin/env python3
"""voice/script.json → voice/vo.txt: the spoken lines joined with a <long pause> tag between them
(the tag stays in English; Gemini TTS reads the text verbatim and the pause lets segment.py find the line boundaries)."""
import json, os, sys
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'voice/script.json')
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, 'voice/vo.txt')
lines = [l['vo'].strip() for l in json.load(open(src, encoding='utf-8'))['lines']]
open(dst, 'w', encoding='utf-8').write(' <long pause> '.join(lines) + '\n')
print(f'{len(lines)} lines, {sum(len(l.split()) for l in lines)} words → {dst}')
