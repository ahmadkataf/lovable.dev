# Builds timeline-<lang>.json: scene starts/ends driven by the voice-over durations + per-frame VO envelope (12 fps) for mouth flaps.
import json, subprocess, sys, numpy as np
FPS = 12; LEAD = 0.35; TAIL = 0.7; TAIL_CTA = 3.0; HEAD = 0.5
import os
LEAD = float(os.environ.get("LEAD", LEAD)); TAIL = float(os.environ.get("TAIL", TAIL)); HEAD = float(os.environ.get("HEAD", HEAD))
def dur(p): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p],capture_output=True,text=True).stdout.strip())
def pcm(p):
    raw = subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar','12000','-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(raw,'<i2').astype(float)/32768
import os
SCRIPT = os.environ.get('SCRIPT', 'script.json'); VO = os.environ.get('VO', 'vo'); PREFIX = os.environ.get('TLPREFIX', 'timeline')
if os.environ.get('TAIL_CTA'): TAIL_CTA = float(os.environ['TAIL_CTA'])
s = json.load(open(SCRIPT))
for lang in sys.argv[1:] or ['ar','en']:
    t = HEAD; scenes = []
    for sc in s['scenes']:
        f = f"{VO}/{lang}-{sc['id']}.mp3"; d = dur(f)
        vs = t + LEAD; ve = vs + d; e = ve + (TAIL_CTA if sc is s['scenes'][-1] else TAIL)
        scenes.append({'id': sc['id'], 'start': round(t,3), 'voStart': round(vs,3), 'voEnd': round(ve,3), 'end': round(e,3), 'file': f})
        t = e
    total = t
    env = np.zeros(int(np.ceil(total*FPS))+2)
    for sc in scenes:
        x = pcm(sc['file']); sr = 12000; hop = sr//FPS
        for i in range(len(x)//hop):
            r = np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2))
            fi = int(round((sc['voStart'] + i/FPS)*FPS))
            if fi < len(env): env[fi] = r
    env = env/ (env.max() or 1)
    json.dump({'fps': FPS, 'lang': lang, 'total': round(total,3), 'scenes': scenes, 'env': [round(float(v),3) for v in env]}, open(f'{PREFIX}-{lang}.json','w'))
    print(lang, 'total', round(total,2), [(sc['id'], sc['start'], sc['end']) for sc in scenes])
