# Builds short.html (vertical 1080x1920 YouTube Short) from the stop-motion assets in stopmotion.html.
import re
src = open('stopmotion.html', encoding='utf-8').read()
defs = re.search(r'<defs>.*?</defs>', src, re.S).group(0)
helpers = src[src.index('// ---------- helpers ----------'):src.index('// ---------- scenes ----------')]
head = src[:src.index('<style>')]
css = src[src.index('<style>'):src.index('</style>') + 8]
# vertical canvas: 1080x1920, horizon lower, bigger labels
css = (css.replace('html,body{width:1920px;height:1080px', 'html,body{width:1080px;height:1920px')
          .replace('linear-gradient(180deg,#e6d4ae 0%,#dcc69c 62%,#b8945f 62.5%,#a8844f 100%)', 'linear-gradient(180deg,#e6d4ae 0%,#dcc69c 64%,#b8945f 64.5%,#a8844f 100%)')
          .replace('#stage svg{position:absolute;left:0;top:0;width:1920px;height:1080px', '#stage svg{position:absolute;left:0;top:0;width:1080px;height:1920px')
          .replace('#rec{position:absolute;left:46px;top:36px', '#rec{position:absolute;left:40px;top:170px'))
grain = '<svg id="grain" width="1080" height="1920"><filter id="gf"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="1"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .2  0 0 0 .5 0"/></filter><rect width="1080" height="1920" filter="url(#gf)"/></svg>'
T = r'''const T = {
 ar: {hook1:'لحظة!', btc:'البيتكوين', ai:'الذكاء الاصطناعي', next:'مين الجاي؟!', price:'10 د.أ', cut:'-3 د.أ', pct:'30%', mid:'الوسيط', driver:'1 د.أ', lose:'الكل خسران...', except:'إلا الوسيط',
      nomid:'بدون شركة بالنص', zero:'0%', c1:'١ · الطلب', c1b:'تلفون أو واتساب', c2:'٢ · السائق', c2b:'بيشوف الأجرة قبل ما يقبل', fee:'1.50 د.أ', c3:'٣ · الكاش', c3b:'ختم من الطرفين', like:'متل البلوك تشين', without:'بدون بلوك تشين!',
      w1:'السعر كامل', w2:'الأجرة كاملة', w3:'سعر المحل', full:'100%', name:'درب', soon:'قريباً بحارتك', shop:'شاورما', bankw:'بنك'},
 en: {hook1:'Wait!', btc:'Bitcoin', ai:'AI', next:"Who's next?!", price:'10 JOD', cut:'-3 JOD', pct:'30%', mid:'MIDDLEMAN', driver:'1 JOD', lose:'Everybody loses...', except:'except the middleman',
      nomid:'No company in the middle', zero:'0%', c1:'1 · The order', c1b:'phone or WhatsApp', c2:'2 · The driver', c2b:'sees the fee first', fee:'1.50 JOD', c3:'3 · The cash', c3b:'stamped by both', like:'Like a blockchain', without:'without the blockchain!',
      w1:'full price', w2:'full fee', w3:'counter price', full:'100%', name:'DARB', soon:'coming to your street', shop:'SHAWARMA', bankw:'BANK'}
};
let LANG='ar', TL=null, FPS=12;
const world=document.getElementById('world'), textLayer=document.getElementById('text');
function setLang(l){LANG=l;document.body.className=l;document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';document.getElementById('shopSign').textContent=T[l].shop;document.getElementById('shopSign').setAttribute('font-family',l==='ar'?'Cairo':'Fredoka');document.getElementById('bankSign').textContent=T[l].bankw;}
function setTimeline(tl){TL=tl;FPS=tl.fps||12;}
'''
scenes = r'''// ---------- scenes (vertical) ----------
const S={};
const AR=()=>LANG==='ar';
S.hook=(u,d,t)=>{const k=f=>d*f;
  document.getElementById('rec').classList.toggle('hide',u<.2);
  puppet(540,1560,t,{s:2.3*pop(u,.05,.4),mood:u<k(.15)?'shock':(u<k(.62)?'talk':'shock'),id:'ytS'});
  if(u>.5)label('hook1',540,300,{size:150,s:pop(u,.5,.35),cls:'ghost',id:'h1'});
  if(u>k(.2)){use('btc',320,640,{s:3.4*pop(u,k(.2),.4),id:'btcS'});label('btc',320,840,{size:46,s:pop(u,k(.24),.3),cls:'yel',rot:-4,id:'btcL'});}
  if(u>k(.42)){use('robot',760,630,{s:2.1*pop(u,k(.42),.4),id:'robS'});label('ai',760,840,{size:AR()?42:46,s:pop(u,k(.46),.3),cls:'teal',rot:4,id:'aiL'});}
  if(u>k(.66)){label('next',540,1060,{size:AR()?120:110,s:pop(u,k(.66),.4),cls:'red',rot:-3,id:'nx'});confetti(540,1060,u,k(.7),30,'cfh');}
};
S.number=(u,d,t)=>{const k=f=>d*f;
  use('shop',290,760,{s:1.1*pop(u,0,.4),id:'shop'});use('owner',520,1010,{s:1.1*pop(u,.2,.4),id:'own'});
  if(u>k(.06))use('plate',660,930,{s:1.2*pop(u,k(.06),.3),id:'plate'});
  if(u>k(.08)){coins(760,1010,10,u,k(.08),{id:'c',sc:1.2});label('price',760,790,{size:64,s:pop(u,k(.12),.3),cls:'yel',id:'price'});}
  if(u>k(.24)){const r=steps(lin(u,k(.24),k(.34)),5);use('octo',840,1900-520*r,{s:1.35,id:'octo'});if(r>=1)label('mid',840,1080,{size:54,s:pop(u,k(.34),.3),cls:'purple',rot:4,id:'mid'});}
  if(u>k(.4)){const m=steps(lin(u,k(.4),k(.5)),6);for(let i=0;i<3;i++){const sx=760,sy=1010-16*(9-i);use('coin',sx+(820-sx)*m,sy+(1300-sy)*m-Math.sin(m*3.14)*260,{s:1.2,id:'fly'+i});}
    label('cut',720,500,{size:80,s:pop(u,k(.42),.3),cls:'red',rot:-8,id:'cut',dir:'ltr'});}
  if(u>k(.5))label('pct',880,330,{size:120,s:pop(u,k(.5),.35),cls:'ghost',rot:6,id:'pct'});
  if(u>k(.6)){use('driver',300,1560,{s:1.0*pop(u,k(.6),.4),id:'drv'});label('driver',300,1360,{size:54,s:pop(u,k(.64),.3),cls:'navy',id:'drvTag'});}
  if(u>k(.78))label('lose',400,230,{size:AR()?90:78,s:pop(u,k(.78),.4),cls:'ghost',id:'lose'});
  if(u>k(.9))label('except',400,370,{size:AR()?66:52,s:pop(u,k(.9),.35),cls:'purple',rot:-3,id:'exc'});
};
S.reveal=(u,d,t)=>{const k=f=>d*f;
  use('shop',290,720,{s:1.1*pop(u,0,.4),id:'shop2'});use('owner',500,960,{s:1.05*pop(u,.1,.4),id:'own2'});
  use('driver',780,1500,{s:1.25*pop(u,.15,.4),id:'drv2'});
  const gone=u>k(.3);
  if(!gone)use('octo',600,1180,{s:1.1*pop(u,.1,.4),id:'octo2'});
  else{const f=steps(lin(u,k(.3),k(.42)),5);use('octo',600+100*f,1180+900*f,{s:1.1,rot:90*f,id:'octo2'});}
  if(u>k(.18)&&u<k(.32)){const o=Math.round((u*8)%2);use('scissors',430,1080,{s:1.7,rot:o?-16:10,id:'sc2'});}
  if(gone){const m=steps(lin(u,k(.32),k(.45)),8);shape(`<path d="M600 1000 Q700 1050 760 1400" fill="none" stroke="#2a9d8f" stroke-width="14" stroke-dasharray="40 26" stroke-dashoffset="${-FRAME*20}" stroke-linecap="round" opacity="${m}"/>`);
    label('nomid',540,300,{size:AR()?70:60,s:pop(u,k(.34),.4),cls:'teal',id:'nomid'});
    if(u>k(.52)){label('zero',540,570,{size:230,s:pop(u,k(.52),.4),cls:'ghost',rot:-6,id:'zero'});confetti(540,570,u,k(.52),36,'cfz');}}
};
S.how=(u,d,t)=>{const k=f=>d*f;
  puppet(200,1760,t,{s:1.3,mood:'talk',id:'ytHow'});
  const seg=u<k(.27)?0:(u<k(.5)?1:(u<k(.72)?2:3));
  const s0=[0,k(.27),k(.5),k(.72)][seg];const p=pop(u,s0,.4);
  if(seg<3){const x=540,y=880;shape(`<g transform="translate(${x} ${y}) scale(${p})" class="pc"><rect x="-380" y="-420" width="760" height="840" rx="26" fill="#fbf6ea" stroke="#8a6a4a" stroke-width="5"/></g>`);
    if(seg===0){use('phone',x,y-20,{s:1.5*p,id:'ph'});if(u>s0+.4)shape(`<g transform="translate(${x-150} ${y-150})"><rect x="0" y="0" width="300" height="150" rx="10" fill="#fff" stroke="#c9b48f" stroke-width="4"/><rect x="20" y="20" width="130" height="14" rx="7" fill="#243b4a"/><rect x="20" y="50" width="230" height="12" rx="6" fill="#c9b48f"/><rect x="20" y="75" width="150" height="12" rx="6" fill="#c9b48f"/><rect x="20" y="108" width="240" height="28" rx="8" fill="#f4c542"/></g>`);
      label('c1',x,y-330,{size:64,s:pop(u,s0+.15,.3),cls:'red',id:'c1'});label('c1b',x,y+340,{size:44,s:pop(u,s0+.5,.3),cls:'body',id:'c1b'});}
    if(seg===1){use('driver',x,y+40,{s:1.6*p,id:'drv3'});if(u>s0+.4)label('fee',x+150,y-220,{size:64,s:pop(u,s0+.4,.3),cls:'red',rot:-6,id:'fee'});
      if(u>s0+.9)shape(`<g transform="translate(${x+120} ${y+260})" class="pc"><rect x="-110" y="-42" width="220" height="84" rx="20" fill="#2a9d8f"/><path d="M-36 0 l22 22 l50 -48" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></g>`);
      label('c2',x,y-330,{size:64,s:pop(u,s0+.15,.3),cls:'red',id:'c2'});label('c2b',x,y+340,{size:AR()?42:44,s:pop(u,s0+.5,.3),cls:'body',id:'c2b'});}
    if(seg===2){coins(x-120,y+150,8,u,s0+.2,{id:'cc',sc:1.6});use('owner',x+150,y+120,{s:1.1*p,id:'own3'});
      if(u>s0+.8)shape(`<g transform="translate(${x-140} ${y-160}) rotate(-12)" class="pc"><circle r="60" fill="#e5493a"/><path d="M-26 0 l18 18 l36 -40" fill="none" stroke="#fff8ee" stroke-width="10" stroke-linecap="round"/></g>`);
      if(u>s0+1.2)shape(`<g transform="translate(${x+60} ${y-190}) rotate(10)" class="pc"><circle r="60" fill="#2a9d8f"/><path d="M-26 0 l18 18 l36 -40" fill="none" stroke="#fff8ee" stroke-width="10" stroke-linecap="round"/></g>`);
      label('c3',x,y-330,{size:64,s:pop(u,s0+.15,.3),cls:'red',id:'c3'});label('c3b',x,y+340,{size:44,s:pop(u,s0+.5,.3),cls:'body',id:'c3b'});}
  }else{
    for(let i=0;i<3;i++){const s=s0+i*.3;const q=pop(u,s,.4);if(q<=0)continue;const x=260+i*280;use('receipt',x,800,{s:1.5*q,id:'rc'+i});
      if(u>s+.4)shape(`<g transform="translate(${x+90} ${920}) rotate(-10)" class="pc"><circle r="44" fill="#e5493a" stroke="#9c2b20" stroke-width="3"/><path d="M-18 0 l12 12 l26 -28" fill="none" stroke="#fff8ee" stroke-width="8" stroke-linecap="round"/></g>`);
      if(i>0&&u>s+.2)use('link',x-140,800,{s:1.3,id:'lk'+i});}
    if(u>s0+.9)label('like',540,1150,{size:AR()?74:68,s:pop(u,s0+.9,.4),cls:'navy',rot:-2,id:'like'});
    if(u>s0+1.8)label('without',540,1300,{size:AR()?74:64,s:pop(u,s0+1.8,.4),cls:'red',rot:2,id:'without'});
  }
};
S.punch=(u,d,t)=>{const k=f=>d*f;
  if(u>k(.02)){use('owner',220,1040,{s:1.05*pop(u,k(.02),.4),id:'o5'});coins(330,1020,10,u,k(.04),{id:'wc',sc:1.0});label('full',330,815,{size:60,s:pop(u,k(.08),.3),cls:'red',rot:-8,id:'full'});label('w1',220,1300,{size:40,s:pop(u,k(.1),.3),cls:'yel',id:'w1'});}
  if(u>k(.22)){use('driver',560,1120,{s:1.05*pop(u,k(.22),.4),id:'d5'});label('fee',600,880,{size:52,s:pop(u,k(.26),.3),cls:'red',rot:6,id:'fee5'});label('w2',560,1300,{size:40,s:pop(u,k(.3),.3),cls:'yel',id:'w2'});}
  if(u>k(.4)){use('customer',880,1060,{s:1.05*pop(u,k(.4),.4),id:'c5'});label('w3',880,1300,{size:40,s:pop(u,k(.44),.3),cls:'yel',id:'w3'});}
  if(u>k(.58)){label('name',540,440,{size:AR()?300:260,s:pop(u,k(.58),.45),cls:'ghost',rot:-4,id:'name'});confetti(540,440,u,k(.58),44,'cfc');}
  if(u>k(.8))label('soon',540,712,{size:AR()?56:48,s:pop(u,k(.8),.4),cls:'teal',id:'soon'});
  puppet(540,1760,t,{s:1.3,mood:u>k(.58)?'happy':'talk',id:'yt5'});
};
// ---------- main ----------
function render(t){
  FRAME=Math.floor(t*FPS);
  world.innerHTML='';textLayer.innerHTML='';
  document.getElementById('rt').setAttribute('seed',String((FRAME%3)+1));
  document.getElementById('set').style.filter=`brightness(${(1+(hash('flick'+FRAME)-.5)*.04).toFixed(3)})`;
  if(!TL)return;
  let sc=TL.scenes.find(s=>t>=s.start&&t<s.end);if(!sc)sc=TL.scenes[TL.scenes.length-1];
  const u=t-sc.start,d=sc.end-sc.start;
  S[sc.id](u,d,t);
  hand(820,1700,u,0,.45,[0,700]);
}
window.render=render;window.setLang=setLang;window.setTimeline=setTimeline;
</script>
</body></html>
'''
html = (head + css + '</head>\n<body class="ar">\n<div id="set"></div>\n' + grain +
        '\n<div id="stage"><svg viewBox="0 0 1080 1920">\n' + defs + '\n<g id="world"></g>\n</svg></div>\n<div id="text"></div>\n'
        '<div id="rec" class="hide"><i></i><span>REC</span></div>\n<div id="vig"></div>\n<script>\n' + T + helpers + scenes)
open('short.html', 'w', encoding='utf-8').write(html)
print('short.html', len(html))
