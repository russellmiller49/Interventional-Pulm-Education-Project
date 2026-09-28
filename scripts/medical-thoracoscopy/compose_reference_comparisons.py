#!/usr/bin/env python3
"""Lay the device models over the manufacturer's reference frames, for the owner to look at.

Reads the renders from `render_device_previews.py --matched` and the frames themselves, in place.
Writes comparison sheets to the owner's local data only: they contain the manufacturer's images,
so they are never committed and never uploaded.

    python3 scripts/medical-thoracoscopy/compose_reference_comparisons.py

For frames 2 and 13 the model was rendered through the camera fitted to that frame, so its outline
should lie on the instrument's. For frame 3 the frame is rectified to a head-on view of the distal
face at 200 pixels per millimetre and set beside the model's face at the same scale.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from local_data import local_data_path, require_local_data_path  # noqa: E402
from mt_reference import PPTX_PARTS, Frame, read_frame_bytes  # noqa: E402

DEVICES = ("raw-assets", "medical-thoracoscopy", "devices")
FULL = ("raw-assets", "medical-thoracoscopy", "measurements", "reference-measurements-full.json")
OUT = ("raw-assets", "medical-thoracoscopy", "devices", "comparisons")
ORANGE = np.array([255, 120, 0], dtype=np.float64)


def outline(alpha: np.ndarray, width: int = 2) -> np.ndarray:
    solid = alpha > 0.5
    return solid & ~ndi.binary_erosion(solid, iterations=width)


def overlay(frame_rgb: np.ndarray, render: Image.Image) -> Image.Image:
    rgba = np.asarray(render.convert("RGBA")).astype(np.float64) / 255.0
    alpha = rgba[:, :, 3]
    base = frame_rgb.copy()
    tint = alpha[:, :, None] * 0.28
    base = base * (1 - tint) + ORANGE[None, None, :] * tint
    edge = outline(alpha)
    base[edge] = ORANGE
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


def caption(image: Image.Image, text: str) -> Image.Image:
    out = Image.new("RGB", (image.width, image.height + 44), (255, 255, 255))
    out.paste(image, (0, 44))
    draw = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 26)
    except OSError:
        font = ImageFont.load_default()
    draw.text((12, 8), text, fill=(20, 20, 20), font=font)
    return out


def rectified_face(frame: Frame, tip: dict, size: int = 1200, px_per_mm: float = 200.0) -> np.ndarray:
    ellipse = tip["faceEllipsePx"]
    centre = np.array(ellipse["centre"])
    angle = math.radians(ellipse["majorAxisDeg"])
    major, minor = ellipse["semiMajor"], ellipse["semiMinor"]
    e_major = np.array([math.cos(angle), math.sin(angle)])
    e_minor = np.array([-math.sin(angle), math.cos(angle)])
    up = np.array(tip["faceUp"])
    right = np.array([up[1], -up[0]])
    inner = tip["innerRadius"]
    j, i = np.meshgrid(np.arange(size), np.arange(size))
    # The model's head-on render looks along +Z with +Y up, so device +X is on the image's left.
    x_mm = -(j - size / 2) / px_per_mm
    y_mm = (size / 2 - i) / px_per_mm
    fx = (x_mm * right[0] + y_mm * up[0]) / inner
    fy = (x_mm * right[1] + y_mm * up[1]) / inner
    points = centre[None, None, :] + fx[..., None] * major * e_major + fy[..., None] * minor * e_minor
    rgb = np.stack([ndi.map_coordinates(frame.rgb[:, :, k], [points[..., 1], points[..., 0]], order=1, cval=255)
                    for k in range(3)], axis=-1)
    return rgb


def main() -> int:
    pptx = require_local_data_path(*PPTX_PARTS)
    full = json.loads(local_data_path(*FULL).read_text())
    previews = local_data_path(*DEVICES, "previews")
    out = local_data_path(*OUT)
    out.mkdir(parents=True, exist_ok=True)

    for number, name, text in ((2, "matched.frame2.png", "Frame 2 with the telescope model over it (orange)"),
                               (13, "matched.frame13.png", "Frame 13 with the telescope and sleeve models over it (orange)")):
        frame = Frame(read_frame_bytes(pptx, number), number)
        render = Image.open(previews / name)
        sheet = caption(overlay(frame.rgb, render), text)
        sheet.save(out / f"frame{number}-overlay.png")
        print(f"wrote {out / f'frame{number}-overlay.png'}")

    frame = Frame(read_frame_bytes(pptx, 3), 3)
    face = rectified_face(frame, full["frame3"]["nominal"])
    model = Image.open(previews / "matched.frame3.png").convert("RGBA")
    backdrop = Image.new("RGBA", model.size, (255, 255, 255, 255))
    model_rgb = np.asarray(Image.alpha_composite(backdrop, model).convert("RGB")).astype(np.float64)
    alpha = np.asarray(model).astype(np.float64)[:, :, 3] / 255.0
    side = np.concatenate([face, np.full((face.shape[0], 20, 3), 255.0), model_rgb], axis=1)
    sheet = caption(Image.fromarray(np.clip(side, 0, 255).astype(np.uint8)),
                    "Frame 3 rectified to a head-on view (left) and the model's distal face (right), both at 200 px/mm")
    sheet.save(out / "frame3-side-by-side.png")
    mixed = face.copy()
    dark = np.asarray(Image.open(previews / "matched.frame3.png").convert("L")).astype(np.float64)
    edges = ndi.sobel(dark, 0) ** 2 + ndi.sobel(dark, 1) ** 2
    mixed[(edges > np.percentile(edges, 96)) & (alpha > 0.5)] = ORANGE
    caption(Image.fromarray(np.clip(mixed, 0, 255).astype(np.uint8)),
            "Frame 3 rectified, with the model face's edges over it (orange)").save(out / "frame3-overlay.png")
    print(f"wrote {out / 'frame3-side-by-side.png'} and frame3-overlay.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
