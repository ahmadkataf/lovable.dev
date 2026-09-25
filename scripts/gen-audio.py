"""Generate per-unit audio sprites (mp3) + index.json from audio-src/<book>/texts.json using Piper TTS.
Usage: python3 scripts/gen-audio.py <voice.onnx> [book]      (default book: g8 -> public/g8/audio)
"""
import json, sys, os, struct, subprocess, wave, io, time
from piper import PiperVoice
import numpy as np

voice_path = sys.argv[1]
# A bigger book can be recorded at a lower rate to keep the Android app small (speech stays clear at 16 kHz / 16 kbps).
AUDIO_RATE = os.environ.get('AUDIO_RATE', '22050')
AUDIO_KBPS = os.environ.get('AUDIO_KBPS', '24k')
book = sys.argv[2] if len(sys.argv) > 2 else 'g8'
out_dir = f'public/{book}/audio'
os.makedirs(out_dir, exist_ok=True)
texts = json.load(open(f'audio-src/{book}/texts.json'))
voice = PiperVoice.load(voice_path)
SR = voice.config.sample_rate
GAP = int(float(os.environ.get('AUDIO_GAP', '0.25')) * SR)  # silence between clips
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
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        voice.synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf, 'rb') as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    # trim leading/trailing near-silence
    thr = 300
    idx = np.where(np.abs(data) > thr)[0]
    if len(idx): data = data[max(0, idx[0] - int(0.05*SR)): min(len(data), idx[-1] + int(0.12*SR))]
    return data

index = {}
total_sec = 0
t0 = time.time()
for group, items in texts.items():
    parts, pos, entries = [], 0, {}
    for text in items:
        spoken = speakable(text)
        if spoken is None:
            continue
        pcm = synth(spoken)
        if len(pcm) == 0:
            continue
        entries[norm(text)] = [round(pos / SR, 3), round(len(pcm) / SR, 3)]
        parts.append(pcm); parts.append(np.zeros(GAP, dtype=np.int16))
        pos += len(pcm) + GAP
    audio = np.concatenate(parts)
    wav_path = os.path.join(out_dir, f'{group}.wav')
    with wave.open(wav_path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(audio.tobytes())
    mp3_path = os.path.join(out_dir, f'{group}.mp3')
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', wav_path, '-ac', '1', '-ar', AUDIO_RATE, '-codec:a', 'libmp3lame', '-b:a', AUDIO_KBPS, mp3_path], check=True)
    os.remove(wav_path)
    index[group] = entries
    sec = pos / SR; total_sec += sec
    print(f'{group}: {len(items)} clips, {sec/60:.1f} min, {os.path.getsize(mp3_path)/1e6:.2f} MB, elapsed {time.time()-t0:.0f}s', flush=True)

json.dump({'sr': SR, 'groups': index}, open(os.path.join(out_dir, 'index.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('total minutes', round(total_sec / 60, 1))
