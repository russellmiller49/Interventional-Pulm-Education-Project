#!/usr/bin/env python3
"""Generate and content-hash the public rigid-bronchoscopy v2 asset set.

This script authors the generic central airway and clearly marked teaching
proxies, then packages the existing Blender-generated EFER component GLBs
without modifying their bytes. Do not edit generated GLBs by hand.
"""

from __future__ import annotations

import hashlib
import json
import platform
import shutil
import struct
import sys
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

from v2_asset_common import (
    AIRWAY_MODEL,
    CARINA_WORLD,
    MM_TO_METERS,
    PROCEDURAL_POSES,
    SEMANTIC_ANCHORS,
    WORLD_UNITS_PER_MM,
    make_airway_surfaces,
    pose_clearance_mm,
    validate_pose_axes,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ASSEMBLY_DIR = REPO_ROOT / "public" / "models" / "rigid-bronchoscopy" / "assembly"
SOURCE_COMPONENT_DIR = SOURCE_ASSEMBLY_DIR / "components"
OUTPUT_DIR = REPO_ROOT / "public" / "models" / "rigid-bronchoscopy" / "v2"
MANIFEST_PATH = OUTPUT_DIR / "asset-manifest.json"
VALIDATION_REPORT_PATH = OUTPUT_DIR / "validation-report.json"
BLENDER_VALIDATION_REPORT_PATH = OUTPUT_DIR / "blender-import-validation.json"

HOOD_ORDERING_URL = "https://hoodlabs.com/efer-bronchoscope-ordering-information/"
HOOD_USER_MANUAL_URL = (
    "https://hoodlabs.com/wp-content/uploads/EFER-BRONCHOSCOPE-USER-MANUAL.pdf"
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def web_path(path: Path) -> str:
    return "/" + str(path.relative_to(REPO_ROOT / "public"))


def rounded(values: Any, digits: int = 6) -> Any:
    array = np.asarray(values, dtype=float)
    return np.round(array, digits).tolist()


def glb_primitive_attributes(path: Path) -> list[set[str]]:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"Not a binary glTF file: {path}")
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
        raise ValueError(f"GLB lacks a JSON chunk: {path}")
    return [
        set(primitive.get("attributes", {}))
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]


def pbr(
    name: str,
    rgba: tuple[int, int, int, int],
    *,
    metallic: float,
    roughness: float,
    double_sided: bool = False,
) -> PBRMaterial:
    return PBRMaterial(
        name=name,
        baseColorFactor=list(rgba),
        metallicFactor=metallic,
        roughnessFactor=roughness,
        doubleSided=double_sided,
        alphaMode="BLEND" if rgba[3] < 255 else "OPAQUE",
    )


AIRWAY_OUTER_MATERIAL = pbr(
    "Airway outer wall",
    (185, 105, 96, 255),
    metallic=0.0,
    roughness=0.76,
    double_sided=True,
)
AIRWAY_INNER_MATERIAL = pbr(
    "Airway inner lumen",
    (222, 151, 139, 255),
    metallic=0.0,
    roughness=0.68,
    double_sided=True,
)
ANESTHESIA_HOSE_MATERIAL = pbr(
    "Translucent anesthesia circuit hose",
    (128, 196, 220, 210),
    metallic=0.0,
    roughness=0.42,
    double_sided=True,
)
JET_HOSE_MATERIAL = pbr(
    "Jet hose blue polymer",
    (35, 114, 205, 255),
    metallic=0.0,
    roughness=0.5,
    double_sided=True,
)
CONNECTOR_MATERIAL = pbr(
    "Connector polymer",
    (220, 226, 229, 255),
    metallic=0.08,
    roughness=0.38,
    double_sided=True,
)
RED_CAP_MATERIAL = pbr(
    "EFER red cap proxy",
    (178, 28, 39, 255),
    metallic=0.0,
    roughness=0.55,
    double_sided=True,
)
BLUE_CAP_MATERIAL = pbr(
    "EFER blue cap proxy",
    (32, 92, 174, 255),
    metallic=0.0,
    roughness=0.55,
    double_sided=True,
)
STAINLESS_TOOL_MATERIAL = pbr(
    "Stainless steel teaching proxy",
    (151, 164, 174, 255),
    metallic=0.9,
    roughness=0.2,
    double_sided=True,
)
RED_TOOL_MATERIAL = pbr(
    "Red stent-system identification collar",
    (177, 27, 40, 255),
    metallic=0.05,
    roughness=0.48,
    double_sided=True,
)


def assign_material(mesh: trimesh.Trimesh, material: PBRMaterial) -> trimesh.Trimesh:
    mesh = mesh.copy()
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh


def scene_with_named_meshes(
    entries: list[tuple[str, trimesh.Trimesh, PBRMaterial]],
) -> trimesh.Scene:
    scene = trimesh.Scene()
    for name, mesh, material in entries:
        scene.add_geometry(
            assign_material(mesh, material),
            node_name=name,
            geom_name=f"{name}_Mesh",
        )
    return scene


def geometry_stats(path: Path) -> dict[str, Any]:
    scene = trimesh.load(path, force="scene")
    meshes = [geometry for geometry in scene.geometry.values() if isinstance(geometry, trimesh.Trimesh)]
    material_names = sorted(
        {
            str(getattr(getattr(mesh.visual, "material", None), "name", ""))
            for mesh in meshes
            if getattr(mesh.visual, "material", None) is not None
        }
    )
    primitive_attributes = glb_primitive_attributes(path)
    return {
        "meshCount": len(meshes),
        "triangleCount": int(sum(len(mesh.faces) for mesh in meshes)),
        "boundsMm": {
            "min": rounded(scene.bounds[0] / MM_TO_METERS, 3),
            "max": rounded(scene.bounds[1] / MM_TO_METERS, 3),
            "size": rounded(scene.extents / MM_TO_METERS, 3),
        },
        "semanticNodes": sorted(scene.graph.nodes_geometry),
        "materialNames": material_names,
        "allWindingConsistent": all(mesh.is_winding_consistent for mesh in meshes),
        "allFinite": all(np.isfinite(mesh.vertices).all() for mesh in meshes),
        "allPrimitivesHaveVertexNormals": bool(primitive_attributes)
        and all("NORMAL" in attributes for attributes in primitive_attributes),
    }


def write_hashed_glb(
    scene: trimesh.Scene,
    directory: Path,
    stem: str,
) -> tuple[Path, str]:
    directory.mkdir(parents=True, exist_ok=True)
    data = scene.export(file_type="glb", include_normals=True, unitize_normals=True)
    if not isinstance(data, bytes):
        raise TypeError(f"Expected GLB bytes for {stem}, got {type(data)!r}")
    digest = sha256_bytes(data)
    output_path = directory / f"{stem}-{digest[:12]}.glb"
    output_path.write_bytes(data)
    return output_path, digest


def copy_hashed_glb(source: Path, directory: Path) -> tuple[Path, str]:
    directory.mkdir(parents=True, exist_ok=True)
    digest = sha256_file(source)
    destination = directory / f"{source.stem}-{digest[:12]}.glb"
    shutil.copyfile(source, destination)
    return destination, digest


def airway_assets() -> tuple[list[dict[str, Any]], trimesh.Trimesh]:
    surfaces = make_airway_surfaces()
    full_scene = scene_with_named_meshes(
        [
            ("Airway_Outer_Wall", surfaces["outerSurface"], AIRWAY_OUTER_MATERIAL),
            ("Airway_Inner_Lumen", surfaces["innerSurface"], AIRWAY_INNER_MATERIAL),
        ]
    )
    cutaway_scene = scene_with_named_meshes(
        [
            (
                "Airway_Cutaway_Outer_Wall",
                surfaces["cutawayOuterSurface"],
                AIRWAY_OUTER_MATERIAL,
            ),
            (
                "Airway_Cutaway_Inner_Lumen",
                surfaces["cutawayInnerSurface"],
                AIRWAY_INNER_MATERIAL,
            ),
        ]
    )
    records: list[dict[str, Any]] = []
    for asset_id, role, scene, stem in (
        (
            "anatomy-central-airway-full",
            "anatomyFull",
            full_scene,
            "central-airway-full",
        ),
        (
            "anatomy-central-airway-cutaway",
            "anatomyCutaway",
            cutaway_scene,
            "central-airway-cutaway",
        ),
    ):
        path, digest = write_hashed_glb(scene, OUTPUT_DIR / "anatomy", stem)
        records.append(
            {
                "id": asset_id,
                "kind": role,
                "runtime": True,
                "path": web_path(path),
                "sha256": digest,
                "sizeBytes": path.stat().st_size,
                "geometry": geometry_stats(path),
                "provenance": {
                    "sourceType": "public-safe purpose-built educational geometry",
                    "patientDerived": False,
                    "sourceNotes": (
                        "Generic adult central-airway proportions authored for true-scale rigid "
                        "bronchoscopy teaching; not segmented from an individual or intended for planning."
                    ),
                },
                "estimatedFields": [
                    "all airway centerline points",
                    "all airway wall and lumen radii",
                    "carinal blending radii",
                    "surface material appearance",
                ],
            }
        )
    return records, surfaces["innerVolume"]


def hollow_sweep(
    centerline_mm: list[list[float]],
    outer_diameter_mm: float,
    inner_diameter_mm: float,
) -> trimesh.Trimesh:
    from v2_asset_common import sweep

    outer = sweep(centerline_mm, outer_diameter_mm * 0.5)
    extended = deepcopy(centerline_mm)
    start = np.asarray(extended[0], dtype=float)
    next_point = np.asarray(extended[1], dtype=float)
    end = np.asarray(extended[-1], dtype=float)
    previous = np.asarray(extended[-2], dtype=float)
    start_extension = (start - next_point) / np.linalg.norm(start - next_point) * 3.0
    end_extension = (end - previous) / np.linalg.norm(end - previous) * 3.0
    extended[0] = (start + start_extension).tolist()
    extended[-1] = (end + end_extension).tolist()
    inner = sweep(extended, inner_diameter_mm * 0.5)
    shell = trimesh.boolean.difference([outer, inner], engine="manifold", check_volume=True)
    shell.remove_unreferenced_vertices()
    shell.fix_normals()
    return shell


def cylinder_between(
    start_mm: list[float],
    end_mm: list[float],
    radius_mm: float,
    *,
    sections: int = 48,
) -> trimesh.Trimesh:
    start = np.asarray(start_mm, dtype=float) * MM_TO_METERS
    end = np.asarray(end_mm, dtype=float) * MM_TO_METERS
    delta = end - start
    transform = trimesh.geometry.align_vectors([0.0, 0.0, 1.0], delta)
    transform[:3, 3] = (start + end) * 0.5
    return trimesh.creation.cylinder(
        radius=radius_mm * MM_TO_METERS,
        height=float(np.linalg.norm(delta)),
        sections=sections,
        transform=transform,
    )


def hose_asset(
    *,
    asset_id: str,
    stem: str,
    label: str,
    centerline_mm: list[list[float]],
    outer_diameter_mm: float,
    inner_diameter_mm: float,
    connector_outer_diameter_mm: float,
    connector_inner_diameter_mm: float,
    hose_material: PBRMaterial,
    port_id: str,
) -> dict[str, Any]:
    shell = hollow_sweep(centerline_mm, outer_diameter_mm, inner_diameter_mm)
    first = np.asarray(centerline_mm[0], dtype=float)
    second = np.asarray(centerline_mm[1], dtype=float)
    connector_end = first + (second - first) / np.linalg.norm(second - first) * 24.0
    connector_outer = cylinder_between(
        first.tolist(), connector_end.tolist(), connector_outer_diameter_mm * 0.5
    )
    inner_start = (first - (second - first) / np.linalg.norm(second - first) * 2.0).tolist()
    inner_end = (
        connector_end + (second - first) / np.linalg.norm(second - first) * 2.0
    ).tolist()
    connector_inner = cylinder_between(
        inner_start,
        inner_end,
        connector_inner_diameter_mm * 0.5,
    )
    connector = trimesh.boolean.difference(
        [connector_outer, connector_inner], engine="manifold", check_volume=True
    )
    connector.fix_normals()
    scene = scene_with_named_meshes(
        [
            (f"{label}_Hose", shell, hose_material),
            (f"{label}_Connector", connector, CONNECTOR_MATERIAL),
        ]
    )
    path, digest = write_hashed_glb(scene, OUTPUT_DIR / "accessories", stem)
    return {
        "id": asset_id,
        "kind": "ventilationAccessory",
        "runtime": True,
        "path": web_path(path),
        "sha256": digest,
        "sizeBytes": path.stat().st_size,
        "geometry": geometry_stats(path),
        "dimensionsMm": {
            "outerDiameter": outer_diameter_mm,
            "innerDiameter": inner_diameter_mm,
            "connectorOuterDiameter": connector_outer_diameter_mm,
            "connectorInnerDiameter": connector_inner_diameter_mm,
        },
        "anchors": {
            "connector": {
                "positionMm": centerline_mm[0],
                "direction": rounded(
                    (np.asarray(centerline_mm[1]) - np.asarray(centerline_mm[0]))
                    / np.linalg.norm(np.asarray(centerline_mm[1]) - np.asarray(centerline_mm[0])),
                    6,
                ),
                "connectsToPort": port_id,
            }
        },
        "provenance": {
            "sourceType": "manual-supported port function; educational proxy geometry",
            "sourceUrl": HOOD_USER_MANUAL_URL,
        },
        "estimatedFields": [
            "hose length and curvature",
            "hose wall thickness",
            "connector diameter and profile",
            "material appearance",
        ],
    }


def cap_body(openings: list[dict[str, Any]]) -> trimesh.Trimesh:
    body = trimesh.creation.cylinder(radius=12.5 * MM_TO_METERS, height=6.0 * MM_TO_METERS, sections=96)
    bores = []
    for opening in openings:
        bore = trimesh.creation.cylinder(
            radius=opening["diameterMm"] * 0.5 * MM_TO_METERS,
            height=10.0 * MM_TO_METERS,
            sections=48,
        )
        bore.apply_translation(
            [
                opening["centerMm"][0] * MM_TO_METERS,
                opening["centerMm"][1] * MM_TO_METERS,
                0.0,
            ]
        )
        bores.append(bore)
    result = trimesh.boolean.difference([body, *bores], engine="manifold", check_volume=True)
    result.remove_unreferenced_vertices()
    result.fix_normals()
    return result


def stent_introducer_asset() -> dict[str, Any]:
    """Build a deliberately generic, dimensioned stent-introducer proxy."""
    outer = cylinder_between([0.0, 0.0, 0.0], [0.0, 0.0, -450.0], 3.75, sections=64)
    inner = cylinder_between([0.0, 0.0, 3.0], [0.0, 0.0, -453.0], 3.15, sections=64)
    shaft = trimesh.boolean.difference([outer, inner], engine="manifold", check_volume=True)
    shaft.remove_unreferenced_vertices()
    shaft.fix_normals()
    proximal_collar = cylinder_between(
        [0.0, 0.0, 0.0], [0.0, 0.0, 24.0], 10.0, sections=64
    )
    distal_tip = cylinder_between(
        [0.0, 0.0, -442.0], [0.0, 0.0, -450.0], 3.75, sections=64
    )
    scene = scene_with_named_meshes(
        [
            ("Stent_Introducer_Hollow_Shaft", shaft, STAINLESS_TOOL_MATERIAL),
            ("Stent_Introducer_Proximal_Collar", proximal_collar, RED_TOOL_MATERIAL),
            ("Stent_Introducer_Distal_Tip", distal_tip, STAINLESS_TOOL_MATERIAL),
        ]
    )
    path, digest = write_hashed_glb(
        scene,
        OUTPUT_DIR / "accessories",
        "generic-stent-introducer-proxy",
    )
    return {
        "id": "tool-stent-introducer",
        "kind": "instrumentProxy",
        "runtime": True,
        "path": web_path(path),
        "sha256": digest,
        "sizeBytes": path.stat().st_size,
        "geometry": geometry_stats(path),
        "dimensionsMm": {
            "estimatedWorkingLength": 450.0,
            "estimatedOuterDiameter": 7.5,
            "estimatedInnerDiameter": 6.3,
            "estimatedProximalCollarDiameter": 20.0,
        },
        "anchors": {
            "entry": {
                "positionMm": [0.0, 0.0, 0.0],
                "direction": [0.0, 0.0, -1.0],
            },
            "toolEndpoint": {
                "positionMm": [0.0, 0.0, -450.0],
                "direction": [0.0, 0.0, -1.0],
            },
        },
        "provenance": {
            "sourceType": "manufacturer-listed stent-system concept; educational proxy geometry",
            "sourceUrl": HOOD_ORDERING_URL,
            "sourceNotes": (
                "The ordering page confirms BR/BP/BI stent-placement systems and color families but "
                "does not publish these proxy dimensions. This is not a model of a specific part number."
            ),
        },
        "estimatedFields": [
            "working length",
            "shaft outer and inner diameters",
            "collar dimensions",
            "distal profile",
            "material appearance",
        ],
    }


def cap_asset(
    *,
    asset_id: str,
    stem: str,
    part_number: str,
    label: str,
    color_code: str,
    openings: list[dict[str, Any]],
    estimated_openings: list[str],
) -> dict[str, Any]:
    material = BLUE_CAP_MATERIAL if color_code == "blue" else RED_CAP_MATERIAL
    body = cap_body(openings)
    scene = scene_with_named_meshes([(f"{part_number}_Cap_Body", body, material)])
    path, digest = write_hashed_glb(scene, OUTPUT_DIR / "accessories", stem)
    estimated = [
        "cap depth and edge profile",
        "opening center offsets",
        "material appearance",
        *estimated_openings,
    ]
    return {
        "id": asset_id,
        "kind": "capProxy",
        "runtime": True,
        "path": web_path(path),
        "sha256": digest,
        "sizeBytes": path.stat().st_size,
        "geometry": geometry_stats(path),
        "partNumber": part_number,
        "label": label,
        "dimensionsMm": {
            "publishedOuterDiameter": 25.0,
            "estimatedDepth": 6.0,
        },
        "anchors": {
            "capOpenings": [
                {
                    "id": opening["id"],
                    "positionMm": [*opening["centerMm"], 3.0],
                    "direction": [0.0, 0.0, -1.0],
                    "diameterMm": opening["diameterMm"],
                    "estimated": opening["id"] in estimated_openings,
                }
                for opening in openings
            ]
        },
        "provenance": {
            "sourceType": "manufacturer-published cap diameter/use plus educational proxy geometry",
            "sourceUrl": HOOD_ORDERING_URL,
            "publishedFields": ["part number", "25 mm cap diameter", "color code", "compatible opening diameters/use"],
        },
        "estimatedFields": estimated,
    }


def generated_accessories() -> list[dict[str, Any]]:
    records = [
        hose_asset(
            asset_id="accessory-anesthesia-circuit-hose",
            stem="anesthesia-circuit-hose-proxy",
            label="Anesthesia_Circuit",
            centerline_mm=[
                [0.0, 0.0, 0.0],
                [35.0, 0.0, 0.0],
                [75.0, -15.0, 0.0],
                [120.0, -48.0, 7.0],
                [170.0, -70.0, 16.0],
                [220.0, -72.0, 20.0],
            ],
            outer_diameter_mm=22.0,
            inner_diameter_mm=18.0,
            connector_outer_diameter_mm=22.0,
            connector_inner_diameter_mm=15.0,
            hose_material=ANESTHESIA_HOSE_MATERIAL,
            port_id="anesthesiaCircuit",
        ),
        hose_asset(
            asset_id="accessory-jet-ventilation-hose",
            stem="jet-ventilation-hose-proxy",
            label="Jet_Ventilation",
            centerline_mm=[
                [0.0, 0.0, 0.0],
                [24.0, 0.0, 0.0],
                [70.0, 10.0, 4.0],
                [125.0, 32.0, 8.0],
                [185.0, 30.0, 13.0],
            ],
            outer_diameter_mm=4.0,
            inner_diameter_mm=2.0,
            connector_outer_diameter_mm=6.0,
            connector_inner_diameter_mm=2.4,
            hose_material=JET_HOSE_MATERIAL,
            port_id="jet",
        ),
    ]
    records.append(stent_introducer_asset())
    records.extend(
        [
            cap_asset(
                asset_id="cap-bs2309-3-telescope-plus-2mm-instrument",
                stem="bs2309-3-cap-proxy",
                part_number="BS2309-3",
                label="5.5 mm endoscope plus 2 mm instrument cap",
                color_code="red",
                openings=[
                    {"id": "telescope5p5", "diameterMm": 5.5, "centerMm": [-3.2, 0.0]},
                    {"id": "instrument2", "diameterMm": 2.0, "centerMm": [4.2, 0.0]},
                ],
                estimated_openings=[],
            ),
            cap_asset(
                asset_id="cap-bs2311-3-telescope-plus-4mm-instrument",
                stem="bs2311-3-cap-proxy",
                part_number="BS2311-3",
                label="5.5 mm endoscope plus 4 mm instrument cap",
                color_code="red",
                openings=[
                    {"id": "telescope5p5", "diameterMm": 5.5, "centerMm": [-3.8, 0.0]},
                    {"id": "instrument4", "diameterMm": 4.0, "centerMm": [4.4, 0.0]},
                ],
                estimated_openings=[],
            ),
            cap_asset(
                asset_id="cap-bs2319-3-optical-forceps",
                stem="bs2319-3-optical-forceps-cap-proxy",
                part_number="BS2319-3",
                label="Optical forceps plus 5.5 mm endoscope cap",
                color_code="blue",
                openings=[
                    {"id": "telescope5p5", "diameterMm": 5.5, "centerMm": [-3.8, 0.0]},
                    {"id": "opticalForcepsGuide", "diameterMm": 4.0, "centerMm": [4.4, 0.0]},
                ],
                estimated_openings=["opticalForcepsGuide"],
            ),
        ]
    )
    return records


TOOL_ID_OVERRIDES = {
    "generic-endoscopic-camera-head.glb": "accessory-generic-endoscopic-camera-head",
    "generic-fiberoptic-light-cable.glb": "accessory-generic-fiberoptic-light-cable",
    "generic-light-guide-adapter-c1.glb": "accessory-generic-light-guide-adapter-c1",
    "generic-light-guide-adapter-c2.glb": "accessory-generic-light-guide-adapter-c2",
    "optical-grasping-forceps-32-3230-430hm.glb": "tool-optical-grasping-forceps",
    "semi-rigid-biopsy-forceps-bps2001.glb": "tool-semi-rigid-biopsy-forceps",
    "semi-rigid-grasping-forceps-bps2002.glb": "tool-semi-rigid-grasping-forceps",
    "semi-rigid-suction-catheter-3mm.glb": "tool-semi-rigid-suction-catheter-3mm",
}


def component_id(entry: dict[str, Any]) -> str:
    part_number = str(entry.get("part_number") or "").lower()
    component_type = str(entry.get("component_type") or "component").replace("_", "-")
    if not part_number:
        raise ValueError(f"Missing part number for {entry['filename']}")
    return f"efer-{part_number}-{component_type}"


def copied_components() -> list[dict[str, Any]]:
    efer_inventory_path = SOURCE_ASSEMBLY_DIR / "efer-component-inventory.json"
    tool_inventory_path = SOURCE_ASSEMBLY_DIR / "tool-asset-inventory.json"
    efer_inventory = json.loads(efer_inventory_path.read_text(encoding="utf-8"))
    tool_inventory = json.loads(tool_inventory_path.read_text(encoding="utf-8"))
    efer_by_filename = {entry["filename"]: entry for entry in efer_inventory["components"]}
    tool_by_filename = {entry["filename"]: entry for entry in tool_inventory["assets"]}

    records: list[dict[str, Any]] = []
    for source in sorted(SOURCE_COMPONENT_DIR.glob("*.glb")):
        path, digest = copy_hashed_glb(source, OUTPUT_DIR / "components")
        if source.name in efer_by_filename:
            inventory_entry = efer_by_filename[source.name]
            asset_id = component_id(inventory_entry)
            provenance = {
                "sourceType": "Blender-generated EFER teaching component",
                "sourceAsset": str(source.relative_to(REPO_ROOT)),
                "sourceSha256": digest,
                "manufacturerSourceUrl": (
                    inventory_entry.get("root_custom_properties", {}).get("dimension_source")
                    or inventory_entry.get("root_custom_properties", {}).get("source")
                    or HOOD_ORDERING_URL
                ),
                "sourceTeachingSetSha256": efer_inventory["source_sha256"],
            }
            estimated_fields = ["mesh geometry beyond published nominal dimensions"]
            if inventory_entry["top_level_component_id"] == "Autoclavable_Bronchial_Endoscope_BX5500_FA":
                estimated_fields.append("490 mm working-length geometry")
        elif source.name in tool_by_filename:
            inventory_entry = tool_by_filename[source.name]
            asset_id = TOOL_ID_OVERRIDES[source.name]
            metadata = inventory_entry["metadata"]
            provenance = {
                "sourceType": metadata.get("source_type"),
                "sourceAsset": str(source.relative_to(REPO_ROOT)),
                "sourceSha256": digest,
                "sourceUrl": metadata.get("source_url"),
                "secondarySourceUrl": metadata.get("secondary_source_url"),
            }
            estimated_fields = []
            if metadata.get("geometry_note"):
                estimated_fields.append(metadata["geometry_note"])
            if not estimated_fields:
                estimated_fields.append("non-published handle and surface geometry")
        else:
            raise ValueError(f"No tracked provenance inventory entry for {source.name}")

        records.append(
            {
                "id": asset_id,
                "kind": "eferComponent" if source.name in efer_by_filename else "toolOrAccessory",
                "runtime": True,
                "path": web_path(path),
                "sha256": digest,
                "sizeBytes": path.stat().st_size,
                "geometry": geometry_stats(path),
                "provenance": provenance,
                "estimatedFields": estimated_fields,
            }
        )

    pack_source = SOURCE_ASSEMBLY_DIR / "rigid-bronchoscopy-assembly-kit.glb"
    pack_path, pack_digest = copy_hashed_glb(pack_source, OUTPUT_DIR / "components")
    records.append(
        {
            "id": "efer-rigid-bronchoscopy-assembly-kit",
            "kind": "assemblyPack",
            "runtime": True,
            "path": web_path(pack_path),
            "sha256": pack_digest,
            "sizeBytes": pack_path.stat().st_size,
            "geometry": geometry_stats(pack_path),
            "provenance": {
                "sourceType": "request-efficient pack generated by the tracked Blender tool-asset builder",
                "sourceAsset": str(pack_source.relative_to(REPO_ROOT)),
                "sourceSha256": pack_digest,
            },
            "estimatedFields": ["contains the estimated fields declared by its individual components"],
        }
    )
    return records


def clean_generated_outputs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in OUTPUT_DIR.rglob("*.glb"):
        path.unlink()
    if MANIFEST_PATH.exists():
        MANIFEST_PATH.unlink()
    if VALIDATION_REPORT_PATH.exists():
        VALIDATION_REPORT_PATH.unlink()
    if BLENDER_VALIDATION_REPORT_PATH.exists():
        BLENDER_VALIDATION_REPORT_PATH.unlink()


def main() -> None:
    clean_generated_outputs()
    validate_pose_axes(PROCEDURAL_POSES)

    anatomy_records, lumen = airway_assets()
    poses = deepcopy(PROCEDURAL_POSES)
    for pose in poses:
        pose["validatedMinimumRadialClearanceMm"] = round(pose_clearance_mm(lumen, pose), 3)
        pose["validationMethod"] = (
            "80 longitudinal x 32 radial swept-surface samples against the authored lumen mesh"
        )
        if pose["validatedMinimumRadialClearanceMm"] < 0.5:
            raise ValueError(
                f"Pose {pose['id']} clearance {pose['validatedMinimumRadialClearanceMm']} mm is below 0.5 mm"
            )

    assets = [*anatomy_records, *copied_components(), *generated_accessories()]
    ids = [asset["id"] for asset in assets]
    if len(ids) != len(set(ids)):
        duplicates = sorted({asset_id for asset_id in ids if ids.count(asset_id) > 1})
        raise ValueError(f"Duplicate asset ids: {duplicates}")
    assets.sort(key=lambda asset: asset["id"])
    build_id = hashlib.sha256(
        "\n".join(f"{asset['id']}:{asset['sha256']}" for asset in assets).encode("utf-8")
    ).hexdigest()[:16]

    manifest = {
        "schema": "rigid_bronchoscopy_asset_manifest/v2",
        "version": 2,
        "buildId": build_id,
        "generatedOn": date.today().isoformat(),
        "generatedWith": {
            "python": platform.python_version(),
            "trimesh": trimesh.__version__,
            "generator": "scripts/rigid-bronchoscopy/build-v2-assets.py",
            "validator": "scripts/rigid-bronchoscopy/validate-v2-assets.py",
        },
        "educationalUseOnly": True,
        "disclaimer": (
            "Generic educational geometry and reference-based device proxies; not manufacturing CAD, "
            "patient-specific anatomy, procedural planning, or a substitute for the current IFU and supervised training."
        ),
        "units": {
            "authoredDimensions": "millimeters",
            "glbGeometry": "meters",
            "metersPerMillimeter": MM_TO_METERS,
        },
        "coordinateSystem": {
            "glb": "glTF 2.0 right-handed Y-up",
            **AIRWAY_MODEL["coordinateConvention"],
        },
        "presentation": {
            "worldUnitsPerMillimeter": WORLD_UNITS_PER_MM,
            "assetScaleWorldUnitsPerMeter": WORLD_UNITS_PER_MM / MM_TO_METERS,
            "carinaWorld": CARINA_WORLD,
            "policy": "keep every GLB meter-native and apply one shared presentation scale at runtime",
        },
        "sources": [
            {
                "id": "efer-ordering-information",
                "type": "manufacturer",
                "url": HOOD_ORDERING_URL,
                "supports": "part numbers, tube dimensions, cap diameters/openings/colors, tool dimensions",
            },
            {
                "id": "efer-user-manual",
                "type": "manufacturer user manual",
                "url": HOOD_USER_MANUAL_URL,
                "supports": "main/accessory/anesthesia/jet interface roles",
            },
        ],
        "airwayModel": AIRWAY_MODEL,
        "assets": assets,
        "semanticAnchors": SEMANTIC_ANCHORS,
        "proceduralPoses": poses,
        "assemblyStates": {
            "openMainAxial": {"mainAxialCapAssetId": None},
            "telescopeOnly5p5": {"mainAxialCapAssetId": "efer-bs2303-3-silicone-cap"},
            "opticalForceps": {"mainAxialCapAssetId": "cap-bs2319-3-optical-forceps"},
            "telescopePlus2mmInstrument": {
                "mainAxialCapAssetId": "cap-bs2309-3-telescope-plus-2mm-instrument"
            },
            "telescopePlus4mmInstrument": {
                "mainAxialCapAssetId": "cap-bs2311-3-telescope-plus-4mm-instrument"
            },
        },
        "validationRequirements": {
            "contentHashFilenamePrefixCharacters": 12,
            "criticalDimensionToleranceMm": 0.1,
            "anchorToleranceMm": 1.0,
            "minimumPoseRadialClearanceMm": 0.5,
            "requiredAirwaySemanticNodes": [
                "Airway_Outer_Wall",
                "Airway_Inner_Lumen",
                "Airway_Cutaway_Outer_Wall",
                "Airway_Cutaway_Inner_Lumen",
            ],
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "manifest": str(MANIFEST_PATH.relative_to(REPO_ROOT)),
                "buildId": build_id,
                "assetCount": len(assets),
                "totalBytes": sum(asset["sizeBytes"] for asset in assets),
                "poseClearancesMm": {
                    pose["id"]: pose["validatedMinimumRadialClearanceMm"] for pose in poses
                },
            }
        )
    )


if __name__ == "__main__":
    main()
