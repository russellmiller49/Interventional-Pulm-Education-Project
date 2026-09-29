#!/usr/bin/env python3
"""Measure the manufacturer's reference frames and write the measurement record.

The frames are stills of the manufacturer's product animation, held in the owner's local data
inside `mini-thoracoscopy.pptx`. They are read in place. Only numbers leave this script: no frame,
crop or overlay is written to the repository.

Four frames are measured:

- frame 2, the telescope from its left side: shaft, eyepiece, body and the parts behind it;
- frame 3, the distal face: optic, working channel and wall;
- frame 13, the telescope through the flexible sleeve: the sleeve's diameters and lengths;
- frame 7, the forceps through the telescope: how far it stands proud, and the jaw opening.

The frames are perspective views. Frames 2 and 13 are read through a pinhole camera fitted to
the telescope shaft, whose diameter and length are published (`mt_reference.TubeCamera`). The
distal face in frame 3 is read as an affine view of a circle. In frame 7 the shaft's width does
not change along its length, so that frame is read at one scale.

Every value is a derived measurement, never a device fact. Its tolerance is how far it moved
when each assumption of the fit was varied in turn (root sum of squares), plus one pixel at the
depth of the measurement. The variations are listed in the record. A tolerance is a modelling
tolerance, not a manufacturing one.

Outputs:
    src/features/medical-thoracoscopy/content/data/reference-measurements.json
        the values the models and the device definitions use (committed)
    <Local-Data>/raw-assets/medical-thoracoscopy/measurements/reference-measurements-full.json
        every value, including each variation (not committed)

Usage:
    python3 scripts/medical-thoracoscopy/measure_reference_frames.py           write both
    python3 scripts/medical-thoracoscopy/measure_reference_frames.py --check   compare only

The committed record is formatted with the repository's Prettier as it is written, so the file
the device models are stamped with is the file that is committed. `--check` compares values, not
formatting.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from dataclasses import dataclass, replace
from datetime import date
from pathlib import Path

import numpy as np
from scipy import ndimage as ndi

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from local_data import local_data_path, require_local_data_path  # noqa: E402
from mt_reference import (  # noqa: E402
    PPTX_PARTS,
    Frame,
    Line,
    TubeCamera,
    fit_ellipse,
    fit_line,
    mask_run,
    outer_edges,
    read_frame_bytes,
    sha256_file,
    silhouette_edges,
)

RECORD = REPO / "src/features/medical-thoracoscopy/content/data/reference-measurements.json"
FULL_RECORD = ("raw-assets", "medical-thoracoscopy", "measurements", "reference-measurements-full.json")

# Published values the camera fits rest on. They are device facts in device-definitions.json and
# are read from there, so a change to a fact changes the measurements.
DEFINITIONS = REPO / "src/features/medical-thoracoscopy/content/data/device-definitions.json"

# Points picked by eye on each frame. Every one of them is refined before it is used, and the
# results do not depend on the exact pixel chosen.
SEEDS = {
    "frame2.shaft": ((109.0, 777.5), (1560.0, 707.2)),
    "frame2.eyepiece": ((2006.7, 501.8), (2342.0, 283.7)),
    "frame3.face": (1137.0, 570.0),
    "frame13.shaft": ((666.8, 1138.6), (1390.0, 589.6)),
    "frame13.eyepiece": ((1647.5, 250.0), (1735.0, 150.0)),
    "frame7.shaft": ((560.0, 868.0), (1480.0, 752.0)),
}


def published(device: str, key: str) -> float:
    definitions = json.loads(DEFINITIONS.read_text())
    for entry in definitions["devices"]:
        if entry["id"] == device:
            for fact in entry["facts"]:
                if fact["key"] == key:
                    if fact["category"] != "device fact" or not isinstance(fact["value"], (int, float)):
                        raise ValueError(f"{device}.{key} is not a published number")
                    return float(fact["value"])
    raise KeyError(f"{device}.{key}")


SHAFT_DIAMETER = published("operative-telescope", "shaftOuterDiameter")
SHAFT_LENGTH = published("operative-telescope", "shaftLength")
TOTAL_LENGTH = published("operative-telescope", "totalLength")


# ---------------------------------------------------------------------------------------------
# Shared pieces


@dataclass(frozen=True)
class Variation:
    """One way of doing the fit. The nominal fit has every field at its default."""

    name: str = "nominal"
    principal_dx: float = 0.0  # px, added to the principal point (the centre of the white card)
    principal_dy: float = 0.0
    tip_px: float = 0.0  # px along the axis, added to the distal end of the shaft
    body_px: float = 0.0  # px along the axis, added to where the shaft meets the body
    rim_px: float = 2.0  # px inside an edge at which the object's own luminance is read
    fixed_edges: bool = False  # place edges 20 below the background instead of at half contrast
    end_px: float = 0.0  # px along the eyepiece axis, added to the eyepiece end
    dark: float = 40.0  # luminance below which the distal face is dark (frame 3)
    rim_level: float = 80.0  # luminance between the dark channel and its lit rim (frame 3)
    wall_ratio: float | None = None  # outer over inner wall radius on the distal face (frame 3)


def variations(*names: str) -> list[Variation]:
    table = {
        "principal x -150": Variation("principal x -150", principal_dx=-150.0),
        "principal x +150": Variation("principal x +150", principal_dx=150.0),
        "principal y -230": Variation("principal y -230", principal_dy=-230.0),
        "principal y +230": Variation("principal y +230", principal_dy=230.0),
        "tip at the face centre": Variation("tip at the face centre", tip_px=6.4),
        "body -2 px": Variation("body -2 px", body_px=-2.0),
        "body +2 px": Variation("body +2 px", body_px=2.0),
        "rim read 1.5 px inside": Variation("rim read 1.5 px inside", rim_px=1.5),
        "rim read 3 px inside": Variation("rim read 3 px inside", rim_px=3.0),
        "edges 20 below background": Variation("edges 20 below background", fixed_edges=True),
        "eyepiece end -2 px": Variation("eyepiece end -2 px", end_px=-2.0),
        "eyepiece end +2 px": Variation("eyepiece end +2 px", end_px=2.0),
        "dark below 30": Variation("dark below 30", dark=30.0),
        "dark below 50": Variation("dark below 50", dark=50.0),
        "channel rim at 60": Variation("channel rim at 60", rim_level=60.0),
        "channel rim at 100": Variation("channel rim at 100", rim_level=100.0),
    }
    return [table[name] for name in names]


def edges_across(frame: Frame, line: Line, t: float, half: float, v: "Variation"):
    if v.fixed_edges:
        return outer_edges(frame, line, t, half=half, drop=20.0)
    return silhouette_edges(frame, line, t, half=half, rim_px=v.rim_px)


def refine_axis(frame: Frame, seed: Line, t0: float, t1: float, step: float, half: float,
                v: "Variation", rounds: int = 2):
    """The shaft's axis and its apparent width, from profiles across it."""
    line = seed
    for _ in range(rounds):
        ts, mids, widths = [], [], []
        for t in np.arange(t0, t1, step):
            edges = edges_across(frame, line, t, half, v)
            if edges is None:
                continue
            ts.append(t)
            mids.append((edges[0] + edges[1]) / 2)
            widths.append(edges[1] - edges[0])
        ts = np.array(ts)
        slope, offset, _, _ = fit_line(ts, np.array(mids))
        line = line.refined(offset, slope)
    width_slope, width_at_zero, residual, count = fit_line(ts, np.array(widths))
    return line, width_at_zero, width_slope, residual, count


def crossing(values: np.ndarray, positions: np.ndarray, level: float, rising: bool) -> float:
    """First position where the values cross the level, interpolated."""
    for index in range(1, len(values)):
        a, b = values[index - 1], values[index]
        if (rising and a < level <= b) or (not rising and a > level >= b):
            fraction = (level - a) / (b - a)
            return float(positions[index - 1] + fraction * (positions[index] - positions[index - 1]))
    raise ValueError("no crossing")


def luminance_along(frame: Frame, line: Line, ts: np.ndarray) -> np.ndarray:
    return frame.sample(np.array([line.at(t) for t in ts]))


def round_to(value: float, step: float) -> float:
    return float(round(round(value / step) * step, 6))


def round_up(value: float, step: float) -> float:
    return float(round(math.ceil(value / step - 1e-9) * step, 6))


# ---------------------------------------------------------------------------------------------
# Frame 2: the telescope from its left side


def telescope_side(frame: Frame, mask: np.ndarray, v: Variation) -> dict:
    out: dict = {}

    # The shaft: its axis, and its width falling with distance from the camera.
    seed = Line.through(*SEEDS["frame2.shaft"])
    axis, width0, width_slope, residual, count = refine_axis(frame, seed, 10.0, 1400.0, 2.0, 60.0, v)
    out["shaftWidthResidualPx"] = residual

    # The distal end: where the luminance along the axis falls half way from the background to
    # the metal. The body: where the silhouette first grows past the shaft by 3 px.
    ts = np.arange(-20.0, 20.0, 0.1)
    lum = luminance_along(frame, axis, ts)
    tip_t = crossing(lum, ts, (lum[:20].mean() + lum[-20:].mean()) / 2, rising=False)
    body_t = None
    for t in np.arange(1300.0, 1560.0, 0.5):
        edges = edges_across(frame, axis, t, 60.0, v)
        if edges is None or (edges[1] - edges[0]) > width0 + width_slope * t + 3.0:
            body_t = t
            break
    if body_t is None:
        raise ValueError("frame 2: the body was not found")
    tip_t += v.tip_px
    body_t += v.body_px
    axis = Line(axis.at(tip_t), axis.direction)  # t now runs from the distal end
    body_t -= tip_t
    width = lambda t: width0 + width_slope * (t + tip_t)  # noqa: E731

    centre = frame.centre() + np.array([v.principal_dx, v.principal_dy])
    camera = TubeCamera(axis.at(0.0), axis.at(body_t), width(0.0), width(body_t), SHAFT_DIAMETER,
                        SHAFT_LENGTH, centre)
    out["camera"] = {
        "principalPointPx": [float(centre[0]), float(centre[1])],
        "focalPx": camera.focal_px,
        "tipDepthMm": float(camera.tip[2]),
        "bodyDepthMm": float(camera.end[2]),
        "shaftTiltDeg": camera.tilt_deg,
        "shaftAxisPx": {"through": axis.at(0.0).tolist(), "direction": axis.direction.tolist()},
        "shaftWidthPx": {"atTip": width(0.0), "perPx": width_slope},
        "bodyStartsAtPx": body_t,
    }

    def u_of(t: float) -> float:
        return float(camera.to_plane(axis.at(t))[0])

    def mm_across(px: float, t: float) -> float:
        return camera.width_mm(px, u_of(t))

    # The eyepiece tube: its axis from the midpoints of its silhouette.
    tube = Line.through(*SEEDS["frame2.eyepiece"])
    for _ in range(2):
        ts_, mids = [], []
        for t in np.arange(-100.0, 300.0, 2.0):
            run = mask_run(mask, tube, t, half=160.0, step=0.25)
            if run is None:
                continue
            ts_.append(t)
            mids.append((run[0] + run[1]) / 2)
        slope, offset, _, _ = fit_line(np.array(ts_), np.array(mids))
        tube = tube.refined(offset, slope)
    ts = np.arange(480.0, 540.0, 0.1)
    lum = luminance_along(frame, tube, ts)
    end_t = crossing(lum, ts, (lum[:50].mean() + lum[-50:].mean()) / 2, rising=True) + v.end_px
    end_px = tube.at(end_t)

    # Roll: the plane through the shaft and the eyepiece is turned about the shaft until the
    # eyepiece end lies at the published total length, measured along the shaft from the tip.
    def end_u(roll: float) -> float:
        camera.set_roll(roll)
        return float(camera.to_plane(end_px)[0])

    low, high = -30.0, 40.0
    if not (end_u(low) - TOTAL_LENGTH) * (end_u(high) - TOTAL_LENGTH) < 0:
        raise ValueError("frame 2: no roll puts the eyepiece end at the total length")
    for _ in range(60):
        middle = (low + high) / 2
        if (end_u(low) - TOTAL_LENGTH) * (end_u(middle) - TOTAL_LENGTH) <= 0:
            high = middle
        else:
            low = middle
    roll = (low + high) / 2
    camera.set_roll(roll)
    out["camera"]["rollDeg"] = roll
    # Where the device sat, in the fitted camera's frame (x right, y down, z forward): for laying the
    # model over the frame. Kept in the local record only.
    out["pose"] = {"tipMm": camera.tip.tolist(), "axis": camera.axis.tolist(), "up": camera.up.tolist()}

    a = camera.to_plane(tube.at(-100.0))
    b = camera.to_plane(tube.at(400.0))
    direction = (b - a) / np.linalg.norm(b - a)
    meet = a + direction * (-a[1] / direction[1])
    out["eyepieceAngle"] = float(np.degrees(np.arctan2(direction[1], direction[0])))
    out["eyepieceMeetsShaftAt"] = float(meet[0])

    def along(t: float):
        point = camera.to_plane(tube.at(t))
        return float(np.dot(point - meet, direction)), point

    stations = []
    for t in np.arange(-130.0, end_t - 1.0, 1.0):
        run = mask_run(mask, tube, t, half=160.0, step=0.25)
        if run is None:
            continue
        s, point = along(t)
        stations.append((s, camera.width_mm(run[1] - run[0], point[0], point[1]), t, run))
    s_values = np.array([row[0] for row in stations])
    diameters = np.array([row[1] for row in stations])

    def median_between(lo: float, hi: float) -> float:
        pick = (s_values >= lo) & (s_values <= hi)
        return float(np.median(diameters[pick]))

    def first_above(level: float, start: float) -> float:
        pick = np.nonzero((s_values > start) & (diameters > level))[0]
        return float(s_values[pick[0]])

    narrow = median_between(44.0, 66.0)
    wide = median_between(86.0, 110.0)
    step_wide = first_above((narrow + wide) / 2, 44.0)
    neck = median_between(118.0, 127.0)
    step_neck = first_above((wide + neck) / 2, step_wide + 10.0)
    flare = first_above(neck + 0.8, step_neck + 5.0)
    cup = float(diameters.max())
    widest = s_values[diameters >= cup - 0.3]
    end_s = along(end_t)[0]

    blue = []
    for s, _, t, run in stations:
        colour = frame.colour_at(tube.at(t, (run[0] + run[1]) / 2))
        if colour[2] - colour[0] > 40 and 60.0 < s < 100.0:
            blue.append(s)
    out["eyepiece"] = {
        "narrowDiameter": narrow,
        "wideStartsAt": step_wide,
        "wideDiameter": wide,
        "blueRingFrom": float(min(blue)),
        "blueRingTo": float(max(blue)),
        "neckStartsAt": step_neck,
        "neckDiameter": neck,
        "flareStartsAt": flare,
        "eyecupDiameter": cup,
        "eyecupWidestFrom": float(widest.min()),
        "eyecupWidestTo": float(widest.max()),
        "endsAt": end_s,
    }

    # The body, read on its lower side where nothing stands in front of it. Distances are along
    # the shaft from the tip; half-widths are from the shaft axis, at the depth of the axis.
    outline = []
    upper = []
    for t in np.arange(body_t + 1.0, body_t + 500.0, 2.0):
        run = mask_run(mask, axis, t, half=200.0, step=0.25)
        if run is None:
            break
        u = u_of(t)
        outline.append((u, mm_across(run[1], t), t))
        upper.append((u, mm_across(-run[0], t)))
    outline_arr = np.array(outline)

    along_axis = np.arange(body_t, body_t + 520.0, 0.5)
    colours = np.array([frame.colour_at(axis.at(t)) for t in along_axis])
    luminance = colours.mean(axis=1)
    widest_index = int(np.argmax(outline_arr[:, 1]))
    widest_t = outline_arr[widest_index, 2]
    dark_after = np.nonzero((along_axis > widest_t) & (luminance < 80))[0]
    ring_t = float(along_axis[dark_after[0]])
    blue_after = np.nonzero((along_axis > ring_t) & (colours[:, 2] - colours[:, 0] > 25))[0]
    cap_t = float(along_axis[blue_after[0]])
    inside = [t for t in along_axis if mask[int(round(axis.at(t)[1])), int(round(axis.at(t)[0]))]]
    rear_t = float(max(inside))

    def lower_half_width(t: float) -> float:
        run = mask_run(mask, axis, t, half=200.0, step=0.25)
        return mm_across(run[1], t)

    body_points = [(u, r) for u, r, t in outline if t < ring_t]
    nose = [(u, lo, up) for (u, lo, _), (_, up) in zip(outline, upper) if u < u_of(body_t) + 12.0]
    offset = float(np.median([(lo - up) / 2 for _, lo, up in nose]))
    ring_widths = [lower_half_width(t) for t in np.arange(ring_t + 6.0, cap_t - 1.0, 1.0)]
    cap_widths = [lower_half_width(t) for t in np.arange(cap_t + 2.0, rear_t - 2.0, 1.0)]
    body_arr = np.array(body_points)
    peak = body_arr[body_arr[:, 1] >= body_arr[:, 1].max() - 0.1]

    out["body"] = {
        "startsAt": u_of(body_t),
        "outline": [[float(u), float(r)] for u, r in body_points],
        "widestHalfWidth": float(body_arr[:, 1].max()),
        "widestFrom": float(peak[:, 0].min()),
        "widestTo": float(peak[:, 0].max()),
        "axisBelowShaftAxis": offset,
        "endsAt": u_of(ring_t),
        "halfWidthAtEnd": lower_half_width(ring_t),
        "ringHalfWidth": float(np.median(ring_widths)),
        "capStartsAt": u_of(cap_t),
        "capHalfWidth": float(np.median(cap_widths)),
        "channelEntryAt": u_of(rear_t),
    }
    out["resolutionMm"] = mm_across(1.0, body_t)
    return out


# ---------------------------------------------------------------------------------------------
# Frame 3: the distal face


def telescope_tip(frame: Frame, v: Variation) -> dict:
    centre = np.array(SEEDS["frame3.face"], dtype=float)

    # The inner edge of the outer wall: the outermost dark point on each ray from the centre.
    points = []
    for ray in np.arange(0.0, 360.0, 0.5):
        direction = np.array([math.cos(math.radians(ray)), math.sin(math.radians(ray))])
        s = np.arange(100.0, 520.0, 0.25)
        samples = centre[None, :] + s[:, None] * direction[None, :]
        usable = ((samples[:, 0] > 0) & (samples[:, 0] < frame.width - 1)
                  & (samples[:, 1] > 0) & (samples[:, 1] < frame.height - 1))
        values = np.full(len(s), 255.0)
        values[usable] = frame.sample(samples[usable])
        dark = np.nonzero(values < v.dark)[0]
        if len(dark):
            points.append(centre + direction * s[dark[-1]])
    points = np.array(points)
    keep = np.ones(len(points), dtype=bool)
    for _ in range(8):
        middle, major, minor, angle = fit_ellipse(points[keep])
        rotation = np.array([[math.cos(angle), math.sin(angle)], [-math.sin(angle), math.cos(angle)]])
        local = (points - middle) @ rotation.T
        residual = (np.sqrt((local[:, 0] / major) ** 2 + (local[:, 1] / minor) ** 2) - 1) * math.sqrt(major * minor)
        spread = float(np.median(np.abs(residual[keep])) * 1.4826)
        keep = np.abs(residual) < max(3 * spread, 1.0)

    e_major = np.array([math.cos(angle), math.sin(angle)])
    e_minor = np.array([-math.sin(angle), math.cos(angle)])

    def face_image(half_span: float, size: int, up: np.ndarray | None = None) -> np.ndarray:
        """The face resampled so the wall is a circle of radius one."""
        grid = np.linspace(-half_span, half_span, size)
        x, y = np.meshgrid(grid, -grid if up is not None else grid)
        if up is not None:
            right = np.array([up[1], -up[0]])
            fx = x * right[0] + y * up[0]
            fy = x * right[1] + y * up[1]
        else:
            fx, fy = x, y
        image = (middle[None, None, :] + fx[..., None] * major * e_major[None, None, :]
                 + fy[..., None] * minor * e_minor[None, None, :])
        return frame.sample(image.reshape(-1, 2)).reshape(size, size), grid

    # The optic: the bright lens nearest the wall. "Up" on the face points from the centre to it.
    face, grid = face_image(1.1, 1101)
    labels, count = ndi.label(face > 200)
    sizes = ndi.sum(np.ones_like(face), labels, range(1, count + 1))
    step = grid[1] - grid[0]
    best = None
    for index in np.argsort(sizes)[::-1][:8]:
        ys, xs = np.nonzero(labels == index + 1)
        lx, ly = grid[int(round(xs.mean()))], grid[int(round(ys.mean()))]
        radius = math.hypot(lx, ly)
        if 0.5 < radius < 0.9 and sizes[index] * step * step > 0.05:
            best = (lx, ly, sizes[index] * step * step)
            break
    if best is None:
        raise ValueError("frame 3: the lens was not found")
    lens_x, lens_y, lens_area = best
    lens_distance = math.hypot(lens_x, lens_y)
    up = np.array([lens_x, lens_y]) / lens_distance

    # The face with the optic straight up, in units of the inner wall radius.
    size = 1051
    face, grid = face_image(1.05, size, up)
    step = grid[1] - grid[0]
    rows_to_y = lambda row: float(-grid[row])  # noqa: E731

    # The channel is bounded by its own lit rim. Reflections inside it stay well below the rim.
    labels, _ = ndi.label(face < v.rim_level)
    channel = ndi.binary_fill_holes(labels == labels[size // 2, size // 2])
    distance = ndi.distance_transform_edt(channel) * step
    row, col = np.unravel_index(int(np.argmax(distance)), distance.shape)
    inscribed_radius = float(distance[row, col])
    inscribed_y = rows_to_y(row)
    inscribed_x = float(grid[col])
    column = channel[:, size // 2]
    top = rows_to_y(int(np.nonzero(column)[0].min()))
    bottom = rows_to_y(int(np.nonzero(column)[0].max()))
    cols = np.nonzero(channel.any(axis=0))[0]
    half_widths = []
    for height in (0.3, 0.2, 0.1, 0.0, -0.2, -0.4, -0.6, -0.8, -0.95):
        xs = np.nonzero(channel[int(round((1.05 - height) / step))])[0]
        half_widths.append([height, float((grid[xs.max()] - grid[xs.min()]) / 2)])

    # The optic housing: the light ring around the lens, up to where the dark face begins.
    lens_row = int(round((1.05 - lens_distance) / step))
    centre_col = size // 2
    housing = []
    for ray in np.arange(0.0, 360.0, 2.0):
        direction = np.array([math.cos(math.radians(ray)), -math.sin(math.radians(ray))])
        for r in np.arange(0.12, 0.5, step / 2):
            y = lens_row + direction[1] * r / step
            x = centre_col + direction[0] * r / step
            yi, xi = int(round(y)), int(round(x))
            if not (0 <= yi < size and 0 <= xi < size):
                break
            if face[yi, xi] < v.dark:
                housing.append((x, y, ray))
                break
    housing = np.array(housing)
    # Leave out the rays that reach the outer wall before the dark face.
    near_wall = np.hypot((housing[:, 0] - centre_col) * step, (size // 2 - housing[:, 1]) * step) > 0.95
    fit = housing[~near_wall][:, :2]
    xc, yc, r = _circle_fit(fit)
    housing_centre_y = float((size // 2 - yc) * step)
    housing_centre_x = float((xc - centre_col) * step)
    housing_radius = float(r * step)

    # Wall thickness: the outer silhouette on the side where the background is plain.
    ratios = []
    for ray in np.arange(100.0, 260.0, 1.0):
        direction = np.array([math.cos(math.radians(ray)), math.sin(math.radians(ray))])
        s = np.arange(0.8, 1.3, 0.001)
        samples = (middle[None, :] + (s[:, None] * direction[0]) * major * e_major[None, :]
                   + (s[:, None] * direction[1]) * minor * e_minor[None, :])
        values = frame.sample(samples)
        dark = np.nonzero(values < v.dark)[0]
        if not len(dark):
            continue
        after = np.nonzero((s > s[dark[-1]]) & (values > 245))[0]
        if len(after):
            ratios.append(s[after[0]] / s[dark[-1]])
    wall_ratio = float(np.median(ratios)) if v.wall_ratio is None else v.wall_ratio
    inner_radius = (SHAFT_DIAMETER / 2) / wall_ratio

    mm = lambda units: units * inner_radius  # noqa: E731
    return {
        "faceEllipsePx": {"centre": middle.tolist(), "semiMajor": major, "semiMinor": minor,
                          "majorAxisDeg": math.degrees(angle), "residualPx": spread},
        "faceUp": up.tolist(),
        "wallThickness": SHAFT_DIAMETER / 2 - inner_radius,
        "innerRadius": inner_radius,
        "lensCentreAbove": mm(lens_distance),
        "lensDiameter": mm(2 * math.sqrt(lens_area / math.pi)),
        "housingCentreAbove": mm(housing_centre_y),
        "housingDiameter": mm(2 * housing_radius),
        "housingOffCentreline": mm(abs(housing_centre_x - inscribed_x)),
        "channelInscribedDiameter": mm(2 * inscribed_radius),
        "channelCentreBelow": -mm(inscribed_y),
        "channelTop": mm(top),
        "channelBottom": mm(bottom),
        "channelWidth": mm(float(grid[cols.max()] - grid[cols.min()])),
        "channelHalfWidthsByHeight": [[h, w] for h, w in half_widths],
        "channelTableUnit": "inner wall radius",
        "resolutionMm": mm(1.0 / minor),
    }


def _circle_fit(points: np.ndarray):
    x, y = points[:, 0], points[:, 1]
    design = np.column_stack([x, y, np.ones_like(x)])
    target = -(x**2 + y**2)
    (a, b, c), *_ = np.linalg.lstsq(design, target, rcond=None)
    xc, yc = -a / 2, -b / 2
    return xc, yc, math.sqrt(xc**2 + yc**2 - c)


# ---------------------------------------------------------------------------------------------
# Frame 13: the telescope through the flexible sleeve


def sleeve(frame: Frame, v: Variation) -> dict:
    seed = Line.through(*SEEDS["frame13.shaft"])
    profile = []
    for t in np.arange(-30.0, 1000.0, 1.0):
        edges = edges_across(frame, seed, t, 80.0, v)
        profile.append((t, *(edges if edges else (np.nan, np.nan))))
    profile = np.array(profile)
    t, lo, hi = profile[:, 0], profile[:, 1], profile[:, 2]
    width = hi - lo
    known = np.isfinite(width)

    # Sections along the axis: shaft, sleeve tube, sleeve head, shaft, body.
    def first(condition, start):
        index = np.nonzero(condition & (t > start))[0]
        return float(t[index[0]])

    tip_t = first(known, -30.0)
    tube_t = first(known & (width > 32.0), tip_t)
    head_t = first(known & (width > 55.0), tube_t)
    head_end_t = first(known & (width < 32.0), head_t)
    body_t = first(known & (width > 40.0), head_end_t + 20.0)

    shaft = known & (((t > tip_t + 8) & (t < tube_t - 8)) | ((t > head_end_t + 8) & (t < body_t - 8)))
    slope, offset, _, _ = fit_line(t[shaft], ((lo + hi) / 2)[shaft])
    axis = seed.refined(offset, slope)
    width_slope, width0, _, _ = fit_line(t[shaft], width[shaft])
    tip_t += v.tip_px
    body_t += v.body_px
    centre = frame.centre() + np.array([v.principal_dx, v.principal_dy])
    camera = TubeCamera(axis.at(tip_t), axis.at(body_t), width0 + width_slope * tip_t,
                        width0 + width_slope * body_t, SHAFT_DIAMETER, SHAFT_LENGTH, centre)

    def u_of(tt: float) -> float:
        return float(camera.to_plane(axis.at(tt))[0])

    def section_diameter(t0: float, t1: float) -> float:
        pick = known & (t > t0) & (t < t1)
        return float(np.median([camera.width_mm(w, u_of(tt)) for tt, w in zip(t[pick], width[pick])]))

    blue = []
    for tt in np.arange(head_t, head_end_t, 0.5):
        colour = frame.colour_at(axis.at(tt))
        if colour[2] - colour[0] > 40:
            blue.append(tt)
    cap_t = float(min(blue))

    # A second reading of the eyepiece, as a check on frame 2's: turn the plane until the eyepiece
    # end lies at the published total length, then read the eyepiece's angle to the shaft.
    mask = frame.object_mask()
    tube = Line.through(*SEEDS["frame13.eyepiece"])
    for _ in range(2):
        ts_, mids = [], []
        for tt in np.arange(-60.0, 60.0, 1.0):
            run = mask_run(mask, tube, tt, half=120.0, step=0.25)
            if run is not None:
                ts_.append(tt)
                mids.append((run[0] + run[1]) / 2)
        slope, offset, _, _ = fit_line(np.array(ts_), np.array(mids))
        tube = tube.refined(offset, slope)
    along_tube = np.arange(150.0, 320.0, 0.1)
    lum = luminance_along(frame, tube, along_tube)
    end_t = crossing(lum, along_tube, (lum[:50].mean() + 252.0) / 2, rising=True)
    end_px = tube.at(end_t)

    def end_u(roll: float) -> float:
        camera.set_roll(roll)
        return float(camera.to_plane(end_px)[0])

    low, high = -60.0, 60.0
    for _ in range(60):
        middle = (low + high) / 2
        if (end_u(low) - TOTAL_LENGTH) * (end_u(middle) - TOTAL_LENGTH) <= 0:
            high = middle
        else:
            low = middle
    camera.set_roll((low + high) / 2)
    a_pt = camera.to_plane(tube.at(-40.0))
    b_pt = camera.to_plane(tube.at(40.0))
    eyepiece_dir = (b_pt - a_pt) / np.linalg.norm(b_pt - a_pt)
    eyepiece_meet = a_pt + eyepiece_dir * (-a_pt[1] / eyepiece_dir[1])

    return {
        "camera": {"principalPointPx": centre.tolist(), "focalPx": camera.focal_px,
                   "shaftTiltDeg": camera.tilt_deg, "rollDeg": camera.roll_deg},
        "pose": {"tipMm": camera.tip.tolist(), "axis": camera.axis.tolist(), "up": camera.up.tolist(),
                 "rollFitted": True},
        "eyepieceAngleCheck": float(np.degrees(np.arctan2(eyepiece_dir[1], eyepiece_dir[0]))),
        "eyepieceMeetsShaftCheck": float(eyepiece_meet[0]),
        "tubeOuterDiameter": section_diameter(tube_t + 8, head_t - 8),
        "headOuterDiameter": section_diameter(head_t + 4, head_end_t - 4),
        "tubeDistalEndAt": u_of(tube_t),
        "headStartsAt": u_of(head_t),
        "capStartsAt": u_of(cap_t),
        "headEndsAt": u_of(head_end_t),
        "tubeLength": u_of(head_t) - u_of(tube_t),
        "whiteHeadLength": u_of(cap_t) - u_of(head_t),
        "capLength": u_of(head_end_t) - u_of(cap_t),
        "headAndCapLength": u_of(head_end_t) - u_of(head_t),
        "resolutionMm": camera.width_mm(1.0, u_of(tube_t)),
    }


# ---------------------------------------------------------------------------------------------
# Frame 7: the forceps through the telescope


def forceps(frame: Frame, mask: np.ndarray, v: Variation) -> dict:
    seed = Line.through(*SEEDS["frame7.shaft"])
    axis, width0, width_slope, _, _ = refine_axis(frame, seed, 0.0, 780.0, 2.0, 40.0, v)
    scale = (width0 + width_slope * 400.0) / SHAFT_DIAMETER  # px per mm; the width barely changes

    # The telescope's distal end: where the silhouette narrows from the shaft to the sheath.
    narrow_at = None
    for t in np.arange(0.0, -150.0, -0.5):
        edges = edges_across(frame, axis, t, 40.0, v)
        if edges is None or (edges[1] - edges[0]) < 0.8 * width0:
            narrow_at = t
            break
    scope_tip = narrow_at + v.tip_px

    # The sheath: dark, on its own axis, ending at the jaws.
    sheath_ts, sheath_mids = [], []
    for t in np.arange(scope_tip - 10.0, scope_tip - 130.0, -1.0):
        run = mask_run(mask, axis, t, half=40.0, step=0.25)
        if run is None:
            continue
        sheath_ts.append(t)
        sheath_mids.append((run[0] + run[1]) / 2)
    slope, offset, _, _ = fit_line(np.array(sheath_ts), np.array(sheath_mids))
    sheath_axis = axis.refined(offset, slope)
    # Its end: where the silhouette through its axis stops being as wide as the sheath. The mask,
    # not the luminance, because the sheath carries light lettering.
    widths = []
    for t in np.arange(scope_tip - 10.0, scope_tip - 60.0, -1.0):
        run = mask_run(mask, sheath_axis, t, half=40.0, step=0.25)
        if run is not None:
            widths.append(run[1] - run[0])
    sheath_width = float(np.median(widths))
    sheath_end = None
    for t in np.arange(scope_tip - 10.0, scope_tip - 300.0, -0.25):
        run = mask_run(mask, sheath_axis, t, half=40.0, step=0.25)
        if run is None or (run[1] - run[0]) < 0.6 * sheath_width:
            sheath_end = t
            break

    # The jaws: the two mask points farthest along the sheath, one on each side of its axis.
    ys, xs = np.nonzero(mask[int(sheath_axis.at(sheath_end)[1]) - 80:int(sheath_axis.at(sheath_end)[1]) + 80,
                             int(sheath_axis.at(sheath_end)[0]) - 120:int(sheath_axis.at(sheath_end)[0]) + 5])
    ys = ys + int(sheath_axis.at(sheath_end)[1]) - 80
    xs = xs + int(sheath_axis.at(sheath_end)[0]) - 120
    relative = np.column_stack([xs, ys]) - sheath_axis.at(sheath_end)
    forward = relative @ (-sheath_axis.direction)
    across = relative @ sheath_axis.normal
    hinge = sheath_axis.at(sheath_end)
    tips = []
    for side in (-1, 1):
        pick = (np.sign(across) == side) & (forward > 2.0)
        index = int(np.argmax(forward[pick] ** 2 + across[pick] ** 2))
        tips.append((forward[pick][index], across[pick][index]))
    angles = [math.degrees(math.atan2(abs(a), f)) for f, a in tips]

    return {
        "sheathDiameterInImage": sheath_width / scale,
        "scalePxPerMm": scale,
        "shaftWidthChangePx": abs(width_slope) * 780.0,
        "sheathProudOfScope": (scope_tip - sheath_end) / scale,
        "sheathAxisToScopeAxisDeg": math.degrees(math.atan(abs(slope))),
        "jawOpeningInImage": float(sum(angles)),
        "jawHalfAnglesInImage": [float(a) for a in angles],
        "jawReachBeyondSheath": float(max(f for f, _ in tips) / scale),
        "resolutionMm": 1.0 / scale,
    }


# ---------------------------------------------------------------------------------------------
# Tolerances, and the record


def flatten(value, prefix=""):
    if isinstance(value, dict):
        out = {}
        for key, inner in value.items():
            out.update(flatten(inner, f"{prefix}{key}."))
        return out
    return {prefix[:-1]: value}


def spread(nominal: dict, varied: list[tuple[str, dict]], keys: list[str]) -> dict:
    """For each key, the change under each variation, and their root sum of squares."""
    table = {}
    base = flatten(nominal)
    for key in keys:
        changes = {}
        for name, result in varied:
            changes[name] = float(flatten(result)[key] - base[key])
        table[key] = {"changes": changes, "rss": float(math.sqrt(sum(c * c for c in changes.values())))}
    return table


def measure(pptx: Path) -> tuple[dict, dict]:
    frames = {number: Frame(read_frame_bytes(pptx, number), number) for number in (2, 3, 7, 13)}
    masks = {number: frames[number].object_mask() for number in (2, 7)}

    side_variations = variations(
        "principal x -150", "principal x +150", "principal y -230", "principal y +230",
        "tip at the face centre", "body -2 px", "body +2 px", "rim read 1.5 px inside", "rim read 3 px inside",
        "edges 20 below background",
        "eyepiece end -2 px", "eyepiece end +2 px",
    )
    side = telescope_side(frames[2], masks[2], Variation())
    side_varied = [(v.name, telescope_side(frames[2], masks[2], v)) for v in side_variations]

    tip = telescope_tip(frames[3], Variation())
    tip_varied = [(v.name, telescope_tip(frames[3], v)) for v in variations("dark below 30", "dark below 50", "channel rim at 60", "channel rim at 100")]
    nominal_ratio = (SHAFT_DIAMETER / 2) / tip["innerRadius"]
    tip_varied.append(("wall ratio +0.02",
                       telescope_tip(frames[3], Variation("wall ratio +0.02", wall_ratio=nominal_ratio + 0.02))))

    sleeve_variations = variations(
        "principal x -150", "principal x +150", "principal y -230", "principal y +230",
        "tip at the face centre", "body -2 px", "body +2 px", "rim read 1.5 px inside", "rim read 3 px inside",
        "edges 20 below background",
    )
    sleeve_nominal = sleeve(frames[13], Variation())
    sleeve_varied = [(v.name, sleeve(frames[13], v)) for v in sleeve_variations]

    forceps_variations = variations("rim read 1.5 px inside", "rim read 3 px inside",
                                    "edges 20 below background")
    forceps_nominal = forceps(frames[7], masks[7], Variation())
    forceps_varied = [(v.name, forceps(frames[7], masks[7], v)) for v in forceps_variations]
    forceps_varied.append(("scope tip 3 px nearer", forceps(frames[7], masks[7], Variation("scope tip", tip_px=-3.0))))

    full = {
        "frame2": {"nominal": side, "variations": dict(side_varied)},
        "frame3": {"nominal": tip, "variations": dict(tip_varied)},
        "frame13": {"nominal": sleeve_nominal, "variations": dict(sleeve_varied)},
        "frame7": {"nominal": forceps_nominal, "variations": dict(forceps_varied)},
    }
    spreads = {
        "frame2": spread(side, side_varied, [
            "eyepieceAngle", "eyepieceMeetsShaftAt", "eyepiece.narrowDiameter", "eyepiece.wideStartsAt",
            "eyepiece.wideDiameter", "eyepiece.blueRingFrom", "eyepiece.blueRingTo", "eyepiece.neckStartsAt",
            "eyepiece.neckDiameter", "eyepiece.flareStartsAt", "eyepiece.eyecupDiameter",
            "eyepiece.eyecupWidestFrom", "eyepiece.eyecupWidestTo", "eyepiece.endsAt",
            "body.widestHalfWidth", "body.axisBelowShaftAxis", "body.endsAt", "body.halfWidthAtEnd",
            "body.ringHalfWidth", "body.capStartsAt", "body.capHalfWidth", "body.channelEntryAt",
            "camera.rollDeg",
        ]),
        "frame3": spread(tip, tip_varied, [
            "wallThickness", "lensCentreAbove", "lensDiameter", "housingCentreAbove", "housingDiameter",
            "housingOffCentreline",
            "channelInscribedDiameter", "channelCentreBelow", "channelTop", "channelBottom", "channelWidth",
        ]),
        "frame13": spread(sleeve_nominal, sleeve_varied, [
            "tubeOuterDiameter", "headOuterDiameter", "tubeLength", "whiteHeadLength", "capLength",
            "headAndCapLength", "eyepieceAngleCheck", "eyepieceMeetsShaftCheck",
        ]),
        "frame7": spread(forceps_nominal, forceps_varied, [
            "sheathProudOfScope", "jawOpeningInImage", "jawReachBeyondSheath",
        ]),
    }
    full["tolerances"] = spreads
    return full, {"frames": frames}


def tolerance(full: dict, frame: str, key: str, step: float, floor: float = 0.0,
              allowance: float = 0.0, angle: bool = False) -> float:
    """Root sum of squares of the variations, plus one pixel for a length, rounded up."""
    rss = full["tolerances"][frame][key]["rss"]
    pixel = 0.0 if angle else full[frame]["nominal"]["resolutionMm"]
    return round_up(max(floor, rss + pixel + allowance), step)


def build_record(full: dict, pptx: Path, frames: dict) -> dict:
    side = full["frame2"]["nominal"]
    tip = full["frame3"]["nominal"]
    sl = full["frame13"]["nominal"]
    fc = full["frame7"]["nominal"]
    # The face is read as an affine view; the frame is a close perspective view, so positions on
    # the face carry an allowance of 4 % of the inner radius on top of the variations.
    face_allowance = 0.04 * tip["innerRadius"]

    def m(identifier, frame, quantity, value, unit, tol, method, step=0.1):
        return {
            "id": identifier,
            "frame": frame,
            "quantity": quantity,
            "value": round_to(value, step),
            "unit": unit,
            "tolerance": tol,
            "method": method,
        }

    t2 = lambda key, step=0.1, floor=0.0: tolerance(full, "frame2", key, step, floor)  # noqa: E731
    t3 = lambda key, step=0.05, floor=0.0: tolerance(full, "frame3", key, step, floor, face_allowance)  # noqa: E731
    t13 = lambda key, step=0.1, floor=0.0: tolerance(full, "frame13", key, step, floor)  # noqa: E731
    t7 = lambda key, step=0.5, floor=0.0: tolerance(full, "frame7", key, step, floor)  # noqa: E731

    side_method = ("Pinhole camera fitted to the shaft (published diameter and length); read on the plane "
                   "through the shaft and the eyepiece, turned about the shaft until the eyepiece end lies at "
                   "the published total length, measured along the shaft from the tip.")
    body_method = ("Lower silhouette of the body, distance along the shaft from the tip and half-width from the "
                   "shaft axis, at the depth of the axis.")
    eyepiece = side["eyepiece"]
    body = side["body"]
    measurements = [
        m("telescope.eyepieceAngle", 2, "Angle between the eyepiece axis and the shaft axis",
          side["eyepieceAngle"], "deg", tolerance(full, "frame2", "eyepieceAngle", 0.5, 0.5, angle=True), side_method),
        m("telescope.eyepieceMeetsShaftAt", 2, "Where the eyepiece axis meets the shaft axis, from the tip",
          side["eyepieceMeetsShaftAt"], "mm", t2("eyepieceMeetsShaftAt", 0.5, 1.0), side_method),
        m("telescope.eyepieceNarrowDiameter", 2, "Eyepiece tube, narrow section, diameter",
          eyepiece["narrowDiameter"], "mm", t2("eyepiece.narrowDiameter"), side_method),
        m("telescope.eyepieceWideStartsAt", 2, "Eyepiece tube, start of the wide section, along the eyepiece axis from where it meets the shaft axis",
          eyepiece["wideStartsAt"], "mm", t2("eyepiece.wideStartsAt", 0.5, 1.0), side_method),
        m("telescope.eyepieceWideDiameter", 2, "Eyepiece tube, wide section, diameter",
          eyepiece["wideDiameter"], "mm", t2("eyepiece.wideDiameter"), side_method),
        m("telescope.eyepieceRingFrom", 2, "Coloured ring on the eyepiece tube, proximal to its start",
          eyepiece["blueRingFrom"], "mm", t2("eyepiece.blueRingFrom", 0.5, 1.0), side_method),
        m("telescope.eyepieceRingTo", 2, "Coloured ring on the eyepiece tube, its end",
          eyepiece["blueRingTo"], "mm", t2("eyepiece.blueRingTo", 0.5, 1.0), side_method),
        m("telescope.eyepieceNeckStartsAt", 2, "Eyepiece neck, start",
          eyepiece["neckStartsAt"], "mm", t2("eyepiece.neckStartsAt", 0.5, 1.0), side_method),
        m("telescope.eyepieceNeckDiameter", 2, "Eyepiece neck, diameter",
          eyepiece["neckDiameter"], "mm", t2("eyepiece.neckDiameter"), side_method),
        m("telescope.eyecupFlareStartsAt", 2, "Eyecup, start of the flare",
          eyepiece["flareStartsAt"], "mm", t2("eyepiece.flareStartsAt", 0.5, 1.0), side_method),
        m("telescope.eyecupDiameter", 2, "Eyecup, largest diameter",
          eyepiece["eyecupDiameter"], "mm", t2("eyepiece.eyecupDiameter"), side_method),
        m("telescope.eyecupWidestFrom", 2, "Eyecup, largest diameter from",
          eyepiece["eyecupWidestFrom"], "mm", t2("eyepiece.eyecupWidestFrom", 0.5, 1.0), side_method),
        m("telescope.eyecupWidestTo", 2, "Eyecup, largest diameter to",
          eyepiece["eyecupWidestTo"], "mm", t2("eyepiece.eyecupWidestTo", 0.5, 1.0), side_method),
        m("telescope.eyepieceEndsAt", 2, "Eyepiece end, along the eyepiece axis from where it meets the shaft axis",
          eyepiece["endsAt"], "mm", t2("eyepiece.endsAt", 0.5, 1.0), side_method),
        m("telescope.bodyWidestHalfWidth", 2, "Body, largest half-width below the shaft axis",
          body["widestHalfWidth"], "mm", t2("body.widestHalfWidth"), body_method),
        m("telescope.bodyAxisBelowShaftAxis", 2, "Body, its axis below the shaft axis",
          body["axisBelowShaftAxis"], "mm", t2("body.axisBelowShaftAxis", 0.1, 0.2), body_method),
        m("telescope.bodyEndsAt", 2, "Body, end, where the dark valve ring begins, from the tip",
          body["endsAt"], "mm", t2("body.endsAt", 0.5, 1.0), body_method),
        m("telescope.bodyHalfWidthAtEnd", 2, "Body, half-width below the shaft axis at its end",
          body["halfWidthAtEnd"], "mm", t2("body.halfWidthAtEnd"), body_method),
        m("telescope.valveRingHalfWidth", 2, "Valve ring behind the body, half-width below the shaft axis",
          body["ringHalfWidth"], "mm", t2("body.ringHalfWidth"), body_method),
        m("telescope.sealingCapStartsAt", 2, "Sealing cap, start, from the tip",
          body["capStartsAt"], "mm", t2("body.capStartsAt", 0.5, 1.0), body_method),
        m("telescope.sealingCapHalfWidth", 2, "Sealing cap, half-width below the shaft axis",
          body["capHalfWidth"], "mm", t2("body.capHalfWidth"), body_method),
        m("telescope.channelEntryAt", 2, "Working channel entry, the rear face of the sealing cap, from the tip",
          body["channelEntryAt"], "mm", t2("body.channelEntryAt", 0.5, 1.0), body_method),
    ]
    outline_tolerance = round_up(max(full["tolerances"]["frame2"]["body.widestHalfWidth"]["rss"]
                                     + side["resolutionMm"], 0.2), 0.1)
    outline_points = [[round_to(u, 0.1), round_to(r, 0.01)] for u, r in body["outline"][::2]]
    measurements.append({
        "id": "telescope.bodyOutline",
        "frame": 2,
        "quantity": "Body, half-width below the shaft axis against distance from the tip",
        "points": outline_points,
        "unit": "mm",
        "tolerance": outline_tolerance,
        "method": body_method,
    })

    face_method = ("The distal face read as an affine view of a circle: an ellipse fitted to the inner edge of "
                   "the outer wall is mapped to a circle, and the face is turned so that the optic is up. Scale "
                   "from the published shaft diameter less the measured wall. The frame is a close perspective "
                   "view, so an allowance of 4 % of the inner radius is added to every tolerance.")
    measurements += [
        m("telescope.wallThickness", 3, "Wall of the shaft at the distal face", tip["wallThickness"], "mm",
          tolerance(full, "frame3", "wallThickness", 0.01, 0.05), face_method, 0.01),
        m("telescope.lensCentreAbove", 3, "Lens centre above the centre of the distal face", tip["lensCentreAbove"],
          "mm", t3("lensCentreAbove"), face_method, 0.01),
        m("telescope.lensDiameter", 3, "Lens, bright clear aperture, diameter", tip["lensDiameter"], "mm",
          t3("lensDiameter", 0.05, 0.1), face_method, 0.01),
        m("telescope.opticHousingCentreAbove", 3, "Optic housing, centre above the centre of the distal face",
          tip["housingCentreAbove"], "mm", t3("housingCentreAbove"), face_method, 0.01),
        m("telescope.opticHousingDiameter", 3, "Optic housing, outer diameter", tip["housingDiameter"], "mm",
          t3("housingDiameter", 0.05, 0.1), face_method, 0.01),
        m("telescope.opticHousingOffCentreline", 3,
          "Optic housing's centre, to one side of the line through the channel's centre and the lens",
          tip["housingOffCentreline"], "mm", t3("housingOffCentreline"), face_method, 0.01),
        m("telescope.channelInscribedDiameter", 3, "Largest circle inside the working channel at the distal face",
          tip["channelInscribedDiameter"], "mm", t3("channelInscribedDiameter"), face_method, 0.01),
        m("telescope.channelCentreBelow", 3, "Centre of that circle below the centre of the distal face",
          tip["channelCentreBelow"], "mm", t3("channelCentreBelow"), face_method, 0.01),
        m("telescope.channelTop", 3, "Working channel, flat upper edge, height above the centre of the face",
          tip["channelTop"], "mm", t3("channelTop"), face_method, 0.01),
        m("telescope.channelBottomBelow", 3, "Working channel, lowest point, below the centre of the face",
          -tip["channelBottom"], "mm", t3("channelBottom"), face_method, 0.01),
        m("telescope.channelWidth", 3, "Working channel, widest", tip["channelWidth"], "mm",
          t3("channelWidth"), face_method, 0.01),
        {
            "id": "telescope.channelOutline",
            "frame": 3,
            "quantity": "Working channel, half-width against height, in units of the inner wall radius",
            "points": [[h, round_to(w, 0.005)] for h, w in tip["channelHalfWidthsByHeight"]],
            "unit": "inner wall radius",
            "tolerance": round_up(0.04 + 0.02, 0.01),
            "method": face_method,
        },
    ]

    sleeve_method = ("Pinhole camera fitted to the telescope shaft seen distal and proximal to the sleeve "
                     "(published diameter and length); the sleeve is coaxial with the shaft.")
    measurements += [
        m("sleeve.tubeOuterDiameter", 13, "Flexible sleeve, tube outer diameter", sl["tubeOuterDiameter"], "mm",
          t13("tubeOuterDiameter", 0.1, 0.2), sleeve_method),
        m("sleeve.headOuterDiameter", 13, "Flexible sleeve, head and cap outer diameter", sl["headOuterDiameter"],
          "mm", t13("headOuterDiameter", 0.1, 0.3), sleeve_method),
        m("sleeve.whiteHeadLength", 13, "Flexible sleeve, head length, distal to the cap", sl["whiteHeadLength"],
          "mm", t13("whiteHeadLength", 0.5, 1.0), sleeve_method),
        m("sleeve.capLength", 13, "Flexible sleeve, cap length", sl["capLength"], "mm",
          t13("capLength", 0.5, 1.0), sleeve_method),
        m("telescope.eyepieceAngleSecondView", 13,
          "Angle between the eyepiece axis and the shaft axis, read again on frame 13 as a check on frame 2",
          sl["eyepieceAngleCheck"], "deg", tolerance(full, "frame13", "eyepieceAngleCheck", 0.5, 0.5, angle=True),
          sleeve_method + " The plane was turned, as on frame 2, until the eyepiece end lay at the published "
          "total length."),
        m("telescope.eyepieceMeetsShaftSecondView", 13,
          "Where the eyepiece axis meets the shaft axis, read again on frame 13 as a check on frame 2",
          sl["eyepieceMeetsShaftCheck"], "mm", t13("eyepieceMeetsShaftCheck", 0.5, 1.0),
          sleeve_method + " The plane was turned, as on frame 2, until the eyepiece end lay at the published "
          "total length."),
    ]

    forceps_method = ("The telescope shaft keeps the same width along its length in this frame, so the frame is "
                      "read at one scale: the shaft's apparent width against its published diameter. The jaw "
                      "opening is the angle in the image; seen at a slant, a true angle can only look smaller, "
                      "so the true opening is this or more.")
    measurements += [
        m("forceps.sheathProudOfScope", 7, "Sheath beyond the telescope's distal face, as shown", fc["sheathProudOfScope"],
          "mm", t7("sheathProudOfScope", 0.5, 1.0), forceps_method, 0.5),
        m("forceps.jawOpeningInImage", 7, "Jaw opening, both jaws together, in the image", fc["jawOpeningInImage"],
          "deg", tolerance(full, "frame7", "jawOpeningInImage", 1.0, 5.0, angle=True),
          forceps_method, 1.0),
        m("forceps.jawReachBeyondSheath", 7, "Jaws, reach beyond the sheath end, in the image",
          fc["jawReachBeyondSheath"], "mm", t7("jawReachBeyondSheath", 0.5, 1.0), forceps_method, 0.5),
    ]

    cameras = [
        {"frame": 2, **{k: side["camera"][k] for k in ("principalPointPx", "focalPx", "tipDepthMm", "shaftTiltDeg",
                                                         "rollDeg")}},
        {"frame": 13, **{k: sl["camera"][k] for k in ("principalPointPx", "focalPx", "shaftTiltDeg", "rollDeg")}},
    ]
    for camera in cameras:
        for key, value in list(camera.items()):
            if isinstance(value, float):
                camera[key] = round_to(value, 0.01)
            elif isinstance(value, list):
                camera[key] = [round_to(x, 0.1) for x in value]

    record_frames = []
    shows = {
        2: "The telescope from its left side",
        3: "The distal face of the telescope",
        7: "The double-spoon forceps through the telescope",
        13: "The telescope through the flexible sleeve",
    }
    for number in (2, 3, 7, 13):
        frame = frames[number]
        record_frames.append({
            "frame": number,
            "part": f"ppt/media/image{number}.png",
            "sha256": frame.sha256,
            "widthPx": frame.width,
            "heightPx": frame.height,
            "shows": shows[number],
        })

    return {
        "record": "medical-thoracoscopy-reference-measurements",
        "version": 1,
        "measuredOn": date.today().isoformat(),
        "measuredBy": "scripts/medical-thoracoscopy/measure_reference_frames.py",
        "statement": (
            "Measurements of stills from the manufacturer's product animation, read in place from the owner's "
            "local data. Only numbers are recorded here; no image is. Every value is a derived measurement, not a "
            "device fact, and none has been checked by the manufacturer. A tolerance is how far the value moved "
            "when each assumption of the fit was varied, plus one pixel: a modelling tolerance, not a "
            "manufacturing one."
        ),
        "document": {"id": "S-FRAMES", "sha256": sha256_file(pptx)},
        "publishedValuesUsed": {
            "operative-telescope.shaftOuterDiameter": SHAFT_DIAMETER,
            "operative-telescope.shaftLength": SHAFT_LENGTH,
            "operative-telescope.totalLength": TOTAL_LENGTH,
        },
        "variations": {
            "2": [name for name in full["frame2"]["variations"]],
            "3": [name for name in full["frame3"]["variations"]],
            "7": [name for name in full["frame7"]["variations"]],
            "13": [name for name in full["frame13"]["variations"]],
        },
        "frames": record_frames,
        "cameras": cameras,
        "measurements": measurements,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--pptx", default=None, help="the presentation; defaults to the owner's local data")
    parser.add_argument("--check", action="store_true", help="compare with the committed record only")
    args = parser.parse_args()
    pptx = Path(args.pptx) if args.pptx else require_local_data_path(*PPTX_PARTS)

    full, context = measure(pptx)
    record = build_record(full, pptx, context["frames"])

    if args.check:
        committed = json.loads(RECORD.read_text())
        problems = []
        by_id = {entry["id"]: entry for entry in committed["measurements"]}
        for entry in record["measurements"]:
            old = by_id.get(entry["id"])
            if old is None:
                problems.append(f"{entry['id']}: not in the committed record")
                continue
            for key in ("value", "tolerance", "points"):
                if entry.get(key) != old.get(key):
                    problems.append(f"{entry['id']}.{key}: {old.get(key)} -> {entry.get(key)}")
        if set(by_id) - {entry["id"] for entry in record["measurements"]}:
            problems.append("the committed record has measurements this script no longer makes")
        if committed["document"] != record["document"] or committed["frames"] != record["frames"]:
            problems.append("the frames or the presentation have changed")
        for line in problems:
            print("✗", line)
        print(f"{len(record['measurements'])} measurements; {len(problems)} differ from the committed record")
        return 1 if problems else 0

    RECORD.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    subprocess.run(["npx", "prettier", "--write", str(RECORD)], cwd=REPO, check=True, capture_output=True)
    full_path = local_data_path(*FULL_RECORD)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(json.dumps(full, indent=2, default=float) + "\n")
    print(f"wrote {RECORD.relative_to(REPO)} ({len(record['measurements'])} measurements)")
    print(f"wrote {full_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
