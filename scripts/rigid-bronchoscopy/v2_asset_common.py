#!/usr/bin/env python3
"""Shared geometry and validation data for rigid-bronchoscopy v2 assets.

All authored dimensions are millimetres. GLB export converts them to metres,
which is the unit convention used by glTF. The airway is deliberately generic
and central-only: it is not derived from a patient scan.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import trimesh
from scipy.spatial import cKDTree
from shapely.geometry import Point


MM_TO_METERS = 0.001
WORLD_UNITS_PER_MM = 0.009
CARINA_WORLD = [1.22, -0.3, 0.0]


AIRWAY_MODEL: dict[str, Any] = {
    "modelId": "generic-adult-central-airway-v2",
    "modelType": "public-safe educational geometry; not patient-derived",
    "coordinateConvention": {
        "longitudinalAxis": "+X from proximal trachea toward the carina",
        "lateralityAxis": "right is -Y; left is +Y",
        "anteriorAxis": "+Z",
    },
    "junction": {
        "centerMm": [0.0, 0.0, 0.0],
        "innerBlendRadiusMm": 13.0,
        "outerBlendRadiusMm": 15.0,
    },
    "branches": [
        {
            "id": "trachea",
            "label": "Trachea",
            "innerRadiusMm": 10.0,
            "outerRadiusMm": 12.0,
            "centerlineMm": [
                [-135.0, 0.0, 0.0],
                [-90.0, 0.0, 0.0],
                [-45.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
            ],
            "innerBooleanCenterlineMm": [
                [-138.0, 0.0, 0.0],
                [-90.0, 0.0, 0.0],
                [-45.0, 0.0, 0.0],
                [4.0, 0.0, 0.0],
            ],
        },
        {
            "id": "rightMainstem",
            "label": "Right main bronchus",
            "innerRadiusMm": 8.0,
            "outerRadiusMm": 10.0,
            "centerlineMm": [
                [-4.0, 0.0, 0.0],
                [20.0, -8.0, -1.0],
                [40.0, -21.0, -3.0],
                [62.0, -34.0, -4.0],
            ],
            "innerBooleanCenterlineMm": [
                [-6.0, 0.0, 0.0],
                [20.0, -8.0, -1.0],
                [40.0, -21.0, -3.0],
                [65.0, -36.0, -4.4],
            ],
        },
        {
            "id": "leftMainstem",
            "label": "Left main bronchus",
            "innerRadiusMm": 8.0,
            "outerRadiusMm": 10.0,
            "centerlineMm": [
                [-4.0, 0.0, 0.0],
                [20.0, 10.0, 1.0],
                [42.0, 25.0, 2.0],
                [69.0, 44.0, 3.0],
            ],
            "innerBooleanCenterlineMm": [
                [-6.0, 0.0, 0.0],
                [20.0, 10.0, 1.0],
                [42.0, 25.0, 2.0],
                [72.0, 46.0, 3.2],
            ],
        },
    ],
}


PROCEDURAL_POSES: list[dict[str, Any]] = [
    {
        "id": "tracheal",
        "label": "Mid-tracheal true-scale view",
        "tubeAssetId": "efer-bt2203-3-tracheal-tube",
        "tubeOuterDiameterMm": 10.0,
        "visibleSweepStartMm": [-120.0, 0.0, 0.0],
        "bevelMm": [-50.0, 0.0, 0.0],
        "telescopeObjectiveMm": [-51.0, 0.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "anatomyTarget": "trachea",
        "cameraPreset": "trueScale",
    },
    {
        "id": "carinal",
        "label": "Carinal inspection view",
        "tubeAssetId": "efer-bt2203-3-tracheal-tube",
        "tubeOuterDiameterMm": 10.0,
        "visibleSweepStartMm": [-110.0, 0.0, 0.0],
        "bevelMm": [-8.0, 0.0, 0.0],
        "telescopeObjectiveMm": [-9.0, 0.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "anatomyTarget": "carina",
        "cameraPreset": "carina",
    },
    {
        "id": "rightMainstem",
        "label": "Initial right-mainstem position",
        "tubeAssetId": "efer-bt2105-3-bronchial-tube",
        "tubeOuterDiameterMm": 8.0,
        "visibleSweepStartMm": [-55.0, 0.0, 0.0],
        "bevelMm": [28.0, -9.0, -1.5],
        "telescopeObjectiveMm": [27.0, -8.89, -1.48],
        "axis": [0.9939, -0.1078, -0.0180],
        "anatomyTarget": "rightMainstem",
        "cameraPreset": "selectedMainstem",
    },
    {
        "id": "leftMainstem",
        "label": "Initial left-mainstem position",
        "tubeAssetId": "efer-bt2105-3-bronchial-tube",
        "tubeOuterDiameterMm": 8.0,
        "visibleSweepStartMm": [-50.0, 0.0, 0.0],
        "bevelMm": [23.0, 9.0, 1.0],
        "telescopeObjectiveMm": [22.01, 8.88, 0.99],
        "axis": [0.9924, 0.1223, 0.0136],
        "anatomyTarget": "leftMainstem",
        "cameraPreset": "selectedMainstem",
    },
]


SEMANTIC_ANCHORS: dict[str, Any] = {
    "ports": {
        "mainAxial": {
            "assetId": "efer-bd2410-3-adult-universal-base",
            "positionMm": [0.0, 0.0, 50.0],
            "direction": [0.0, 0.0, -1.0],
            "source": "named rear-main-port geometry in the source EFER teaching model",
            "estimated": False,
        },
        "accessory": {
            "assetId": "efer-bd2410-3-adult-universal-base",
            "positionMm": [-1.0, 46.13, 29.15],
            "direction": [0.0, 0.866, 0.5],
            "source": "named accessory-port end collar in the source EFER teaching model",
            "estimated": True,
        },
        "anesthesiaCircuit": {
            "assetId": "efer-bd2410-3-adult-universal-base",
            "positionMm": [0.0, -46.88, -24.2],
            "direction": [0.0, -0.966, -0.259],
            "source": "named anesthesia-port end collar in the source EFER teaching model",
            "estimated": True,
        },
        "jet": {
            "assetId": "efer-bd2410-3-adult-universal-base",
            "positionMm": [0.0, -24.0, 1.0],
            "direction": [0.0, -1.0, 0.0],
            "source": "named fixed-jet-port end collar in the source EFER teaching model",
            "estimated": False,
        },
    },
    "tubeFeatures": {
        "bt2203Bevel": {
            "assetId": "efer-bt2203-3-tracheal-tube",
            "positionMm": [0.0, 0.0, -260.0],
            "direction": [0.0, 0.0, -1.0],
            "estimated": False,
        },
        "bt2203SafetyStop": {
            "assetId": "efer-bt2203-3-tracheal-tube",
            "positionMm": [0.0, 0.0, -249.6],
            "direction": [0.0, 0.0, -1.0],
            "estimated": False,
        },
        "bt2105Bevel": {
            "assetId": "efer-bt2105-3-bronchial-tube",
            "positionMm": [0.0, 0.0, -360.0],
            "direction": [0.0, 0.0, -1.0],
            "estimated": False,
        },
        "bt2105SafetyStop": {
            "assetId": "efer-bt2105-3-bronchial-tube",
            "positionMm": [0.0, 0.0, -349.6],
            "direction": [0.0, 0.0, -1.0],
            "estimated": False,
        },
        "bt2105FenestrationRight": {
            "assetId": "efer-bt2105-3-bronchial-tube",
            "positionMm": [0.0, -4.0, -330.0],
            "direction": [0.0, -1.0, 0.0],
            "source": "educational feature anchor; exact fenestration geometry is not semantically separated in the source mesh",
            "estimated": True,
        },
        "bt2105FenestrationLeft": {
            "assetId": "efer-bt2105-3-bronchial-tube",
            "positionMm": [0.0, 4.0, -330.0],
            "direction": [0.0, 1.0, 0.0],
            "source": "educational feature anchor; exact fenestration geometry is not semantically separated in the source mesh",
            "estimated": True,
        },
    },
    "telescopeObjective": {
        "assetId": "efer-bx-5500-fa-rigid-telescope",
        "positionMm": [0.0, 0.0, -490.5],
        "direction": [0.0, 0.0, -1.0],
        "estimated": False,
    },
    "toolEndpoints": {
        "opticalForceps": {
            "assetId": "tool-optical-grasping-forceps",
            "positionMm": [0.0, 0.0, -477.0],
            "direction": [0.0, 0.0, -1.0],
            "estimated": False,
        },
        "threeMillimeterSuction": {
            "assetId": "tool-semi-rigid-suction-catheter-3mm",
            "positionMm": [29.31, 0.0, -550.72],
            "direction": [0.12, 0.0, -0.993],
            "estimated": True,
        },
        "semiRigidGraspingForceps": {
            "assetId": "tool-semi-rigid-grasping-forceps",
            "positionMm": [0.0, 0.0, -607.0],
            "direction": [0.0, 0.0, -1.0],
            "estimated": False,
        },
        "stentIntroducer": {
            "assetId": "tool-stent-introducer",
            "positionMm": [0.0, 0.0, -450.0],
            "direction": [0.0, 0.0, -1.0],
            "source": "generic educational proxy informed by the EFER stent-placement system listing",
            "estimated": True,
        },
    },
    "anatomy": {
        "proximalTrachea": {"positionMm": [-135.0, 0.0, 0.0]},
        "midTrachea": {"positionMm": [-67.5, 0.0, 0.0]},
        "carina": {"positionMm": [0.0, 0.0, 0.0]},
        "rightMainstemDistal": {"positionMm": [62.0, -34.0, -4.0]},
        "leftMainstemDistal": {"positionMm": [69.0, 44.0, 3.0]},
    },
}


def mm_points(points: list[list[float]]) -> np.ndarray:
    return np.asarray(points, dtype=float) * MM_TO_METERS


def _circle(radius_mm: float, resolution: int = 24):
    return Point(0.0, 0.0).buffer(radius_mm * MM_TO_METERS, resolution=resolution)


def sweep(centerline_mm: list[list[float]], radius_mm: float) -> trimesh.Trimesh:
    mesh = trimesh.creation.sweep_polygon(_circle(radius_mm), mm_points(centerline_mm))
    mesh.fix_normals()
    return mesh


def make_airway_volumes() -> tuple[trimesh.Trimesh, trimesh.Trimesh, trimesh.Trimesh]:
    outer_parts = [
        sweep(branch["centerlineMm"], branch["outerRadiusMm"])
        for branch in AIRWAY_MODEL["branches"]
    ]
    inner_parts = [
        sweep(branch["innerBooleanCenterlineMm"], branch["innerRadiusMm"])
        for branch in AIRWAY_MODEL["branches"]
    ]
    junction = AIRWAY_MODEL["junction"]
    outer_sphere = trimesh.creation.icosphere(
        subdivisions=3,
        radius=junction["outerBlendRadiusMm"] * MM_TO_METERS,
    )
    inner_sphere = trimesh.creation.icosphere(
        subdivisions=3,
        radius=junction["innerBlendRadiusMm"] * MM_TO_METERS,
    )
    outer_parts.append(outer_sphere)
    inner_parts.append(inner_sphere)
    outer = trimesh.boolean.union(outer_parts, engine="manifold", check_volume=True)
    inner = trimesh.boolean.union(inner_parts, engine="manifold", check_volume=True)
    wall = trimesh.boolean.difference([outer, inner], engine="manifold", check_volume=True)
    for mesh in (outer, inner, wall):
        mesh.remove_unreferenced_vertices()
        mesh.fix_normals()
    return outer, inner, wall


def dense_centerline_samples(samples_per_segment: int = 40) -> np.ndarray:
    samples: list[np.ndarray] = []
    for branch in AIRWAY_MODEL["branches"]:
        points = mm_points(branch["innerBooleanCenterlineMm"])
        for start, end in zip(points[:-1], points[1:]):
            for fraction in np.linspace(0.0, 1.0, samples_per_segment, endpoint=False):
                samples.append(start + (end - start) * fraction)
        samples.append(points[-1])
    return np.asarray(samples)


def split_wall_surfaces(wall: trimesh.Trimesh) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    """Split a wall shell into outward outer and lumen-facing inner surfaces."""
    samples = dense_centerline_samples()
    tree = cKDTree(samples)
    _, nearest = tree.query(wall.triangles_center)
    radial = wall.triangles_center - samples[nearest]
    radial_length = np.linalg.norm(radial, axis=1)
    safe_radial = radial / np.maximum(radial_length[:, None], 1e-12)
    alignment = np.einsum("ij,ij->i", wall.face_normals, safe_radial)
    inner_mask = alignment < -0.05
    # Plane clipping creates a handful of ambiguous triangles at the authored
    # cut edge. Reassign small same-label face islands to their surrounding
    # semantic surface rather than exporting isolated triangles.
    neighbors: list[list[int]] = [[] for _ in range(len(wall.faces))]
    for first, second in wall.face_adjacency:
        neighbors[int(first)].append(int(second))
        neighbors[int(second)].append(int(first))
    for _ in range(3):
        visited = np.zeros(len(wall.faces), dtype=bool)
        flips: list[int] = []
        for seed in range(len(wall.faces)):
            if visited[seed]:
                continue
            label = bool(inner_mask[seed])
            stack = [seed]
            visited[seed] = True
            component: list[int] = []
            while stack:
                current = stack.pop()
                component.append(current)
                for neighbor in neighbors[current]:
                    if not visited[neighbor] and bool(inner_mask[neighbor]) == label:
                        visited[neighbor] = True
                        stack.append(neighbor)
            if len(component) < 24:
                flips.extend(component)
        if not flips:
            break
        inner_mask[np.asarray(flips, dtype=int)] = ~inner_mask[np.asarray(flips, dtype=int)]
    outer_mask = ~inner_mask
    outer_surface = wall.submesh([outer_mask], append=True, repair=False)
    inner_surface = wall.submesh([inner_mask], append=True, repair=False)
    for mesh in (outer_surface, inner_surface):
        mesh.remove_unreferenced_vertices()
    return outer_surface, inner_surface


def make_airway_surfaces() -> dict[str, trimesh.Trimesh]:
    outer_volume, inner_volume, wall = make_airway_volumes()
    outer_surface, inner_surface = split_wall_surfaces(wall)

    # Author the cutaway relative to the local airway centerline rather than a
    # fixed world plane. That keeps a posterior half-shell for both mainstems
    # even though their centerlines have small, opposite Z offsets.
    centerline_samples = dense_centerline_samples()
    centerline_tree = cKDTree(centerline_samples)

    def posterior_half(surface: trimesh.Trimesh) -> trimesh.Trimesh:
        _, nearest = centerline_tree.query(surface.triangles_center)
        local_radial = surface.triangles_center - centerline_samples[nearest]
        keep = local_radial[:, 2] <= 0.0
        result = surface.submesh([keep], append=True, repair=False)
        result.merge_vertices(digits_vertex=9)
        result.remove_unreferenced_vertices()
        components = result.split(only_watertight=False)
        if len(components) > 1:
            result = max(components, key=lambda component: len(component.faces))
        return result

    cutaway_outer = posterior_half(outer_surface)
    cutaway_inner = posterior_half(inner_surface)
    return {
        "outerVolume": outer_volume,
        "innerVolume": inner_volume,
        "wall": wall,
        "outerSurface": outer_surface,
        "innerSurface": inner_surface,
        "cutawayOuterSurface": cutaway_outer,
        "cutawayInnerSurface": cutaway_inner,
    }


def _orthonormal_basis(axis: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    reference = np.asarray([0.0, 0.0, 1.0])
    first = np.cross(axis, reference)
    if np.linalg.norm(first) < 0.1:
        reference = np.asarray([0.0, 1.0, 0.0])
        first = np.cross(axis, reference)
    first /= np.linalg.norm(first)
    second = np.cross(axis, first)
    return first, second


def pose_clearance_mm(
    lumen: trimesh.Trimesh,
    pose: dict[str, Any],
    longitudinal_samples: int = 80,
    radial_samples: int = 32,
) -> float:
    start = np.asarray(pose["visibleSweepStartMm"], dtype=float) * MM_TO_METERS
    end = np.asarray(pose["bevelMm"], dtype=float) * MM_TO_METERS
    axis = end - start
    axis /= np.linalg.norm(axis)
    first, second = _orthonormal_basis(axis)
    radius = pose["tubeOuterDiameterMm"] * 0.5 * MM_TO_METERS
    points: list[np.ndarray] = []
    for fraction in np.linspace(0.0, 1.0, longitudinal_samples):
        center = start + (end - start) * fraction
        for angle in np.linspace(0.0, math.tau, radial_samples, endpoint=False):
            points.append(center + radius * (math.cos(angle) * first + math.sin(angle) * second))
    signed = trimesh.proximity.signed_distance(lumen, np.asarray(points))
    return float(np.min(signed) / MM_TO_METERS)


def validate_pose_axes(poses: list[dict[str, Any]]) -> None:
    for pose in poses:
        start = np.asarray(pose["visibleSweepStartMm"], dtype=float)
        end = np.asarray(pose["bevelMm"], dtype=float)
        expected = end - start
        expected /= np.linalg.norm(expected)
        declared = np.asarray(pose["axis"], dtype=float)
        declared /= np.linalg.norm(declared)
        if not np.allclose(expected, declared, atol=0.003):
            raise ValueError(f"Pose {pose['id']} axis does not match its authored straight sweep")
