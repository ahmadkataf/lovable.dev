import numpy as np, wave
SR=44100; DUR=21.5; N=int(SR*DUR)
rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
BEAT=0.5
def add(sig,t,gain=1.0,pan=0.0):
    i=int(t*SR); j=min(N,i+len(sig))
    if j<=i: return
    s=sig[:j-i]*gain
    L[i:j]+=s*np.sqrt((1-pan)/2)*1.414; R[i:j]+=s*np.sqrt((1+pan)/2)*1.414
def env(n,a,d):  # attack seconds, exp decay time const
    t=np.arange(n)/SR
    e=np.exp(-t/d); 
    if a>0: e*=np.minimum(1,t/a)
    return e
def lp(x,fc):  # one-pole lowpass
    a=np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); s=0.0
    # vectorized via lfilter-like recurrence using cumulative trick is hard; use chunked loop with numpy
    from itertools import accumulate
    y=np.array(list(accumulate(x*(1-a), lambda p,v: p*a+v)))
    return y
def hp(x,fc): return x-lp(x,fc)
def kick():
    n=int(0.45*SR); t=np.arange(n)/SR
    f=45+110*np.exp(-t/0.035); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-t/0.16)
    s+=0.4*rng.standard_normal(n)*np.exp(-t/0.003)
    return np.tanh(s*1.6)
def clap():
    n=int(0.3*SR); t=np.arange(n)/SR
    nz=rng.standard_normal(n); nz=hp(lp(nz,4500),900)
    e=np.exp(-t/0.09)
    for d in (0.0,0.011,0.022): e+= (t>=d)*np.exp(-np.maximum(0,t-d)/0.006)*0.8
    return nz*e*0.9
def hat(op=False):
    n=int((0.25 if op else 0.06)*SR); t=np.arange(n)/SR
    nz=np.diff(rng.standard_normal(n+1)); nz=np.diff(np.concatenate([[0],nz]))
    return nz*np.exp(-t/(0.07 if op else 0.014))*0.18
def saw(f,n,det=0):
    t=np.arange(n)/SR; out=np.zeros(n)
    for d in ([-det,0,det] if det else [0]):
        ff=f*(1+d); out+=2*((t*ff)%1)-1
    return out/ (3 if det else 1)
def note(m): return 440*2**((m-69)/12)
def bassnote(m,dur):
    n=int(dur*SR); s=saw(note(m),n)+0.6*np.sin(2*np.pi*note(m-12)*np.arange(n)/SR)
    s=lp(s,700)*env(n,0.004,dur*0.8); return np.tanh(s*1.4)*0.55
def pluck(m,dur=0.35):
    n=int(dur*SR); s=saw(note(m),n,0.006)
    s=lp(s,2600)*env(n,0.002,0.12); return s*0.22
def pad(ms,dur):
    n=int(dur*SR); s=sum(saw(note(m),n,0.008) for m in ms)/len(ms)
    t=np.arange(n)/SR; e=np.minimum(1,t/0.25)*np.minimum(1,(dur-t)/0.3)
    return lp(s,1400)*e*0.22
def impact():
    n=int(2.2*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*(38+40*np.exp(-t/0.08))*t)*np.exp(-t/0.7)
    s+=lp(rng.standard_normal(n),1800)*np.exp(-t/0.35)*0.5
    return np.tanh(s*1.8)*0.9
def riser(dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=t/dur
    nz=rng.standard_normal(n); lo=lp(nz,600); hi=nz-lo
    s=(lo*(1-x)+hi*x)*x**2.2
    tone=np.sin(2*np.pi*np.cumsum(200+1400*x**2)/SR)*x**2*0.25
    return (s*0.35+tone)
def whoosh(dur=0.55):
    n=int(dur*SR); t=np.arange(n)/SR; x=t/dur
    nz=lp(rng.standard_normal(n),3000); e=np.sin(np.pi*x)**2
    return nz*e*0.45
def tick():
    n=int(0.03*SR); t=np.arange(n)/SR
    return np.sin(2*np.pi*2400*t)*np.exp(-t/0.006)*0.25
def sparkle(t0):
    for k,m in enumerate([88,91,95,100]):
        add(pluck(m,0.4)*0.8,t0+k*0.05,pan=(-0.5+k*0.33))

# chord progression A minor: Am F C G (one chord per bar = 2s)
prog=[(57,[69,72,76]),(53,[65,69,72]),(48,[67,72,76]),(55,[67,71,74])]
# --- intro 0-2.5: pulse + riser
add(impact()*0.7,0.0)
for b in range(5): add(kick()*0.55,b*BEAT)
add(riser(2.45),0.05,0.9)
for k in range(8): add(tick()*1.2,0.5+k*0.25,pan=0.3)
add(pad([57,60,64],2.5)*0.9,0)
# --- main 2.5 - 16.5 and 16.5 - 21
def groove(t0,t1,full=True):
    b=0; t=t0
    while t<t1-1e-6:
        add(kick(),t,0.95)
        add(hat(),t+BEAT/2,1.0,pan=0.25)
        if full: add(hat(),t+BEAT*0.75,0.6,pan=-0.25)
        if b%2==1: add(clap(),t,0.8)
        t+=BEAT; b+=1
groove(2.5,12.5); groove(13.0,16.0); groove(16.5,19.5)
# bass & chords
t=2.5; ci=0
while t<19.5-1e-6:
    root,ch=prog[ci%4]
    for k in range(8):
        tt=t+k*0.25
        if tt>=19.5: break
        if 12.5<=tt<13.0 or 16.0<=tt<16.5: continue
        add(bassnote(root if k%4!=3 else root+12,0.22),tt)
    add(pad(ch,2.0),t)
    arp=ch+[ch[0]+12]
    for k in range(16):
        tt=t+k*0.125
        if tt>=19.5 or 12.5<=tt<13.0 or 16.0<=tt<16.5: continue
        if k%2==0 or tt>=13: add(pluck(arp[(k*3)%4]+12,0.3),tt,0.9,pan=(0.4 if k%2 else -0.4))
    t+=2.0; ci+=1
# transitions
add(whoosh(0.5),2.0,1.0); add(impact(),2.5,0.9); sparkle(2.6)
for tt in (5.0,7.0,9.0,11.0): add(whoosh(0.45),tt-0.35,0.6)
add(riser(0.5),12.5,0.6); add(impact()*0.8,13.0); 
for k in range(12): add(tick(),13.3+k*0.22,pan=0.2)
add(riser(0.5),16.0,0.7); add(impact(),16.5); sparkle(16.6)
add(whoosh(0.5),19.0,0.8); add(impact(),19.5,1.0); sparkle(19.55)
add(pad([57,64,69,72],2.0)*1.2,19.5)
# simple reverb (FFT convolution) on whole mix send
ir_n=int(1.3*SR); tir=np.arange(ir_n)/SR
irL=rng.standard_normal(ir_n)*np.exp(-tir/0.35); irR=rng.standard_normal(ir_n)*np.exp(-tir/0.35)
def conv(x,ir):
    n=1<<int(np.ceil(np.log2(len(x)+len(ir))))
    return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(ir,n),n)[:len(x)]
wetL=conv(L,irL); wetR=conv(R,irR); s=0.05/ np.sqrt(np.sum(irL**2))
L+=wetL*s*4; R+=wetR*s*4
# fade out tail & master
fo=int(1.0*SR); fadeenv=np.ones(N); fadeenv[-fo:]=np.linspace(1,0,fo)
mix=np.stack([L,R],1)*fadeenv[:,None]
mix=np.tanh(mix/np.max(np.abs(mix))*1.6)*0.89
with wave.open('music.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix*32767).astype('<i2').tobytes())
print('ok')
