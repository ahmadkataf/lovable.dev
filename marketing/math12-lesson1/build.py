#!/usr/bin/env python3
"""Voice + timeline pipeline for the lesson video.

  python3 build.py sections                      # group script lines into TTS sections (≈2–5 min each)
  python3 build.py voicetest --tts T --voices a,b,c   # same paragraph in several voices → voice/test/
  python3 build.py gen --tts T --voice V [--style S] [--only 1,2]   # one Gemini request per section
  python3 build.py split                         # cut each section WAV into one clip per script line
  python3 build.py restore                       # section WAVs from the committed FLACs (no API calls)
  python3 build.py timeline [--estimate]         # timeline.js/json + narration.wav + lesson.srt

T = path to gemini_tts.py (reads GEMINI_API_KEY). Free tier: 10 requests/day, so one request = one
section, never one line. Existing WAVs are never regenerated.
"""
import argparse, csv, json, os, re, subprocess, sys, time, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VDIR = HERE                           # per-video folder (script.json, voice/, timeline.*); --video solutions
P = lambda *a: os.path.join(VDIR, *a)
PREFIX = 'L01'
SR = 24000
LEAD, GAP, TAIL = 0.8, 0.5, 1.0      # seconds: scene start → first line, between lines, after last line
EST_WPS = 1.75                        # words/second used before real audio exists (ar-001-tutor-2 ≈ 1.74)
MAX_WORDS = 400                       # per TTS section (≈ 3–4 min; small sections = cheap retakes)
PAUSE = ' <long pause> '              # between lines inside a section
VOICE = 'ar-001-tutor-2'              # locked for the whole course (owner's choice after the voice test)
STYLE = 'clear, friendly instructor, moderate pace'


def load_script():
    s = json.load(open(P('script.json'), encoding='utf-8'))
    for sc in s['scenes']:
        for i, ln in enumerate(sc['lines']):
            ln['id'] = f"{sc['id']}_{i:02d}"
    return s


def words(t):
    return len(re.findall(r'\S+', t))


def read_wav(path):
    with wave.open(path) as w:
        assert w.getsampwidth() == 2, path
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
        if w.getnchannels() > 1:
            x = x.reshape(-1, w.getnchannels()).mean(1)
        sr = w.getframerate()
    if sr != SR:
        t = np.arange(int(len(x) * SR / sr)) / SR
        x = np.interp(t, np.arange(len(x)) / sr, x).astype(np.float32)
    return x


def write_wav(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    y = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())


# ---------------------------------------------------------------- sections
def cmd_sections(a):
    s = load_script()
    secs, cur, cw = [], [], 0
    for sc in s['scenes']:
        w = sum(words(l['say']) for l in sc['lines'])
        if cur and cw + w > MAX_WORDS:
            secs.append(cur); cur, cw = [], 0
        cur.append(sc); cw += w
    if cur:
        secs.append(cur)
    os.makedirs(P('voice', 'sections'), exist_ok=True)
    meta = []
    rows = []
    for k, group in enumerate(secs, 1):
        lines = [l for sc in group for l in sc['lines']]
        text = PAUSE.join(l['say'].strip() for l in lines)
        name = f'{PREFIX}_s{k}'
        open(P('voice', 'sections', name + '.txt'), 'w', encoding='utf-8').write(text + '\n')
        wc = sum(words(l['say']) for l in lines)
        meta.append({'name': name, 'scenes': [sc['id'] for sc in group], 'lines': [l['id'] for l in lines], 'words': wc})
        rows.append({'lesson': PREFIX, 'section': k, 'script': f'voice/sections/{name}.txt', 'wav': f'voice/sections/{name}.wav',
                     'start_sec': '', 'status': 'done' if os.path.exists(P('voice', 'sections', name + '.wav')) else 'todo'})
        print(f'{name}: scenes {group[0]["id"]}–{group[-1]["id"]}, {len(lines)} lines, {wc} words ≈ {wc / EST_WPS / 60:.1f} min')
    json.dump(meta, open(P('voice', 'sections.json'), 'w'), ensure_ascii=False, indent=1)
    write_manifest(rows)


def write_manifest(rows):
    with open(P('voice', 'manifest.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['lesson', 'section', 'script', 'wav', 'start_sec', 'status'])
        w.writeheader(); w.writerows(rows)


def run_tts(tts, text_file, out, voice, style, model):
    cmd = [sys.executable, '-I', tts, '--in', text_file, '--out', out, '--voice', voice, '--model', model]
    if style:
        cmd += ['--style', style]
    r = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(r.stdout); sys.stderr.write(r.stderr)
    return r.returncode, 'SKIP' in r.stdout


def cmd_voicetest(a):
    text = a.text or open(P('voice', 'test', 'sample.txt'), encoding='utf-8').read().strip()
    os.makedirs(P('voice', 'test'), exist_ok=True)
    open(P('voice', 'test', 'sample.txt'), 'w', encoding='utf-8').write(text + '\n')
    for i, v in enumerate(a.voices.split(',')):
        if i:
            time.sleep(22)
        code, skipped = run_tts(a.tts, P('voice', 'test', 'sample.txt'), P('voice', 'test', f'{v}.wav'), v, a.style, a.model)
        if code == 3:
            sys.exit(3)


def cmd_gen(a):
    meta = json.load(open(P('voice', 'sections.json')))
    only = {int(x) for x in a.only.split(',')} if a.only else None
    first = True
    for k, m in enumerate(meta, 1):
        if only and k not in only:
            continue
        out = P('voice', 'sections', m['name'] + '.wav')
        if os.path.exists(out):
            print('SKIP (exists)', out); continue
        if not first:
            time.sleep(a.gap)
        first = False
        code, _ = run_tts(a.tts, P('voice', 'sections', m['name'] + '.txt'), out, a.voice, a.style, a.model)
        if code == 3:
            print(f'Daily quota used up. Remaining sections: {[x["name"] for x in meta if not os.path.exists(P("voice", "sections", x["name"] + ".wav"))]}')
            sys.exit(3)
        if code:
            sys.exit(code)
        flac(out)
    cmd_sections(a)  # refresh manifest status


def flac(wav):
    """Lossless copy that is small enough to commit (the WAVs are git-ignored)."""
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'flac', wav[:-4] + '.flac'], check=True)


def cmd_restore(a):
    """Recreate section WAVs from the committed FLAC files (no API calls)."""
    for f in sorted(os.listdir(P('voice', 'sections'))):
        if f.endswith('.flac') and not os.path.exists(P('voice', 'sections', f[:-5] + '.wav')):
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', P('voice', 'sections', f), P('voice', 'sections', f[:-5] + '.wav')], check=True)
            print('restored', f[:-5] + '.wav')


# ---------------------------------------------------------------- split sections into lines
def frame_db(x, hop=0.01, win=0.03):
    h, n = int(SR * hop), int(SR * win)
    m = max(1, (len(x) - n) // h)
    idx = np.arange(n)[None, :] + h * np.arange(m)[:, None]
    rms = np.sqrt((x[idx] ** 2).mean(1) + 1e-12)
    return 20 * np.log10(rms), hop


def silences(x, min_len=0.12):
    db, hop = frame_db(x)
    thr = max(np.percentile(db, 95) - 38, -60)
    sil = db < thr
    runs, i = [], 0
    while i < len(sil):
        if sil[i]:
            j = i
            while j < len(sil) and sil[j]:
                j += 1
            if (j - i) * hop >= min_len:
                runs.append(((i) * hop, (j) * hop))
            i = j
        else:
            i += 1
    return runs, db, hop, thr


AR_DIAC = re.compile(r'[ً-ْٰـ]')


def norm_chars(t):
    """Normalise Arabic for alignment: no tags, tashkeel, punctuation; unify hamza/alef/ta marbuta/ya forms."""
    t = re.sub(r'<[^>]+>', ' ', t)
    t = AR_DIAC.sub('', t)
    t = re.sub('[إأآٱ]', 'ا', t).replace('ة', 'ه').replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'[^ء-ي0-9]', '', t)


def asr_words(path):
    """Word timestamps from faster-whisper (cached next to the WAV)."""
    cache = path + '.words.json'
    if os.path.exists(cache):
        return json.load(open(cache, encoding='utf-8'))
    from faster_whisper import WhisperModel
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True).stdout
    model = WhisperModel(os.environ.get('WHISPER_MODEL', 'medium'), device='cpu', compute_type='int8',
                         download_root=os.environ.get('WHISPER_DIR'))
    segs, _ = model.transcribe(np.frombuffer(raw, np.float32), language='ar', word_timestamps=True, beam_size=5,
                               condition_on_previous_text=True)
    out = [[w.word, round(w.start, 3), round(w.end, 3)] for sg in segs for w in sg.words]
    json.dump(out, open(cache, 'w', encoding='utf-8'), ensure_ascii=False)
    return out


def align_bounds(line_texts, wds):
    """Character alignment of script vs ASR. For each line: index of the first/last ASR word that matched it,
    and how many of its characters are unmatched before the first / after the last match."""
    import difflib
    script, owner = '', []
    for k, t in enumerate(line_texts):
        n = norm_chars(t); script += n; owner += [k] * len(n)
    asr, wid = '', []
    for j, (w, st, en) in enumerate(wds):
        n = norm_chars(w); asr += n; wid += [j] * len(n)
    sm = difflib.SequenceMatcher(None, script, asr, autojunk=False)
    match = {}
    for blk in sm.get_matching_blocks():
        for j in range(blk.size):
            match[blk.a + j] = wid[blk.b + j]
    L = len(line_texts)
    fw, lw, head, tail, cover = [None] * L, [None] * L, [0] * L, [0] * L, [0.0] * L
    start = 0
    for k in range(L):
        idx = [i for i in range(start, start + owner.count(k))]
        m = [i for i in idx if i in match]
        if m:
            fw[k], lw[k] = match[m[0]], match[m[-1]]
            head[k], tail[k] = m[0] - idx[0], idx[-1] - m[-1]
        cover[k] = len(m) / max(1, len(idx))
        start += len(idx)
    return fw, lw, head, tail, cover


def cmd_split(a):
    """Cut every section WAV into one clip per script line, using Whisper word timings aligned to the script,
    then snapping each cut to the longest silence between the two lines."""
    s = load_script()
    say = {l['id']: l['say'] for sc in s['scenes'] for l in sc['lines']}
    meta = json.load(open(P('voice', 'sections.json')))
    report = []
    for m in meta:
        path = P('voice', 'sections', m['name'] + '.wav')
        if not os.path.exists(path):
            print('missing', path); continue
        x = read_wav(path)
        total = len(x) / SR
        runs, db, hop, thr = silences(x, min_len=0.08)
        texts = [say[i] for i in m['lines']]
        wds = asr_words(path)
        fw, lw, head, tail, cover = align_bounds(texts, wds)
        cuts = []
        for k in range(len(texts) - 1):
            prev = cuts[-1] if cuts else 0.0
            lo = wds[lw[k]][2] if lw[k] is not None else prev
            nxt = next((j for j in range(k + 1, len(texts)) if fw[j] is not None), None)
            hi = wds[fw[nxt]][1] if nxt is not None else total
            if hi < lo:
                lo, hi = hi, lo
            tl_, hd = tail[k], (head[k + 1] if nxt == k + 1 else 99)
            t_est = lo + (hi - lo) * (tl_ / (tl_ + hd)) if tl_ + hd else (lo + hi) / 2
            cand = [(abs((a0 + b0) / 2 - t_est) - .3 * min(b0 - a0, .8), (a0 + b0) / 2)
                    for a0, b0 in runs if lo - .1 <= (a0 + b0) / 2 <= hi + .1 and (a0 + b0) / 2 > prev]
            cuts.append(min(cand)[1] if cand else max(prev + .05, (lo + hi) / 2))
        bounds = [0.0] + cuts + [total]
        for k, lid in enumerate(m['lines']):
            a0, b0 = bounds[k], bounds[k + 1]
            seg = x[int(a0 * SR):int(b0 * SR)]
            sdb, h = frame_db(seg) if len(seg) > SR * 0.05 else (np.array([-99]), 0.01)
            loud = np.where(sdb > thr)[0]
            if len(loud):
                st = max(0, loud[0] * h - 0.06); en = min(len(seg) / SR, (loud[-1] + 3) * h + 0.12)
            else:
                st, en = 0, len(seg) / SR
            clip = seg[int(st * SR):int(en * SR)].copy()
            f = min(len(clip) // 2, int(0.01 * SR))
            if f:
                clip[:f] *= np.linspace(0, 1, f); clip[-f:] *= np.linspace(1, 0, f)
            write_wav(P('voice', 'lines', lid + '.wav'), clip)
            dur = len(clip) / SR
            report.append((lid, round(a0 + st, 2), round(dur, 2), round(words(say[lid]) / max(dur, .01), 2), round(cover[k], 2)))
    rates = np.array([r[3] for r in report])
    med = float(np.median(rates)) if len(rates) else 0
    with open(P('voice', 'split-report.tsv'), 'w') as f:
        f.write('line\tsection_start\tdur\twords_per_sec\tasr_match\tflag\n')
        for r in report:
            flag = 'CHECK' if (med and (r[3] < med * 0.6 or r[3] > med * 1.6)) or r[4] < .6 else ''
            f.write('\t'.join(map(str, r)) + '\t' + flag + '\n')
    flagged = sum(1 for r in report if (med and (r[3] < med * .6 or r[3] > med * 1.6)) or r[4] < .6)
    print(f'{len(report)} line clips, median {med:.2f} words/s, {flagged} flagged (see voice/split-report.tsv)')


# ---------------------------------------------------------------- timeline
def fmt_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def cmd_timeline(a):
    s = load_script()
    have = all(os.path.exists(P('voice', 'lines', l['id'] + '.wav')) for sc in s['scenes'] for l in sc['lines'])
    use_audio = have and not a.estimate
    t = 0.0
    scenes, clips = [], []
    for sc in s['scenes']:
        start = t
        t += LEAD
        lines = []
        for i, ln in enumerate(sc['lines']):
            if use_audio:
                x = read_wav(P('voice', 'lines', ln['id'] + '.wav')); d = len(x) / SR; clips.append((t, x))
            else:
                d = words(ln['say']) / EST_WPS
            lines.append({'id': ln['id'], 'start': round(t, 3), 'end': round(t + d, 3), 'text': ln['say']})
            t += d + float(ln.get('hold', 0) or 0) + (GAP if i < len(sc['lines']) - 1 else 0)
        t += TAIL + float(sc.get('tail', 0) or 0)
        scenes.append({'id': sc['id'], 'section': sc.get('section', ''), 'bookPage': sc.get('bookPage'),
                       'start': round(start, 3), 'end': round(t, 3), 'lines': lines})
    tl = {'fps': 30, 'total': round(t, 3), 'audio': use_audio, 'crumb': s.get('crumb', 'الوحدة الأولى · الدرس الأول'), 'scenes': scenes}
    json.dump(tl, open(P('timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(P('timeline.js'), 'w', encoding='utf-8').write('window.TL = ' + json.dumps(tl, ensure_ascii=False) + '\n')
    with open(P('lesson.srt'), 'w', encoding='utf-8') as f:
        n = 0
        for sc in scenes:
            for ln in sc['lines']:
                n += 1; f.write(f"{n}\n{fmt_srt(ln['start'])} --> {fmt_srt(ln['end'])}\n{ln['text']}\n\n")
    if use_audio:
        mix = np.zeros(int((t + 1) * SR), np.float32)
        for st, x in clips:
            i = int(st * SR); mix[i:i + len(x)] += x
        write_wav(P('voice', 'narration.wav'), mix)
    print(f"timeline: {len(scenes)} scenes, {sum(len(x['lines']) for x in scenes)} lines, {t / 60:.2f} min ({'real audio' if use_audio else f'estimated at {EST_WPS} words/s'})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', default='', help="'' = the lesson, 'solutions' = the exercises video")
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('sections')
    for name in ('voicetest', 'gen'):
        g = sub.add_parser(name)
        g.add_argument('--tts', required=True)
        g.add_argument('--style', default=STYLE)
        g.add_argument('--model', default='gemini-3.8-flash-tts')
        if name == 'gen':
            g.add_argument('--voice', default=VOICE); g.add_argument('--only')
            g.add_argument('--gap', type=float, default=22, help='seconds between requests (free tier needs ≥21; paid tier can use 2)')
        else:
            g.add_argument('--voices', required=True); g.add_argument('--text')
    sub.add_parser('split')
    sub.add_parser('restore')
    tl = sub.add_parser('timeline'); tl.add_argument('--estimate', action='store_true')
    a = ap.parse_args()
    global VDIR, PREFIX
    if a.video:
        VDIR = os.path.join(HERE, a.video); PREFIX = 'L01' + a.video[:3].upper()
    {'sections': cmd_sections, 'voicetest': cmd_voicetest, 'gen': cmd_gen, 'split': cmd_split, 'timeline': cmd_timeline, 'restore': cmd_restore}[a.cmd](a)


if __name__ == '__main__':
    main()
