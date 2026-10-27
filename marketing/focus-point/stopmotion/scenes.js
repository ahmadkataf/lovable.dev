// TEST scene (replaced once the script and voice timings exist): checks the look of each paper part.
'use strict'
const P = (n) => `photos/p${n}.jpg`
window.DURATION = 6

photoPrint('t-hall', P(10), { w: 760, h: 980, at: 0.0, from: { x: -500, y: 900, r: -25 }, to: { x: 540, y: 820, r: -3 } })
caption('t-cap', 'مكان صمم للتركيز', { at: 0.9, y: 1560, size: 92 })
focusSwitch('t-sw', { at: 2.4, from: { x: 1500, y: 700, r: 20 }, to: { x: 560, y: 760, r: 2 }, on: 3.4 })
caption('t-cap2', 'شغل وضع التركيز', { at: 3.9, y: 1340, size: 96, style: 'wine' })
