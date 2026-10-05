import wave, numpy as np, json
SR=44100; DUR=23.5; N=int(SR*DUR); mix=np.zeros((N,2))
info=json.load(open('sfx/info.json'))
def load(name):
    w=wave.open(name); sr=w.getframerate(); ch=w.getnchannels()
    x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768; x=x.reshape(-1,ch)
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
    x=x.copy()
    if cut: x=x[:int(cut*SR)]; f=int(fade*SR); x[-f:]*=np.linspace(1,0,f)[:,None]
    i=int(round(t*SR))
    if i<0: x=x[-i:]; i=0
    j=min(N,i+len(x)); y=x[:j-i]*g
    if pan: y=y*np.array([1-pan,1+pan])[None,:]
    mix[i:j]+=y
def hit(id,tev,g=1.0,**k): put(S(id),tev-info[id]['peak'],g,**k)
# hook
for k,tw in enumerate([0.0,0.32,0.62,1.0,1.32]):
    hit('3115',tw+.05,0.7,pan=(.25 if k%2 else -.25)); hit('2073',tw+.06,0.45)
hit('2299',0.66,0.6); hit('2299',1.36,0.75)
hit('1492',2.15,0.75)
# typing + send
put(S('2535')[int(0.2*SR):int(1.25*SR)],2.42,0.6,fade=.08)
hit('2358',3.62,0.7); hit('3115',3.6,0.35)
# messages: own -> dry pop ; incoming -> bubble pop
for t,who in [(4.25,'me'),(5.5,'them'),(6.8,'them'),(7.8,'me'),(8.9,'them'),(9.75,'me'),(10.35,'them')]:
    if who=='me': hit('2356',t+.03,0.75); hit('3115',t,0.25)
    else: hit('2357',t+.1,0.8); hit('2364',t+.02,0.25)
# tap card + enter app
hit('2568',10.95,0.8); hit('2608',11.42,0.8); hit('2903',11.5,0.8,cut=1.6,fade=.5)
# montage
for tp in (12.0,13.2,14.4,15.6): hit('2357',tp+.12,0.75); hit('2364',tp+.04,0.3)
for ts in (12.95,14.15,15.35): hit('168',ts+.05,0.6)
put(load('voice-normal.wav'),13.35,0.9)
hit('2870',14.57,0.55,cut=1.0,fade=.3)
put(S('1063')[int(0.05*SR):],15.5,0.5,cut=0.95,fade=.2)
# back to chat
hit('3120',16.45,0.4); hit('2356',16.93,0.8); hit('2364',16.92,0.3)
hit('2925',17.75,0.7); hit('3005',17.72,0.6)
# exit + CTA
hit('1492',18.85,0.7)
for t in (19.15,19.75,20.35,20.95): hit('2354',t+.05,0.75)
hit('2655',21.85,0.8); hit('3060',21.9,0.45)
hit('2350',22.85,0.4,cut=1.2,fade=.4)
f=int(.6*SR); mix[-f:]*=np.linspace(1,0,f)[:,None]
pk=np.max(np.abs(mix)); mix=np.tanh(mix/pk*1.25)*0.9
with wave.open('sfx4.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
print('ok',round(pk,2))
