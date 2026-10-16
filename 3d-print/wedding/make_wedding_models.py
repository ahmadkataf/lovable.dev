#!/usr/bin/env python3
"""Wedding LED light sign with raised glowing letters (STL, units = mm).

Two printed parts:
  sign_box.stl    – arch-shaped light box (holds the LED strip), opaque colour
  sign_front.stl  – front panel with raised hollow "channel" letters

The front panel prints face-down with a filament change:
  0 → 7 mm   translucent white (letter faces + walls; this is what glows)
  7 mm → top opaque colour (black / gold / rose) – the panel background
Light from the box enters each hollow letter from behind and lights it up,
while the opaque background stays dark.

Usage:
  pip install trimesh manifold3d shapely mapbox_earcut scipy networkx \
              "matplotlib>=3.11"   # 3.11+ shapes Arabic text natively
  python3 make_wedding_models.py --arabic "زواج مبارك" --names "Ahmad & Sara" --date "16.10.2026"
"""
import argparse
import os

import manifold3d
import numpy as np
import trimesh
from matplotlib.font_manager import FontProperties
from matplotlib.textpath import TextPath
from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_LATIN = os.path.join(HERE, "fonts", "pacifico-latin-400-normal.ttf")
FONT_ARABIC = os.path.join(HERE, "fonts", "amiri-arabic-700-normal.ttf")
OUT = os.path.join(HERE, "stl")
PREVIEW = os.path.join(HERE, "preview")

W, H = 160, 200          # sign size (fits a 220 x 220 bed)
DEPTH = 36               # light box depth – distance helps the LEDs diffuse
WALL = 3.0               # box wall
FACE = 0.8               # letter face thickness (thin = bright)
LETTER_WALL = 1.0        # side walls of the hollow letters
RELIEF = 7.0             # how far the letters stand out from the background
PLATE = 2.4              # background plate thickness
RIM = 5.0                # locating rim that slides into the box
FIT = 0.25               # clearance between rim and box


# ---------------------------------------------------------------- 2D shapes
def arch():
    r = W / 2
    body = box(-r, -H / 2, r, H / 2 - r).buffer(-8).buffer(8)  # rounded bottom corners
    return unary_union([body, box(-r, 0, r, H / 2 - r), Point(0, H / 2 - r).buffer(r, 128)])


def heart(width, n=240):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    p = Polygon(np.c_[x, y]).buffer(0)
    minx, miny, maxx, maxy = p.bounds
    p = affinity.translate(p, -(minx + maxx) / 2, -(miny + maxy) / 2)
    return affinity.scale(p, width / (maxx - minx), width / (maxx - minx), origin=(0, 0))


def text_shape(s, font, width, max_height, cy):
    """Text outline centred at (0, cy), scaled to fit width x max_height."""
    path = TextPath((0, 0), s, size=100, prop=FontProperties(fname=font))
    geom = Polygon()
    for ring in path.to_polygons():
        if len(ring) >= 3:
            geom = geom.symmetric_difference(Polygon(ring).buffer(0))  # even-odd fill
    minx, miny, maxx, maxy = geom.bounds
    k = min(width / (maxx - minx), max_height / (maxy - miny))
    geom = affinity.translate(geom, -(minx + maxx) / 2, -(miny + maxy) / 2)
    return affinity.translate(affinity.scale(geom, k, k, origin=(0, 0)), 0, cy)


def glow_shapes(arabic, names, date):
    """Everything that lights up, in front-view coordinates."""
    outline = arch()
    border = outline.buffer(-6).difference(outline.buffer(-9.5))

    # Two linked hearts at the top of the arch.
    ring = heart(30)
    ring = ring.difference(ring.buffer(-3.2))
    hearts = unary_union([affinity.translate(ring, -9, 58), affinity.translate(ring, 9, 54)])

    parts = [border, hearts,
             text_shape(arabic, FONT_ARABIC, 118, 42, 14).buffer(0.4),
             text_shape(names, FONT_LATIN, 112, 30, -36).buffer(0.3)]
    if date:
        parts.append(text_shape(date, FONT_LATIN, 70, 13, -70).buffer(0.3))
    return unary_union(parts)


def cable_and_hangers():
    cable = Point(0, -H / 2 + 16).buffer(4.5, 48)
    keyholes = []
    for x in (-40, 40):
        keyholes += [Point(x, 40).buffer(4.5, 48), box(x - 2.2, 40, x + 2.2, 50),
                     Point(x, 50).buffer(2.2, 32)]
    return unary_union([cable, *keyholes])


# ---------------------------------------------------------------- 3D helpers
def extrude(geom, z0, z1):
    """Extrude a shapely (multi)polygon between z0 and z1 using manifold3d."""
    geom = geom.buffer(0).simplify(0.02).buffer(0)       # drop slivers from offsets
    rings = []
    for g in getattr(geom, "geoms", [geom]):
        if g.area < 0.5:
            continue
        rings.append(np.asarray(g.exterior.coords)[:-1])
        rings += [np.asarray(r.coords)[:-1] for r in g.interiors]
    cs = manifold3d.CrossSection(rings, manifold3d.FillRule.EvenOdd)
    return cs.extrude(z1 - z0).translate((0, 0, z0))


def union(solids):
    return manifold3d.Manifold.batch_boolean(solids, manifold3d.OpType.Add)


def to_trimesh(solid):
    m = solid.to_mesh()
    return trimesh.Trimesh(np.asarray(m.vert_properties)[:, :3], np.asarray(m.tri_verts))


def check(solid, name):
    mesh = to_trimesh(solid)
    bodies = len(mesh.split(only_watertight=False))
    e = mesh.extents
    print(f"{name:16s} {e[0]:6.1f} x {e[1]:6.1f} x {e[2]:5.1f} mm  watertight={mesh.is_watertight}"
          f"  bodies={bodies}  volume={mesh.volume / 1000:.1f} cm3")
    assert mesh.is_watertight and bodies == 1, name
    mesh.export(os.path.join(OUT, name))


# ---------------------------------------------------------------- parts
def light_box():
    outer = arch()
    back = outer.difference(cable_and_hangers())
    walls = outer.difference(outer.buffer(-WALL))
    return union([extrude(back, 0, WALL), extrude(walls, WALL - 0.01, DEPTH)])


def front_panel(glow):
    """Printed face-down, so the geometry is mirrored to read correctly when flipped."""
    glow = affinity.scale(glow, -1, 1, origin=(0, 0))
    outer = arch()
    light_hole = glow.buffer(-LETTER_WALL)               # where light enters each letter
    rim = outer.buffer(-WALL - FIT)
    top = RELIEF + PLATE
    return union([
        extrude(glow, 0, FACE),                                           # glowing faces
        extrude(glow.difference(light_hole), FACE - 0.01, RELIEF + 0.01),  # letter walls
        extrude(outer.difference(light_hole), RELIEF, top),                # background
        extrude(rim.difference(rim.buffer(-1.6)), top - 0.01, top + RIM),  # locating rim
    ])


def preview(glow, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import PathPatch
    from matplotlib.path import Path

    def fill(ax, g, **kw):
        for p in getattr(g, "geoms", [g]):
            rings = [p.exterior, *p.interiors]
            path = Path.make_compound_path(*[Path(np.asarray(r.coords), closed=True) for r in rings])
            ax.add_patch(PathPatch(path, **kw))

    fig, ax = plt.subplots(figsize=(5, 6.2), dpi=140)
    fig.patch.set_facecolor("#120d0e")
    fill(ax, arch(), color="#1c1416", ec="#3a2c2e", lw=1.5)
    for r, a in [(4, 0.06), (2.5, 0.10), (1.2, 0.18)]:      # soft halo
        fill(ax, glow.buffer(r), color="#ffb85c", alpha=a, lw=0)
    fill(ax, glow, color="#fff1d6", lw=0)
    ax.autoscale()
    ax.set_aspect("equal")
    ax.axis("off")
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--arabic", default="زواج مبارك", help="main Arabic line")
    ap.add_argument("--names", default="Mr & Mrs", help="names line, e.g. 'Ahmad & Sara'")
    ap.add_argument("--date", default="", help="optional date line")
    a = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)
    glow = glow_shapes(a.arabic, a.names, a.date)
    check(light_box(), "sign_box.stl")
    check(front_panel(glow), "sign_front.stl")
    preview(glow, os.path.join(PREVIEW, "sign_lit.png"))


if __name__ == "__main__":
    main()
