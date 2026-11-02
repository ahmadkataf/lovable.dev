import wave, numpy as np, json, sys
SR=44100; info=json.load(open('sfx/info.json'))
def load(n):
    w=wave.open(n); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768; x=x.reshape(-1,w.getnchannels())
    if x.shape[1]==1: x=np.repeat(x,2,1)
    if sr!=SR: t=np.arange(int(len(x)*SR/sr))/SR; s=np.arange(len(x))/sr; x=np.stack([np.interp(t,s,x[:,c]) for c in range(2)],1)
    return x
def mixer(dur):
    N=int(dur*SR); m=np.zeros((N,2))
    def put(x,t,g=1.0,cut=None,fade=.05):
        x=x.copy()
        if cut: x=x[:int(cut*SR)]
        f=int(fade*SR); x[-f:]*=np.linspace(1,0,f)[:,None]
        i=int(t*SR); i0=max(0,-i); i=max(0,i); j=min(N,i+len(x)-i0); m[i:j]+=x[i0:i0+j-i]*g
    hit=lambda id,t,g=1.0,**k: put(load(f'sfx/{id}.wav'),t-info[id]['peak'],g,**k)
    return m,put,hit
def save(m,name):
    f=int(.4*SR); m[-f:]*=np.linspace(1,0,f)[:,None]; m=np.tanh(m/np.abs(m).max()*1.2)*0.9
    with wave.open(name,'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((m*32767).astype('<i2').tobytes())
V=lambda n: load(f'v-{n}.wav')
tick=load('sfx/1063.wav')
# words
m,put,hit=mixer(18.5)
hit('2299',.08,.8); hit('3115',.06,.6); hit('2073',.47,.5)
for i,n in enumerate(['career','aptitude','remuneration']):
    a=2.0+i*4.4; hit('3115',a+.05,.6); hit('2357',a+.2,.6); put(V(n),a+.35,1.0); put(V(n),a+1.9,.8)
    put(tick[int(.05*SR):],a+.7,.45,cut=2.9,fade=.15); hit('2870',a+3.72,.55,cut=1.0,fade=.3)
hit('2299',15.35,.8); hit('3005',15.75,.6); hit('2354',16.35,.6)
save(m,'a-words.wav')
# exam
m,put,hit=mixer(16)
hit('2299',.08,.8); hit('3115',.06,.6); hit('2357',.95,.6)
put(tick[int(.05*SR):],1.6,.5,cut=5.0,fade=.2); hit('2870',6.72,.65,cut=1.0,fade=.3); hit('2364',6.72,.3)
hit('3120' if False else '3115',7.45,.5); hit('2299',12.55,.8); hit('3005',12.6,.5); hit('2354',13.25,.6)
save(m,'a-exam.wav')
# idiom
m,put,hit=mixer(16)
hit('2299',.08,.8); hit('3115',.06,.6); put(V('onaroll'),.35,1.0); hit('2073',.55,.4)
hit('2655',2.02,.6); hit('3115',3.1,.5); hit('2299',3.42,.7); hit('3060',3.5,.4)
hit('2357',5.1,.6); put(V('sent'),5.6,1.0)
hit('2357',9.1,.6); put(V('dead'),9.6,1.0)
hit('2299',12.45,.8); hit('3005',12.5,.5); hit('2354',13.15,.6)
save(m,'a-idiom.wav')
print('ok')
