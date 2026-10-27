// The ad, scene by scene, timed to the voice (voice/timings.js). One caption at a time: each caption leaves before
// the next one lands, so words never sit on top of each other. Prints are swept off the desk at the next line.
'use strict'
const P = (n) => `photos/p${n}.jpg`
const L = Object.fromEntries((window.TIMINGS?.lines || []).map((l) => [l.id, l]))
const at = (id, k = 0) => L[id].start + k                     // seconds into line `id`
const next = (id) => { const i = +id.slice(1); return L['L' + (i + 1)] ? L['L' + (i + 1)].start : window.TIMINGS.duration }
window.DURATION = Math.ceil((window.TIMINGS?.last_voice ?? 46.5) + 3.6)
const CAP_Y = 1600
const SWEEP_L = { x: -900, y: 760, r: -24 }, SWEEP_R = { x: 1980, y: 760, r: 24 }

// the desk lamp: dim until the switch flips ON
const FLIP = at('L1', 1.85)
window.sceneLight = (tq) => (tq < FLIP ? 0.84 : tq < FLIP + 2 / POSES ? 0.93 : 1)

// ---------- L1 · تركيزك مطفأ؟ حان وقت تشغيله ----------
focusSwitch('sw1', { at: at('L1', 0), from: { x: 540, y: -500, r: -12 }, to: { x: 540, y: 820, r: -2 }, on: FLIP, leave: next('L1'), leaveTo: { x: 540, y: -700, r: 8 } })
caption('c1', 'تركيزك مطفأ؟', { at: at('L1', 0.15), y: CAP_Y - 40, size: 104, leave: next('L1') })

// ---------- L2 · هذا فوكس بوينت، المشروع الأول من نوعه في درعا ----------
photoPrint('p2', P(2), { w: 700, h: 930, at: at('L2', 0.05), from: { x: 540, y: -900, r: 14 }, to: { x: 540, y: 760, r: 3 }, leave: next('L2'), leaveTo: SWEEP_L })
caption('c2', 'المشروع الأول من نوعه في درعا', { at: at('L2', 1.25), y: CAP_Y, size: 76, maxW: 1010, style: 'wine', leave: next('L2') })

// ---------- L3 · هنا تفكر خارج الصندوق، في مكان صمم للتركيز ----------
photoPrint('p1', P(1), { w: 700, h: 930, pos: '50% 46%', at: at('L3', 0.05), from: SWEEP_R, to: { x: 540, y: 760, r: -2 }, leave: next('L3'), leaveTo: SWEEP_L })
woodFrame('fr', { size: 420, at: at('L3', 0.55), from: { x: 540, y: -400, r: 0 }, to: { x: 548, y: 700, r: 0 }, tiltAt: at('L3', 0.95), tilt: 17, tiltDur: 0.8, leave: next('L3'), leaveTo: SWEEP_L })
caption('c3', 'فكر خارج الصندوق', { at: at('L3', 0.3), y: CAP_Y, size: 100, leave: L.L3.pauses?.[0]?.[1] ?? at('L3', 2.3), leaveDx: 1300 })
photoPrint('p12', P(12), { w: 380, h: 500, pos: '50% 55%', at: (L.L3.pauses?.[0]?.[1] ?? at('L3', 2.3)) + 0.05, from: { x: -400, y: 1500, r: -20 }, to: { x: 300, y: 1330, r: -7 }, z: 26, leave: next('L3'), leaveTo: SWEEP_L })
caption('c3b', 'مكان صمم للتركيز', { at: (L.L3.pauses?.[0]?.[1] ?? at('L3', 2.3)) + 0.25, y: 1690, x: 700, size: 70, maxW: 520, style: 'wine', leave: next('L3') })

// ---------- L4 · غرف خاصة هادئة، لك وحدك أو لفريقك الصغير ----------
const L4b = L.L4.pauses?.[0]?.[1] ?? at('L4', 1.6)
photoPrint('p7', P(7), { w: 620, h: 826, at: at('L4', 0.05), from: SWEEP_R, to: { x: 400, y: 700, r: -5 }, leave: next('L4'), leaveTo: SWEEP_L })
photoPrint('p6', P(6), { w: 640, h: 853, at: L4b, from: { x: 1500, y: 1400, r: 30 }, to: { x: 640, y: 860, r: 4 }, z: 24, leave: next('L4'), leaveTo: SWEEP_L })
caption('c4', 'غرف خاصة هادئة', { at: at('L4', 0.35), y: CAP_Y + 20, size: 100, leave: next('L4') })

// ---------- L5 · وقاعة مجهزة بشاشة، للاجتماعات وورش العمل والتدريب ----------
const L5b = L.L5.pauses?.[0]?.[1] ?? at('L5', 1.9)
photoPrint('p10', P(10), { w: 720, h: 960, pos: '50% 40%', at: at('L5', 0.05), from: { x: 540, y: -900, r: -10 }, to: { x: 540, y: 760, r: -2 }, leave: next('L5'), leaveTo: SWEEP_L })
photoPrint('p5', P(5), { w: 360, h: 480, at: L5b, from: { x: 1500, y: 1300, r: 25 }, to: { x: 820, y: 1200, r: 8 }, z: 26, leave: next('L5'), leaveTo: SWEEP_L })
caption('c5', 'قاعة للاجتماعات والتدريب', { at: at('L5', 0.4), y: CAP_Y + 40, size: 90, maxW: 920, leave: next('L5') })

// ---------- L6 · ومساحة مفتوحة، بنوافذ كبيرة تطل على المدينة، وضوء طبيعي ----------
photoPrint('p9', P(9), { w: 740, h: 986, pos: '50% 40%', at: at('L6', 0.05), from: SWEEP_R, to: { x: 540, y: 760, r: 2 }, leave: next('L6'), leaveTo: SWEEP_L })
caption('c6', 'إطلالة وضوء طبيعي', { at: (L.L6.pauses?.[0]?.[1] ?? at('L6', 1.5)), y: CAP_Y + 20, size: 100, style: 'wine', leave: next('L6') })

// ---------- L7 · إنترنت سريع، وتكييف، وركن للمشروبات... وقهوتك تصل إلى طاولتك ----------
const L7b = L.L7.pauses?.[1]?.[1] ?? at('L7', 3.6)
photoPrint('p11', 'photos/p11-machine.jpg', { w: 760, h: 531, at: at('L7', 0.05), from: { x: 540, y: -700, r: 10 }, to: { x: 540, y: 520, r: -3 }, leave: next('L7'), leaveTo: SWEEP_L })
paperTag('t7a', 'إنترنت سريع', { at: at('L7', 0.3), from: { x: 1400, y: 900, r: 20 }, to: { x: 760, y: 920, r: 5 }, cls: 'ink', leave: L7b - 0.1, leaveTo: { x: 1500, y: 900, r: 20 } })
paperTag('t7b', 'تكييف', { at: (L.L7.pauses?.[0]?.[1] ?? at('L7', 1.8)), from: { x: -400, y: 1000, r: -20 }, to: { x: 330, y: 1010, r: -6 }, leave: L7b - 0.1, leaveTo: { x: -500, y: 1000, r: -20 } })
photoPrint('p3', P(3), { w: 520, h: 693, pos: '50% 60%', at: L7b, from: { x: 540, y: 2400, r: -14 }, to: { x: 560, y: 1080, r: 4 }, z: 26, leave: next('L7'), leaveTo: SWEEP_L })
caption('c7', 'قهوتك تصل إلى طاولتك', { at: L7b + 0.35, y: CAP_Y + 90, size: 84, maxW: 940, style: 'wine', leave: next('L7') })

// ---------- L8 · احجز من التطبيق أو الموقع… دون إنشاء حساب، وادفع عبر شام كاش أو عند وصولك ----------
const L8b = L.L8.pauses?.[0]?.[1] ?? at('L8', 3)
const L8c = L.L8.pauses?.[1]?.[1] ?? at('L8', 4.4)
photoPrint('p8', P(8), { w: 470, h: 626, at: at('L8', 0.05), from: SWEEP_L, to: { x: 300, y: 640, r: -6 }, leave: next('L8'), leaveTo: SWEEP_L })
paperPhone('ph', 'assets/app-book.png', { at: at('L8', 0.3), from: { x: 760, y: 2500, r: 12 }, to: { x: 730, y: 860, r: 3 }, s: 0.86, leave: next('L8'), leaveTo: { x: 760, y: 2600, r: 10 } })
caption('c8', 'احجز بخطوات', { at: at('L8', 0.5), y: 1440, x: 330, size: 84, maxW: 520, leave: L8c - 0.05 })
paperTag('t8a', 'بلا حساب', { at: L8b, from: { x: -400, y: 1180, r: -20 }, to: { x: 300, y: 1180, r: -4 }, cls: 'ink', leave: L8c - 0.05, leaveTo: { x: -500, y: 1180, r: -20 } })
paperTag('t8b', 'شام كاش<span class="small">أو الدفع عند الوصول</span>', { at: L8c, from: { x: -500, y: 1300, r: -20 }, to: { x: 320, y: 1320, r: -3 }, cls: 'wine', leave: next('L8'), leaveTo: SWEEP_L })

// ---------- L9 · ننتظرك كل يوم من التاسعة صباحا حتى الحادية عشرة ليلا، في شارع المجمع الحكومي ----------
const L9b = L.L9.pauses?.[0]?.[1] ?? at('L9', 4)
paperClock('clk', { at: at('L9', 0.05), fromPos: { x: 540, y: -500, r: -20 }, to: { x: 540, y: 720, r: -3 }, from: 9, to24: 23, spinAt: at('L9', 0.9), spinDur: 2.6, leave: L9b - 0.1, leaveTo: SWEEP_L })
caption('c9', 'يوميا من 9 صباحا حتى 11 ليلا', { at: at('L9', 0.6), y: 1240, size: 82, maxW: 920, leave: L9b - 0.1 })
paperMap('map', { at: L9b, from: SWEEP_R, to: { x: 540, y: 760, r: 2 }, pinAt: L9b + 0.45, leave: next('L9'), leaveTo: SWEEP_L })
paperTag('t9', 'شارع المجمع الحكومي<span class="small">بناء العايش · درعا</span>', { at: L9b + 0.6, from: { x: 540, y: 2300, r: 10 }, to: { x: 540, y: 1300, r: -2 }, leave: next('L9'), leaveTo: SWEEP_L })

// ---------- L10 · فوكس بوينت... شغل وضع التركيز  (+ end card) ----------
const L10b = L.L10.pauses?.[0]?.[1] ?? at('L10', 1.2)
logoCard('logo', { at: at('L10', 0.05), from: { x: 540, y: -700, r: -8 }, to: { x: 540, y: 560, r: -1.5 } })
focusSwitch('sw2', { at: L10b - 0.15, from: { x: 1600, y: 1180, r: 20 }, to: { x: 540, y: 1180, r: 2 }, on: L10b + 0.3, s: 0.62 })
caption('c10', 'شغل وضع التركيز', { at: L10b + 0.55, y: 1490, size: 84, maxW: 1020, style: 'wine' })
paperTag('t10a', '<span class="ltr">@its_focus_point</span>', { at: L10b + 1.3, from: { x: -500, y: 1690, r: -10 }, to: { x: 330, y: 1660, r: -3 }, cls: 'ink', s: 0.78 })
paperTag('t10b', '<span class="ltr">0985258963</span>', { at: L10b + 1.6, from: { x: 1600, y: 1690, r: 10 }, to: { x: 790, y: 1660, r: 3 }, s: 0.78 })
paperTag('t10c', '<span class="ltr">focuspoint.raqeem.dev</span>', { at: L10b + 1.9, from: { x: 540, y: 2300, r: 6 }, to: { x: 540, y: 1790, r: -1 }, cls: 'wine', s: 0.72 })
