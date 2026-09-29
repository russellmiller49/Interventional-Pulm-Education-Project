"""Audit the CT and segmentation the thorax anatomy is built from, and pin what each segment holds.

    python3 scripts/medical-thoracoscopy/audit_thorax_sources.py           write the record
    python3 scripts/medical-thoracoscopy/audit_thorax_sources.py --check   fail if anything changed

For both files: the SHA-256, the size, the grid and the frame. Between them: the slice offset,
measured from their origins, not assumed. For every segment the build uses (`thorax_common.SEGMENTS`):
its layer and value, the name the file gives it, its volume, the mean and spread of the CT density
inside it, its extent in LPS millimetres and its number of connected pieces, and whether each falls
inside the range the segment was identified by. A segment whose content has changed stops the
build here instead of silently changing the anatomy.

The committed record holds numbers only: `src/features/medical-thoracoscopy/content/data/anatomy/source-audit.json`.
"""
from __future__ import annotations

import argparse
import sys

import numpy as np
from scipy import ndimage

from thorax_common import (
    CT_FILE,
    RECORDS,
    SEGMENTATION_FILE,
    SEGMENTS,
    Volume,
    load_ct,
    rounded,
    sha256_file,
    source_path,
    write_record,
)

RECORD = RECORDS / "source-audit.json"


def audit() -> dict:
    volume = Volume()
    ct, ct_origin, ct_spacing = load_ct()
    offset = (volume.origin - ct_origin) / volume.spacing
    if not np.allclose(ct_spacing, volume.spacing, atol=1e-4):
        raise SystemExit("The CT and the segmentation have different spacings")
    if not np.allclose(offset[:2], 0, atol=1e-3) or abs(offset[2] - round(offset[2])) > 1e-3:
        raise SystemExit(f"The segmentation is not offset from the CT by whole slices: {offset}")
    k_shift = int(round(-offset[2]))  # segmentation slice k lies at CT slice k - k_shift

    segments = []
    for segment in SEGMENTS:
        name_key = next(key for key, value in volume.header_segments.items()
                        if key.endswith("_Name") and value.strip() == segment.file_name)
        prefix = name_key[: -len("_Name")]
        layer = int(volume.header_segments[f"{prefix}_Layer"])
        value = int(volume.header_segments[f"{prefix}_LabelValue"])
        if (layer, value) != (segment.layer, segment.value):
            raise SystemExit(f"{segment.key}: the file now stores it at {layer}:{value}")
        mask = volume.mask(segment.key)
        voxels = np.argwhere(mask)
        ks = voxels[:, 2] - k_shift
        inside = (ks >= 0) & (ks < ct.shape[2])
        hu = ct[voxels[inside, 0], voxels[inside, 1], ks[inside]].astype(float)
        _, pieces = ndimage.label(mask, structure=np.ones((3, 3, 3)))
        volume_ml = len(voxels) * volume.voxel_ml
        segments.append({
            "key": segment.key,
            "layer": layer,
            "value": value,
            "nameInFile": segment.file_name,
            "contains": segment.contains,
            "volumeMl": volume_ml,
            "huMean": float(hu.mean()),
            "huSd": float(hu.std()),
            "lpsMin": volume.to_lps(voxels.min(0)).tolist(),
            "lpsMax": volume.to_lps(voxels.max(0)).tolist(),
            "pieces": int(pieces),
            "expected": {"volumeMl": list(segment.volume_ml), "huMean": list(segment.hu_mean)},
            "matchesExpected": bool(segment.volume_ml[0] <= volume_ml <= segment.volume_ml[1]
                                    and segment.hu_mean[0] <= hu.mean() <= segment.hu_mean[1]),
        })
        print(f"{segment.key:22s} {volume_ml:8.1f} mL  HU {hu.mean():7.1f}  pieces {pieces}", flush=True)

    ct_path, seg_path = source_path(CT_FILE), source_path(SEGMENTATION_FILE)
    return rounded({
        "record": "medical-thoracoscopy-anatomy-source-audit",
        "version": 1,
        "script": "scripts/medical-thoracoscopy/audit_thorax_sources.py",
        "statement": (
            "Numbers only. The CT and its segmentation stay in the owner's local data. Segments are "
            "identified by what they were measured to contain, never by the names in the file."
        ),
        "frame": "LPS millimetres",
        "ct": {
            "file": CT_FILE, "sha256": sha256_file(ct_path), "bytes": ct_path.stat().st_size,
            "size": list(ct.shape), "spacing": ct_spacing.tolist(), "origin": ct_origin.tolist(),
        },
        "segmentation": {
            "file": SEGMENTATION_FILE, "sha256": sha256_file(seg_path), "bytes": seg_path.stat().st_size,
            "layers": int(volume.labels.shape[0]), "size": volume.shape.tolist(),
            "spacing": volume.spacing.tolist(), "origin": volume.origin.tolist(), "space": volume.space,
        },
        "segmentationSliceOffset": k_shift,
        "segments": segments,
    }, 3)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    record = audit()
    failed = [entry["key"] for entry in record["segments"] if not entry["matchesExpected"]]
    if failed:
        print("Segments outside their expected content:", ", ".join(failed))
        return 1
    if args.check:
        import json

        committed = json.loads(RECORD.read_text())
        if committed != json.loads(json.dumps(record)):
            print(f"{RECORD} differs from the sources now on disk")
            return 1
        print("source audit unchanged")
        return 0
    write_record(RECORD, record)
    print(f"wrote {RECORD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
