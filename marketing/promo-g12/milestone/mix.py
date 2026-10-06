import wave, numpy as np, json, re
SR=44100; DUR=17.0; N=int(SR*DUR); mix=np.zeros((N,2))
info=json.load(open('sfx/info.json'))
def load(name):
    w=wave.open(name); x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768; return x.reshape(-1,w.getnchannels())
cache={}
def S(id):
    if id not in cache: cache[id]=load(f'sfx/{id}.wav')
    return cache[id]
def put(x,t,g=1.0,cut=None,fade=.05,pan=0.0,fin=0):
    x=x.copy()
    if cut: x=x[:int(cut*SR)]
    f=int(fade*SR); x[-f:]*=np.linspace(1,0,f)[:,None]
    if fin: fi=int(fin*SR); x[:fi]*=np.linspace(0,1,fi)[:,None]
    i=int(round(t*SR))
    if i<0: x=x[-i:]; i=0
    j=min(N,i+len(x)); y=x[:j-i]*g
    if pan: y=y*np.array([1-pan,1+pan])[None,:]
    mix[i:j]+=y
def hit(id,tev,g=1.0,**k): put(S(id),tev-info[id]['peak'],g,**k)
# arrival times: same formula as the page
html=open('milestone.html').read()
SUBS=int(re.search(r'const SUBS=(\d+)',html).group(1)); T0,T1=1.75,4.55
n=min(SUBS,108)
for i in range(n):
    u=(i+1)/n; ta=T0+(T1-T0)*np.sqrt(u)-.28
    hit('2073',ta+.28,0.22+0.1*(i%3==0),pan=((i*37)%11-5)/7)
    if i%9==0: hit('3005',ta+.28,0.25)
# hook
for k,tw in enumerate([0.0,0.35,0.7]): hit('3115',tw+.05,0.7,pan=(.25 if k%2 else -.25)); hit('2073',tw+.06,0.45)
hit('2299',0.72,0.7); hit('530',0.8,0.45)
hit('3120',1.42,0.35)
# the 104 moment
hit('2903',T1+.27,0.9,cut=2.2,fade=.6)
put(S('975'),T1+.15,0.55,cut=3.0,fade=.8,fin=.1)
put(S('506')[int(1.0*SR):],T1+.2,0.45,cut=4.8,fade=1.2,fin=.2)
hit('524',T1+.33,0.5,cut=1.0,fade=.3)
# phone + notifications
hit('1492',6.0,0.7)
for t in (6.15,6.75,7.3,7.9): hit('2354',t+.05,0.8)
hit('2655',8.0,0.7); hit('3060',8.05,0.45); hit('530',8.1,0.4)
hit('3120',6.22,0.3)
hit('168',9.75,0.6)
# thanks
hit('3120',9.97,0.35); hit('3120',10.27,0.3)
hit('2299',11.05,0.75); hit('3005',11.1,0.6)
put(S('506')[int(7.0*SR):],11.1,0.32,cut=2.2,fade=.8,fin=.4)
# CTA
hit('166',13.15,0.6); hit('3120',13.37,0.35)
hit('2655',13.75,0.75); hit('3060',13.8,0.4)
hit('2003',14.35,0.65); hit('2354',14.75,0.75); hit('2568',14.95,0.55)
hit('2350',15.85,0.4,cut=1.2,fade=.4)
f=int(.5*SR); mix[-f:]*=np.linspace(1,0,f)[:,None]
pk=np.max(np.abs(mix)); mix=np.tanh(mix/pk*1.25)*0.9
with wave.open('sfx5.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
print('ok',SUBS,round(pk,2))
