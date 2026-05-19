"""Generate derived web assets for the FluoroView patient-4 case.

This script reads local raw DICOM input and writes only derived educational PNG/JSON outputs.
Raw source data should stay outside git.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from fluoroview_pipeline.drr.base import ProjectionOptions
from fluoroview_pipeline.drr.cpu_projector import CpuRaySumProjector
from fluoroview_pipeline.geometry.carm import CArmGeometry
from fluoroview_pipeline.io.dicom_loader import read_ct_series
from fluoroview_pipeline.physics.hu import hu_to_windowed_image, normalize_to_uint8

SAFETY_LABEL = "Educational simulation only — not for diagnosis, treatment, or procedure guidance."


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dicom-dir", required=True)
    parser.add_argument("--case-dir", required=True)
    parser.add_argument("--stride", type=int, default=4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    case_dir = Path(args.case_dir)
    drr_dir = case_dir / "drr"
    ct_dir = case_dir / "ct"
    drr_dir.mkdir(parents=True, exist_ok=True)
    ct_dir.mkdir(parents=True, exist_ok=True)

    ct = read_ct_series(args.dicom_dir)
    stride = max(1, args.stride)
    volume = ct.volume_hu[::stride, ::stride, ::stride]
    spacing = tuple(value * stride for value in ct.spacing_mm)

    ct_axes = write_ct_slices(volume, ct_dir)
    drr_frames = write_drr_atlas(volume, spacing, drr_dir)
    update_manifest(case_dir / "case_manifest.json", ct_axes, drr_frames)


def write_ct_slices(volume: np.ndarray, ct_dir: Path) -> dict[str, object]:
    axes: dict[str, object] = {}
    axis_specs = {
        "axial": (0, volume.shape[0]),
        "coronal": (1, volume.shape[1]),
        "sagittal": (2, volume.shape[2]),
    }
    for axis, (axis_index, length) in axis_specs.items():
        indices = np.linspace(length * 0.22, length * 0.78, 5).round().astype(int)
        frames = []
        for output_index, volume_index in enumerate(indices):
            image = extract_slice(volume, axis_index, int(volume_index))
            png = render_ct_png(image, f"{axis.capitalize()} CT slice {output_index + 1}/5")
            filename = f"{axis}_{output_index:02d}.png"
            png.save(ct_dir / filename)
            frames.append(
                {
                    "index": output_index,
                    "positionMm": float(output_index - 2) * 8.0,
                    "imageUrl": f"/fluoroview/cases/patient-4/ct/{filename}",
                }
            )
        axes[axis] = {"label": axis.capitalize(), "defaultIndex": 2, "frames": frames}
    return axes


def write_drr_atlas(
    volume: np.ndarray,
    spacing: tuple[float, float, float],
    drr_dir: Path,
) -> list[dict[str, object]]:
    rao_angles = [-60, -30, 0, 30, 60]
    cranial_angles = [-20, 0, 20]
    projector = CpuRaySumProjector()
    options = ProjectionOptions(downsample=1)
    frames: list[dict[str, object]] = []
    for rao in rao_angles:
        for cranial in cranial_angles:
            geometry = CArmGeometry.oblique(rao, cranial, detector_shape=(256, 256))
            result = projector.project(volume, spacing, geometry, options)
            png = render_drr_png(result.image, rao, cranial)
            filename = f"drr_rao_{angle_token(rao)}_cran_{angle_token(cranial)}.png"
            png.save(drr_dir / filename)
            frames.append(
                {
                    "id": filename.removesuffix(".png"),
                    "raoLaoDeg": rao,
                    "cranialCaudalDeg": cranial,
                    "imageUrl": f"/fluoroview/cases/patient-4/drr/{filename}",
                    "thicknessProxy": round(1.0 + abs(rao) / 180 + abs(cranial) / 120, 3),
                }
            )
    return frames


def extract_slice(volume: np.ndarray, axis: int, index: int) -> np.ndarray:
    index = min(max(index, 0), volume.shape[axis] - 1)
    if axis == 0:
        return volume[index, :, :]
    if axis == 1:
        return volume[:, index, :]
    return volume[:, :, index]


def render_ct_png(image_hu: np.ndarray, label: str) -> Image.Image:
    windowed = hu_to_windowed_image(image_hu, window_center=-600, window_width=1500)
    return annotate_image(normalize_to_uint8(windowed), label)


def render_drr_png(image: np.ndarray, rao: int, cranial: int) -> Image.Image:
    pixels = normalize_to_uint8(image)
    label = f"CPU DRR atlas RAO/LAO {rao} deg, cranial/caudal {cranial} deg"
    return annotate_image(pixels, label)


def annotate_image(pixels: np.ndarray, label: str) -> Image.Image:
    image = Image.fromarray(pixels).convert("L").resize((512, 512), Image.Resampling.BILINEAR)
    rgb = Image.merge("RGB", (image, image, image))
    draw = ImageDraw.Draw(rgb)
    font = ImageFont.load_default()
    draw.rectangle((14, 14, 330, 40), fill=(0, 0, 0))
    draw.text((22, 22), label, fill=(255, 255, 255), font=font)
    draw.rectangle((14, 468, 498, 494), fill=(0, 0, 0))
    draw.text((22, 476), SAFETY_LABEL, fill=(255, 255, 255), font=font)
    return rgb


def update_manifest(
    manifest_path: Path,
    ct_axes: dict[str, object],
    drr_frames: list[dict[str, object]],
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["description"] = (
        "Derived educational case generated from local DICOM source data using the CPU "
        "fallback projector. Raw source files remain local and untracked."
    )
    manifest["ctSlices"]["axes"] = ct_axes
    manifest["drrAtlas"]["provenance"] = {
        "backend": "cpu-ray-sum",
        "detectorPixels": [512, 512],
        "pixelValueRange": [0.0, 1.0],
        "note": "Generated locally with the deterministic CPU fallback projector.",
    }
    manifest["drrAtlas"]["frames"] = drr_frames
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def angle_token(value: int) -> str:
    return f"m{abs(value)}" if value < 0 else f"p{value}"


if __name__ == "__main__":
    main()
