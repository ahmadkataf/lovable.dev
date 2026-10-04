// Writes the door panel's laser paths (from door_panel.py) as SVG, DXF and AI 8 with the app's own exporters:
// the grooves on the red cut layer, the panel's outline on the blue layer as an alignment guide (not to be output).
import { readFileSync, writeFileSync } from 'fs'
import { toSVG, toDXF, toAI } from '../src/export'
import type { Loop } from '../src/geom'
const [src, outDir] = process.argv.slice(2)
const d = JSON.parse(readFileSync(src, 'utf8')) as { w: number; h: number; paths: { pts: [number, number][]; closed: boolean }[] }
const loops: Loop[] = d.paths.map(p => ({ closed: p.closed, pts: p.pts.map(([x, y]) => ({ x, y })) }))
loops.push({ closed: true, layer: 'engrave', pts: [{ x: 0, y: 0 }, { x: d.w, y: 0 }, { x: d.w, y: d.h }, { x: 0, y: d.h }] })
const panel = { id: 'door', name: 'door', loops, w: d.w, h: d.h, count: 1, minFinger: Infinity, cornerNeck: Infinity }
const lay = { placed: [{ panel, x: 0, y: 0, copy: 0 }], w: d.w, h: d.h }
const base = `${outDir}/door-60x160`
writeFileSync(base + '.svg', toSVG(lay))
writeFileSync(base + '.dxf', toDXF(lay))
writeFileSync(base + '.ai', toAI(lay, 'door-60x160.ai'))
console.log('written', base)
