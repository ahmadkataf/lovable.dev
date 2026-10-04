import numpy as np, wave
from itertools import accumulate
SR=44100; DUR=20.5; N=int(SR*DUR); rng=np.random.default_rng(11)
L=np.zeros(N); R=np.zeros(N)
def add(sig,t,g=1.0,pan=0.0):
    i=int(t*SR); j=min(N,i+len(sig))
    if j<=i or i<0: return
    s=sig[:j-i]*g; L[i:j]+=s*np.sqrt((1-pan)/2)*1.414; R[i:j]+=s*np.sqrt((1+pan)/2)*1.414
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); return np.array(list(accumulate(x*(1-a),lambda p,v:p*a+v)))
def hp(x,fc): return x-lp(x,fc)
def T(d): return np.arange(int(d*SR))/SR
def noise(d): return rng.standard_normal(int(d*SR))
def note(m): return 440*2**((m-69)/12)
def key(v=1.0):
    t=T(.07); nz=hp(lp(noise(.07),6500),1500)*np.exp(-t/.006)
    th=np.sin(2*np.pi*(140+rng.uniform(-20,20))*t)*np.exp(-t/.018)
    return (nz*0.5+th*0.6)*v
def bell(f,d=1.4,idx=3.0,g=0.3):
    t=T(d); mod=np.sin(2*np.pi*f*3.5*t)*idx*np.exp(-t/0.25)
    return np.sin(2*np.pi*f*t+mod)*np.exp(-t/(d/3.2))*g
def marimba(m,g=0.45):
    f=note(m); t=T(.6)
    s=np.sin(2*np.pi*f*t)*np.exp(-t/.22)+0.25*np.sin(2*np.pi*4*f*t)*np.exp(-t/.05)+0.15*np.sin(2*np.pi*10*f*t)*np.exp(-t/.008)
    return s*g
def knock(f=190,g=0.6):
    t=T(.15); return (np.sin(2*np.pi*f*t)*np.exp(-t/.05)+lp(noise(.15),900)*np.exp(-t/.012)*0.6)*g
def thump(g=0.8):
    t=T(.5); return np.sin(2*np.pi*(45+50*np.exp(-t/.05))*t)*np.exp(-t/.16)*g
def bloop(d=.55,g=.35):
    t=T(d); x=t/d; f=180*np.exp(np.log(5)*x**1.3); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.sin(np.pi*x)**1.2*g
def swish(d=.28,g=.4,bright=4500):
    t=T(d); x=t/d; e=np.minimum(1,x/.3)*np.exp(-np.maximum(0,x-.3)*5)
    return hp(lp(noise(d),bright),700)*e*g
def shutter(g=.5):
    out=np.zeros(int(.16*SR))
    for d0 in (0,.065):
        t=T(.05); c=(hp(noise(.05),2500)*np.exp(-t/.004)+np.sin(2*np.pi*900*t)*np.exp(-t/.006)*0.5)
        i=int(d0*SR); out[i:i+len(c)]+=c
    return out*g
def tink(f=2637,g=.25):
    t=T(.5); return (np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*2.76*t))*np.exp(-t/.12)*g
def wood(f,g=.35):
    t=T(.08); return np.sin(2*np.pi*f*t)*np.exp(-t/.018)*g
def flap(g=.5):
    t=T(.09); return (lp(noise(.09),2600)*np.exp(-t/.012)*0.7+np.sin(2*np.pi*95*t)*np.exp(-t/.03))*g
def zip_(d=.45,g=.25):
    t=T(d); x=t/d; f=300+1800*x**1.5; s=np.sin(2*np.pi*np.cumsum(f)/SR)*0.3+hp(noise(d),3000)*0.5*(0.5+0.5*np.sign(np.sin(2*np.pi*(20+60*x)*t)))
    return s*np.sin(np.pi*x)*g
def ratchet(g=.12):
    t=T(.012); return hp(noise(.012),3500)*np.exp(-t/.0015)*g
def marker(d,g=.22):
    t=T(d); x=t/d; sq=0.55+0.45*np.sin(2*np.pi*13*t)
    return hp(lp(noise(d),7000),1800)*sq*np.minimum(1,x/.1)*np.minimum(1,(1-x)/.1)*g
def bubble(g=.4):
    t=T(.12); f=350+1100*(t/.12); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.04)*g
def coins(g=.12):
    out=np.zeros(int(.5*SR))
    for k in range(9):
        f=rng.uniform(3000,6000); t=T(.08); s=np.sin(2*np.pi*f*t)*np.exp(-t/.02)
        i=int(rng.uniform(0,.35)*SR); out[i:i+len(s)]+=s
    return out*g

# ---------- S1 typewriter
add(knock(260,.45),0.12)
TYPED='شو أذكى طريقة تدرس فيها إنجليزي البكالوريا؟'; n=len(TYPED)
for k in range(n):
    tt=0.35+(k+0.5)*(1.75/n)
    add(key(0.45 if TYPED[k]==' ' else 0.8),tt,pan=rng.uniform(-.3,.3))
add(bell(note(88),1.2,2.0,.35),2.16)
add(bloop(.56,.4),2.42); add(swish(.5,.25,3000),2.5)
# ---------- S2 brand
add(thump(.9),3.08); add(knock(150,.7),3.08)
for i,m in enumerate([72,76,79,84]): add(marimba(m,.35),3.18+i*.08,pan=(-.5+i*.33))
for tt in (3.45,3.7,3.95): add(swish(.26,.32),tt)
add(swish(.42,.45,3500),5.18)
# ---------- S3 features
add(swish(.5,.4,3000),5.6); add(thump(.6),5.92)
for i,(st,m) in enumerate(zip([5.7,7.45,9.2,10.95],[67,71,74,79])):
    add(marimba(m,.42),st+(.25 if i==0 else 0)); add(marimba(m+12,.18),st+(.25 if i==0 else 0)+.09)
    if i>0: add(shutter(.55),st)
for tt in (7.9,9.7): add(wood(1500,.35),tt); add(key(.5),tt)
for k in range(4): add(tink(1760+k*0,.12),7.98+k*.33,pan=.3)   # speaker pings
add(bubble(.35),8.35)
add(tink(2637,.25),9.95); add(tink(3520,.25),10.05)
for k in range(3):                                           # clock
    add(wood(1250,.3),11.2+k*.5); add(wood(950,.3),11.45+k*.5)
for i in range(6): add(flap(.5),12.47+i*.045+.08,pan=(-.6+i*.24))
# ---------- S4 numbers
add(knock(240,.45),12.95); add(swish(.3,.3),13.05)
add(zip_(.5,.22),13.1)
vals=['1700','12','535','4500']
for ci,v in enumerate(vals):
    t0=13.35+ci*.17
    for j,ch in enumerate(v):
        d=int(ch); a=t0+j*.07; prev=0
        for s in np.linspace(0,1,240):
            pos=int((1-(1-s)**3)*(d+10))
            if pos>prev: add(ratchet(.1),a+s*1.15,pan=(-.4+ci*.27)); prev=pos
    add(knock(320,.35),t0+len(v)*.07+1.1)
for i in range(6): add(flap(.5),15.37+i*.045+.08,pan=(.6-i*.24))
# ---------- S5 CTA
add(knock(260,.4),15.8); add(swish(.26,.3),15.88)
add(bubble(.45),16.08); add(bell(note(84),1.0,1.5,.22),16.12)
add(marker(.42,.22),16.4)
add(swish(.26,.28),16.85)
add(bell(note(91),1.0,2.5,.25),17.05); add(bell(note(96),1.0,2.5,.2),17.13); add(coins(.14),17.1)
add(marker(.5,.2),17.35)
add(bubble(.4),18.02); add(wood(1800,.25),18.22)
add(swish(.25,.3,2500),18.72); add(thump(1.0),18.97); add(knock(120,.8),18.97)
for k,m in enumerate([72,76,79,84]): add(bell(note(m),2.2,1.2,.14),19.4+k*.06,pan=(-.4+k*.27))
# ---------- room reverb + master
irn=int(.6*SR); ti=np.arange(irn)/SR; ir1=rng.standard_normal(irn)*np.exp(-ti/.12); ir2=rng.standard_normal(irn)*np.exp(-ti/.12)
def conv(x,ir):
    m=1<<int(np.ceil(np.log2(len(x)+len(ir)))); return np.fft.irfft(np.fft.rfft(x,m)*np.fft.rfft(ir,m),m)[:len(x)]
k=0.18/np.sqrt(np.sum(ir1**2)); L2=L+conv(L,ir1)*k; R2=R+conv(R,ir2)*k
fo=int(.8*SR); e=np.ones(N); e[-fo:]=np.linspace(1,0,fo)
mix=np.stack([L2,R2],1)*e[:,None]; mix=np.tanh(mix/np.max(np.abs(mix))*1.3)*0.9
with wave.open('sfx2.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
print('ok')
