"""Run a TIGRE-backed atlas generation job on the GPU VM.

This script intentionally expects local raw inputs and writes derived outputs. Raw bundles should
not be copied into git or public deployable paths.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from fluoroview_pipeline.drr.base import ProjectionOptions
from fluoroview_pipeline.drr.tigre_projector import TigreProjector
from fluoroview_pipeline.geometry.carm import CArmGeometry
from fluoroview_pipeline.io.dicom_loader import read_ct_series

DEFAULT_PROVENANCE_NOTE = (
    "Generated on a GPU VM path with TIGRE installed. Until TigreProjector maps project geometry "
    "to true TIGRE projection calls, outputs from this repo backend are labeled tigre-placeholder."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case-id", default="patient-4", help="Non-PHI case identifier")
    parser.add_argument("--dicom-dir", required=True, help="Local VM path to deidentified DICOM series")
    parser.add_argument("--output-dir", required=True, help="Output folder for derived atlas arrays")
    parser.add_argument("--angles", default="-60,-30,0,30,60", help="Comma-separated RAO/LAO angles")
    parser.add_argument(
        "--cranial-angles",
        default="-20,0,20",
        help="Comma-separated cranial/caudal angles. Negative values are caudal.",
    )
    parser.add_argument(
        "--detector-sizes",
        default="512",
        help="Comma-separated square detector sizes to generate, for example 512,1024.",
    )
    parser.add_argument(
        "--backend-label",
        default=None,
        help="Override backend label written to export manifests. Defaults to projector metadata.",
    )
    parser.add_argument(
        "--provenance-note",
        default=DEFAULT_PROVENANCE_NOTE,
        help="Non-PHI provenance note written to export manifests.",
    )
    return parser.parse_args()


def _parse_float_list(value: str) -> list[float]:
    return [float(item) for item in value.split(",") if item.strip()]


def _parse_int_list(value: str) -> list[int]:
    return [int(item) for item in value.split(",") if item.strip()]


def _angle_token(value: float) -> str:
    rounded = int(round(value))
    prefix = "p" if rounded >= 0 else "m"
    return f"{prefix}{abs(rounded)}"


def _write_png(image: np.ndarray, path: Path) -> None:
    clipped = np.clip(image, 0.0, 1.0)
    pixels = np.round(clipped * 255).astype(np.uint8)
    Image.fromarray(pixels, mode="L").save(path)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_manifest(
    output_dir: Path,
    frames: list[dict[str, object]],
    detector_size: int,
    *,
    case_id: str,
    backend_label: str | None,
    provenance_note: str,
) -> None:
    frame_backends = sorted({str(frame.get("backend", "unknown")) for frame in frames})
    resolved_backend = backend_label or (frame_backends[0] if len(frame_backends) == 1 else "mixed")
    manifest = {
        "schemaVersion": 1,
        "caseId": case_id,
        "backend": resolved_backend,
        "provenance": {
            "frameBackends": frame_backends,
            "note": provenance_note,
        },
        "detectorSize": [detector_size, detector_size],
        "pixelValueRange": [0.0, 1.0],
        "angles": {
            "primaryAngleDeg": sorted({frame["primaryAngleDeg"] for frame in frames}),
            "secondaryAngleDeg": sorted({frame["secondaryAngleDeg"] for frame in frames}),
        },
        "frames": frames,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def _write_checksums(output_dir: Path) -> None:
    paths = sorted(
        path
        for path in output_dir.rglob("*")
        if path.is_file() and path.name not in {"sha256.txt"}
    )
    lines = [f"{_sha256(path)}  {path.relative_to(output_dir)}" for path in paths]
    (output_dir / "sha256.txt").write_text("\n".join(lines) + "\n")


def main() -> None:
    args = parse_args()
    primary_angles = _parse_float_list(args.angles)
    secondary_angles = _parse_float_list(args.cranial_angles)
    detector_sizes = _parse_int_list(args.detector_sizes)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    ct = read_ct_series(args.dicom_dir)
    projector = TigreProjector()

    for detector_size in detector_sizes:
        size_output_dir = output_dir
        if len(detector_sizes) > 1:
            size_output_dir = output_dir / f"{detector_size}x{detector_size}"
        size_output_dir.mkdir(parents=True, exist_ok=True)

        frames: list[dict[str, object]] = []
        options = ProjectionOptions(downsample=1)
        for primary_angle in primary_angles:
            for secondary_angle in secondary_angles:
                geometry = CArmGeometry.oblique(
                    primary_angle,
                    secondary_angle,
                    detector_shape=(detector_size, detector_size),
                )
                result = projector.project(ct.volume_hu, ct.spacing_mm, geometry, options)
                backend = str(result.metadata.get("backend", "unknown"))
                stem = (
                    f"drr_rao_{_angle_token(primary_angle)}_"
                    f"cran_{_angle_token(secondary_angle)}"
                )
                npy_path = size_output_dir / f"{stem}.npy"
                png_path = size_output_dir / f"{stem}.png"
                np.save(npy_path, result.image.astype(np.float32))
                _write_png(result.image, png_path)
                frames.append(
                    {
                        "id": stem,
                        "primaryAngleDeg": primary_angle,
                        "secondaryAngleDeg": secondary_angle,
                        "detectorSize": [detector_size, detector_size],
                        "arrayPath": npy_path.name,
                        "pngPath": png_path.name,
                        "shape": list(result.image.shape),
                        "dtype": "float32",
                        "valueRange": [float(np.min(result.image)), float(np.max(result.image))],
                        "backend": backend,
                        "projectorMetadata": result.metadata,
                    }
                )
                print(f"Wrote {npy_path} and {png_path}")

        _write_manifest(
            size_output_dir,
            frames,
            detector_size,
            case_id=args.case_id,
            backend_label=args.backend_label,
            provenance_note=args.provenance_note,
        )
        _write_checksums(size_output_dir)
        print(f"Wrote {size_output_dir / 'manifest.json'}")
        print(f"Wrote {size_output_dir / 'sha256.txt'}")


if __name__ == "__main__":
    main()
