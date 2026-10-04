import numpy as np, wave
src=open('music.py').read(); exec(src[:src.index('# chord progression')])
def pop(f=900,dur=0.12,g=0.5):
    n=int(dur*SR); t=np.arange(n)/SR
    fr=f*(1+1.2*np.exp(-t/0.012)); s=np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-t/0.035)
    return s*g
def click(g=0.6):
    n=int(0.05*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*1800*t)*np.exp(-t/0.004)+hp(rng.standard_normal(n),3000)*np.exp(-t/0.002)*0.6
    return s*g
def chime():
    out=np.zeros(int(0.9*SR))
    for k,(m,d) in enumerate([(84,0),(91,0.09)]):
        n=int(0.7*SR); t=np.arange(n)/SR; f=note(m)
        s=(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*2*f*t)+0.15*np.sin(2*np.pi*3*f*t))*np.exp(-t/0.22)
        i=int(d*SR); out[i:i+n]+=s*0.35
    return out
def swipe(dur=0.3,g=0.5):
    n=int(dur*SR); t=np.arange(n)/SR; x=t/dur
    nz=rng.standard_normal(n); lo=lp(nz,2500); s=(hp(lo,400)*(1-x)+hp(nz,1500)*x*0.5)*np.sin(np.pi*x)**1.5
    return s*g
def stamp():
    return impact()[:int(0.9*SR)]*0.8+click(0.8).tolist().__len__()*0 + np.pad(click(0.9),(0,int(0.9*SR)-int(0.05*SR)))
def buzz(dur=0.4):
    n=int(dur*SR); t=np.arange(n)/SR
    s=np.sign(np.sin(2*np.pi*95*t))*0.5+np.sin(2*np.pi*190*t)*0.3
    return lp(s,1500)*np.exp(-t/0.18)*0.35
def scratch(dur=0.25):
    n=int(dur*SR); t=np.arange(n)/SR
    s=hp(rng.standard_normal(n),2000)*np.sin(np.pi*t/dur)
    return s*0.35
def coin():
    n=int(0.5*SR); t=np.arange(n)/SR
    f=np.where(t<0.07,note(83),note(88))
    return np.sign(np.sin(2*np.pi*np.cumsum(f)/SR))*np.exp(-t/0.15)*0.12

# ---- scene 1
add(impact()*0.8,0.05); add(swipe(0.4,0.7),0.38,pan=-0.4)
add(pop(700,0.15,0.6),0.97); add(buzz(0.4),1.05)
add(scratch(0.28),1.6); add(pop(1100,0.15,0.6),1.86); sparkle(1.9)
# ---- wipe -> logo
add(whoosh(0.55),2.05,1.1); add(impact(),2.5); sparkle(2.55)
for k,tt in enumerate([2.85,3.0,3.3,3.6,3.9]): add(pop(800+k*120,0.12,0.45),tt,pan=(-0.3 if k%2 else 0.3))
add(whoosh(0.45),4.5,0.9)
# ---- phone
add(swipe(0.6,0.9),5.0); add(pop(900,0.12,0.4),5.3)
for tt in (6.45,7.45,9.6,11.5): add(click(0.7),tt)
for tt in (6.65,8.65,10.65,11.6): add(swipe(0.35,0.55),tt,pan=0.3)
for tt in (6.85,8.85,10.85): add(pop(950,0.12,0.4),tt)
for k in range(4): add(pop(1500,0.08,0.25),7.55+k*0.28,pan=0.2)   # speaker ripples
add(pop(1200,0.12,0.45),7.9)                                       # slow chip
add(chime(),9.85); sparkle(9.95)
add(whoosh(0.4),12.5,0.7); add(swipe(0.45,0.9),12.85)
# ---- stats
add(impact()*0.7,13.05); add(pop(800,0.12,0.45),13.1); add(pop(1000,0.12,0.45),13.25)
for i in range(4): add(swipe(0.3,0.5),13.4+i*0.18,pan=(-0.4 if i%2 else 0.4)); add(click(0.4),13.6+i*0.18)
for k in range(24): add(tick()*0.9,13.6+k*0.055,pan=(k%2-0.5)*0.4)
add(coin(),14.9); add(pop(900,0.12,0.4),14.9); add(pop(1050,0.12,0.4),15.1)
add(riser(0.45),16.05,0.7); add(swipe(0.5,1.0),16.3)
# ---- CTA
add(impact()*0.6,16.55); add(pop(900,0.12,0.45),16.6); add(pop(1000,0.12,0.45),16.75)
add(impact(),17.0); add(click(0.9),17.0); sparkle(17.05)
add(swipe(0.35,0.6),17.45); add(coin(),17.7)
add(pop(950,0.12,0.45),18.1); add(pop(1100,0.1,0.35),18.35)
add(riser(0.5),18.95,0.6); add(impact(),19.45,1.1); sparkle(19.5); add(chime()*0.8,19.6)
fo=int(1.0*SR); e=np.ones(N); e[-fo:]=np.linspace(1,0,fo)
ir_n=int(0.8*SR); tir=np.arange(ir_n)/SR; ir=rng.standard_normal(ir_n)*np.exp(-tir/0.18)
def conv(x,ir):
    n=1<<int(np.ceil(np.log2(len(x)+len(ir)))); return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(ir,n),n)[:len(x)]
sc=0.12/np.sqrt(np.sum(ir**2)); L2=L+conv(L,ir)*sc; R2=R+conv(R,ir[::-1].copy())*sc
mix=np.stack([L2,R2],1)*e[:,None]; mix=np.tanh(mix/np.max(np.abs(mix))*1.4)*0.89
with wave.open('sfx.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
print('ok')
