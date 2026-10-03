// SVG and DXF writers. Both use millimetres; red hairlines are what laser software expects for cuts.
import { Loop, loopToPath, round3 } from './geom'
import { Layout } from './layout'

export function toSVG(lay: Layout, opts: { labels?: boolean } = {}): string {
  const w = round3(lay.w), h = round3(lay.h)
  const groups = lay.placed.map(pl => {
    const paths = pl.panel.loops.map(l => `<path d="${loopToPath(l, pl.x, pl.y)}"/>`).join('')
    const label = opts.labels
      ? `<text x="${round3(pl.x + pl.panel.w / 2)}" y="${round3(pl.y + pl.panel.h / 2)}" font-size="${round3(Math.min(6, pl.panel.h / 4))}" text-anchor="middle" dominant-baseline="middle" fill="#888" stroke="none">${esc(pl.panel.name)}</text>`
      : ''
    return `<g id="${esc(pl.panel.id)}-${pl.copy + 1}">${paths}${label}</g>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
<g fill="none" stroke="#ff0000" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">
${groups}
</g>
</svg>
`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** DXF R12 (AC1009): POLYLINE/VERTEX with bulges, CIRCLE and LINE. Y is flipped so the drawing is upright. */
export function toDXF(lay: Layout): string {
  const H = lay.h
  const out: string[] = []
  const g = (code: number, v: string | number) => out.push(String(code), typeof v === 'number' ? String(round3(v)) : v)
  g(0, 'SECTION'); g(2, 'HEADER')
  g(9, '$ACADVER'); g(1, 'AC1009')
  g(9, '$INSUNITS'); g(70, 4)
  g(9, '$MEASUREMENT'); g(70, 1)
  g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(30, 0)
  g(9, '$EXTMAX'); g(10, lay.w); g(20, H); g(30, 0)
  g(0, 'ENDSEC')
  g(0, 'SECTION'); g(2, 'TABLES')
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, 1)
  g(0, 'LAYER'); g(2, 'CUT'); g(70, 0); g(62, 1); g(6, 'CONTINUOUS')
  g(0, 'ENDTAB'); g(0, 'ENDSEC')
  g(0, 'SECTION'); g(2, 'ENTITIES')
  for (const pl of lay.placed) for (const l of pl.panel.loops) writeLoop(l, pl.x, pl.y)
  g(0, 'ENDSEC'); g(0, 'EOF')
  return out.join('\n') + '\n'

  function writeLoop(l: Loop, dx: number, dy: number) {
    const X = (v: number) => v + dx, Y = (v: number) => H - (v + dy)
    const n = l.pts.length
    if (l.closed && n === 2 && Math.abs(Math.abs(l.pts[0].b ?? 0) - 1) < 1e-9 && Math.abs(Math.abs(l.pts[1].b ?? 0) - 1) < 1e-9) {
      const p = l.pts[0], q = l.pts[1]
      g(0, 'CIRCLE'); g(8, 'CUT'); g(10, X((p.x + q.x) / 2)); g(20, Y((p.y + q.y) / 2)); g(30, 0); g(40, Math.hypot(q.x - p.x, q.y - p.y) / 2)
      return
    }
    if (!l.closed && n === 2) {
      g(0, 'LINE'); g(8, 'CUT'); g(10, X(l.pts[0].x)); g(20, Y(l.pts[0].y)); g(30, 0); g(11, X(l.pts[1].x)); g(21, Y(l.pts[1].y)); g(31, 0)
      return
    }
    g(0, 'POLYLINE'); g(8, 'CUT'); g(66, 1); g(70, l.closed ? 1 : 0); g(10, 0); g(20, 0); g(30, 0)
    for (const p of l.pts) {
      g(0, 'VERTEX'); g(8, 'CUT'); g(10, X(p.x)); g(20, Y(p.y)); g(30, 0)
      if (p.b) g(42, -p.b) // mirrored in y, so the arc sense flips
    }
    g(0, 'SEQEND'); g(8, 'CUT')
  }
}
