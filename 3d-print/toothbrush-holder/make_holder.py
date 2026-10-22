#!/usr/bin/env python3
"""Self-clamping electric toothbrush holder (STL, units = mm).

The brush stands on a ring (cradle) hanging from a toothed slider.  Its weight
pulls the slider down; the rack turns two gears whose arms swing the two jaws
inwards, so the brush is held upright.  Lift the brush and the jaws fall open
again under their own weight.  The jaws ride on a parallelogram linkage, so
the pads stay parallel to the brush.

Assembly (front view, wall = XY plane, +Z points out of the wall):

    jaw ── pin ── gear-arm ── gear ⇄ rack (slider) ⇄ gear ── gear-arm ── pin ── jaw
     └──── pin ── link ───────────── (base) ───────────── link ── pin ────┘

Parts (print flat, no supports, 0.2 mm layers, PLA/PETG):
  base.stl        x1   wall plate (VHB tape or 2 countersunk screws)
  slider.stl      x1   rack + guide slots
  cradle.stl      x1   ring the brush stands on (glue onto slider tongue)
  gear_arm.stl    x2
  link.stl        x2
  jaw_left.stl    x1
  jaw_right.stl   x1
  pins.stl        12   (10 needed + 2 spare) – press-fit, print lying down

Usage:
  pip install manifold3d trimesh shapely numpy scipy networkx
  python3 make_holder.py            # writes stl/ and checks the mechanism
"""
import os

import manifold3d as mf
import numpy as np
import trimesh
from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "stl")

# ---------------------------------------------------------------- parameters
MOD, TEETH, PA = 1.5, 12, np.radians(20)    # gear module, tooth count, pressure angle
R_PITCH = MOD * TEETH / 2                    # 9 mm
RACK_X = 5.0                                 # rack pitch line, distance from centre
GEAR_X = RACK_X + R_PITCH + 0.2              # gear pivot (0.2 mm backlash)
LINK_X = GEAR_X + 17.0                       # parallelogram link pivot
ARM = 32.0                                   # arm length (pivot → jaw joint)
OPEN, CLOSED = 30.0, 0.0                     # arm tilt in degrees (+ = outwards)
TRAVEL = R_PITCH * np.radians(OPEN - CLOSED) # slider stroke

T = 4.0          # thickness of all flat parts
BOSS = 0.4       # raised washer under every moving part
PIN_D, PIN_FLAT, PIN_LEN = 4.6, 4.0, 8.2
HOLE_TIGHT, HOLE_FREE = 4.4, 5.2
PAD_OFF, PAD_T, PAD_H, PAD_Z = 9.5, 4.5, 41.0, 15.0  # pad inner face offset, thickness, height, half-length

UP_PIN, LOW_PIN = 24.0, -24.0                # slider guide pins (y)
SLOT = TRAVEL + 0.2
BRUSH_Z = 28.0                               # brush axis distance from the wall

Z_BASE, Z_MECH = 0.0, T + BOSS               # layer heights in the assembly
Z_JAW = Z_MECH + T + BOSS


# ---------------------------------------------------------------- helpers
def solid(geom, h, z0=0.0):
    """Extrude a shapely (multi)polygon to a manifold."""
    geom = geom.buffer(0).simplify(0.01)
    rings = []
    for g in getattr(geom, "geoms", [geom]):
        if g.area < 0.05:
            continue
        rings.append(np.asarray(g.exterior.coords)[:-1])
        rings += [np.asarray(r.coords)[:-1] for r in g.interiors]
    return mf.CrossSection(rings, mf.FillRule.EvenOdd).extrude(h).translate((0, 0, z0))


def union(parts):
    return mf.Manifold.batch_boolean(parts, mf.OpType.Add)


def circle(x, y, d):
    return Point(x, y).buffer(d / 2, 64)


def bar(p, q, w):
    return unary_union([Point(p).buffer(w / 2, 48), Point(q).buffer(w / 2, 48),
                        Polygon(_rect(p, q, w))])


def _rect(p, q, w):
    p, q = np.array(p, float), np.array(q, float)
    n = np.array([-(q - p)[1], (q - p)[0]])
    n = n / np.linalg.norm(n) * w / 2
    return [p + n, q + n, q - n, p - n]


def washer(x, y):
    return circle(x, y, 8.0).difference(circle(x, y, HOLE_TIGHT))


def to_mesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(np.asarray(mesh.vert_properties)[:, :3], np.asarray(mesh.tri_verts))


# ---------------------------------------------------------------- 2D profiles
def gear_profile():
    """Involute spur gear, a tooth gap centred on −X when the arm points along +Y."""
    rb, ra, rf = R_PITCH * np.cos(PA), R_PITCH + MOD, R_PITCH - 1.25 * MOD
    inv = lambda a: np.tan(a) - a
    half = np.pi / (2 * TEETH) - 0.05 / R_PITCH         # half tooth angle at pitch (+ backlash)
    radii = np.linspace(rb, ra, 12)
    psi = half + inv(PA) - inv(np.arccos(rb / radii))   # half thickness angle per radius
    teeth = [Point(0, 0).buffer(rf, 96)]
    for k in range(TEETH):
        c = np.radians(105 + 30 * k)                    # teeth at ±15° around the arm axis
        right = [(r * np.cos(c - a), r * np.sin(c - a)) for r, a in zip(radii, psi)]
        left = [(r * np.cos(c + a), r * np.sin(c + a)) for r, a in zip(radii, psi)][::-1]
        base_r = rf * 0.9
        pts = ([(base_r * np.cos(c - psi[0]), base_r * np.sin(c - psi[0]))] + right + left +
               [(base_r * np.cos(c + psi[0]), base_r * np.sin(c + psi[0]))])
        teeth.append(Polygon(pts).buffer(0))
    return unary_union(teeth)


def rack_profile(y0, y1):
    """Rack teeth on the +X side of the slider, a tooth centred on y = 0."""
    p = np.pi * MOD
    t = np.tan(PA)
    teeth = []
    for k in range(int(np.floor(y0 / p)) - 1, int(np.ceil(y1 / p)) + 2):
        yc = k * p
        h_tip, h_root = p / 4 - MOD * t - 0.05, p / 4 + 1.25 * MOD * t - 0.05
        teeth.append(Polygon([(RACK_X - 1.25 * MOD, yc - h_root), (RACK_X + MOD, yc - h_tip),
                              (RACK_X + MOD, yc + h_tip), (RACK_X - 1.25 * MOD, yc + h_root)]))
    return unary_union(teeth).intersection(box(0, y0, 20, y1))


# ---------------------------------------------------------------- parts (assembly frame)
def base():
    plate = box(-38, -32, 38, 40).buffer(-6).buffer(6)
    holes = [circle(s * x, 0, HOLE_TIGHT) for s in (-1, 1) for x in (GEAR_X, LINK_X)]
    holes += [circle(0, UP_PIN, HOLE_TIGHT), circle(0, LOW_PIN, HOLE_TIGHT)]
    screws = [(s * 24, -22) for s in (-1, 1)]
    body = solid(plate.difference(unary_union(holes + [circle(x, y, 4.2) for x, y in screws])), T)
    washers = [washer(s * x, 0) for s in (-1, 1) for x in (GEAR_X, LINK_X)]
    washers += [washer(0, UP_PIN), washer(0, LOW_PIN)]
    body = union([body, solid(unary_union(washers), BOSS, T)])
    for x, y in screws:                                   # countersink for M4 / 4 mm wood screws
        cone = mf.Manifold.cylinder(T - 1.0, 2.1, 4.3, 64).translate((x, y, 1.0))
        body = body - cone
    return body


def gear_arm():
    """Local frame: pivot at origin, arm along +Y, jaw joint at (0, ARM)."""
    shape = unary_union([gear_profile(), bar((0, 0), (0, ARM), 7.0), circle(0, ARM, 9.0)])
    shape = shape.difference(unary_union([circle(0, 0, HOLE_FREE), circle(0, ARM, HOLE_TIGHT)]))
    return union([solid(shape, T), solid(washer(0, ARM), BOSS, T)])


def link():
    shape = bar((0, 0), (0, ARM), 9.0)
    shape = shape.difference(unary_union([circle(0, 0, HOLE_FREE), circle(0, ARM, HOLE_TIGHT)]))
    return union([solid(shape, T), solid(washer(0, ARM), BOSS, T)])


def jaw(side):
    """Right jaw: gear-arm joint at origin, link joint at (+17, 0), pad inwards (−X)."""
    span = LINK_X - GEAR_X
    plate = unary_union([bar((0, 0), (span, 0), 9.0), box(-PAD_OFF, -4.5, 0, 4.5)])
    plate = plate.difference(unary_union([circle(0, 0, HOLE_FREE), circle(span, 0, HOLE_FREE)]))
    pad = box(-PAD_OFF, -PAD_Z, -PAD_OFF + PAD_T, PAD_Z).buffer(1.0).buffer(-1.0)
    m = union([solid(plate, T), solid(pad, PAD_H)])
    return m if side > 0 else m.mirror((1, 0, 0))


def slider():
    """Assembly frame at the OPEN position."""
    core = box(-RACK_X + 1.25 * MOD, -11, RACK_X - 1.25 * MOD, 16)
    rack = rack_profile(-11, 16)
    rack = unary_union([rack, affinity.scale(rack, -1, 1, origin=(0, 0))])
    upper = box(-5, 16, 5, 36).buffer(-1).buffer(1)
    lower = box(-6, -50, 6, -11)
    slots = [box(-HOLE_FREE / 2, y - HOLE_FREE / 2, HOLE_FREE / 2, y + SLOT + HOLE_FREE / 2)
             .buffer(0.01) for y in (UP_PIN, LOW_PIN)]
    shape = unary_union([core, rack, upper, lower]).difference(unary_union(slots))
    return solid(shape, T, Z_MECH)


def cradle():
    """Sleeve over the slider tongue + ring the brush stands on (assembly frame, open)."""
    gap, wall = 0.15, 1.8
    x_out, z0, z1 = 6 + gap + wall, Z_MECH - gap - wall, Z_MECH + T + gap + wall
    sleeve = mf.Manifold.cube((2 * x_out, 20, z1 - z0)).translate((-x_out, -54, z0))
    cavity = mf.Manifold.cube((12 + 2 * gap, 20, T + 2 * gap)).translate((-6 - gap, -50, Z_MECH - gap))
    ring_2d = (circle(0, BRUSH_Z, 38).difference(circle(0, BRUSH_Z, 22))
               .difference(box(-6, BRUSH_Z + 8, 6, 80)))           # C-opening for the cable/drip
    neck = box(-6, z0, 6, BRUSH_Z - 9)
    ring = solid(unary_union([ring_2d, neck]), 4.0)                # in (x, z) – rotate into place
    ring = ring.rotate((90, 0, 0)).translate((0, -50, 0))          # occupies y −54 … −50
    return union([sleeve, ring]) - cavity


def pin():
    shaft = mf.Manifold.cylinder(PIN_LEN, PIN_D / 2, PIN_D / 2, 48)
    head = mf.Manifold.cylinder(1.6, 4.0, 4.0, 48).translate((0, 0, PIN_LEN))
    tip = mf.Manifold.cylinder(0.6, PIN_D / 2 - 0.4, PIN_D / 2, 48)   # lead-in chamfer
    p = union([shaft.translate((0, 0, 0.6)) - mf.Manifold.cube((10, 10, 0.6)).translate((-5, -5, 0)),
               tip, head.translate((0, 0, 0.6))])
    return p.translate((0, 0, -0.6)) ^ mf.Manifold.cube((10, PIN_FLAT, 20)).translate((-5, -PIN_FLAT / 2, -1))


# ---------------------------------------------------------------- assembly
def assembly(phi, pin_d=None):
    """All parts placed for arm tilt `phi` (degrees, + = open)."""
    dy = -R_PITCH * np.radians(OPEN - phi)
    parts = {"base": base(), "slider": slider().translate((0, dy, 0)),
             "cradle": cradle().translate((0, dy, 0))}
    pins = []
    for s, tag in ((1, "R"), (-1, "L")):
        a = np.radians(phi)
        gear_pos = np.array([s * GEAR_X, 0.0])
        joint = gear_pos + ARM * np.array([s * np.sin(a), np.cos(a)])
        link_joint = joint + [s * (LINK_X - GEAR_X), 0]
        parts["gear_" + tag] = gear_arm().rotate((0, 0, -s * phi)).translate((*gear_pos, Z_MECH))
        parts["link_" + tag] = link().rotate((0, 0, -s * phi)).translate((s * LINK_X, 0, Z_MECH))
        parts["jaw_" + tag] = jaw(s).translate((*joint, Z_JAW))
        for (x, y), z in (((gear_pos[0], 0), Z_MECH + T), ((s * LINK_X, 0), Z_MECH + T),
                          (tuple(joint), Z_JAW + T), (tuple(link_joint), Z_JAW + T)):
            pins.append((x, y, z))
    pins += [(0, UP_PIN, Z_MECH + T), (0, LOW_PIN, Z_MECH + T)]
    d = pin_d or PIN_D
    for i, (x, y, z) in enumerate(pins):
        p = union([mf.Manifold.cylinder(PIN_LEN, d / 2, d / 2, 32).translate((0, 0, -PIN_LEN)),
                   mf.Manifold.cylinder(1.6, 4.0, 4.0, 32)])
        parts[f"pin{i}"] = p.translate((x, y, z))
    return parts


def check_mechanism():
    """Interference check between every pair of parts at several positions."""
    worst = 0.0
    for phi in np.linspace(OPEN, CLOSED, 8):
        parts = assembly(phi, pin_d=HOLE_TIGHT - 0.2)   # pins slimmer than the press holes
        names = list(parts)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                v = (parts[a] ^ parts[b]).volume()
                if v > 0.01:
                    print(f"  interference at {phi:5.1f}°: {a} × {b}: {v:.3f} mm³")
                    worst = max(worst, v)
    print(f"mechanism check: worst overlap {worst:.3f} mm³ over {OPEN}° → {CLOSED}°, "
          f"slider travel {TRAVEL:.1f} mm")
    gap = lambda phi: 2 * (GEAR_X + ARM * np.sin(np.radians(phi)) - PAD_OFF)
    print(f"jaw opening: {gap(OPEN):.0f} mm open → {gap(CLOSED):.0f} mm closed")
    return worst


def export(m, name):
    mesh = to_mesh(m)
    mesh.apply_translation(-np.array([*mesh.bounds.mean(0)[:2], mesh.bounds[0][2]]))
    bodies = len(mesh.split(only_watertight=False))
    e = mesh.extents
    print(f"{name:15s} {e[0]:6.1f} x {e[1]:6.1f} x {e[2]:5.1f} mm  watertight={mesh.is_watertight}"
          f"  bodies={bodies}")
    assert mesh.is_watertight
    mesh.export(os.path.join(OUT, name))


def main():
    os.makedirs(OUT, exist_ok=True)
    export(base(), "base.stl")
    export(slider(), "slider.stl")
    export(cradle().rotate((-90, 0, 0)), "cradle.stl")       # ring flat on the bed
    export(gear_arm(), "gear_arm.stl")
    export(link(), "link.stl")
    export(jaw(1), "jaw_right.stl")
    export(jaw(-1), "jaw_left.stl")
    pins = [pin().rotate((90, 0, 0)).translate((0, 0, 0)) for _ in range(12)]
    plate = union([p.translate((12 * (i % 6), 14 * (i // 6), 0)) for i, p in enumerate(pins)])
    export(plate, "pins.stl")
    assert check_mechanism() < 0.5


if __name__ == "__main__":
    main()
