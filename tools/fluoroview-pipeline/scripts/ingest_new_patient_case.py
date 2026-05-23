#!/usr/bin/env python3
"""Ingest the local FluoroView new-patient source bundle into public web assets."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET
from typing import Any

import h5py
import nrrd
import numpy as np
from PIL import Image
from scipy.ndimage import zoom
import trimesh

from fluoroview_pipeline.airway_graph import (
    build_airway_graph,
    build_centerline_overlay,
    build_segment_metadata,
)

try:
    import pygltflib
except ImportError:  # pragma: no cover - dependency is optional at import time for tests
    pygltflib = None


HU_LOW = -1144
HU_HIGH = 2951
TARGET_SIZE_XYZ = (256, 256, 256)
SAFETY_LABEL = "Educational simulation only — not for diagnosis, treatment, or procedure guidance."
VTK_PARTS = [
    ("frontal-arm-c", "frontal-arm-c.vtk"),
    ("frontal-arm-l", "frontal-arm-l.vtk"),
    ("frontal-arm-p", "frontal-arm-p.vtk"),
    ("frontal-beam", "frontal-beam.vtk"),
    ("frontal-detector-base", "frontal-detector-base.vtk"),
    ("frontal-detector", "frontal-detector.vtk"),
    ("table-base", "table-base.vtk"),
    ("table-middle", "table-middle.vtk"),
    ("table-top", "table-top.vtk"),
]
H5_TRANSFORMS = {
    "gantry-to-ras": "gantry-to-ras.h5",
    "positioning": "PositioningTransform.h5",
    "frontal-arm-l-rotation": "frontal-arm-l-rotation-transform.h5",
    "frontal-arm-p-rotation": "frontal-arm-p-rotation-transform.h5",
    "frontal-arm-c-rotation": "frontal-arm-c-rotation-transform.h5",
    "frontal-detector-translation": "frontal-arm-detector-translation-transform.h5",
    "frontal-detector-rotation": "frontal-arm-detector-rotation-transform.h5",
    "frontal-camera-to-detector": "frontal-camera-to-frontal-detector.h5",
    "table-vertical": "table-vertical-transform.h5",
    "table-longitudinal": "table-longitudinal-transform.h5",
    "table-lateral": "table-lateral-transform.h5",
}


@dataclass(frozen=True)
class CtExport:
    volume_asset: dict[str, Any]
    preview_asset: dict[str, Any]
    provenance: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--case-dir", required=True)
    parser.add_argument("--public-root", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    case_dir = Path(args.case_dir)
    public_root = Path(args.public_root)
    case_id = case_dir.name
    asset_base = f"/fluoroview/cases/{case_id}"

    for subdir in ["ct", "metadata", "virtual-cath-lab", "carm"]:
        (case_dir / subdir).mkdir(parents=True, exist_ok=True)

    print(f"[ingest] source: {source_dir}")
    print(f"[ingest] case:   {case_dir}")

    ct = export_ct_volume(source_dir / "target_clean_ct.nrrd", case_dir, asset_base)
    graph = build_and_write_airway_assets(source_dir, case_dir)
    airway_provenance = copy_or_compress_airway_glb(source_dir, case_dir)
    scope_path = build_scope_animation_path(source_dir, case_dir, graph)
    carm = build_carm_assets(source_dir, case_dir, asset_base)
    vcl = build_slicerheart_reference(source_dir, case_dir, asset_base)
    manifest = build_case_manifest(
        case_dir=case_dir,
        asset_base=asset_base,
        ct=ct,
        graph=graph,
        airway_provenance=airway_provenance,
        scope_path=scope_path,
        c_arm=carm,
        virtual_cath_lab=vcl,
    )
    write_json(case_dir / "case_manifest.json", manifest)

    print(f"[ingest] wrote {case_dir / 'case_manifest.json'}")
    print(f"[ingest] public payload {folder_size_mb(case_dir):.1f} MB")


def export_ct_volume(nrrd_path: Path, case_dir: Path, asset_base: str) -> CtExport:
    if not nrrd_path.exists():
        raise SystemExit(f"Missing CT NRRD: {nrrd_path}")
    print(f"[ct] reading {nrrd_path.name}")
    volume_hu, header = nrrd.read(str(nrrd_path))
    volume_hu = volume_hu.astype(np.float32, copy=False)
    original_size_xyz = tuple(int(value) for value in volume_hu.shape)
    zoom_factors = tuple(target / source for target, source in zip(TARGET_SIZE_XYZ, original_size_xyz))
    resampled = zoom(volume_hu, zoom_factors, order=1, prefilter=False)
    resampled = np.clip(resampled, HU_LOW, HU_HIGH)
    scaled = np.round((resampled - HU_LOW) / (HU_HIGH - HU_LOW) * 255.0)
    volume_uint8_xyz = np.clip(scaled, 0, 255).astype(np.uint8)
    raw_bytes = np.ascontiguousarray(volume_uint8_xyz.transpose(2, 1, 0)).tobytes()

    ct_dir = case_dir / "ct"
    volume_raw = ct_dir / "ct_volume_uint8.raw"
    preview_raw = ct_dir / "ct_preview_uint8.raw"
    volume_raw.write_bytes(raw_bytes)
    preview_raw.write_bytes(raw_bytes)

    spacing_xyz, direction_lps, origin_lps = nrrd_geometry(header, original_size_xyz)
    output_spacing_xyz = [
        float(spacing_xyz[index] * original_size_xyz[index] / TARGET_SIZE_XYZ[index])
        for index in range(3)
    ]

    volume_metadata = {
        "schema": "fluoroview_volume_drr/v1",
        "volumeUri": f"{asset_base}/ct/{volume_raw.name}",
        "format": "uint8-r8",
        "sizeXyz": list(TARGET_SIZE_XYZ),
        "originalSizeXyz": list(original_size_xyz),
        "spacingXyzMm": output_spacing_xyz,
        "originLps": origin_lps,
        "directionLps": direction_lps,
        "huRange": [HU_LOW, HU_HIGH],
        "sampleDomain": "normalized-r8",
        "baselineMas": 16,
        "recommendedSteps": {"interactive": 96, "full": 224},
        "recommendedRenderScale": {"interactive": 0.67, "full": 1.0},
        "source": nrrd_path.name,
    }
    preview_metadata = {
        "raw": preview_raw.name,
        "rawUrl": f"{asset_base}/ct/{preview_raw.name}",
        "sizeXyz": list(TARGET_SIZE_XYZ),
        "originalSizeXyz": list(original_size_xyz),
        "stride": [
            max(1, int(round(original_size_xyz[index] / TARGET_SIZE_XYZ[index])))
            for index in range(3)
        ],
        "spacingXyzMm": output_spacing_xyz,
        "originLps": origin_lps,
        "directionLps": direction_lps,
        "windowHu": [HU_LOW, HU_HIGH],
        "source": "Derived uint8 CT preview from local target_clean_ct.nrrd; not diagnostic.",
    }
    write_json(ct_dir / "ct_volume_metadata.json", volume_metadata)
    write_json(ct_dir / "ct_preview_metadata.json", preview_metadata)
    return CtExport(
        volume_asset=volume_metadata,
        preview_asset=preview_metadata,
        provenance={
            "ctSourceFile": nrrd_path.name,
            "ctSourceSha256": sha256(nrrd_path),
            "windowHu": [HU_LOW, HU_HIGH],
        },
    )


def nrrd_geometry(
    header: dict[str, Any],
    original_size_xyz: tuple[int, int, int],
) -> tuple[list[float], list[float], list[float]]:
    directions = np.asarray(header.get("space directions"), dtype=np.float64)
    if directions.shape != (3, 3):
        directions = np.eye(3, dtype=np.float64)
    spacing = np.linalg.norm(directions, axis=1)
    spacing = np.where(spacing > 1e-8, spacing, np.ones_like(spacing))
    direction = (directions / spacing[:, None]).reshape(-1).astype(float).tolist()
    origin = np.asarray(header.get("space origin", [0, 0, 0]), dtype=np.float64).tolist()
    if str(header.get("space", "")).lower().startswith("right-anterior-superior"):
        origin = [-float(origin[0]), -float(origin[1]), float(origin[2])]
        direction_matrix = np.asarray(direction, dtype=np.float64).reshape(3, 3)
        direction_matrix[:, 0] *= -1
        direction_matrix[:, 1] *= -1
        direction = direction_matrix.reshape(-1).tolist()
    if len(origin) != 3:
        origin = [0.0, 0.0, 0.0]
    if len(direction) != 9:
        direction = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
    if len(original_size_xyz) != 3:
        raise ValueError("NRRD CT volume must be 3D.")
    return spacing.astype(float).tolist(), [float(v) for v in direction], [float(v) for v in origin]


def build_and_write_airway_assets(source_dir: Path, case_dir: Path) -> dict[str, Any]:
    graph = build_airway_graph(source_dir / "Centerline")
    metadata_dir = case_dir / "metadata"
    write_json(metadata_dir / "airway_graph.json", graph)
    write_json(
        metadata_dir / "centerline_overlay.json",
        build_centerline_model_overlay(source_dir) or build_centerline_overlay(graph),
    )
    write_json(metadata_dir / "segments.json", build_segment_metadata(graph))
    print(
        f"[airway] graph nodes={len(graph['nodes'])} edges={len(graph['edges'])} "
        f"terminals={len(graph['terminalNodeIds'])}"
    )
    return graph


def copy_or_compress_airway_glb(source_dir: Path, case_dir: Path) -> dict[str, Any]:
    source = source_dir / "Full_airway_segments.glb"
    dest = case_dir / "airway_segments.glb"
    if not source.exists():
        raise SystemExit(f"Missing airway GLB: {source}")
    npx = shutil.which("npx")
    if npx:
        command = [npx, "--no-install", "gltf-pipeline", "-i", str(source), "-o", str(dest), "-d"]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=300, check=False)
            if result.returncode == 0 and dest.exists():
                print(f"[airway] DRACO compressed {source.name} -> {dest.name}")
                return {"airwayGlbSource": source.name, "airwayGlbCompression": "draco"}
            print(f"[airway] gltf-pipeline failed; copying uncompressed GLB: {result.stderr[:240]}")
        except Exception as exc:  # pragma: no cover - depends on local node install
            print(f"[airway] gltf-pipeline unavailable; copying uncompressed GLB: {exc}")
    shutil.copy(source, dest)
    return {"airwayGlbSource": source.name, "airwayGlbCompression": "none"}


def build_scope_animation_path(
    source_dir: Path,
    case_dir: Path,
    graph: dict[str, Any],
) -> dict[str, Any]:
    glb_path = source_dir / "bronch_animation.glb"
    points = try_extract_glb_polyline(glb_path)
    source = glb_path.name
    if len(points) < 20:
        points = fallback_route_from_graph(graph)
        source = "fallback-airway-graph-route"
        print(
            "[scope] bronch_animation.glb had too little usable geometry; "
            "using documented airway graph fallback route."
        )
    length = polyline_length(points)
    if len(points) < 20 or length <= 10:
        raise SystemExit("Bronchoscope path preprocessing failed: no plausible route with >=20 points.")
    payload = {
        "schema": "fluoroview_scope_path/v1",
        "coordinateSystem": "LPS",
        "units": "mm",
        "source": source,
        "defaultRouteId": "bezier-demo",
        "pointsLps": points,
        "lengthMm": round(length, 3),
    }
    write_json(case_dir / "metadata" / "bronch_animation_path.json", payload)
    return payload


def try_extract_glb_polyline(path: Path) -> list[list[float]]:
    if pygltflib is None or not path.exists() or path.stat().st_size < 1024:
        return []
    try:
        gltf = pygltflib.GLTF2().load(str(path))
        blob = gltf.binary_blob()
        if not blob:
            return []
        all_points: list[np.ndarray] = []
        for node in gltf.nodes:
            if node.mesh is None:
                continue
            mesh = gltf.meshes[node.mesh]
            transform = node_transform(node)
            for primitive in mesh.primitives:
                position_accessor = getattr(primitive.attributes, "POSITION", None)
                if position_accessor is None:
                    continue
                positions = read_accessor_vec3(gltf, blob, position_accessor)
                if positions.size:
                    homogeneous = np.c_[positions, np.ones(len(positions))]
                    world = (homogeneous @ transform.T)[:, :3] * 1000.0
                    all_points.append(world)
        if not all_points:
            return []
        cloud = np.concatenate(all_points, axis=0)
        return centerline_from_point_cloud(cloud)
    except Exception as exc:
        print(f"[scope] warning: could not parse {path.name}: {exc}")
        return []


def read_accessor_vec3(gltf: Any, blob: bytes, accessor_index: int) -> np.ndarray:
    accessor = gltf.accessors[accessor_index]
    if accessor.type != "VEC3" or accessor.componentType != 5126:
        return np.empty((0, 3), dtype=np.float64)
    buffer_view = gltf.bufferViews[accessor.bufferView]
    offset = (buffer_view.byteOffset or 0) + (accessor.byteOffset or 0)
    stride = buffer_view.byteStride or 12
    points = np.zeros((accessor.count, 3), dtype=np.float64)
    for index in range(accessor.count):
        points[index] = struct.unpack_from("<fff", blob, offset + index * stride)
    return points


def node_transform(node: Any) -> np.ndarray:
    if node.matrix:
        return np.asarray(node.matrix, dtype=np.float64).reshape(4, 4).T
    transform = np.eye(4, dtype=np.float64)
    if node.scale:
        transform = transform @ np.diag([*node.scale, 1.0])
    if node.rotation:
        transform = transform @ quaternion_matrix(node.rotation)
    if node.translation:
        transform[:3, 3] = np.asarray(node.translation, dtype=np.float64)
    return transform


def quaternion_matrix(q: list[float]) -> np.ndarray:
    x, y, z, w = q
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
            [0, 0, 0, 1],
        ],
        dtype=np.float64,
    )


def centerline_from_point_cloud(points: np.ndarray, bins: int = 240) -> list[list[float]]:
    if len(points) < 20:
        return []
    centroid = points.mean(axis=0)
    centered = points - centroid
    _, _, vh = np.linalg.svd(centered, full_matrices=False)
    axis = vh[0]
    t = centered @ axis
    edges = np.linspace(float(t.min()), float(t.max()), bins + 1)
    bin_ids = np.clip(np.digitize(t, edges) - 1, 0, bins - 1)
    polyline = []
    for bin_id in range(bins):
        mask = bin_ids == bin_id
        if mask.any():
            polyline.append(points[mask].mean(axis=0).astype(float).tolist())
    return polyline


def fallback_route_from_graph(graph: dict[str, Any]) -> list[list[float]]:
    node_by_id = {node["id"]: node for node in graph["nodes"]}
    edge_by_id = {edge["id"]: edge for edge in graph["edges"]}
    terminals = [node_by_id[node_id] for node_id in graph["terminalNodeIds"] if node_id in node_by_id]
    if not terminals:
        return []
    terminal = max(terminals, key=lambda node: node.get("rootDistanceMm", 0))
    edges = []
    node = terminal
    while node.get("parentEdgeId") is not None:
        edge = edge_by_id.get(node["parentEdgeId"])
        if edge is None:
            break
        edges.append(edge)
        parent_id = node.get("parentNodeId")
        if parent_id is None:
            break
        node = node_by_id[parent_id]
    points: list[list[float]] = []
    for edge in reversed(edges):
        edge_points = edge["pointsLps"]
        if points and edge_points and distance(points[-1], edge_points[0]) < 0.001:
            points.extend(edge_points[1:])
        else:
            points.extend(edge_points)
    return resample_polyline(points, target_count=max(80, len(points)))


def build_carm_assets(source_dir: Path, case_dir: Path, asset_base: str) -> dict[str, Any] | None:
    scene_dir = source_dir / "Slicerheart" / "C_arm_CT_only"
    if not scene_dir.exists():
        return None
    carm_dir = case_dir / "carm"
    gantry_uri = None
    try:
        gantry_path = carm_dir / "carm_gantry.glb"
        convert_vtks_to_glb(scene_dir, gantry_path)
        gantry_uri = f"{asset_base}/carm/{gantry_path.name}"
    except Exception as exc:
        print(f"[carm] warning: VTK to GLB conversion skipped: {exc}")

    transforms = []
    sid = 800.0
    for transform_id, file_name in H5_TRANSFORMS.items():
        h5_path = scene_dir / file_name
        if not h5_path.exists():
            continue
        matrix, fixed = read_h5_transform(h5_path)
        if transform_id == "frontal-camera-to-detector" and len(fixed) >= 3:
            sid = abs(float(fixed[2])) or sid
        transforms.append(
            {
                "id": transform_id,
                "matrixLpsFromParent": matrix.reshape(-1).astype(float).tolist(),
            }
        )
    sad = sid * 0.75
    c_arm = {
        "coordinateSystem": "LPS",
        "sadMm": round(float(sad), 3),
        "sidMm": round(float(sid), 3),
        "detectorPixelPitchMm": 0.5,
        "detectorPixels": [1024, 1024],
        "detectorSizeMm": [512.0, 512.0],
        "rest": {
            "armLDeg": -90.0,
            "armPDeg": 0.0,
            "armCDeg": 0.0,
            "detectorRotationDeg": 90.0,
            "tableShiftMm": [0.0, -15.0, 0.0],
        },
        "transforms": transforms,
    }
    if gantry_uri:
        c_arm["gantryGlbUri"] = gantry_uri
    animation_glb = source_dir / "C_arm_animation.glb"
    if animation_glb.exists():
        animation_output = carm_dir / "c_arm_animation.glb"
        copy_untextured_carm_animation(animation_glb, animation_output)
        c_arm["animationGlbUri"] = f"{asset_base}/carm/{animation_output.name}?v=untextured-1"
        print(f"[carm] copied animated C-arm GLB -> {animation_output.name}")
    write_json(carm_dir / "carm_manifest.json", c_arm)
    return c_arm


def copy_untextured_carm_animation(source_path: Path, output_path: Path) -> None:
    """Strip embedded texture references while preserving mesh and animation tracks."""
    if pygltflib is None:
        shutil.copy2(source_path, output_path)
        print("[carm] warning: pygltflib unavailable; copied animated C-arm with original textures.")
        return

    gltf = pygltflib.GLTF2().load_binary(str(source_path))
    palette = (
        (0.78, 0.78, 0.70, 1.0),
        (0.66, 0.70, 0.70, 1.0),
        (0.35, 0.50, 0.56, 1.0),
    )
    for index, material in enumerate(gltf.materials or []):
        if material.pbrMetallicRoughness is None:
            material.pbrMetallicRoughness = pygltflib.PbrMetallicRoughness()
        material.pbrMetallicRoughness.baseColorTexture = None
        material.pbrMetallicRoughness.metallicRoughnessTexture = None
        material.pbrMetallicRoughness.baseColorFactor = list(palette[index % len(palette)])
        material.pbrMetallicRoughness.metallicFactor = 0.25
        material.pbrMetallicRoughness.roughnessFactor = 0.58
        material.normalTexture = None
        material.occlusionTexture = None
        material.emissiveTexture = None
        material.emissiveFactor = [0.0, 0.0, 0.0]
    gltf.textures = []
    gltf.images = []
    gltf.samplers = []
    gltf.save_binary(str(output_path))


def convert_vtks_to_glb(scene_dir: Path, output_path: Path) -> None:
    scene = trimesh.Scene()
    added = 0
    for mesh_name, file_name in VTK_PARTS:
        vtk_path = scene_dir / file_name
        if not vtk_path.exists():
            continue
        mesh = parse_legacy_vtk_polydata(vtk_path)
        scene.add_geometry(mesh, node_name=mesh_name, geom_name=mesh_name)
        added += 1
    if added == 0:
        raise ValueError("No expected C-arm VTK files were found.")
    output_path.write_bytes(scene.export(file_type="glb"))
    print(f"[carm] converted {added} VTK meshes -> {output_path.name}")


def build_centerline_model_overlay(source_dir: Path) -> dict[str, Any] | None:
    vtk_path = source_dir / "Centerline" / "Centerline model_2.vtk"
    if not vtk_path.exists():
        return None
    try:
        raw_polylines = parse_legacy_vtk_lines(vtk_path)
    except Exception as exc:
        print(f"[airway] warning: could not parse {vtk_path.name}; using graph overlay: {exc}")
        return None
    polylines = []
    all_points: list[list[float]] = []
    for index, points in enumerate(raw_polylines):
        length = polyline_length(points)
        if length <= 1:
            continue
        target_count = int(max(24, min(180, math.ceil(length / 2.0) + 1)))
        sampled = [
            [round(float(value), 3) for value in point]
            for point in resample_polyline(points, target_count)
        ]
        all_points.extend(sampled)
        polylines.append(
            {
                "id": f"centerline-model-{index}",
                "label": f"Centerline model route {index + 1}",
                "pointsLps": sampled,
                "lengthMm": round(length, 3),
            }
        )
    if not polylines:
        return None
    points_array = np.asarray(all_points, dtype=np.float64)
    print(
        f"[airway] centerline overlay from {vtk_path.name}: "
        f"{len(polylines)} routes, {len(all_points)} sampled points"
    )
    return {
        "schema": "fluoroview_centerline_overlay/v2",
        "units": "mm",
        "coordinateSystem": "LPS",
        "source": vtk_path.name,
        "sourceRole": "patient-specific Slicer centerline model",
        "boundsLpsMm": [
            [round(float(value), 3) for value in points_array.min(axis=0)],
            [round(float(value), 3) for value in points_array.max(axis=0)],
        ],
        "rawPolylineCount": len(raw_polylines),
        "sampledPointCount": len(all_points),
        "polylines": polylines,
    }


def parse_legacy_vtk_polydata(path: Path) -> trimesh.Trimesh:
    raw = path.read_bytes()
    header = raw.splitlines()[:4]
    if b"BINARY" not in header[2] or b"POLYDATA" not in header[3]:
        raise ValueError(f"{path.name} is not binary POLYDATA.")
    points, cursor = parse_vtk_points(raw, path)
    section = first_vtk_section(raw, cursor, [b"POLYGONS", b"TRIANGLE_STRIPS"])
    if section is None:
        raise ValueError(f"No mesh topology parsed from {path.name}.")
    section_name, section_cursor = section
    line, cursor = read_vtk_line(raw, section_cursor)
    parts = line.strip().split()
    face_count = int(parts[1])
    int_count = int(parts[2])
    data = np.frombuffer(raw[cursor:cursor + int_count * 4], dtype=">i4")
    triangles = []
    index = 0
    for _ in range(face_count):
        item_count = int(data[index])
        item_indices = data[index + 1:index + 1 + item_count].astype(int).tolist()
        index += item_count + 1
        for tri_index in range(1, item_count - 1):
            if section_name == "TRIANGLE_STRIPS" and tri_index % 2 == 0:
                triangles.append(
                    [item_indices[0], item_indices[tri_index + 1], item_indices[tri_index]]
                )
            else:
                triangles.append([item_indices[0], item_indices[tri_index], item_indices[tri_index + 1]])
    faces = np.asarray(triangles, dtype=np.int64)
    if len(faces) == 0:
        raise ValueError(f"No mesh geometry parsed from {path.name}.")
    return trimesh.Trimesh(vertices=points, faces=faces, process=False)


def parse_legacy_vtk_lines(path: Path) -> list[list[list[float]]]:
    raw = path.read_bytes()
    header = raw.splitlines()[:4]
    if b"BINARY" not in header[2] or b"POLYDATA" not in header[3]:
        raise ValueError(f"{path.name} is not binary POLYDATA.")
    points, cursor = parse_vtk_points(raw, path)
    section = first_vtk_section(raw, cursor, [b"LINES"])
    if section is None:
        raise ValueError(f"No line topology parsed from {path.name}.")
    _, section_cursor = section
    line, cursor = read_vtk_line(raw, section_cursor)
    parts = line.strip().split()
    line_count = int(parts[1])
    int_count = int(parts[2])
    data = np.frombuffer(raw[cursor:cursor + int_count * 4], dtype=">i4").astype(np.int64)
    polylines: list[list[list[float]]] = []
    index = 0
    for _ in range(line_count):
        point_count = int(data[index])
        indices = data[index + 1:index + 1 + point_count]
        index += point_count + 1
        if point_count >= 2:
            polylines.append(points[indices].astype(float).tolist())
    return polylines


def parse_vtk_points(raw: bytes, path: Path) -> tuple[np.ndarray, int]:
    token_index = raw.find(b"\nPOINTS ")
    if token_index == -1:
        raise ValueError(f"No POINTS section parsed from {path.name}.")
    line, cursor = read_vtk_line(raw, token_index + 1)
    parts = line.strip().split()
    count = int(parts[1])
    dtype = ">f4" if parts[2].lower() == "float" else ">f8"
    byte_count = count * 3 * np.dtype(dtype).itemsize
    points = np.frombuffer(raw[cursor:cursor + byte_count], dtype=dtype).astype(np.float32)
    points = points.reshape(count, 3)
    cursor += byte_count
    if cursor < len(raw) and raw[cursor:cursor + 1] == b"\n":
        cursor += 1
    return points, cursor


def first_vtk_section(raw: bytes, start: int, names: list[bytes]) -> tuple[str, int] | None:
    matches: list[tuple[int, bytes]] = []
    for name in names:
        for prefix in [b"\n" + name + b" ", name + b" "]:
            index = raw.find(prefix, start)
            if index != -1:
                matches.append((index + (1 if prefix.startswith(b"\n") else 0), name))
                break
    if not matches:
        return None
    cursor, name = min(matches, key=lambda item: item[0])
    return name.decode("ascii"), cursor


def read_vtk_line(raw: bytes, cursor: int) -> tuple[str, int]:
    end = raw.index(b"\n", cursor)
    line = raw[cursor:end].decode("ascii", errors="replace")
    return line, end + 1


def read_h5_transform(path: Path) -> tuple[np.ndarray, np.ndarray]:
    with h5py.File(path, "r") as handle:
        params = np.asarray(handle["TransformGroup/0/TransformParameters"][()], dtype=np.float64)
        fixed = np.asarray(handle["TransformGroup/0/TransformFixedParameters"][()], dtype=np.float64)
    matrix = np.eye(4, dtype=np.float64)
    matrix[:3, :3] = params[:9].reshape(3, 3)
    matrix[:3, 3] = params[9:12]
    return matrix, fixed


def build_slicerheart_reference(source_dir: Path, case_dir: Path, asset_base: str) -> dict[str, Any] | None:
    scene_dir = source_dir / "Slicerheart" / "C_arm_CT_only"
    nrrd_path = scene_dir / "CArmFrontalXRay.nrrd"
    mrml_path = scene_dir / "2026-05-21-Scene.mrml"
    if not nrrd_path.exists() or not mrml_path.exists():
        return None
    frame = read_uint8_nrrd_image(nrrd_path)
    image_path = case_dir / "virtual-cath-lab" / "slicerheart_frontal_reference.png"
    Image.frombytes("L", frame["size"], frame["pixels"]).save(image_path)
    preset = load_rendering_preset(scene_dir / "FluoroRenderingPreset_02.vp.json")
    projection = extract_slicer_projection(mrml_path, frame)
    scene_manifest = {
        "schema": "fluoroview_slicer_c_arm_scene/v1",
        "source": "SlicerHeart Virtual Cath Lab scene export",
        "ingestedUtc": datetime.now(timezone.utc).isoformat(),
        "sourceFiles": {
            "mrml": mrml_path.name,
            "frontalNrrd": nrrd_path.name,
            "lateralNrrd": "CArmLateralXRay.nrrd",
            "renderingPreset": "FluoroRenderingPreset_02.vp.json",
        },
        "coordinateSystems": {"slicerScene": "RAS", "fluoroView": "LPS"},
        "frames": [
            {
                "id": "slicerheart-frontal-reference",
                "view": "frontal",
                "imageUrl": f"{asset_base}/virtual-cath-lab/{image_path.name}",
                "relativePath": f"virtual-cath-lab/{image_path.name}",
                "sourceFileName": nrrd_path.name,
                "sourceSha256": sha256(nrrd_path),
                "sha256": sha256(image_path),
                "dimensionsIJK": [frame["size"][0], frame["size"][1], 1],
                "spacingIJKMm": [frame["spacing"][0], frame["spacing"][1], 1.0],
                "detectorSizeMm": [
                    round(frame["size"][0] * frame["spacing"][0], 6),
                    round(frame["size"][1] * frame["spacing"][1], 6),
                ],
                "encoding": frame["header"].get("encoding"),
                "space": frame["header"].get("space"),
            }
        ],
        "frontalProjection": projection,
        "renderingPreset": preset,
        "qualityNotes": [
            "Derived SlicerHeart C-arm reference frame; raw NRRD/H5/VTK/MRML files remain local.",
            "Use as calibration evidence and optional frontal reference, not diagnostic imaging.",
        ],
    }
    manifest_path = case_dir / "metadata" / "slicer_c_arm_scene_manifest.json"
    write_json(manifest_path, scene_manifest)
    return {
        "source": "SlicerHeart Virtual Cath Lab",
        "status": "scene-export",
        "manifestUrl": f"{asset_base}/metadata/{manifest_path.name}",
        "sceneManifestUrl": f"{asset_base}/metadata/{manifest_path.name}",
        "frontalImageUrl": f"{asset_base}/virtual-cath-lab/{image_path.name}",
        "frontalDetectorPixels": [frame["size"][0], frame["size"][1]],
        "frontalDetectorSizeMm": scene_manifest["frames"][0]["detectorSizeMm"],
        "frontalPixelSpacingMm": [frame["spacing"][0], frame["spacing"][1]],
        "coordinateSystem": "RAS",
        "sourceImageIncludesModel": True,
        "frontalProjection": projection,
        "renderingPreset": preset,
        "note": "SlicerHeart frontal reference is available for calibration comparison.",
    }


def read_uint8_nrrd_image(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    header_blob, payload = data.split(b"\n\n", 1)
    header = parse_nrrd_header(header_blob.decode("utf-8", errors="replace"))
    sizes = [int(part) for part in header["sizes"].split()]
    encoding = header.get("encoding", "raw").lower()
    pixels = gzip.decompress(payload) if encoding == "gzip" else payload
    expected = sizes[0] * sizes[1] * sizes[2]
    spacing = parse_space_directions(header.get("space directions", ""))
    return {
        "pixels": pixels[:expected],
        "size": (sizes[0], sizes[1]),
        "spacing": (spacing[0], spacing[1]),
        "header": header,
    }


def parse_nrrd_header(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        fields[key.strip()] = value.strip()
    return fields


def parse_space_directions(value: str) -> tuple[float, float, float]:
    vectors = []
    for chunk in value.split(")"):
        if "(" not in chunk:
            continue
        parts = chunk.split("(", 1)[1].split(",")
        try:
            vectors.append(tuple(float(part.strip()) for part in parts))
        except ValueError:
            pass
    spacing = [math.sqrt(sum(component * component for component in vector)) for vector in vectors]
    while len(spacing) < 3:
        spacing.append(1.0)
    return (spacing[0], spacing[1], spacing[2])


def extract_slicer_projection(mrml_path: Path, frame: dict[str, Any]) -> dict[str, Any]:
    root = ET.parse(mrml_path).getroot()
    camera = next((node for node in root.iter("Camera") if node.get("singletonTag") == "CArmFrontal"), None)
    if camera is None:
        return {
            "coordinateSystem": "RAS",
            "positionRasMm": [0, -400, 0],
            "focalPointRasMm": [0, 0, 0],
            "viewUpRas": [0, 0, 1],
            "sourceToImageDistanceMm": 800,
            "detectorPixels": [frame["size"][0], frame["size"][1]],
            "detectorSizeMm": [frame["size"][0] * frame["spacing"][0], frame["size"][1] * frame["spacing"][1]],
        }
    return {
        "coordinateSystem": "RAS",
        "positionRasMm": parse_number_list(camera.get("position", "")),
        "focalPointRasMm": parse_number_list(camera.get("focalPoint", "")),
        "viewUpRas": parse_number_list(camera.get("viewUp", "")),
        "sourceToImageDistanceMm": parse_attributes(camera.get("attributes")).get(
            "VirtualCathLab.SourceToImageDistance",
            800,
        ),
        "detectorPixels": [frame["size"][0], frame["size"][1]],
        "detectorSizeMm": [frame["size"][0] * frame["spacing"][0], frame["size"][1] * frame["spacing"][1]],
        "pixelSpacingMm": [frame["spacing"][0], frame["spacing"][1]],
        "viewAngleDeg": float(camera.get("viewAngle")) if camera.get("viewAngle") else None,
    }


def parse_attributes(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    out = {}
    for item in value.split(";"):
        if ":" not in item:
            continue
        key, raw = item.split(":", 1)
        out[key] = parse_number_list(raw.strip())
    return out


def parse_number_list(value: str) -> Any:
    parts = value.split()
    if not parts:
        return []
    try:
        values = [float(part) for part in parts]
    except ValueError:
        return value
    if len(values) == 1:
        return values[0]
    return values


def load_rendering_preset(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    preset = json.loads(path.read_text(encoding="utf-8"))
    props = preset.get("volumeProperties", [])
    if not props:
        return {"sourceFileName": path.name, "sha256": sha256(path)}
    component = props[0].get("components", [{}])[0]
    return {
        "sourceFileName": path.name,
        "sha256": sha256(path),
        "effectiveRange": props[0].get("effectiveRange"),
        "scalarOpacity": component.get("scalarOpacity", {}).get("points", []),
        "rgbTransferFunction": component.get("rgbTransferFunction", {}).get("points", []),
    }


def source_depth_to_lps_point(projection: dict[str, Any], point_lps: list[float]) -> float | None:
    try:
        source_ras = np.asarray(projection["positionRasMm"], dtype=np.float64)
        focal_ras = np.asarray(projection["focalPointRasMm"], dtype=np.float64)
        point_ras = np.asarray([-point_lps[0], -point_lps[1], point_lps[2]], dtype=np.float64)
        forward = focal_ras - source_ras
        norm = np.linalg.norm(forward)
        if norm < 1e-8:
            return None
        forward = forward / norm
        depth = float(np.dot(point_ras - source_ras, forward))
        return abs(depth) if math.isfinite(depth) and abs(depth) > 1e-6 else None
    except (KeyError, TypeError, ValueError, IndexError):
        return None


def build_case_manifest(
    *,
    case_dir: Path,
    asset_base: str,
    ct: CtExport,
    graph: dict[str, Any],
    airway_provenance: dict[str, Any],
    scope_path: dict[str, Any],
    c_arm: dict[str, Any] | None,
    virtual_cath_lab: dict[str, Any] | None,
) -> dict[str, Any]:
    carina = graph.get("carinaLpsMm", [0, 0, 0])
    sad = c_arm.get("sadMm", 600.0) if c_arm else 600.0
    sid = c_arm.get("sidMm", 1200.0) if c_arm else 1200.0
    detector_pixels = c_arm.get("detectorPixels", [1024, 1024]) if c_arm else [1024, 1024]
    pixel_pitch = c_arm.get("detectorPixelPitchMm", 0.3) if c_arm else 0.3
    volume = dict(ct.volume_asset)
    volume.pop("schema", None)
    volume.pop("source", None)
    if virtual_cath_lab and virtual_cath_lab.get("frontalProjection"):
        projection = virtual_cath_lab["frontalProjection"]
        detector_pixels = projection.get(
            "detectorPixels",
            virtual_cath_lab.get("frontalDetectorPixels", detector_pixels),
        )
        detector_size = projection.get("detectorSizeMm") or virtual_cath_lab.get(
            "frontalDetectorSizeMm"
        )
        pixel_spacing = projection.get("pixelSpacingMm") or virtual_cath_lab.get(
            "frontalPixelSpacingMm"
        )
        if pixel_spacing:
            pixel_pitch = float(pixel_spacing[0])
        elif detector_size and detector_pixels:
            pixel_pitch = float(detector_size[0]) / max(float(detector_pixels[0]), 1.0)
        sid = float(projection.get("sourceToImageDistanceMm", sid))
        sad = source_depth_to_lps_point(projection, carina) or sad
        volume["calibrationProjection"] = projection
        if virtual_cath_lab.get("renderingPreset"):
            preset = virtual_cath_lab["renderingPreset"]
            volume["transferFunction"] = {
                "scalarOpacity": [
                    {"x": point["x"], "y": point["y"]}
                    for point in preset.get("scalarOpacity", [])
                    if "x" in point and "y" in point
                ],
                "rgbTransferFunction": [
                    {"x": point["x"], "color": point["color"]}
                    for point in preset.get("rgbTransferFunction", [])
                    if "x" in point and "color" in point
                ],
            }
    manifest = {
        "id": "patient-new-volume-drr",
        "title": "New Patient Educational FluoroView Case",
        "version": "0.3.0",
        "safetyLabel": SAFETY_LABEL,
        "description": "Educational FluoroView case with browser-side WebGL2 volume DRR.",
        "sourcePolicy": (
            "Raw DICOM/NIfTI/NRRD/MRML/H5/VTK/segmentation files remain local and untracked. "
            "Only derived PNG, JSON, GLB, and uint8 RAW browser assets are published."
        ),
        "assetBaseUrl": asset_base,
        "geometry": {
            "units": "mm",
            "coordinateSystem": "LPS",
            "isocenter_mm": carina,
            "source_to_isocenter_mm": sad,
            "source_to_detector_mm": sid,
            "detector_pixels": detector_pixels,
            "pixel_pitch_mm": pixel_pitch,
            "asset_base_url": "/fluoroview",
            "default_view": {"rao_lao_deg": 0, "cranial_caudal_deg": 0},
            "overlay_calibration": {
                "method": "centerline-carina",
                "carina_lps_mm": carina,
                "target_detector_percent": [50, 50],
                "note": "New-patient overlay anchored on the airway graph carina.",
            },
        },
        "assets": {
            "airwayGlb": f"{asset_base}/airway_segments.glb?v=untextured-1",
            "airwaySegmentsGlb": f"{asset_base}/airway_segments.glb?v=untextured-1",
            "airwayGraphJson": f"{asset_base}/metadata/airway_graph.json",
            "ctVolumePreview": f"{asset_base}/ct/ct_preview_uint8.raw",
            "virtualCathLabManifest": f"{asset_base}/metadata/slicer_c_arm_scene_manifest.json"
            if virtual_cath_lab
            else None,
            "virtualCathLabSceneManifest": f"{asset_base}/metadata/slicer_c_arm_scene_manifest.json"
            if virtual_cath_lab
            else None,
            "virtualCathLabFrontalImage": virtual_cath_lab.get("frontalImageUrl")
            if virtual_cath_lab
            else None,
            "dracoBaseUrl": "/fluoroview/draco",
            "centerlineJson": f"{asset_base}/metadata/centerline_overlay.json",
            "segmentMetadataJson": f"{asset_base}/metadata/segments.json",
            "assetTransforms": {
                "airway": {
                    "sceneScale": 1000,
                    "rotationDeg": [90, 0, 0],
                    "positionOffsetMm": [0, 0, 0],
                    "note": "Slicer GLB stores scene coordinates in meters with local X, slice/Z, -Y axes; rotate +90 deg about X and scale to LPS millimeters.",
                }
            },
        },
        "ctVolume": ct.preview_asset,
        "interaction": {
            "noduleRadiusMm": 6.0,
            "snapRadiusMm": 4.0,
            "defaultScopeProgress": 0.45,
            "defaultRouteTerminalNodeId": (graph.get("terminalNodeIds") or [0])[0],
            "source": "fluoroview-pipeline",
        },
        "volumeDrr": volume,
        "cArm": c_arm,
        "scopeAnimation": {
            "polylineJsonUri": f"{asset_base}/metadata/bronch_animation_path.json",
            "defaultRouteId": "bezier-demo",
            "tubeRadiusMm": 2.5,
            "tubeColor": "#111111",
        },
        "virtualCathLab": virtual_cath_lab,
        "ctSlices": {
            "windowPresets": [
                {"id": "lung", "label": "Lung", "low": -1000, "high": -300},
                {"id": "softTissue", "label": "Soft tissue", "low": -160, "high": 240},
                {"id": "bone", "label": "Bone", "low": 200, "high": 2000},
            ],
            "axes": {
                "axial": {"label": "Axial", "defaultIndex": TARGET_SIZE_XYZ[2] // 2, "frames": []},
                "coronal": {"label": "Coronal", "defaultIndex": TARGET_SIZE_XYZ[1] // 2, "frames": []},
                "sagittal": {"label": "Sagittal", "defaultIndex": TARGET_SIZE_XYZ[0] // 2, "frames": []},
            },
        },
        "provenance": {
            **ct.provenance,
            **airway_provenance,
            "scopePathSource": scope_path["source"],
            "generatedUtc": datetime.now(timezone.utc).isoformat(),
        },
        "lessons": [
            {
                "id": "new-patient-ap-review",
                "title": "AP Fluoroscopy Review",
                "objective": "Correlate the airway graph with the AP volumetric DRR.",
                "task": "Set the C-arm to AP, toggle centerline and labels, and advance the scope route.",
            },
            {
                "id": "new-patient-oblique-review",
                "title": "Oblique C-arm Exploration",
                "objective": "Observe how airway projection changes as RAO/LAO and cranial/caudal angles move.",
                "task": "Drag the C-arm sliders and compare the fluoro view with the 3D anatomy viewport.",
            },
        ],
    }
    manifest["assets"] = {key: value for key, value in manifest["assets"].items() if value is not None}
    if c_arm is None:
        manifest.pop("cArm", None)
    if virtual_cath_lab is None:
        manifest.pop("virtualCathLab", None)
    return manifest


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def polyline_length(points: list[list[float]]) -> float:
    return sum(distance(points[index - 1], points[index]) for index in range(1, len(points)))


def distance(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((float(a[index]) - float(b[index])) ** 2 for index in range(3)))


def resample_polyline(points: list[list[float]], target_count: int) -> list[list[float]]:
    if len(points) < 2:
        return points
    lengths = [0.0]
    for index in range(1, len(points)):
        lengths.append(lengths[-1] + distance(points[index - 1], points[index]))
    total = lengths[-1]
    if total <= 0:
        return points
    samples = np.linspace(0, total, target_count)
    out = []
    cursor = 1
    for sample in samples:
        while cursor < len(lengths) - 1 and lengths[cursor] < sample:
            cursor += 1
        prev_len = lengths[cursor - 1]
        next_len = lengths[cursor]
        t = 0 if next_len == prev_len else (sample - prev_len) / (next_len - prev_len)
        prev = np.asarray(points[cursor - 1], dtype=np.float64)
        nxt = np.asarray(points[cursor], dtype=np.float64)
        out.append((prev + (nxt - prev) * t).astype(float).tolist())
    return out


def folder_size_mb(path: Path) -> float:
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file()) / (1024 * 1024)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
