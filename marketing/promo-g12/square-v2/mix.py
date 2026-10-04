import wave, numpy as np, json
SR=44100; DUR=20.0; N=int(SR*DUR); mix=np.zeros((N,2))
info=json.load(open('sfx/info.json'))
def load(name):
    w=wave.open(name); sr=w.getframerate(); ch=w.getnchannels()
    x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768
    x=x.reshape(-1,ch)
    if ch==1: x=np.repeat(x,2,1)
    if sr!=SR:
        t=np.arange(int(len(x)*SR/sr))/SR; src=np.arange(len(x))/sr
        x=np.stack([np.interp(t,src,x[:,c]) for c in range(2)],1)
    return x
cache={}
def S(id): 
    if id not in cache: cache[id]=load(f'sfx/{id}.wav')
    return cache[id]
def put(x,t,g=1.0,cut=None,fade=.05,pan=0.0):
    if cut: x=x[:int(cut*SR)].copy(); f=int(fade*SR); x[-f:]*=np.linspace(1,0,f)[:,None]
    i=int(round(t*SR)); 
    if i<0: x=x[-i:]; i=0
    j=min(N,i+len(x)); 
    y=x[:j-i]*g
    if pan: y=y*np.array([1-pan,1+pan])[None,:]
    mix[i:j]+=y
def hit(id,tev,g=1.0,**k):   # align sample peak with visual event time
    put(S(id),tev-info[id]['peak'],g,**k)
# ---- A kinetic words
hit('2299',0.06,0.9); hit('3115',0.05,0.6)
hit('3115',0.46,0.75,pan=.3); hit('2073',0.47,0.5)
hit('3115',0.88,0.75,pan=-.3); hit('2073',0.89,0.5)
hit('2299',1.22,0.7); hit('3005',1.3,0.9)
hit('3115',1.64,0.75); hit('2299',1.66,0.55)
hit('2608',2.12,0.8)
hit('2903',2.42,0.95,cut=2.6,fade=.6)
# ---- B logo
hit('2350',3.25,0.55,cut=1.8,fade=.4)
hit('3120',2.85,0.35); hit('3120',3.05,0.3)
hit('2568',3.33,0.7); hit('2568',3.43,0.7)
hit('1492',4.45,0.75)
# ---- C phone
for tp in (5.0,6.95,8.95,10.95): hit('2357',tp+.12,0.8); hit('2364',tp+.05,0.35)
for ts in (6.5,8.5,10.5): hit('168',ts+.05,0.6)
# voice demo
put(load('voice-normal.wav'),7.22,0.9)
hit('2568',7.75,0.8)
put(load('voice-slow.wav'),8.0,0.9)
hit('2870',9.17,0.6,cut=1.0,fade=.3)
put(S('1063')[int(0.05*44100):],11.0,0.55,cut=1.35,fade=.25)
hit('2608',12.7,0.75); hit('1143',12.98,0.9,cut=1.4,fade=.4)
# ---- D stats
for k,ts in enumerate((13.75,14.5,15.25)): hit('772',ts+.08,0.85)
for ts in (13.0,13.75,14.5,15.25): put(S('1053')[int(1.0*SR):int(1.45*SR)],ts+.05,0.35,fade=.08,cut=.45)
# ---- E CTA
hit('166',16.18,0.7)
hit('3120',16.3,0.4)
hit('2655',16.75,0.8); hit('3060',16.8,0.5)
hit('2003',17.35,0.7)
hit('2354',17.75,0.8)
hit('2568',17.95,0.6)
hit('2350',18.75,0.45,cut=1.4,fade=.4)
hit('2903',19.2,0.75,cut=0.8+0.65,fade=.5)
# master: gentle limiter
f=int(.6*SR); mix[-f:]*=np.linspace(1,0,f)[:,None]
pk=np.max(np.abs(mix)); mix=mix/pk*1.25; mix=np.tanh(mix)*0.9
with wave.open('sfx3.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
print('ok',pk)
