"""Ingest a derived DRR atlas export into a public FluoroView case.

The source atlas directory may live under ignored raw-workspace paths such as ``fluoro_2``.
This script copies only web PNGs and non-PHI metadata into ``public/fluoroview``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

RAW_EXTENSIONS = {".dcm", ".nii", ".nrrd", ".stl", ".obj"}
RAW_SUFFIXES = {".nii.gz"}
DEFAULT_NOTE = (
    "Generated on a GPU VM path with TIGRE installed, but this repo revision's TigreProjector "
    "delegates projection math to the CPU ray-sum placeholder. Treat this atlas as "
    "tigre-placeholder until true TIGRE projection geometry is implemented and rerun."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas-dir", required=True, help="Folder containing VM export manifest and PNGs")
    parser.add_argument("--case-dir", required=True, help="Public case folder to update")
    parser.add_argument(
        "--backend-label",
        default="tigre-placeholder",
        help="Corrected backend provenance label for the public case manifest",
    )
    parser.add_argument(
        "--flip-vertical",
        action="store_true",
        help="Flip DRR PNGs vertically while ingesting to match browser display orientation.",
    )
    parser.add_argument(
        "--tone-map",
        choices=["source", "fluoro"],
        default="fluoro",
        help="Display tone map to apply to public DRR PNGs.",
    )
    parser.add_argument("--note", default=DEFAULT_NOTE, help="Non-PHI provenance note")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    atlas_dir = Path(args.atlas_dir)
    case_dir = Path(args.case_dir)
    manifest_path = case_dir / "case_manifest.json"
    metadata_dir = case_dir / "metadata"
    public_drr_dir = case_dir / "drr"

    source_manifest = load_json(atlas_dir / "manifest.json")
    validate_no_raw_files(atlas_dir)
    verify_source_checksums(atlas_dir)
    validate_source_manifest(source_manifest, atlas_dir)

    metadata_dir.mkdir(parents=True, exist_ok=True)
    public_drr_dir.mkdir(parents=True, exist_ok=True)

    public_frames = copy_png_frames(
        source_manifest,
        atlas_dir,
        public_drr_dir,
        args.backend_label,
        flip_vertical=args.flip_vertical,
        tone_map=args.tone_map,
    )
    public_checksums = write_public_checksums(public_drr_dir, metadata_dir / "drr_atlas_public_sha256.txt")

    vm_sha = atlas_dir / "sha256.txt"
    vm_sha_public_url = None
    if vm_sha.exists():
        shutil.copy2(vm_sha, metadata_dir / "drr_atlas_vm_sha256.txt")
        vm_sha_public_url = "/fluoroview/cases/patient-4/metadata/drr_atlas_vm_sha256.txt"

    ingest_manifest = build_ingest_manifest(
        source_manifest,
        public_frames,
        public_checksums,
        args.backend_label,
        args.note,
        image_orientation(args.flip_vertical),
        args.tone_map,
    )
    ingest_manifest_path = metadata_dir / "drr_atlas_ingest_manifest.json"
    ingest_manifest_path.write_text(json.dumps(ingest_manifest, indent=2) + "\n", encoding="utf-8")

    update_case_manifest(
        manifest_path,
        source_manifest,
        public_frames,
        args.backend_label,
        args.note,
        image_orientation(args.flip_vertical),
        args.tone_map,
        vm_sha_public_url,
    )

    print(f"Copied {len(public_frames)} PNG frames to {public_drr_dir}")
    print(f"Wrote {ingest_manifest_path}")
    print(f"Updated {manifest_path}")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_no_raw_files(root: Path) -> None:
    raw_files = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        suffix = "".join(path.suffixes[-2:]).lower()
        if path.suffix.lower() in RAW_EXTENSIONS or suffix in RAW_SUFFIXES:
            raw_files.append(path)
    if raw_files:
        joined = "\n".join(str(path) for path in raw_files[:20])
        raise SystemExit(f"Raw source-like files found in atlas export; aborting:\n{joined}")


def verify_source_checksums(atlas_dir: Path) -> None:
    checksum_path = atlas_dir / "sha256.txt"
    if not checksum_path.exists():
        return
    errors: list[str] = []
    for line in checksum_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, relative = line.split(maxsplit=1)
        path = atlas_dir / relative
        if not path.exists():
            errors.append(f"Missing checksum target: {relative}")
            continue
        actual = sha256(path)
        if actual != expected:
            errors.append(f"Checksum mismatch: {relative}")
    if errors:
        raise SystemExit("\n".join(errors))


def validate_source_manifest(manifest: dict[str, Any], atlas_dir: Path) -> None:
    frames = manifest.get("frames")
    if not isinstance(frames, list) or not frames:
        raise SystemExit("Atlas manifest does not contain frames.")
    pairs = {
        (int(round(frame["primaryAngleDeg"])), int(round(frame["secondaryAngleDeg"])))
        for frame in frames
    }
    expected = {(rao, cran) for rao in [-60, -30, 0, 30, 60] for cran in [-20, 0, 20]}
    if pairs != expected:
        missing = sorted(expected.difference(pairs))
        extra = sorted(pairs.difference(expected))
        raise SystemExit(f"Atlas angle grid mismatch. Missing={missing}; extra={extra}")
    for frame in frames:
        png_path = atlas_dir / str(frame["pngPath"])
        if not png_path.exists():
            raise SystemExit(f"Missing PNG frame: {png_path}")


def copy_png_frames(
    source_manifest: dict[str, Any],
    atlas_dir: Path,
    public_drr_dir: Path,
    backend_label: str,
    *,
    flip_vertical: bool,
    tone_map: str,
) -> list[dict[str, Any]]:
    public_frames: list[dict[str, Any]] = []
    for frame in sorted(
        source_manifest["frames"],
        key=lambda item: (float(item["primaryAngleDeg"]), float(item["secondaryAngleDeg"])),
    ):
        source_png = atlas_dir / str(frame["pngPath"])
        destination = public_drr_dir / source_png.name
        if flip_vertical or tone_map != "source":
            with Image.open(source_png) as image:
                transformed = transform_drr_image(image, flip_vertical=flip_vertical, tone_map=tone_map)
                transformed.save(destination)
        else:
            shutil.copy2(source_png, destination)
        rao = int(round(float(frame["primaryAngleDeg"])))
        cranial = int(round(float(frame["secondaryAngleDeg"])))
        public_frames.append(
            {
                "id": str(frame["id"]),
                "raoLaoDeg": rao,
                "cranialCaudalDeg": cranial,
                "imageUrl": f"/fluoroview/cases/patient-4/drr/{destination.name}",
                "thicknessProxy": round(1.0 + abs(rao) / 180 + abs(cranial) / 120, 3),
                "backend": backend_label,
                "imageOrientation": image_orientation(flip_vertical),
                "toneMap": tone_map,
            }
        )
    return public_frames


def write_public_checksums(public_drr_dir: Path, output_path: Path) -> dict[str, str]:
    checksums = {
        path.name: sha256(path)
        for path in sorted(public_drr_dir.glob("*.png"))
    }
    output_path.write_text(
        "".join(f"{digest}  drr/{filename}\n" for filename, digest in checksums.items()),
        encoding="utf-8",
    )
    return checksums


def build_ingest_manifest(
    source_manifest: dict[str, Any],
    public_frames: list[dict[str, Any]],
    public_checksums: dict[str, str],
    backend_label: str,
    note: str,
    orientation: str,
    tone_map: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "caseId": source_manifest.get("caseId", "patient-4"),
        "backend": backend_label,
        "sourceBackendReported": source_manifest.get("backend", "unknown"),
        "detectorSize": source_manifest.get("detectorSize"),
        "pixelValueRange": source_manifest.get("pixelValueRange"),
        "angles": source_manifest.get("angles"),
        "imageOrientation": orientation,
        "toneMap": tone_map,
        "note": note,
        "frames": [
            {
                "id": frame["id"],
                "raoLaoDeg": frame["raoLaoDeg"],
                "cranialCaudalDeg": frame["cranialCaudalDeg"],
                "imageUrl": frame["imageUrl"],
                "backend": frame["backend"],
                "imageOrientation": frame["imageOrientation"],
                "toneMap": frame["toneMap"],
                "pngSha256": public_checksums[Path(frame["imageUrl"]).name],
            }
            for frame in public_frames
        ],
    }


def update_case_manifest(
    manifest_path: Path,
    source_manifest: dict[str, Any],
    public_frames: list[dict[str, Any]],
    backend_label: str,
    note: str,
    orientation: str,
    tone_map: str,
    vm_sha_public_url: str | None,
) -> None:
    manifest = load_json(manifest_path)
    detector_size = source_manifest.get("detectorSize", [1024, 1024])
    manifest["description"] = (
        "Derived educational case generated from local CT source data with a VM-generated "
        f"{backend_label} DRR atlas. Raw source files remain local and untracked."
    )
    manifest["geometry"]["detector_pixels"] = detector_size
    manifest["drrAtlas"]["grid"] = {
        "raoLaoAngles": source_manifest["angles"]["primaryAngleDeg"],
        "cranialCaudalAngles": source_manifest["angles"]["secondaryAngleDeg"],
    }
    manifest["drrAtlas"]["provenance"] = {
        "backend": backend_label,
        "sourceBackendReported": source_manifest.get("backend", "unknown"),
        "detectorPixels": detector_size,
        "pixelValueRange": source_manifest.get("pixelValueRange", [0.0, 1.0]),
        "imageOrientation": orientation,
        "toneMap": tone_map,
        "ingestManifest": "/fluoroview/cases/patient-4/metadata/drr_atlas_ingest_manifest.json",
        "publicPngChecksums": "/fluoroview/cases/patient-4/metadata/drr_atlas_public_sha256.txt",
        "vmExportChecksums": vm_sha_public_url,
        "note": note,
    }
    manifest["drrAtlas"]["frames"] = public_frames
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def transform_drr_image(image: Image.Image, *, flip_vertical: bool, tone_map: str) -> Image.Image:
    output = image.convert("L")
    if flip_vertical:
        output = ImageOps.flip(output)
    if tone_map == "fluoro":
        output = apply_fluoro_tone_map(output)
    return output


def apply_fluoro_tone_map(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image, dtype=np.float32)
    low = float(np.percentile(pixels, 1))
    p90 = float(np.percentile(pixels, 90))
    p97 = float(np.percentile(pixels, 97))
    high = max(low + 1.0, min(p97, max(p90 * 1.8, p90 + 18.0), 220.0))
    normalized = np.clip((pixels - low) / (high - low), 0.0, 1.0)
    display = 18.0 + np.power(normalized, 0.58) * 214.0
    return Image.fromarray(np.clip(np.round(display), 0, 255).astype(np.uint8), mode="L")


def image_orientation(flip_vertical: bool) -> str:
    return "vertical-flip-applied" if flip_vertical else "source-png"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    main()
