#!/usr/bin/env python3
"""Pre-render CT-to-endoscopy correlation slices for the Airway Anatomy lesson.

For each teaching structure in the guided survey we bake a windowed axial and
coronal CT slice (with an anatomical crosshair marking the airway) from the
case-001 preview volume, plus a small JSON manifest the lesson consumes at
runtime.

Why pre-render instead of loading the volume in the browser (as the admin-only
synchronized-bronchoscopy module does)?
  * The 27 MB int16 volume lives behind the `site_admin` gate on
    `/airway-anatomy/*` (see src/lib/airway-anatomy/admin-assets.ts). The intro
    lesson is only draft-gated, so a non-admin learner could not fetch it live.
  * The guided survey visits a fixed set of stops, so a handful of compact JPGs
    is far lighter than shipping the volume + a client CT engine.

Voxel/orientation conventions mirror the app renderer exactly
(src/lib/airway-anatomy/{geometry,airway-render}.ts):
  * volume index order: volume[k * sx * sy + j * sx + i]  (i fastest)
  * axial  slice: x = i (patient L →), y = j (posterior ↓)   → top = A, left = R
  * coronal slice: x = i,             y = sz-1-k (superior ↑) → top = S, left = R
  * LPS is Left-Posterior-Superior; the direction matrix is identity here.
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CASE = os.path.join(REPO, "public", "airway-anatomy", "case-001")
MANIFEST = os.path.join(CASE, "case_manifest.json")
GRAPH = os.path.join(CASE, "metadata", "airway_graph.json")
LABELS = os.path.join(CASE, "metadata", "centerline_labels.json")
RAW = os.path.join(CASE, "ct", "target_clean_ct_preview_i16.raw")

OUT_DIR = os.path.join(REPO, "public", "airway-lesson", "ct")
OUT_MANIFEST = os.path.join(REPO, "public", "airway-lesson", "airway-survey-ct.json")

SCALE = 2  # upscale slices for crisp display / crosshair
# Lung window: airway lumen reads black inside gray parenchyma / white mediastinum.
WINDOW = (-1000, -300)

# Lesson node id -> (centerline label OR None for special, fraction along the
# most-proximal labeled edge to sample). Fraction is by arc length.
# `lul-upper`, `lb1`, `lb2` share the LB1+2 trunk in this centerline set.
NODE_MAP = {
    "trachea": ("TR", 0.42),
    "rmb": ("RMSB", 0.55),
    "rul": ("RUL", 0.45),
    "rb1": ("RB1", 0.4),
    "rb2": ("RB2", 0.4),
    "rb3": ("RB3", 0.4),
    "bronchus-intermedius": ("BI", 0.5),
    "rml": ("RML", 0.4),
    "rb4": ("RB4", 0.4),
    "rb5": ("RB5", 0.4),
    "rll": ("RLL", 0.4),
    "rb6": ("RB6", 0.4),
    "rb7": ("RB7", 0.4),
    "rb8": ("RB8", 0.4),
    "rb9": ("RB9", 0.4),
    "rb10": ("RB10", 0.4),
    "lmb": ("LMSB", 0.5),
    "lul": ("LUL", 0.45),
    "lul-upper": ("LB1+2", 0.2),
    "lb1-2": ("LB1+2", 0.4),
    "lb1": ("LB1+2", 0.4),
    "lb2": ("LB1+2", 0.4),
    "lb3": ("LB3", 0.4),
    "lingula": ("LB4+5", 0.5),
    "lb4": ("LB4", 0.4),
    "lb5": ("LB5", 0.4),
    "lll": ("LLL", 0.5),
    "lb6": ("LB6", 0.4),
    "lb7-8": ("LB7+8", 0.4),
    "lb9": ("LB9", 0.4),
    "lb10": ("LB10", 0.4),
}

# Lobe -> crosshair color (mirrors src/lib/airway-anatomy-lesson/airway-graph LOBE_COLORS).
LOBE_COLOR = {
    "central": (148, 163, 184),
    "RUL": (56, 189, 248),
    "RML": (52, 211, 153),
    "RLL": (167, 139, 250),
    "LUL": (251, 191, 36),
    "lingula": (251, 113, 133),
    "LLL": (244, 114, 182),
}
NODE_LOBE = {
    "trachea": "central", "rmb": "central", "bronchus-intermedius": "central", "lmb": "central",
    "rul": "RUL", "rb1": "RUL", "rb2": "RUL", "rb3": "RUL",
    "rml": "RML", "rb4": "RML", "rb5": "RML",
    "rll": "RLL", "rb6": "RLL", "rb7": "RLL", "rb8": "RLL", "rb9": "RLL", "rb10": "RLL",
    "lul": "LUL", "lul-upper": "LUL", "lb1-2": "LUL", "lb1": "LUL", "lb2": "LUL", "lb3": "LUL",
    "lingula": "lingula", "lb4": "lingula", "lb5": "lingula",
    "lll": "LLL", "lb6": "LLL", "lb7-8": "LLL", "lb9": "LLL", "lb10": "LLL",
    "larynx": "central",
}


def load_font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def edge_arclength_point(edge, fraction):
    pts = [np.array(p, dtype=float) for p in edge["pointsLps"]]
    seglen = [float(np.linalg.norm(pts[i + 1] - pts[i])) for i in range(len(pts) - 1)]
    total = sum(seglen) or 1.0
    target = fraction * total
    acc = 0.0
    for i, sl in enumerate(seglen):
        if acc + sl >= target:
            t = (target - acc) / sl if sl else 0.0
            return pts[i] + (pts[i + 1] - pts[i]) * t
        acc += sl
    return pts[-1]


def lps_to_index(lps, ct):
    origin = np.array(ct["originLps"], dtype=float)
    spacing = np.array(ct["spacingXyzMm"], dtype=float)
    # Identity direction in this case; divide component-wise.
    return (np.array(lps, dtype=float) - origin) / spacing


def window_to_gray(slice_i16, low, high):
    norm = (slice_i16.astype(np.float32) - low) / max(high - low, 1)
    return (np.clip(norm, 0, 1) * 255).astype(np.uint8)


def draw_crosshair(img, cx, cy, color):
    d = ImageDraw.Draw(img, "RGBA")
    r = 13
    gap = 5
    halo = (10, 12, 20, 210)
    for col, w in ((halo, 5), (color + (255,), 2)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=w)
        d.line([cx - r - 6, cy, cx - gap, cy], fill=col, width=w)
        d.line([cx + gap, cy, cx + r + 6, cy], fill=col, width=w)
        d.line([cx, cy - r - 6, cx, cy - gap], fill=col, width=w)
        d.line([cx, cy + gap, cx, cy + r + 6], fill=col, width=w)


def draw_orientation(img, letters):
    """letters: dict with keys top/bottom/left/right."""
    d = ImageDraw.Draw(img, "RGBA")
    font = load_font(15)
    w, h = img.size
    pad = 5
    placements = {
        "top": (w // 2, pad),
        "bottom": (w // 2, h - pad - 15),
        "left": (pad, h // 2 - 8),
        "right": (w - pad - 11, h // 2 - 8),
    }
    for key, (x, y) in placements.items():
        ch = letters.get(key)
        if not ch:
            continue
        d.text((x, y), ch, fill=(226, 232, 240, 235), font=font,
               stroke_width=3, stroke_fill=(2, 6, 23, 235))


def render_axial(volume, k, ct, marker_ij, color):
    sx, sy, sz = ct["sizeXyz"]
    k = int(round(max(0, min(sz - 1, k))))
    sl = volume[k, :, :]  # shape (sy, sx) == (j, i)
    gray = window_to_gray(sl, *WINDOW)
    img = Image.fromarray(gray, mode="L").convert("RGB")
    img = img.resize((sx * SCALE, sy * SCALE), Image.BILINEAR)
    draw_crosshair(img, marker_ij[0] * SCALE, marker_ij[1] * SCALE, color)
    draw_orientation(img, {"top": "A", "bottom": "P", "left": "R", "right": "L"})
    return img, k


def render_coronal(volume, j, ct, marker_ik, color):
    sx, sy, sz = ct["sizeXyz"]
    j = int(round(max(0, min(sy - 1, j))))
    # coronal[y, x] = volume[k = sz-1-y, j, i = x]  -> flip k so superior is up
    sl = volume[:, j, :]  # shape (sz, sx) == (k, i)
    sl = sl[::-1, :]      # top row = highest k = superior
    gray = window_to_gray(sl, *WINDOW)
    img = Image.fromarray(gray, mode="L").convert("RGB")
    img = img.resize((sx * SCALE, sz * SCALE), Image.BILINEAR)
    mx = marker_ik[0] * SCALE
    my = (sz - 1 - marker_ik[1]) * SCALE
    draw_crosshair(img, mx, my, color)
    draw_orientation(img, {"top": "S", "bottom": "I", "left": "R", "right": "L"})
    return img, j


def main():
    manifest = json.load(open(MANIFEST))
    ct = manifest["ct"]
    graph = json.load(open(GRAPH))
    labels = json.load(open(LABELS))
    sx, sy, sz = ct["sizeXyz"]

    volume = np.fromfile(RAW, dtype=np.int16).reshape((sz, sy, sx))

    nodes_by_id = {n["id"]: n for n in graph["nodes"]}
    edges_by_id = {e["id"]: e for e in graph["edges"]}

    # label -> most proximal labeled edge (min rootDistance of its start node).
    label_to_edges = {}
    for eid_str, info in labels["edgeLabels"].items():
        if not info:
            continue
        lab = info["abbreviatedLabel"]
        label_to_edges.setdefault(lab, []).append(int(eid_str))

    def proximal_edge(label):
        eids = label_to_edges.get(label, [])
        best, best_rd = None, math.inf
        for eid in eids:
            e = edges_by_id.get(eid)
            if not e:
                continue
            rd = nodes_by_id.get(e["startNodeId"], {}).get("rootDistanceMm", math.inf)
            if rd < best_rd:
                best_rd, best = rd, e
        return best

    os.makedirs(OUT_DIR, exist_ok=True)
    out_structures = {}

    # Special-case: larynx sits above the imaged field -> show the top tracheal slice.
    tr_edge = proximal_edge("TR")
    tr_top = np.array(tr_edge["pointsLps"][0], dtype=float)
    specials = {"larynx": tr_top}

    for node_id in list(NODE_MAP) + ["larynx"]:
        color = LOBE_COLOR[NODE_LOBE[node_id]]
        if node_id in specials:
            lps = specials[node_id]
        else:
            label, frac = NODE_MAP[node_id]
            edge = proximal_edge(label)
            if edge is None:
                print(f"WARN: no edge for {node_id} ({label})")
                continue
            lps = edge_arclength_point(edge, frac)

        idx = lps_to_index(lps, ct)
        i, j, k = idx
        i = max(0, min(sx - 1, i))
        j = max(0, min(sy - 1, j))
        k = max(0, min(sz - 1, k))

        ax_img, ax_k = render_axial(volume, k, ct, (i, j), color)
        co_img, co_j = render_coronal(volume, j, ct, (i, k), color)

        ax_name = f"{node_id}-axial.jpg"
        co_name = f"{node_id}-coronal.jpg"
        ax_img.save(os.path.join(OUT_DIR, ax_name), quality=86, optimize=True)
        co_img.save(os.path.join(OUT_DIR, co_name), quality=86, optimize=True)

        out_structures[node_id] = {
            "axial": f"/airway-lesson/ct/{ax_name}",
            "coronal": f"/airway-lesson/ct/{co_name}",
            "lps": [round(float(v), 2) for v in lps],
            "axialSlice": int(ax_k),
            "coronalSlice": int(co_j),
        }
        print(f"  {node_id:20s} k={int(ax_k):3d} j={int(co_j):3d} lps={[round(float(v),1) for v in lps]}")

    out = {
        "meta": {
            "source": "airway-anatomy/case-001 preview volume",
            "window": {"low": WINDOW[0], "high": WINDOW[1], "label": "Lung"},
            "sizeXyz": ct["sizeXyz"],
            "note": "Educational CT correlation. Axial/coronal slices pre-rendered offline.",
        },
        "structures": out_structures,
    }
    with open(OUT_MANIFEST, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    total = sum(
        os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR)
    )
    print(f"\nwrote {len(out_structures)} structures, {len(os.listdir(OUT_DIR))} images, "
          f"{total/1024:.0f} KB total")
    print(f"manifest: {OUT_MANIFEST}")


if __name__ == "__main__":
    main()
