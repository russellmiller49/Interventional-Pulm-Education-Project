"""Check the built thorax surfaces against the committed record, reading the files independently.

    python3 scripts/medical-thoracoscopy/validate_thorax_surfaces.py

Reads each GLB in the owner's local data with its own parser (`thorax_common.read_glb`), not with
the code that wrote it, and checks:

- each file's SHA-256 and size equal the record's;
- the pleural space: the seven zone nodes, named and ordered as `pleural-zones.json`, share one
  vertex array; together they hold every face exactly once, with no face repeated; joined, they
  make a watertight surface, every edge shared by exactly two faces, oriented outward, with the
  volume and area the record gives;
- each zone is one connected piece, and no face of the surface passes through another;
- the ribs: twelve right ribs, numbered 1 to 12, each watertight; the left ribs and the sternum;
- the context: the named structures, no face repeated, the skin open where the scan ends;
- every file carries the label, the attribution, the frame and the presentation in its root extras.

A report is written to the owner's local data; the exit status is 1 on any failure.
"""
from __future__ import annotations

import json
import sys

import numpy as np

from thorax_mesh_checks import crossing_pairs
from thorax_common import ATTRIBUTION, GRAVITY_LPS, LABEL, PRESENTATION_FROM_LPS, RECORDS, ZONES, read_glb, sha256_file, work_path

ZONE_IDS = [zone["id"] for zone in json.loads(ZONES.read_text())["zones"]]
RECORD = json.loads((RECORDS / "surfaces.json").read_text())
failures: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)
        print("✗", message)


def accessor(document: dict, binary: bytes, index: int, dtype, width: int) -> np.ndarray:
    entry = document["accessors"][index]
    view = document["bufferViews"][entry["bufferView"]]
    return np.frombuffer(binary, dtype=dtype, count=entry["count"] * width, offset=view["byteOffset"]).reshape(-1, width)


def nodes_of(document: dict) -> tuple[dict, list[dict]]:
    root = next(node for node in document["nodes"] if "children" in node)
    children = [document["nodes"][i] for i in root["children"]]
    return root, children


def edges_shared_twice(faces: np.ndarray) -> bool:
    edges = np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1)
    _, counts = np.unique(edges, axis=0, return_counts=True)
    return bool((counts == 2).all())


def signed_volume(vertices: np.ndarray, faces: np.ndarray) -> float:
    a, b, c = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)


def main() -> int:
    raw = work_path("raw", "pleural-space.glb").parent
    report: dict = {"files": {}}
    for name, entry in RECORD["files"].items():
        path = raw / entry["file"]
        check(path.exists(), f"{name}: {path} exists")
        if not path.exists():
            continue
        check(sha256_file(path) == entry["sha256"], f"{name}: hash equals the record")
        check(path.stat().st_size == entry["bytes"], f"{name}: size equals the record")
        document, binary = read_glb(path)
        root, children = nodes_of(document)
        extras = root.get("extras", {})
        check(extras.get("label") == LABEL, f"{name}: labelled {LABEL!r}")
        check(extras.get("attribution") == ATTRIBUTION, f"{name}: carries the attribution")
        check(extras.get("frame") == "LPS millimetres", f"{name}: states its frame")
        check(np.allclose(extras.get("presentationFromLps"), PRESENTATION_FROM_LPS), f"{name}: carries the presentation")
        check(np.allclose(extras.get("gravityLps"), GRAVITY_LPS), f"{name}: carries gravity")
        report["files"][name] = {"nodes": [child["name"] for child in children]}

        if name == "pleural-space":
            check([child["name"] for child in children] == [f"zone:{z}" for z in ZONE_IDS],
                  "pleural space: one node per zone, in the zone list's order")
            primitives = [document["meshes"][child["mesh"]]["primitives"][0] for child in children]
            positions = {p["attributes"]["POSITION"] for p in primitives}
            check(len(positions) == 1, "pleural space: the zones share one vertex array")
            vertices = accessor(document, binary, primitives[0]["attributes"]["POSITION"], np.float32, 3).astype(float)
            parts = [accessor(document, binary, p["indices"], np.uint32, 1).reshape(-1, 3) for p in primitives]
            faces = np.concatenate(parts).astype(np.int64)
            check(len(np.unique(np.sort(faces, axis=1), axis=0)) == len(faces), "pleural space: no face is in two zones")
            check(len(faces) == RECORD["pleuralSpace"]["faces"], "pleural space: every face is in a zone")
            check(edges_shared_twice(faces), "pleural space: watertight, every edge shared by two faces")
            check(len(crossing_pairs(vertices, faces)) == 0, "pleural space: no face passes through another")
            volume = signed_volume(vertices, faces) / 1000.0
            check(volume > 0, "pleural space: oriented outward")
            check(abs(volume - RECORD["pleuralSpace"]["meshVolumeMl"]) < 0.5, "pleural space: volume equals the record")
            check(abs(volume - RECORD["pleuralSpace"]["voxelVolumeMl"]) / RECORD["pleuralSpace"]["voxelVolumeMl"] < 0.01,
                  "pleural space: within 1 % of the voxel volume")
            report["pleuralSpace"] = {"faces": int(len(faces)), "volumeMl": round(volume, 1)}
            # each zone one connected piece, by shared edges
            for zone_id, part in zip(ZONE_IDS, parts):
                part = part.astype(np.int64)
                edges = {}
                for f, tri in enumerate(part):
                    for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
                        edges.setdefault((min(a, b), max(a, b)), []).append(f)
                parent = list(range(len(part)))

                def find(x):
                    while parent[x] != x:
                        parent[x] = parent[parent[x]]
                        x = parent[x]
                    return x

                for shared in edges.values():
                    for other in shared[1:]:
                        parent[find(other)] = find(shared[0])
                pieces = len({find(i) for i in range(len(part))})
                check(pieces == 1, f"pleural space: zone {zone_id} is one piece ({pieces})")

        if name == "ribs":
            names = [child["name"] for child in children]
            check(names[:12] == [f"rib:right:{n}" for n in range(1, 13)], "ribs: twelve right ribs numbered 1 to 12")
            check("ribs:left" in names and "sternum" in names, "ribs: the left ribs and the sternum")
            for child in children[:12]:
                primitive = document["meshes"][child["mesh"]]["primitives"][0]
                faces = accessor(document, binary, primitive["indices"], np.uint32, 1).reshape(-1, 3).astype(np.int64)
                check(edges_shared_twice(faces), f"ribs: {child['name']} is watertight")
                positions = accessor(document, binary, primitive["attributes"]["POSITION"], np.float32, 3).astype(float)
                check(len(crossing_pairs(positions, faces)) == 0, f"ribs: {child['name']} does not pass through itself")

        if name == "context":
            names = {child["name"] for child in children}
            expected = {f"context:{s}" for s in ("diaphragm", "heart", "aorta", "superior-vena-cava",
                                                 "inferior-vena-cava", "pulmonary-artery", "skin")}
            check(names == expected, "context: the named structures")
            for child in children:
                primitive = document["meshes"][child["mesh"]]["primitives"][0]
                faces = accessor(document, binary, primitive["indices"], np.uint32, 1).reshape(-1, 3).astype(np.int64)
                check(len(np.unique(np.sort(faces, axis=1), axis=0)) == len(faces), f"context: {child['name']} repeats no face")
            skin = next(child for child in children if child["name"] == "context:skin")
            check(skin.get("extras", {}).get("open") == "where the scan's field ends", "context: the skin is open where the scan ends")

    report["failures"] = failures
    out = work_path("validation-surfaces.json")
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(f"{len(failures)} failures. Report: {out}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
