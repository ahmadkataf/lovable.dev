"""Generate per-unit audio sprites (mp3) + index.json from audio-src/<book>/texts.json.
Usage: python3 scripts/gen-audio.py <voice> [book]      (default book: g8 -> public/g8/audio)
  <voice> is a Piper voice (.onnx), or, for the more natural Kokoro voices, the folder holding Kokoro's
  model.onnx and voices.npz followed by the voice name:  path/to/kokoro:af_heart
Optional environment: AUDIO_RATE, AUDIO_KBPS, AUDIO_GAP, AUDIO_CHUNK (below), and AUDIO_GROUPS=u1,m2 to
record only those units again, keeping the rest of the index.
"""
import json, sys, os, struct, subprocess, wave, io, time
import numpy as np

voice_path = sys.argv[1]
# A bigger book can be recorded at a lower rate to keep the Android app small (speech stays clear at 16 kHz / 16 kbps).
AUDIO_RATE = os.environ.get('AUDIO_RATE', '22050')
AUDIO_KBPS = os.environ.get('AUDIO_KBPS', '24k')
book = sys.argv[2] if len(sys.argv) > 2 else 'g8'
out_dir = f'public/{book}/audio'
os.makedirs(out_dir, exist_ok=True)
texts = json.load(open(f'audio-src/{book}/texts.json'))

if ':' in voice_path and os.path.isdir(voice_path.rsplit(':', 1)[0]):
    from kokoro_onnx import Kokoro
    kdir, kvoice = voice_path.rsplit(':', 1)
    kokoro = Kokoro(os.path.join(kdir, 'model.onnx'), os.path.join(kdir, 'voices.npz'))
    SR = 24000
    def raw_synth(text):
        s, sr = kokoro.create(text, voice=kvoice, speed=1.0, lang='en-gb' if kvoice[0] == 'b' else 'en-us')
        assert sr == SR
        return (np.clip(s, -1, 1) * 32767).astype(np.int16)
else:
    from piper import PiperVoice
    voice = PiperVoice.load(voice_path)
    SR = voice.config.sample_rate
    def raw_synth(text):
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            voice.synthesize_wav(text, w)
        buf.seek(0)
        with wave.open(buf, 'rb') as w:
            assert w.getframerate() == SR and w.getnchannels() == 1
            return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
GAP = int(float(os.environ.get('AUDIO_GAP', '0.25')) * SR)  # silence between clips
# Each group is cut into files of at most this many seconds (u1c0.mp3, u1c1.mp3, …): a phone decodes a
# file whole into memory before playing it, and one long file per unit took hundreds of MB and crashed
# the app. 0 keeps one file per group.
CHUNK = int(float(os.environ.get('AUDIO_CHUNK', '45')) * SR)
try:
    import imageio_ffmpeg; FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = 'ffmpeg'

def norm(s): return ' '.join(s.split()).strip().lower()

import re
def speakable(text):
    """What the voice should say for a text. Maths is read the way the Maths unit teaches it
    (plus, minus, times, divided by, equals); strings with nothing to say return None."""
    t = text
    t = re.sub(r'\s*×\s*', ' times ', t)
    t = re.sub(r'\s*÷\s*', ' divided by ', t)
    t = re.sub(r'\s*=\s*', ' equals ', t)
    t = re.sub(r'(?<=\d)\s*\+\s*(?=\d)', ' plus ', t)
    t = re.sub(r'(?<=\d)\s*[−–-]\s*(?=\d)', ' minus ', t)
    t = re.sub(r'[…]+|\.{2,}|_{2,}', ' ', t)
    return t if re.search(r'[A-Za-z0-9]', t) else None

def synth(text):
    data = raw_synth(text)
    # trim leading/trailing near-silence
    thr = 300
    idx = np.where(np.abs(data) > thr)[0]
    if len(idx): data = data[max(0, idx[0] - int(0.05*SR)): min(len(data), idx[-1] + int(0.12*SR))]
    return data

ONLY = [g for g in os.environ.get('AUDIO_GROUPS', '').split(',') if g]
index = {}
if ONLY:
    import re as _re
    index = {k: v for k, v in json.load(open(os.path.join(out_dir, 'index.json')))['groups'].items() if _re.sub(r'c\d+$', '', k) not in ONLY}
    for f in os.listdir(out_dir):
        if f.endswith('.mp3') and _re.sub(r'c\d+$', '', f[:-4]) in ONLY: os.remove(os.path.join(out_dir, f))
    texts = {g: t for g, t in texts.items() if g in ONLY}
total_sec = 0
t0 = time.time()
def write(name, parts):
    wav_path = os.path.join(out_dir, f'{name}.wav')
    with wave.open(wav_path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.concatenate(parts).tobytes())
    mp3_path = os.path.join(out_dir, f'{name}.mp3')
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', wav_path, '-ac', '1', '-ar', AUDIO_RATE, '-codec:a', 'libmp3lame', '-b:a', AUDIO_KBPS, mp3_path], check=True)
    os.remove(wav_path)
    return os.path.getsize(mp3_path)

for group, items in texts.items():
    files, parts, pos, entries, size, sec = [], [], 0, {}, 0, 0
    def flush():
        global size, sec
        if not parts: return
        name = f'{group}c{len(files)}' if CHUNK else group
        size += write(name, parts); sec += pos / SR
        index[name] = dict(entries); files.append(name)
    for text in items:
        spoken = speakable(text)
        if spoken is None:
            continue
        pcm = synth(spoken)
        if len(pcm) == 0:
            continue
        if CHUNK and parts and pos + len(pcm) > CHUNK:
            flush(); parts, pos, entries = [], 0, {}
        entries[norm(text)] = [round(pos / SR, 3), round(len(pcm) / SR, 3)]
        parts.append(pcm); parts.append(np.zeros(GAP, dtype=np.int16))
        pos += len(pcm) + GAP
    flush()
    total_sec += sec
    print(f'{group}: {len(items)} clips in {len(files)} files, {sec/60:.1f} min, {size/1e6:.2f} MB, elapsed {time.time()-t0:.0f}s', flush=True)

json.dump({'sr': SR, 'groups': index}, open(os.path.join(out_dir, 'index.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('total minutes', round(total_sec / 60, 1))
