#!/usr/bin/env python3
"""Extract per-structure endoscopic still frames for the cross-modal identify quiz.

For each airway structure that the annotated bronchoscopy shows, pick the frame
where it is most clearly in view (largest outline, within its first appearance),
extract that still from the source video, and record its outline polygon. The
quiz then shows the real endoscopic photo with the structure outlined but
unlabeled, alongside the CT slice and 3D highlight, and asks the learner to name
it.

Reads the same cropped-coordinate overlay dataset the video atlas uses; emits
compact JPEGs + `public/airway-lesson/airway-quiz-frames.json`. Extracts from
the source 1920x1080 video so frame numbers match the CVAT export exactly.
"""
import json
import math
import os
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OVERLAYS = os.path.join(REPO, "public", "airway-lesson", "airway-survey-overlays.json")
SRC_VIDEO = os.path.join(REPO, "normal_airway_anotated_video", "V0002.mp4")
CT_MANIFEST = os.path.join(REPO, "public", "airway-lesson", "airway-survey-ct.json")
OUT_DIR = os.path.join(REPO, "public", "airway-lesson", "quiz")
OUT_MANIFEST = os.path.join(REPO, "public", "airway-lesson", "airway-quiz-frames.json")

# The source frame is 1920x1080 with the scope's info panel on the left; crop to
# the endoscopic octagon so the quiz image is centered on what the scope sees.
CROP_X, CROP_Y, CROP_W, CROP_H = 552, 0, 1368, 1080
JPEG_WIDTH = 820  # downscale the cropped region for the web


def polygon_area(pts):
    a = 0.0
    n = len(pts) // 2
    for i in range(n):
        j = (i - 1) % n
        a += (pts[j * 2] + pts[i * 2]) * (pts[j * 2 + 1] - pts[i * 2 + 1])
    return abs(a / 2)


def first_run_last(frames, step):
    """Last frame of the first contiguous run of `frames` (sorted)."""
    if not frames:
        return None
    max_gap = step * 6
    last = frames[0]
    for k in range(1, len(frames)):
        if frames[k] - frames[k - 1] <= max_gap:
            last = frames[k]
        else:
            break
    return last


def extract_frame(frame_num, out_path):
    # Select exact frame N, crop to the scope octagon, scale down.
    vf = (
        f"select='eq(n\\,{frame_num})',"
        f"crop={CROP_W}:{CROP_H}:{CROP_X}:{CROP_Y},scale={JPEG_WIDTH}:-1"
    )
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", SRC_VIDEO,
        "-vf", vf, "-vframes", "1", "-q:v", "4", out_path,
    ]
    subprocess.run(cmd, check=True)


def poly_in_quiz_space(pts, meta):
    """Return polygon points in the cropped still coordinate space."""
    if meta.get("width") == CROP_W and meta.get("height") == CROP_H:
        return [int(round(v)) for v in pts]
    out = []
    for i in range(0, len(pts), 2):
        out.append(int(round(pts[i])) - CROP_X)
        out.append(int(round(pts[i + 1])) - CROP_Y)
    return out


def main():
    if not os.path.exists(SRC_VIDEO):
        raise SystemExit(f"source video not found: {SRC_VIDEO}")
    data = json.load(open(OVERLAYS))
    meta = data["meta"]
    structures = data["structures"]
    step = meta["step"]
    ct = json.load(open(CT_MANIFEST))["structures"] if os.path.exists(CT_MANIFEST) else {}

    # Gather each structure's frames + the polygon on each frame.
    frames_by_struct = {}
    polys = {}  # (structIdx, frame) -> flat pts
    for frame, shapes in data["frames"]:
        for sh in shapes:
            si = sh[0]
            frames_by_struct.setdefault(si, []).append(frame)
            polys[(si, frame)] = sh[1:]

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {}

    for si, struct in enumerate(structures):
        node = struct.get("node")
        if not node or struct.get("shape") != "poly":
            continue
        frames = sorted(frames_by_struct.get(si, []))
        if not frames:
            continue
        run_last = first_run_last(frames, step)
        # Best frame = largest outline within the first appearance run.
        candidates = [f for f in frames if f <= run_last]
        best_f = max(candidates, key=lambda f: polygon_area(polys[(si, f)]))
        pts = polys[(si, best_f)]
        area = polygon_area(pts)
        # Skip tiny/degenerate outlines.
        if area < (meta["width"] * meta["height"] * 0.004):
            continue
        # A distinct orifice worth outlining vs. the whole scope field (the scope
        # is inside that airway) — the latter reads as "which airway are you in?".
        is_orifice = area < 0.25 * meta["width"] * meta["height"]

        img_name = f"{node}.jpg"
        extract_frame(best_f, os.path.join(OUT_DIR, img_name))

        out[node] = {
            "img": f"/airway-lesson/quiz/{img_name}",
            "frame": best_f,
            "poly": poly_in_quiz_space(pts, meta),
            "name": struct["name"],
            "short": struct["short"],
            "lobe": struct["lobe"],
            "group": struct["group"],
            "isOrifice": is_orifice,
            "hasCt": node in ct,
        }
        print(f"  {node:20s} frame={best_f:4d} area={polygon_area(pts):.0f} verts={len(pts)//2}")

    manifest = {
        "meta": {
            "width": CROP_W,
            "height": CROP_H,
            "note": "Endoscopic still frames for the identify quiz, cropped to the scope image.",
        },
        "structures": out,
    }
    with open(OUT_MANIFEST, "w") as fh:
        json.dump(manifest, fh, separators=(",", ":"))
    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f"\nwrote {len(out)} quiz frames, {total/1024:.0f} KB total\nmanifest: {OUT_MANIFEST}")


if __name__ == "__main__":
    main()
