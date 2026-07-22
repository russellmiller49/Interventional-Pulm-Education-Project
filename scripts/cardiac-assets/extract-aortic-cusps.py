#!/usr/bin/env python3
"""Extract the three fully segmented aortic cusps from a Slicer segmentation.

The source is a layered `.seg.nrrd` in LPS millimetres. Each cusp is written as
an individual PLY so Blender can preserve stable learner-facing node names.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import nrrd
import numpy as np
import trimesh
from skimage.measure import marching_cubes


CUSP_SEGMENTS = {
    "right_coronary_cusp": "aortic-cusp-rcc.ply",
    "non_coronary_cusp": "aortic-cusp-ncc.ply",
    "left_coronary_cusp": "aortic-cusp-lcc.ply",
}


def segment_metadata(header: dict, name: str) -> tuple[int, int]:
    for index in range(128):
        if header.get(f"Segment{index}_Name") != name:
            continue
        return (
            int(header[f"Segment{index}_Layer"]),
            int(header[f"Segment{index}_LabelValue"]),
        )
    raise KeyError(f"Missing Slicer segment: {name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    data, header = nrrd.read(args.source)
    if str(header.get("space", "")).lower() != "left-posterior-superior":
        raise ValueError(
            "Detailed aortic-valve segmentation must use Slicer LPS coordinates"
        )
    directions = np.asarray(header["space directions"], dtype=float)[1:4]
    origin = np.asarray(header["space origin"], dtype=float)
    if data.ndim != 4 or directions.shape != (3, 3):
        raise ValueError(f"Unexpected layered segmentation geometry: {data.shape}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "source": str(args.source),
        "coordinateSystem": "LPS",
        "units": "mm",
        "cusps": {},
    }
    for segment_name, filename in CUSP_SEGMENTS.items():
        layer, label_value = segment_metadata(header, segment_name)
        mask = data[layer] == label_value
        if int(mask.sum()) == 0:
            raise ValueError(f"Empty Slicer segment: {segment_name}")
        vertices_ijk, faces, _normals, _values = marching_cubes(
            mask.astype(np.uint8), 0.5
        )
        vertices_lps = origin + vertices_ijk @ directions
        mesh = trimesh.Trimesh(vertices=vertices_lps, faces=faces, process=False)
        mesh.remove_unreferenced_vertices()
        output_path = args.output_dir / filename
        mesh.export(output_path, file_type="ply")
        manifest["cusps"][segment_name] = {
            "file": filename,
            "voxels": int(mask.sum()),
            "triangles": int(len(mesh.faces)),
        }

    (args.output_dir / "aortic-cusps-source.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    print(
        "Extracted segmented aortic cusps: "
        + ", ".join(
            f"{name}={entry['triangles']:,} tris"
            for name, entry in manifest["cusps"].items()
        )
    )


if __name__ == "__main__":
    main()
