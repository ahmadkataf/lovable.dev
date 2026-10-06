# Generates design.html (wood-grain patterns are produced here to avoid repetition)
woods = {  # id: (base, grain)
  'walnut': ('#6B4226', '#4A2C18'),
  'oak':    ('#D9B47E', '#B48A55'),
  'beech':  ('#E2B48C', '#C4936A'),
  'wenge':  ('#3F2B1F', '#24170F'),
  'synth':  ('#E7E1D5', '#C9C0AE'),
}
def pattern(i, base, grain):
    return f'''<pattern id="g-{i}" width="70" height="140" patternUnits="userSpaceOnUse">
  <rect width="70" height="140" fill="{base}"/>
  <path d="M10 0c6 30-6 50 0 70s-6 40 0 70M24 0c-5 28 7 52 0 70s6 44 0 70M44 0c4 34-8 46 0 70s-4 38 0 70M58 0c-6 26 6 54 0 70s7 42 0 70" stroke="{grain}" stroke-width="1.6" fill="none" opacity=".75"/>
  <path d="M30 40c6-14 14-14 14 0s-8 24-14 34c-6-10-8-20 0-34z" stroke="{grain}" stroke-width="1.4" fill="none" opacity=".6"/>
</pattern>'''
patterns = '\n'.join(pattern(k, *v) for k, v in woods.items())

strips = [('walnut', -36, 'جوز', '#F3EEE4'), ('oak', -18, 'سنديان', '#3B2A17'), ('beech', 0, 'زان', '#3B2A17'), ('wenge', 18, 'ونجي', '#F3EEE4'), ('synth', 36, 'صناعي', '#3B3A33')]
PX, PY, L, W = 250, 330, 240, 72
fan = ''
for k, ang, name, tc in strips:
    fan += f'''<g transform="rotate({ang} {PX} {PY})">
  <rect x="{PX-W/2}" y="{PY-L}" width="{W}" height="{L}" rx="6" fill="url(#g-{k})" stroke="#00000022"/>
  <text x="{PX}" y="{PY-L+30}" text-anchor="middle" font-family="A" font-weight="700" font-size="16" fill="{tc}">{name}</text>
</g>\n'''

html = open('template.html').read().replace('%%PATTERNS%%', patterns).replace('%%FAN%%', fan)
open('design.html', 'w').write(html)
