# Generate: python3 laser-box/door/door_panel.py door.json && (cd laser-box && npx vite-node door/export.ts ../door.json <out-dir>)
# needs: pip install shapely
"""Door panel engraving (as in the customer's photo): 600 x 1600 mm, every groove 10 mm wide as five parallel laser
lines 2 mm apart. A groove that runs into another stops at that groove's edge, so nothing is burnt twice."""
import json, math, sys
from shapely.geometry import LineString, Point, MultiLineString
from shapely.ops import unary_union

W, H = 600.0, 1600.0          # the panel
M = 40.0                      # the border groove's centre line, in from the panel's edge
GW = 10.0                     # groove width
OFFS = [-4.0, -2.0, 0.0, 2.0, 4.0]   # five lines, 2 mm apart: each burns 2 mm, together 10 mm

def bezier(p0, p1, p2, step=0.5):
    n = max(8, int(math.dist(p0, p2) / step))
    return LineString([((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                        (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))])

def parts(g):
    if g.is_empty: return []
    if isinstance(g, LineString): return [g]
    if isinstance(g, MultiLineString): return list(g.geoms)
    return [x for x in getattr(g, 'geoms', []) if isinstance(x, LineString)]

paths = []    # (points, closed)
taken = []    # regions already engraved

# 1. the border: five rectangles
for d in OFFS:
    a, b = M + d, M - d
    paths.append(([(a, a), (W - a, a), (W - a, H - a), (a, H - a)], True))
border = LineString([(M, M), (W - M, M), (W - M, H - M), (M, H - M), (M, M)])
taken.append(border.buffer(GW / 2, join_style=2))

# 2. the two sweeping curves from the bottom-left corner to the right side, bowed up and to the left as in the photo
S = (M, H - M)
curves = [bezier(S, (234.5, 702.0), (W - M, 349.0)), bezier(S, (177.5, 1164.5), (W - M, 768.0))]
# 3. three bars of different lengths running into the right side
bars = [LineString([(x0, y), (W - M, y)]) for x0, y in [(331.0, 1257.0), (243.0, 1351.0), (154.0, 1453.0)]]

for c in curves + bars:
    blocked = unary_union(taken)
    for d in OFFS:
        off = c.offset_curve(d, join_style=2) if d else c
        for seg in parts(off.difference(blocked)):
            if seg.length > 1.0: paths.append((list(seg.coords), False))
    taken.append(c.buffer(GW / 2, cap_style=2, join_style=2))

# 4. three circles, top left, getting smaller downward
circles = [(206.0, 223.0, 78.0), (206.0, 392.0, 57.0), (206.0, 521.0, 41.0)]
for cx, cy, r in circles:
    ring = Point(cx, cy).buffer(r + GW / 2).difference(Point(cx, cy).buffer(r - GW / 2))
    for other in taken: assert not ring.intersects(other), 'circle overlaps another groove'
    for d in OFFS:
        rr = r + d
        n = max(72, int(2 * math.pi * rr / 0.5))
        paths.append(([(cx + rr * math.cos(2 * math.pi * k / n), cy + rr * math.sin(2 * math.pi * k / n)) for k in range(n)], True))
    taken.append(ring)

# checks: circles clear of each other, bars clear of the curves except where they end, wood left between grooves
for i in range(len(circles)):
    for j in range(i + 1, len(circles)):
        (x1, y1, r1), (x2, y2, r2) = circles[i], circles[j]
        gap = math.dist((x1, y1), (x2, y2)) - r1 - r2 - GW
        assert gap > 15, gap
for b in bars:
    for c in curves: assert b.distance(c) > GW + 15, b.distance(c)

out = {'w': W, 'h': H, 'paths': [{'pts': [(round(x, 3), round(y, 3)) for x, y in p], 'closed': cl} for p, cl in paths]}
json.dump(out, open(sys.argv[1], 'w'))
print(len(paths), 'laser paths; total length', round(sum(LineString(p + ([p[0]] if cl else [])).length for p, cl in paths) / 1000, 1), 'm')
