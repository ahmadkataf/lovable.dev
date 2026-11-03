// SVG and DXF writers. Both use millimetres; red hairlines are what laser software expects for cuts.
import { Loop, loopToPath, round3, arcInfo } from './geom'
import { Layout } from './layout'
import { MATERIAL_INFO } from './materials'

export function toSVG(lay: Layout, opts: { labels?: boolean } = {}): string {
  const w = round3(lay.w), h = round3(lay.h)
  const piece = (pl: Layout['placed'][number]) => {
    const paths = pl.panel.loops.filter(l => l.layer !== 'engrave').map(l => `<path d="${loopToPath(l, pl.x, pl.y)}"/>`).join('')
    const label = opts.labels
      ? `<text x="${round3(pl.x + pl.panel.w / 2)}" y="${round3(pl.y + pl.panel.h / 2)}" font-size="${round3(Math.min(6, pl.panel.h / 4))}" text-anchor="middle" dominant-baseline="middle" fill="#888" stroke="none">${esc(pl.panel.name)}</text>`
      : ''
    return `<g id="${esc(pl.panel.id)}-${pl.copy + 1}">${paths}${label}</g>`
  }
  const mats = [...new Set(lay.placed.map(pl => pl.panel.material).filter((m): m is string => !!m))]
  const groups = lay.placed.filter(pl => !pl.panel.material).map(piece).join('\n')
  const other = mats.map(m => `\n<g id="cut-${esc(m)}" fill="none" stroke="${MATERIAL_INFO[m]?.hex ?? '#00a000'}" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">\n${lay.placed.filter(pl => pl.panel.material === m).map(piece).join('\n')}\n</g>`).join('')
  const engraves = lay.placed.flatMap(pl => pl.panel.loops.filter(l => l.layer === 'engrave').map(l => `<path d="${loopToPath(l, pl.x, pl.y)}"/>`)).join('')
  const engraveGroup = engraves ? `\n<g id="engrave" fill="none" stroke="#0000ff" stroke-width="0.1">${engraves}</g>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
<g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">
${groups}
</g>${other}${engraveGroup}
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
  const mats = [...new Set(lay.placed.map(pl => pl.panel.material).filter((m): m is string => !!m))]
  const layerOf = (m?: string) => (m ? 'CUT-' + m.toUpperCase() : 'CUT')
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, 2 + mats.length)
  g(0, 'LAYER'); g(2, 'CUT'); g(70, 0); g(62, 1); g(6, 'CONTINUOUS')
  g(0, 'LAYER'); g(2, 'ENGRAVE'); g(70, 0); g(62, 5); g(6, 'CONTINUOUS')
  for (const m of mats) { g(0, 'LAYER'); g(2, layerOf(m)); g(70, 0); g(62, MATERIAL_INFO[m]?.aci ?? 3); g(6, 'CONTINUOUS') }
  g(0, 'ENDTAB'); g(0, 'ENDSEC')
  g(0, 'SECTION'); g(2, 'ENTITIES')
  for (const pl of lay.placed) for (const l of pl.panel.loops) writeLoop(l, pl.x, pl.y, layerOf(pl.panel.material))
  g(0, 'ENDSEC'); g(0, 'EOF')
  return out.join('\n') + '\n'

  function writeLoop(l: Loop, dx: number, dy: number, cutLayer: string) {
    const X = (v: number) => v + dx, Y = (v: number) => H - (v + dy)
    const L = l.layer === 'engrave' ? 'ENGRAVE' : cutLayer
    const n = l.pts.length
    if (l.closed && n === 2 && Math.abs(Math.abs(l.pts[0].b ?? 0) - 1) < 1e-9 && Math.abs(Math.abs(l.pts[1].b ?? 0) - 1) < 1e-9) {
      const p = l.pts[0], q = l.pts[1]
      g(0, 'CIRCLE'); g(8, L); g(10, X((p.x + q.x) / 2)); g(20, Y((p.y + q.y) / 2)); g(30, 0); g(40, Math.hypot(q.x - p.x, q.y - p.y) / 2)
      return
    }
    if (!l.closed && n === 2 && !l.pts[0].b) {
      g(0, 'LINE'); g(8, L); g(10, X(l.pts[0].x)); g(20, Y(l.pts[0].y)); g(30, 0); g(11, X(l.pts[1].x)); g(21, Y(l.pts[1].y)); g(31, 0)
      return
    }
    g(0, 'POLYLINE'); g(8, L); g(66, 1); g(70, l.closed ? 1 : 0); g(10, 0); g(20, 0); g(30, 0)
    for (const p of l.pts) {
      g(0, 'VERTEX'); g(8, L); g(10, X(p.x)); g(20, Y(p.y)); g(30, 0)
      // internal bulges are counter-clockwise as seen on screen (y down); flipping y for DXF keeps the picture upright,
      // and a counter-clockwise arc stays counter-clockwise in the y-up DXF plane, so the sign is kept
      if (p.b) g(42, String(Math.round(p.b * 1e7) / 1e7)) // the bulge needs more digits than 0.001: on a 300 mm arc that is 0.07 mm
    }
    g(0, 'SEQEND'); g(8, L)
  }
}

/**
 * Adobe Illustrator 8 (the PostScript-based .ai that RDWorks, older CorelDRAW and LaserCut import; newer .ai files
 * are PDF inside and RDWorks cannot read them). Points, origin bottom-left, so 1:1 in millimetres after import.
 * Cuts are red on a "Cut" layer, guide lines blue on an "Engrave" layer; arcs become Bézier curves.
 * A small prolog defines the operators, so Ghostscript and other PostScript viewers can also open the file.
 */
export function toAI(lay: Layout, title = 'laser-box.ai'): string {
  const PT = 72 / 25.4
  const Wpt = lay.w * PT, Hpt = lay.h * PT
  const n = (v: number) => (Math.round(v * 1000) / 1000).toString()
  const X = (v: number) => v * PT, Y = (v: number) => (lay.h - v) * PT
  const pathOf = (l: Loop, dx: number, dy: number): string => {
    const out: string[] = []
    const P = l.pts, N = P.length
    if (!N) return ''
    out.push(`${n(X(P[0].x + dx))} ${n(Y(P[0].y + dy))} m`)
    const last = l.closed ? N : N - 1
    for (let i = 0; i < last; i++) {
      const p = P[i], q = P[(i + 1) % N]
      if (!p.b) { out.push(`${n(X(q.x + dx))} ${n(Y(q.y + dy))} L`); continue }
      // a circular arc split into pieces of at most 90°, each one cubic Bézier
      const a = arcInfo(p, q, p.b)
      const sweep = a.theta * (a.ccw ? -1 : 1) // screen angles (y down): ccw on screen = decreasing angle
      const k = Math.max(1, Math.ceil(a.theta / (Math.PI / 2) - 1e-9))
      const dA = sweep / k, h = (4 / 3) * Math.tan(dA / 4)
      for (let j = 0; j < k; j++) {
        const t0 = a.a0 + j * dA, t1 = t0 + dA
        const x0 = a.c.x + a.r * Math.cos(t0), y0 = a.c.y + a.r * Math.sin(t0)
        const x3 = j === k - 1 ? q.x : a.c.x + a.r * Math.cos(t1), y3 = j === k - 1 ? q.y : a.c.y + a.r * Math.sin(t1)
        const x1 = x0 - h * a.r * Math.sin(t0), y1 = y0 + h * a.r * Math.cos(t0)
        const x2 = x3 + h * a.r * Math.sin(t1), y2 = y3 - h * a.r * Math.cos(t1)
        out.push(`${n(X(x1 + dx))} ${n(Y(y1 + dy))} ${n(X(x2 + dx))} ${n(Y(y2 + dy))} ${n(X(x3 + dx))} ${n(Y(y3 + dy))} C`)
      }
    }
    out.push(l.closed ? 's' : 'S')
    return out.join('\n')
  }
  const layer = (name: string, rgb: string, cmyk: string, pick: (l: Loop, m?: string) => boolean) => {
    const paths = lay.placed.flatMap(pl => pl.panel.loops.filter(l => pick(l, pl.panel.material)).map(l => pathOf(l, pl.x, pl.y))).filter(Boolean)
    if (!paths.length) return ''
    // the 13-operand layer header Illustrator 8 itself writes: visible preview enabled printing dimmed masks, 1 0, colour, 0 50
    return ['%AI5_BeginLayer', `1 1 1 1 0 0 1 0 ${rgb} 0 50 Lb`, `(${name}) Ln`, `${cmyk} K`, '0 J 0 j 0.283 w 4 M []0 d', ...paths, 'LB', '%AI5_EndLayer--', ''].join('\n')
  }
  const mats = [...new Set(lay.placed.map(pl => pl.panel.material).filter((m): m is string => !!m))]
  const cut = layer('Cut', '255 0 0', '0 1 1 0', (l, m) => l.layer !== 'engrave' && !m)
    + mats.map(m => layer('Cut ' + m, MATERIAL_INFO[m]?.rgb ?? '0 160 0', MATERIAL_INFO[m]?.cmyk ?? '1 0 1 0', (l, mm) => l.layer !== 'engrave' && mm === m)).join('')
  const engrave = layer('Engrave', '0 0 255', '1 1 0 0', l => l.layer === 'engrave')
  const bb = `0 0 ${Math.ceil(Wpt)} ${Math.ceil(Hpt)}`
  return [
    '%!PS-Adobe-3.0',
    '%%Creator: Adobe Illustrator(R) 8.0',
    '%%AI8_CreatorVersion: 8',
    '%%For: (Laser Box) ()',
    `%%Title: (${title.replace(/[()\\]/g, '')})`,
    `%%BoundingBox: ${bb}`,
    `%%HiResBoundingBox: 0 0 ${n(Wpt)} ${n(Hpt)}`,
    '%%DocumentProcessColors: Cyan Magenta Yellow',
    '%AI5_FileFormat 4.0',
    '%AI3_ColorUsage: Color',
    `%AI3_TemplateBox: ${n(Wpt / 2)} ${n(Hpt / 2)} ${n(Wpt / 2)} ${n(Hpt / 2)}`,
    `%AI3_TileBox: ${bb}`,
    '%AI3_DocumentPreview: None',
    `%AI5_ArtSize: ${n(Wpt)} ${n(Hpt)}`,
    '%AI5_RulerUnits: 1',
    '%AI5_ArtFlags: 1 0 0 1 0 0 1 0 0',
    '%AI5_TargetResolution: 800',
    `%AI5_NumLayers: ${(cut.match(/%AI5_BeginLayer/g) ?? []).length + (engrave ? 1 : 0)}`,
    '%AI5_OpenViewLayers: 7',
    '%%PageOrigin:0 0',
    '%%EndComments',
    '%%BeginProlog',
    '%%BeginResource: procset LaserBox_AI8_min 1.0 0',
    '/m {moveto} bind def /L {lineto} bind def /l {lineto} bind def /C {curveto} bind def /c {curveto} bind def',
    '/s {closepath stroke} bind def /S {stroke} bind def /K {setcmykcolor} bind def /w {setlinewidth} bind def',
    '/J {setlinecap} bind def /j {setlinejoin} bind def /M {setmiterlimit} bind def /d {setdash} bind def',
    '/Lb {13 {pop} repeat} bind def /Ln {pop} bind def /LB {} def /annotatepage {} def',
    '%%EndResource',
    '%%EndProlog',
    '%%BeginSetup',
    '%%EndSetup',
    cut + engrave + '%%PageTrailer',
    'gsave annotatepage grestore showpage',
    '%%Trailer',
    '%%EOF',
    '',
  ].join('\n')
}
