#!/usr/bin/env python3
"""Build the rigid-bronchoscopy teaching airway from the tracked anatomy case.

The source GLB stores one LPS-millimetre airway mesh under an embedded glTF
rotation/scale.  This builder intentionally reads the raw child geometry,
aligns the trachea with the rigid-scope +X axis, rolls the right-mainstem plane
toward -Y, anchors the carina in the assembly scene, and writes a dedicated
public model that is not coupled to the admin-gated airway-anatomy route.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np
import trimesh


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_GLB = REPO_ROOT / "new_anatomy_module" / "Airway.glb"
SOURCE_GRAPH = (
    REPO_ROOT / "public" / "airway-anatomy" / "case-001" / "metadata" / "airway_graph.json"
)
OUTPUT_DIR = REPO_ROOT / "public" / "models" / "rigid-bronchoscopy" / "anatomy"
OUTPUT_GLB = OUTPUT_DIR / "central-airway.glb"
OUTPUT_PROVENANCE = OUTPUT_DIR / "central-airway.provenance.json"

CARINA_WORLD = np.array([1.22, -0.3, 0.0], dtype=float)
WORLD_UNITS_PER_MM = 0.009


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized(vector: np.ndarray) -> np.ndarray:
    length = float(np.linalg.norm(vector))
    if length <= 1e-9:
        raise ValueError("Cannot normalize a zero-length airway vector")
    return vector / length


def main() -> None:
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(f"Missing tracked airway source: {SOURCE_GLB}")
    if not SOURCE_GRAPH.exists():
        raise FileNotFoundError(f"Missing airway graph: {SOURCE_GRAPH}")

    graph = json.loads(SOURCE_GRAPH.read_text())
    nodes = {int(node["id"]): np.asarray(node["lps"], dtype=float) for node in graph["nodes"]}
    root_lps = nodes[int(graph["rootNodeId"])]
    carina_lps = nodes[int(graph["carinaNodeId"])]
    right_mainstem_lps = nodes[2]

    forward = normalized(carina_lps - root_lps)
    right_vector = right_mainstem_lps - carina_lps
    right_transverse = normalized(right_vector - forward * np.dot(right_vector, forward))
    depth = normalized(np.cross(forward, right_transverse))

    scene = trimesh.load(SOURCE_GLB, force="scene")
    if len(scene.geometry) != 1:
        raise ValueError(f"Expected one airway mesh, found {len(scene.geometry)}")
    mesh = next(iter(scene.geometry.values())).copy()

    delta = np.asarray(mesh.vertices, dtype=float) - carina_lps
    mesh.vertices = np.column_stack(
        (
            CARINA_WORLD[0] + delta @ forward * WORLD_UNITS_PER_MM,
            CARINA_WORLD[1] - delta @ right_transverse * WORLD_UNITS_PER_MM,
            CARINA_WORLD[2] + delta @ depth * WORLD_UNITS_PER_MM,
        )
    )
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=[196, 139, 130, 255])

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Preserve explicit vertex normals so the runtime MeshStandardMaterial can
    # respond to the viewer lights. Without NORMAL attributes the exported
    # airway renders nearly black against the dark stage.
    mesh.export(OUTPUT_GLB, include_normals=True)

    provenance = {
        "schema": "rigid_bronchoscopy_airway_asset/v1",
        "generatedOn": date.today().isoformat(),
        "educationalUseOnly": True,
        "redistributionStatus": "Internal de-identified case-derived geometry; review before external redistribution.",
        "source": {
            "glb": str(SOURCE_GLB.relative_to(REPO_ROOT)),
            "glbSha256": sha256(SOURCE_GLB),
            "airwayGraph": str(SOURCE_GRAPH.relative_to(REPO_ROOT)),
            "airwayGraphSha256": sha256(SOURCE_GRAPH),
            "coordinateSystem": "LPS",
            "units": "mm",
            "meshName": "Final_airway_target",
        },
        "teachingTransform": {
            "worldUnitsPerMm": WORLD_UNITS_PER_MM,
            "carinaWorld": CARINA_WORLD.tolist(),
            "rootLpsMm": root_lps.tolist(),
            "carinaLpsMm": carina_lps.tolist(),
            "rightMainstemLpsMm": right_mainstem_lps.tolist(),
            "forwardBasisLps": forward.tolist(),
            "rightTransverseBasisLps": right_transverse.tolist(),
            "depthBasisLps": depth.tolist(),
        },
        "output": {
            "path": str(OUTPUT_GLB.relative_to(REPO_ROOT)),
            "vertexCount": int(len(mesh.vertices)),
            "triangleCount": int(len(mesh.faces)),
            "boundsWorld": mesh.bounds.tolist(),
        },
    }
    OUTPUT_PROVENANCE.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Wrote {OUTPUT_GLB.relative_to(REPO_ROOT)}")
    print(f"Wrote {OUTPUT_PROVENANCE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
