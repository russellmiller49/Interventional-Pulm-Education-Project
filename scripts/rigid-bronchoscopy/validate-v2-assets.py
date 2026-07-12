#!/usr/bin/env python3
"""Fail-closed validation for the rigid-bronchoscopy v2 asset manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from scipy.spatial import cKDTree

from v2_asset_common import (
    MM_TO_METERS,
    dense_centerline_samples,
    make_airway_volumes,
    pose_clearance_mm,
    validate_pose_axes,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = REPO_ROOT / "public" / "models" / "rigid-bronchoscopy" / "v2"
DEFAULT_MANIFEST = OUTPUT_DIR / "asset-manifest.json"
DEFAULT_REPORT = OUTPUT_DIR / "validation-report.json"
GENERATED_KINDS = {
    "anatomyFull",
    "anatomyCutaway",
    "ventilationAccessory",
    "capProxy",
    "instrumentProxy",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_scene(path: Path) -> trimesh.Scene:
    return trimesh.load(path, force="scene")


def glb_primitive_attributes(path: Path) -> list[set[str]]:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        return []
    offset = 12
    document = None
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            document = json.loads(chunk)
    if document is None:
        return []
    return [
        set(primitive.get("attributes", {}))
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]


def transformed_meshes(scene: trimesh.Scene) -> list[tuple[str, trimesh.Trimesh]]:
    result: list[tuple[str, trimesh.Trimesh]] = []
    for node in scene.graph.nodes_geometry:
        transform, geometry_name = scene.graph[node]
        mesh = scene.geometry[geometry_name].copy()
        mesh.apply_transform(transform)
        result.append((node, mesh))
    return result


def stats(scene: trimesh.Scene, path: Path) -> dict[str, Any]:
    meshes = transformed_meshes(scene)
    primitive_attributes = glb_primitive_attributes(path)
    return {
        "meshCount": len(meshes),
        "triangleCount": sum(len(mesh.faces) for _, mesh in meshes),
        "boundsMm": {
            "min": (scene.bounds[0] / MM_TO_METERS).tolist(),
            "max": (scene.bounds[1] / MM_TO_METERS).tolist(),
            "size": (scene.extents / MM_TO_METERS).tolist(),
        },
        "semanticNodes": sorted(node for node, _ in meshes),
        "allPrimitivesHaveVertexNormals": bool(primitive_attributes)
        and all("NORMAL" in attributes for attributes in primitive_attributes),
    }


class Audit:
    def __init__(self) -> None:
        self.check_count = 0
        self.category_counts: Counter[str] = Counter()
        self.failures: list[dict[str, Any]] = []

    def check(self, condition: bool, category: str, check: str, detail: Any = None) -> None:
        self.check_count += 1
        self.category_counts[category] += 1
        if not bool(condition):
            self.failures.append({"category": category, "check": check, "detail": detail})


def close_values(first: Any, second: Any, tolerance: float) -> bool:
    return bool(
        np.allclose(
            np.asarray(first, dtype=float),
            np.asarray(second, dtype=float),
            atol=tolerance,
            rtol=0.0,
        )
    )


def resolve_public_path(web_path: str, audit: Audit) -> Path:
    relative = web_path.lstrip("/")
    resolved = (REPO_ROOT / "public" / relative).resolve()
    audit.check(
        OUTPUT_DIR.resolve() in resolved.parents,
        "manifest",
        f"asset path remains under v2 output: {web_path}",
        str(resolved),
    )
    return resolved


def validate_manifest_shape(manifest: dict[str, Any], audit: Audit) -> None:
    audit.check(
        manifest.get("schema") == "rigid_bronchoscopy_asset_manifest/v2",
        "manifest",
        "schema is v2",
        manifest.get("schema"),
    )
    audit.check(manifest.get("version") == 2, "manifest", "numeric version is 2")
    audit.check(manifest.get("educationalUseOnly") is True, "manifest", "education-only flag")
    audit.check(bool(manifest.get("disclaimer")), "manifest", "educational disclaimer present")
    audit.check(
        manifest.get("units")
        == {
            "authoredDimensions": "millimeters",
            "glbGeometry": "meters",
            "metersPerMillimeter": 0.001,
        },
        "units",
        "single mm-to-metre unit contract",
        manifest.get("units"),
    )
    presentation = manifest.get("presentation", {})
    audit.check(
        math.isclose(presentation.get("worldUnitsPerMillimeter", -1), 0.009, abs_tol=1e-12),
        "units",
        "shared world units per millimetre",
        presentation,
    )
    audit.check(
        math.isclose(presentation.get("assetScaleWorldUnitsPerMeter", -1), 9.0, abs_tol=1e-12),
        "units",
        "shared meter-native runtime scale",
        presentation,
    )
    assets = manifest.get("assets", [])
    ids = [asset.get("id") for asset in assets]
    paths = [asset.get("path") for asset in assets]
    audit.check(len(assets) >= 35, "manifest", "complete v2 asset set", len(assets))
    audit.check(len(ids) == len(set(ids)), "manifest", "asset ids are unique")
    audit.check(len(paths) == len(set(paths)), "manifest", "asset paths are unique")
    audit.check(all(asset.get("runtime") is True for asset in assets), "manifest", "runtime flags explicit")
    audit.check(
        all(asset.get("provenance") for asset in assets),
        "provenance",
        "every asset has provenance",
    )
    audit.check(
        all(asset.get("estimatedFields") for asset in assets),
        "provenance",
        "every educational mesh declares estimated fields",
    )
    airway = manifest.get("airwayModel", {})
    audit.check(
        airway.get("modelType") == "public-safe educational geometry; not patient-derived",
        "provenance",
        "airway is explicitly public-safe and not patient-derived",
        airway.get("modelType"),
    )
    branch_ids = {branch.get("id") for branch in airway.get("branches", [])}
    audit.check(
        branch_ids == {"trachea", "rightMainstem", "leftMainstem"},
        "anatomy",
        "central-only branch topology",
        sorted(branch_ids),
    )
    for branch in airway.get("branches", []):
        audit.check(
            branch["outerRadiusMm"] > branch["innerRadiusMm"] > 0,
            "anatomy",
            f"positive wall thickness for {branch['id']}",
            branch,
        )
        audit.check(
            branch["outerRadiusMm"] - branch["innerRadiusMm"] >= 1.0,
            "anatomy",
            f"at least 1 mm authored wall for {branch['id']}",
            branch,
        )


def validate_assets(
    manifest: dict[str, Any],
    audit: Audit,
) -> tuple[dict[str, dict[str, Any]], dict[str, Path]]:
    assets_by_id = {asset["id"]: asset for asset in manifest["assets"]}
    paths_by_id: dict[str, Path] = {}
    declared_files: set[Path] = set()
    summaries: dict[str, dict[str, Any]] = {}

    for asset in manifest["assets"]:
        asset_id = asset["id"]
        path = resolve_public_path(asset["path"], audit)
        paths_by_id[asset_id] = path
        declared_files.add(path.resolve())
        audit.check(path.is_file(), "hashes", f"asset exists: {asset_id}", str(path))
        if not path.is_file():
            continue
        digest = sha256_file(path)
        audit.check(digest == asset["sha256"], "hashes", f"SHA-256 matches: {asset_id}")
        audit.check(
            path.stem.endswith(f"-{digest[:12]}"),
            "hashes",
            f"content hash is in filename: {asset_id}",
            path.name,
        )
        audit.check(
            path.stat().st_size == asset["sizeBytes"],
            "hashes",
            f"byte size matches: {asset_id}",
        )
        scene = load_scene(path)
        current = stats(scene, path)
        expected = asset["geometry"]
        audit.check(
            current["meshCount"] == expected["meshCount"],
            "geometry",
            f"mesh count matches manifest: {asset_id}",
            {"expected": expected["meshCount"], "actual": current["meshCount"]},
        )
        audit.check(
            current["triangleCount"] == expected["triangleCount"],
            "geometry",
            f"triangle count matches manifest: {asset_id}",
            {"expected": expected["triangleCount"], "actual": current["triangleCount"]},
        )
        audit.check(
            current["semanticNodes"] == expected["semanticNodes"],
            "geometry",
            f"semantic nodes match manifest: {asset_id}",
        )
        audit.check(
            expected.get("allPrimitivesHaveVertexNormals") is True
            and current["allPrimitivesHaveVertexNormals"] is True,
            "normals",
            f"every glTF primitive serializes a NORMAL accessor: {asset_id}",
            {
                "manifest": expected.get("allPrimitivesHaveVertexNormals"),
                "current": current["allPrimitivesHaveVertexNormals"],
            },
        )
        for bound_key in ("min", "max", "size"):
            audit.check(
                close_values(
                    current["boundsMm"][bound_key],
                    expected["boundsMm"][bound_key],
                    0.1,
                ),
                "dimensions",
                f"{bound_key} bounds within 0.1 mm: {asset_id}",
                {
                    "expected": expected["boundsMm"][bound_key],
                    "actual": current["boundsMm"][bound_key],
                },
            )

        meshes = transformed_meshes(scene)
        audit.check(bool(meshes), "geometry", f"contains mesh geometry: {asset_id}")
        audit.check(
            all(np.isfinite(mesh.vertices).all() for _, mesh in meshes),
            "geometry",
            f"finite vertices: {asset_id}",
        )
        audit.check(
            all(getattr(mesh.visual, "material", None) is not None for _, mesh in meshes),
            "materials",
            f"every mesh has a PBR material: {asset_id}",
        )
        if asset["kind"] in GENERATED_KINDS:
            audit.check(
                all(mesh.is_winding_consistent for _, mesh in meshes),
                "geometry",
                f"consistent face winding: {asset_id}",
            )
            audit.check(
                all(float(np.min(mesh.area_faces)) > 1e-14 for _, mesh in meshes),
                "geometry",
                f"no degenerate triangles: {asset_id}",
            )
            components = {
                node: [len(component.faces) for component in mesh.split(only_watertight=False)]
                for node, mesh in meshes
            }
            audit.check(
                all(len(face_counts) == 1 for face_counts in components.values()),
                "geometry",
                f"no isolated face islands: {asset_id}",
                components,
            )
        summaries[asset_id] = {
            "path": asset["path"],
            "sha256": digest,
            "meshCount": current["meshCount"],
            "triangleCount": current["triangleCount"],
        }

    actual_files = {path.resolve() for path in OUTPUT_DIR.rglob("*.glb")}
    audit.check(
        actual_files == declared_files,
        "manifest",
        "manifest enumerates every v2 GLB and no stale mutable GLBs remain",
        {
            "undeclared": sorted(str(path) for path in actual_files - declared_files),
            "missing": sorted(str(path) for path in declared_files - actual_files),
        },
    )

    asset_ids = set(assets_by_id)
    for state_id, state in manifest.get("assemblyStates", {}).items():
        cap_id = state.get("mainAxialCapAssetId")
        audit.check(
            cap_id is None or cap_id in asset_ids,
            "anchors",
            f"assembly-state cap id resolves: {state_id}",
            cap_id,
        )
    audit.check(
        "tool-stent-introducer" in asset_ids,
        "manifest",
        "stent-introducer proxy is included",
    )
    return summaries, paths_by_id


def validate_airway_normals(
    manifest: dict[str, Any],
    paths_by_id: dict[str, Path],
    audit: Audit,
) -> None:
    samples = dense_centerline_samples()
    tree = cKDTree(samples)
    required_by_asset = {
        "anatomy-central-airway-full": {"Airway_Outer_Wall", "Airway_Inner_Lumen"},
        "anatomy-central-airway-cutaway": {
            "Airway_Cutaway_Outer_Wall",
            "Airway_Cutaway_Inner_Lumen",
        },
    }
    for asset_id, required_nodes in required_by_asset.items():
        path = paths_by_id.get(asset_id)
        audit.check(path is not None, "anatomy", f"required airway asset: {asset_id}")
        if path is None:
            continue
        scene = load_scene(path)
        meshes = dict(transformed_meshes(scene))
        audit.check(
            set(meshes) == required_nodes,
            "anatomy",
            f"semantic airway surfaces: {asset_id}",
            sorted(meshes),
        )
        for node, mesh in meshes.items():
            _, nearest = tree.query(mesh.triangles_center)
            radial = mesh.triangles_center - samples[nearest]
            radial /= np.maximum(np.linalg.norm(radial, axis=1)[:, None], 1e-12)
            alignment = np.einsum("ij,ij->i", mesh.face_normals, radial)
            median = float(np.median(alignment))
            is_inner = "Inner_Lumen" in node
            audit.check(
                median < -0.5 if is_inner else median > 0.5,
                "normals",
                f"anatomically outward wall-normal convention: {node}",
                median,
            )
            audit.check(
                len(mesh.split(only_watertight=False)) == 1,
                "anatomy",
                f"connected semantic airway surface: {node}",
            )

    full_bounds = manifest["assets"][
        next(
            index
            for index, asset in enumerate(manifest["assets"])
            if asset["id"] == "anatomy-central-airway-full"
        )
    ]["geometry"]["boundsMm"]
    size = full_bounds["size"]
    audit.check(190.0 < size[0] < 230.0, "dimensions", "central airway longitudinal extent", size)
    audit.check(80.0 < size[1] < 110.0, "dimensions", "bilateral mainstem span", size)
    audit.check(29.9 <= size[2] <= 30.1, "dimensions", "carinal outer diameter within 0.1 mm", size)


def anchor_groups(manifest: dict[str, Any]):
    semantic = manifest["semanticAnchors"]
    for group_name in ("ports", "tubeFeatures", "toolEndpoints"):
        for anchor_id, anchor in semantic[group_name].items():
            yield f"{group_name}.{anchor_id}", anchor
    yield "telescopeObjective", semantic["telescopeObjective"]


def validate_anchors(
    manifest: dict[str, Any],
    audit: Audit,
) -> None:
    assets_by_id = {asset["id"]: asset for asset in manifest["assets"]}
    required_ports = {"mainAxial", "accessory", "anesthesiaCircuit", "jet"}
    audit.check(
        set(manifest["semanticAnchors"]["ports"]) == required_ports,
        "anchors",
        "four EFER port anchors are distinct and complete",
    )
    for name, anchor in anchor_groups(manifest):
        asset = assets_by_id.get(anchor.get("assetId"))
        audit.check(asset is not None, "anchors", f"anchor asset resolves: {name}", anchor.get("assetId"))
        position = np.asarray(anchor.get("positionMm", []), dtype=float)
        direction = np.asarray(anchor.get("direction", []), dtype=float)
        audit.check(position.shape == (3,) and np.isfinite(position).all(), "anchors", f"finite position: {name}")
        audit.check(direction.shape == (3,) and np.isfinite(direction).all(), "anchors", f"finite direction: {name}")
        if direction.shape == (3,):
            audit.check(
                math.isclose(float(np.linalg.norm(direction)), 1.0, abs_tol=0.002),
                "anchors",
                f"unit direction: {name}",
                float(np.linalg.norm(direction)),
            )
        if asset is not None and position.shape == (3,):
            bounds = asset["geometry"]["boundsMm"]
            minimum = np.asarray(bounds["min"], dtype=float) - 1.0
            maximum = np.asarray(bounds["max"], dtype=float) + 1.0
            audit.check(
                bool(np.all(position >= minimum) and np.all(position <= maximum)),
                "anchors",
                f"position lies on/in referenced asset within 1 mm: {name}",
                {"position": position.tolist(), "bounds": bounds},
            )

    anatomy_asset = assets_by_id["anatomy-central-airway-full"]
    anatomy_bounds = anatomy_asset["geometry"]["boundsMm"]
    minimum = np.asarray(anatomy_bounds["min"], dtype=float) - 1.0
    maximum = np.asarray(anatomy_bounds["max"], dtype=float) + 1.0
    for anchor_id, anchor in manifest["semanticAnchors"]["anatomy"].items():
        position = np.asarray(anchor["positionMm"], dtype=float)
        audit.check(
            bool(np.all(position >= minimum) and np.all(position <= maximum)),
            "anchors",
            f"anatomy anchor in central-airway bounds: {anchor_id}",
            position.tolist(),
        )


def validate_dimensions_and_poses(manifest: dict[str, Any], audit: Audit) -> dict[str, float]:
    assets = {asset["id"]: asset for asset in manifest["assets"]}
    for asset_id in (
        "cap-bs2309-3-telescope-plus-2mm-instrument",
        "cap-bs2311-3-telescope-plus-4mm-instrument",
        "cap-bs2319-3-optical-forceps",
    ):
        asset = assets[asset_id]
        size = asset["geometry"]["boundsMm"]["size"]
        audit.check(
            close_values(size[:2], [25.0, 25.0], 0.1),
            "dimensions",
            f"published 25 mm cap diameter represented within 0.1 mm: {asset_id}",
            size,
        )
        for opening in asset["anchors"]["capOpenings"]:
            audit.check(
                opening["diameterMm"] > 0,
                "dimensions",
                f"positive cap opening diameter: {asset_id}.{opening['id']}",
            )

    stent = assets["tool-stent-introducer"]
    endpoint = np.asarray(stent["anchors"]["toolEndpoint"]["positionMm"])
    entry = np.asarray(stent["anchors"]["entry"]["positionMm"])
    audit.check(
        math.isclose(float(np.linalg.norm(endpoint - entry)), 450.0, abs_tol=0.1),
        "dimensions",
        "stent-introducer endpoint matches declared 450 mm proxy length",
    )

    try:
        validate_pose_axes(manifest["proceduralPoses"])
        axes_valid = True
    except ValueError as error:
        axes_valid = False
        axis_detail = str(error)
    audit.check(
        axes_valid,
        "poses",
        "pose axes match straight authored tube sweeps",
        None if axes_valid else axis_detail,
    )
    _, lumen, _ = make_airway_volumes()
    recomputed: dict[str, float] = {}
    for pose in manifest["proceduralPoses"]:
        clearance = pose_clearance_mm(lumen, pose)
        recomputed[pose["id"]] = round(clearance, 3)
        audit.check(
            clearance >= manifest["validationRequirements"]["minimumPoseRadialClearanceMm"],
            "poses",
            f"minimum 0.5 mm swept-mesh clearance: {pose['id']}",
            clearance,
        )
        audit.check(
            math.isclose(
                clearance,
                pose["validatedMinimumRadialClearanceMm"],
                abs_tol=0.1,
            ),
            "poses",
            f"stored clearance reproduces within 0.1 mm: {pose['id']}",
            {
                "stored": pose["validatedMinimumRadialClearanceMm"],
                "recomputed": clearance,
            },
        )
        bevel = np.asarray(pose["bevelMm"], dtype=float)
        objective = np.asarray(pose["telescopeObjectiveMm"], dtype=float)
        audit.check(
            float(np.linalg.norm(bevel - objective)) <= 1.05,
            "poses",
            f"telescope objective within 1 mm of declared bevel anchor: {pose['id']}",
            float(np.linalg.norm(bevel - objective)),
        )
    audit.check(
        {pose["id"] for pose in manifest["proceduralPoses"]}
        == {"tracheal", "carinal", "rightMainstem", "leftMainstem"},
        "poses",
        "four required discrete procedural poses",
    )
    return recomputed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    audit = Audit()
    validate_manifest_shape(manifest, audit)
    summaries, paths_by_id = validate_assets(manifest, audit)
    validate_airway_normals(manifest, paths_by_id, audit)
    validate_anchors(manifest, audit)
    clearances = validate_dimensions_and_poses(manifest, audit)
    report = {
        "schema": "rigid_bronchoscopy_asset_validation/v2",
        "validatedOn": date.today().isoformat(),
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestBuildId": manifest.get("buildId"),
        "passed": not audit.failures,
        "checkCount": audit.check_count,
        "categoryCheckCounts": dict(sorted(audit.category_counts.items())),
        "assetCount": len(summaries),
        "poseClearancesMm": clearances,
        "assetSummaries": summaries,
        "failures": audit.failures,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "passed": report["passed"],
                "checkCount": report["checkCount"],
                "assetCount": report["assetCount"],
                "failureCount": len(audit.failures),
                "report": str(args.report.resolve().relative_to(REPO_ROOT)),
                "poseClearancesMm": clearances,
            }
        )
    )
    if audit.failures:
        for failure in audit.failures:
            print(json.dumps(failure), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
