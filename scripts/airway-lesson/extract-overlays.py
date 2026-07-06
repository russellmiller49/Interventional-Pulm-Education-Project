#!/usr/bin/env python3
"""Generate the airway "Real bronchoscopy" overlay dataset from a CVAT export.

Pipeline for the Intro-to-Bronchoscopy → Airway Anatomy → "Real bronchoscopy"
video atlas (src/components/airway-anatomy-lesson/AirwayVideoAtlas.tsx):

  1. Annotate a normal diagnostic bronchoscopy in CVAT (interpolation mode).
     The lesson now uses two CVAT exports:
       - updated_airway_annotations.zip: visible structures from the scope view.
       - Current_scope_segment.zip: the airway segment the scope is currently in.
  2. Re-encode the de-identified learner-facing video:
       python3 scripts/airway-lesson/render-video-assets.py
  3. Run this script for each export to emit:
       - airway-survey-overlays.json
       - airway-scope-segment-overlays.json

CVAT interpolation mode already writes a shape at (nearly) every frame, so we do
NOT re-interpolate — we sample every STEP frames and take each track's exact-frame
shape, simplify polygons with Ramer-Douglas-Peucker, and round to integer pixels.

Overlays are stored in the cropped endoscopic-field coordinate space
(1368x1080). Frame numbers remain source-video frame numbers so the cropped
web video and original CVAT export stay synchronized.
"""
import json
import os
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_ZIP = os.path.join(
    REPO, "normal_airway_anotated_video", "updated_airway_annotations.zip"
)
FALLBACK_XML = os.path.join(
    REPO, "normal_airway_anotated_video", "extracted", "annotations.xml"
)
SRC = os.environ.get(
    "AIRWAY_ANNOTATIONS",
    DEFAULT_ZIP if os.path.exists(DEFAULT_ZIP) else FALLBACK_XML,
)
OUT = os.environ.get(
    "AIRWAY_OVERLAYS_OUT",
    os.path.join(REPO, "public", "airway-lesson", "airway-survey-overlays.json"),
)
ANNOTATION_SET = os.environ.get("AIRWAY_OVERLAY_SET", "visible-anatomy")

STEP = 2          # sample every N frames (~30 fps overlay at 59.5 fps source)
RDP_EPS = 2.0     # polygon simplification tolerance, px
MAX_VERTS = 22    # hard cap on vertices per polygon

# Source video facts (ffprobe V0002.mp4).
SRC_WIDTH, SRC_HEIGHT = 1920, 1080
FRAME_COUNT = 2101
DURATION = 35.2902
FPS = FRAME_COUNT / DURATION  # ~59.53

# The source frame includes a left metadata panel. All learner-facing assets use
# only the bronchoscopy image field, so store overlay points in the same cropped
# coordinate system as the quiz stills and public video.
CROP_X, CROP_Y, CROP_W, CROP_H = 552, 0, 1368, 1080

# CVAT label -> (display name, lesson AirwayNode id or None, lobe key, group, short).
# lobe keys match src/lib/airway-anatomy-lesson Lobe type so the player reuses
# lobeColor(). `node` cross-links a structure to the 3D model / dendrogram.
LABEL_MAP = {
    "Vocal cord":               ("Vocal cords",                 "larynx",               "central", "larynx",  "Cords"),
    "Aryepiglottic_fold":       ("Aryepiglottic fold",          None,                   "central", "larynx",  "AE fold"),
    "Cuneiform_cartilage":      ("Cuneiform tubercle",          None,                   "central", "larynx",  "Cuneiform"),
    "Corniculate_cartilage":    ("Corniculate tubercle",        None,                   "central", "larynx",  "Corniculate"),
    "Cricoid_cartilage":        ("Cricoid cartilage",           None,                   "central", "larynx",  "Cricoid"),
    "Trachea":                  ("Trachea",                     "trachea",              "central", "central", "Trachea"),
    "Main_Carina":              ("Main carina",                 "trachea",              "central", "central", "Carina"),
    "Secondary_Carina":         ("Secondary carina (RUL spur)", None,                   "central", "central", "2° carina"),
    "RMB":                      ("Right main bronchus",         "rmb",                  "central", "central", "RMB"),
    "BI":                       ("Bronchus intermedius",        "bronchus-intermedius", "central", "central", "BI"),
    "RUL":                      ("Right upper lobe bronchus",   "rul",                  "RUL",     "RUL",     "RUL"),
    "RB1_Apical":               ("RB1 · Apical",                "rb1",                  "RUL",     "RUL",     "RB1"),
    "RB2_Posterior":            ("RB2 · Posterior",             "rb2",                  "RUL",     "RUL",     "RB2"),
    "RB3_Anterior":             ("RB3 · Anterior",              "rb3",                  "RUL",     "RUL",     "RB3"),
    "RML":                      ("Right middle lobe bronchus",  "rml",                  "RML",     "RML",     "RML"),
    "RB4_Lateral":              ("RB4 · Lateral",               "rb4",                  "RML",     "RML",     "RB4"),
    "RB5_Medial":               ("RB5 · Medial",                "rb5",                  "RML",     "RML",     "RB5"),
    "RLL":                      ("Right lower lobe bronchus",   "rll",                  "RLL",     "RLL",     "RLL"),
    "RB6_Superior":             ("RB6 · Superior",              "rb6",                  "RLL",     "RLL",     "RB6"),
    "RB7_Medial_Basal":         ("RB7 · Medial basal",          "rb7",                  "RLL",     "RLL",     "RB7"),
    "RB8_Anterior_Basal":       ("RB8 · Anterior basal",        "rb8",                  "RLL",     "RLL",     "RB8"),
    "RB9_Lateral_Basal":        ("RB9 · Lateral basal",         "rb9",                  "RLL",     "RLL",     "RB9"),
    "RB10_Posterior_Basal":     ("RB10 · Posterior basal",      "rb10",                 "RLL",     "RLL",     "RB10"),
    "LMB":                      ("Left main bronchus",          "lmb",                  "central", "central", "LMB"),
    "LUL":                      ("Left upper lobe bronchus",    "lul",                  "LUL",     "LUL",     "LUL"),
    "LUL_Proper":               ("Left upper division",         "lul-upper",            "LUL",     "LUL",     "LUL div"),
    "LB1_2_Apicoposterior":     ("LB1+2 · Apicoposterior",      "lb1-2",                "LUL",     "LUL",     "LB1+2"),
    "LB3_Anterior":             ("LB3 · Anterior",              "lb3",                  "LUL",     "LUL",     "LB3"),
    "Lingula":                  ("Lingular bronchus",           "lingula",              "lingula", "lingula", "Lingula"),
    "LB4_Superior":             ("LB4 · Superior lingula",      "lb4",                  "lingula", "lingula", "LB4"),
    "LB5_Inferior":             ("LB5 · Inferior lingula",      "lb5",                  "lingula", "lingula", "LB5"),
    "LLL":                      ("Left lower lobe bronchus",    "lll",                  "LLL",     "LLL",     "LLL"),
    "LB6_Superior":             ("LB6 · Superior",              "lb6",                  "LLL",     "LLL",     "LB6"),
    "LB7_8_Anteromedial_Basal": ("LB7+8 · Anteromedial basal",  "lb7-8",                "LLL",     "LLL",     "LB7+8"),
    "LB9_Lateral_Basal":        ("LB9 · Lateral basal",         "lb9",                  "LLL",     "LLL",     "LB9"),
    "LB10_Posterior_Basal":     ("LB10 · Posterior basal",      "lb10",                 "LLL",     "LLL",     "LB10"),
}


def rdp(points, eps):
    """Ramer-Douglas-Peucker on a list of (x,y). Keeps endpoints."""
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    seg2 = dx * dx + dy * dy
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if seg2 == 0:
            d = ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        else:
            t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / seg2))
            d = ((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2) ** 0.5
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(points[: idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [start, end]


def simplify_polygon(pts):
    if len(pts) <= 6:
        return pts
    eps = RDP_EPS
    out = rdp(pts, eps)
    while len(out) > MAX_VERTS and eps < 40:
        eps *= 1.5
        out = rdp(pts, eps)
    return out


def parse_points(s):
    return [tuple(float(v) for v in pair.split(",")) for pair in s.strip().split(";")]


def crop_points(pts):
    return [(x - CROP_X, y - CROP_Y) for x, y in pts]


def parse_cvat_root(path):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            with archive.open("annotations.xml") as handle:
                return ET.parse(handle).getroot()
    return ET.parse(path).getroot()


def main():
    if not os.path.exists(SRC):
        sys.exit(f"annotations not found: {SRC}\nSet AIRWAY_ANNOTATIONS to the CVAT export.")
    root = parse_cvat_root(SRC)

    first_frame, last_frame, shape_kind = {}, {}, {}
    per_frame = defaultdict(list)

    for tr in root.findall("track"):
        label = tr.get("label")
        if label not in LABEL_MAP:
            print(f"WARN: unmapped label {label!r}, skipping", file=sys.stderr)
            continue
        for tag, kind in (("polygon", "poly"), ("polyline", "line")):
            for sh in tr.findall(tag):
                if sh.get("outside") != "0":
                    continue
                f = int(sh.get("frame"))
                per_frame[f].append((label, kind, parse_points(sh.get("points"))))
                first_frame[label] = min(first_frame.get(label, f), f)
                last_frame[label] = max(last_frame.get(label, f), f)
                shape_kind[label] = kind

    present = sorted((l for l in LABEL_MAP if l in first_frame), key=lambda l: first_frame[l])
    idx_of = {l: i for i, l in enumerate(present)}

    structures = []
    for l in present:
        name, node, lobe, group, short = LABEL_MAP[l]
        structures.append({
            "key": l, "name": name, "short": short, "node": node,
            "lobe": lobe, "group": group, "shape": shape_kind[l],
            "first": first_frame[l], "last": last_frame[l],
        })

    frames_out = []
    for f in range(0, FRAME_COUNT, STEP):
        shapes = per_frame.get(f)
        if not shapes:
            continue
        entry = []
        for label, kind, pts in shapes:
            if kind == "poly":
                pts = simplify_polygon(pts)
            pts = crop_points(pts)
            flat = []
            for x, y in pts:
                flat += [int(round(x)), int(round(y))]
            entry.append([idx_of[label]] + flat)
        frames_out.append([f, entry])

    data = {
        "meta": {
            "video": "airway-survey-cropped.mp4", "poster": "airway-survey-poster-cropped.jpg",
            "width": CROP_W, "height": CROP_H, "fps": round(FPS, 4),
            "duration": DURATION, "frameCount": FRAME_COUNT, "step": STEP,
            "annotationSet": ANNOTATION_SET,
            "sourceWidth": SRC_WIDTH, "sourceHeight": SRC_HEIGHT,
            "crop": {"x": CROP_X, "y": CROP_Y, "width": CROP_W, "height": CROP_H},
        },
        "structures": structures,
        "frames": frames_out,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(data, fh, separators=(",", ":"))

    size = os.path.getsize(OUT)
    vc = [len(s) // 2 for _, shapes in frames_out for s in shapes]
    print(f"wrote {OUT}")
    print(f"  structures: {len(structures)}  sampled frames: {len(frames_out)}")
    print(f"  shapes: {len(vc)}  verts min/mean/max: {min(vc)}/{sum(vc)/len(vc):.1f}/{max(vc)}")
    print(f"  size: {size/1024:.0f} KB")


if __name__ == "__main__":
    main()
