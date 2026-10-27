#!/usr/bin/env python3
"""Build the dolphin synchronized-bronchoscopy case from the Local-Data Slicer export.

Inputs, read in place from <Local-Data>/Dolphin_bronch (never copied into the repo):
  "3 DOLPHIN LUNG 1.25MM.nrrd"   CT, LPS, 512 x 512 x 639 at 1.27 x 1.27 x 1.25 mm
  "Airway Label.seg.nrrd"         hand-drawn tracheobronchial segmentation (label 1)

The scan was registered head-first prone with the animal ventral side down, so the
scanner axes read as the animal's: superior = rostral, posterior = dorsal,
anterior = ventral, and left/right are the animal's own (the tracheal bronchus comes
off the right side of the trachea, as expected in delphinids).

The segmentation stops at the cranial trachea. The upper airway is grown here from the
CT (air below -400 HU that connects to the segmentation) in two parts that meet only at
the laryngeal aditus, the tip of the arytenoepiglottic tube (goosebeak):
  - the laryngeal lumen through the goosebeak, from the unsmoothed CT. The larynx is
    closed in this scan, so the lumen is a 1-2 voxel slit; it is widened by one voxel
    (about 1.3 mm a side) so the scope can follow it, never closer than 2.5 voxels to the
    nasopharynx around the goosebeak, so its wall stays intact;
  - the nasopharynx and both bony nasal passages, from a lightly smoothed CT, so noise in
    the thin bony walls does not punch holes through them.
The paired pterygoid sinuses stay separate at this threshold. The soft nasal passage
from the blowhole down to the bony nares holds no air in this scan (nasal plugs
closed), so the scope starts at the dorsal end of the left bony nasal passage.

Centerlines are shortest paths on the skeleton of the airway mask, rooted at that
start point. Bronchial end points are kept when their branch reaches clearly beyond
the parent lumen; in the upper airway only the right bony nasal passage is a branch,
so the blind spaces beside the goosebeak and the pouch at the top of the trachea are
in the lumen surface but not in the navigation graph.

Usage: python3 scripts/airway-anatomy/build-dolphin-case.py [--skip-ct]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from collections import deque
from pathlib import Path
from typing import Any

import nrrd
import numpy as np
import trimesh
from scipy import ndimage as ndi
from scipy import sparse
from scipy.sparse import csgraph
from skimage.measure import marching_cubes
from skimage.morphology import skeletonize

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from local_data import local_data_path  # noqa: E402

SOURCE_DIR = local_data_path("Dolphin_bronch")
CT_SOURCE_NAME = "3 DOLPHIN LUNG 1.25MM.nrrd"
SEGMENTATION_SOURCE_NAME = "Airway Label.seg.nrrd"
CASE_ID = "dolphin-001"
ASSET_BASE_URL = f"/airway-anatomy/{CASE_ID}"
OUTPUT_DIR = REPO_ROOT / "public" / "airway-anatomy" / CASE_ID
LUMEN_GLB_NAME = "lumen.glb"
CT_PREVIEW_NAME = "dolphin_ct_preview_i16.raw"

AIR_THRESHOLD_HU = -400
UPPER_AIRWAY_MIN_Z = 470
NASAL_SMOOTHING_SIGMA_VOXELS = 1.0
# The nasal side is taken from the nasopharynx at the goosebeak up. Above NASAL_CROP_MIN_Z
# it is kept to the two bony nasal passages; small lateral pockets there are not airway.
NASAL_MIN_Z = 505
NASAL_CROP_MIN_Z = 590
NASAL_CROP_I = (232, 297)
# Source voxel indices (i, j, k) of the anatomical anchors, read off the CT.
# Dorsal end of the left bony nasal passage where the lumen is still about 5 mm in radius.
ROOT_SEED_IJK = (251, 258, 611)
# The matching point in the right bony nasal passage.
RIGHT_NARIS_SEED_IJK = (281, 258, 606)
# Tip of the goosebeak: the laryngeal opening (aditus) into the nasopharynx.
ADITUS_SEED_IJK = (249, 338, 549)
# Inside the laryngeal slit, and inside the nasopharynx just above the goosebeak.
LARYNGEAL_SLIT_SEED_IJK = (249, 339, 540)
NASOPHARYNX_SEED_IJK = (253, 331, 567)
ADITUS_RADIUS_VOXELS = 10
# The laryngeal lumen opens into the wide cranial trachea here.
LARYNX_TRACHEA_SEED_IJK = (240, 352, 481)
# Bronchial end points are taken only caudal to this slice.
BRONCHIAL_ENDPOINT_MAX_Z = 455
CT_STRIDE_XYZ = (2, 2, 2)
CENTERLINE_SPACING_MM = 0.75
MIN_CENTERLINE_CLEARANCE_MM = 0.35

LABELS = {
    "LNP": "Left bony nasal passage",
    "RNP": "Right bony nasal passage",
    "NPX": "Nasopharynx",
    "LX": "Larynx (goosebeak)",
    "TR": "Trachea",
    "TB": "Right tracheal bronchus",
    "RPB": "Right principal bronchus",
    "LPB": "Left principal bronchus",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--skip-ct", action="store_true", help="Keep the existing CT preview.")
    args = parser.parse_args()
    output_dir = args.output_dir.resolve()
    (output_dir / "metadata").mkdir(parents=True, exist_ok=True)
    (output_dir / "ct").mkdir(parents=True, exist_ok=True)

    ct_path = args.source_dir / CT_SOURCE_NAME
    seg_path = args.source_dir / SEGMENTATION_SOURCE_NAME
    ct, ct_header = nrrd.read(str(ct_path))
    seg, seg_header = nrrd.read(str(seg_path))
    geometry = VolumeGeometry(ct_header)
    if ct.shape != seg.shape or not geometry.matches(VolumeGeometry(seg_header)):
        raise ValueError("CT and segmentation grids differ")
    ct = np.clip(ct, -32768, 32767).astype(np.int16)

    mask = build_airway_mask(ct, seg > 0)
    graph, labels, review = build_centerline_graph(mask, geometry)
    mesh, mesh_review = build_lumen_mesh(mask, geometry)
    repairs = validate_centerlines(graph, mesh)
    for polyline in labels["polylines"]:
        polyline["anchorLps"] = polyline["pointsLps"][len(polyline["pointsLps"]) // 2]
    review.update(mesh_review)
    review["centerlineRepairs"] = repairs

    glb_path = output_dir / LUMEN_GLB_NAME
    write_glb(glb_path, mesh)
    preview_path = output_dir / "ct" / CT_PREVIEW_NAME
    first_airway_slice = int(np.nonzero(mask.any(axis=(0, 1)))[0].min())
    ct_asset = build_ct_preview(
        ct, geometry, preview_path, min_z=max(first_airway_slice - 16, 0), skip=args.skip_ct
    )
    ct_asset["sourceSha256"] = sha256(ct_path)

    write_json(output_dir / "metadata" / "airway_graph.json", graph)
    write_json(output_dir / "metadata" / "centerline_labels.json", labels)
    write_json(
        output_dir / "metadata" / "geometry-review.json",
        {"sourceSegmentationSha256": sha256(seg_path), **review},
    )
    write_json(
        output_dir / "case_manifest.json",
        build_manifest(graph, labels, ct_asset, sha256(seg_path), sha256(glb_path), review),
    )
    print(json.dumps({key: review[key] for key in ("topology", "vertices", "triangles")}))
    print(f"edges={len(graph['edges'])} centerlineRepairs={len(repairs)} glbBytes={glb_path.stat().st_size}")


class VolumeGeometry:
    """Index (i, j, k) to LPS millimeters for an axis-aligned NRRD grid."""

    def __init__(self, header: dict[str, Any]) -> None:
        if header.get("space") != "left-posterior-superior":
            raise ValueError(f"Expected an LPS volume, got {header.get('space')!r}")
        directions = np.asarray(header["space directions"], dtype=float)
        if np.count_nonzero(directions - np.diag(np.diag(directions)) > 1e-6):
            raise ValueError("Expected an axis-aligned volume")
        self.steps = np.diag(directions).copy()
        self.spacing = np.abs(self.steps)
        self.origin = np.asarray(header["space origin"], dtype=float)
        self.size = np.asarray(header["sizes"], dtype=int)

    def matches(self, other: "VolumeGeometry") -> bool:
        return (
            np.allclose(self.steps, other.steps, atol=1e-4)
            and np.allclose(self.origin, other.origin, atol=1e-3)
            and np.array_equal(self.size, other.size)
        )

    def lps(self, ijk: np.ndarray) -> np.ndarray:
        return self.origin + np.asarray(ijk, dtype=float) * self.steps


def build_airway_mask(ct: np.ndarray, segmentation: np.ndarray) -> np.ndarray:
    face = ndi.generate_binary_structure(3, 1)
    z0 = UPPER_AIRWAY_MIN_Z
    components, _ = ndi.label(ct[:, :, z0:] < AIR_THRESHOLD_HU, structure=face)
    seeds = np.setdiff1d(np.unique(components[segmentation[:, :, z0:]]), [0])
    grown = np.zeros(ct.shape, dtype=bool)
    grown[:, :, z0:] = np.isin(components, seeds)

    # Below the aditus the laryngeal lumen and the nasopharynx around the goosebeak are
    # separate air spaces; the laryngeal one continues into the segmented trachea.
    below_aditus = grown.copy()
    below_aditus[:, :, ADITUS_SEED_IJK[2] - 2 :] = False
    components, _ = ndi.label(below_aditus, structure=face)
    larynx = components == components[nearest_voxel(below_aditus, LARYNGEAL_SLIT_SEED_IJK)]

    smoothed = np.full(ct.shape, np.float32(0))
    smoothed[:, :, NASAL_MIN_Z:] = ndi.gaussian_filter(
        ct[:, :, NASAL_MIN_Z:].astype(np.float32), NASAL_SMOOTHING_SIGMA_VOXELS
    )
    smoothed_air = smoothed < AIR_THRESHOLD_HU
    components, _ = ndi.label(smoothed_air, structure=face)
    nasal = components == components[nearest_voxel(smoothed_air, NASOPHARYNX_SEED_IJK)]
    lateral = np.ones(ct.shape[0], dtype=bool)
    lateral[NASAL_CROP_I[0] : NASAL_CROP_I[1] + 1] = False
    nasal[lateral, :, NASAL_CROP_MIN_Z:] = False

    # The aditus: the unsmoothed air channel that climbs from the end of the slit, over the
    # goosebeak tip, into the smoothed nasopharynx.
    tip = np.argwhere(larynx)
    tip = tip[tip[:, 2] == tip[:, 2].max()]
    center = tip.mean(0)
    i, j, k = np.ogrid[: ct.shape[0], : ct.shape[1], : ct.shape[2]]
    ball = ((i - center[0]) ** 2 + (j - center[1]) ** 2 + ((k - center[2]) * 1.25 / 1.27) ** 2) <= (
        ADITUS_RADIUS_VOXELS**2
    )
    components, _ = ndi.label(grown & ball, structure=face)
    aditus = components == components[tuple(tip[0])]
    if not (ndi.binary_dilation(aditus, structure=face) & nasal).any():
        raise ValueError("No air channel joins the laryngeal slit to the nasopharynx")
    # Like the slit, the channel is one voxel wide; open it by one voxel over the tip only.
    over_tip = np.zeros(ct.shape, dtype=bool)
    over_tip[:, :, tip[0, 2] :] = True
    aditus |= ndi.binary_dilation(aditus, structure=face) & over_tip

    mask = segmentation | larynx | nasal | aditus
    # Light smoothing closes one-voxel holes and diagonal-only contacts that would become
    # tunnels in the surface. It erases the slit, which is restored below.
    mask = ndi.gaussian_filter(mask.astype(np.float32), 0.7) > 0.5
    slit = larynx.copy()
    slit[:, :, : np.argwhere(segmentation)[:, 2].max() + 1] = False
    nasal_side = (grown & ~larynx) | nasal
    wall_kept = ndi.distance_transform_edt(~nasal_side) >= 2.5
    slit |= ndi.binary_dilation(slit, structure=face) & wall_kept
    mask |= slit | aditus
    components, _ = ndi.label(mask, structure=face)
    sizes = np.bincount(components.ravel())
    sizes[0] = 0
    mask = ndi.binary_fill_holes(components == sizes.argmax())
    if not nasal[mask].any():
        raise ValueError("The nasal airway is not connected to the larynx")
    # The goosebeak wall must stay closed: below the aditus, the laryngeal lumen and the
    # nasopharynx around the goosebeak may not touch.
    below = mask.copy()
    below[:, :, ADITUS_SEED_IJK[2] - 3 :] = False
    components, _ = ndi.label(below, structure=face)
    slit_id = components[nearest_voxel(below & slit, LARYNGEAL_SLIT_SEED_IJK)]
    beside = below & nasal_side & ~slit
    if np.any(components[beside] == slit_id):
        raise ValueError("The laryngeal lumen opens into the nasopharynx below the aditus")
    return mask


def nearest_voxel(mask: np.ndarray, seed: tuple[int, int, int], reach: int = 12) -> tuple[int, ...]:
    lo = np.maximum(np.asarray(seed) - reach, 0)
    window = np.argwhere(mask[lo[0] : seed[0] + reach + 1, lo[1] : seed[1] + reach + 1, lo[2] : seed[2] + reach + 1])
    if not len(window):
        raise ValueError(f"No airway voxel near {seed}")
    window += lo
    return tuple(window[np.argmin(np.linalg.norm(window - np.asarray(seed), axis=1))])


def build_centerline_graph(
    mask: np.ndarray, geometry: VolumeGeometry
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    present = np.argwhere(mask)
    lo = present.min(0) - 2
    hi = present.max(0) + 3
    crop = mask[lo[0] : hi[0], lo[1] : hi[1], lo[2] : hi[2]]
    clearance = ndi.distance_transform_edt(crop, sampling=geometry.spacing)
    skeleton = skeletonize(crop) > 0
    voxels = np.argwhere(skeleton)
    index = -np.ones(skeleton.shape, dtype=np.int64)
    index[tuple(voxels.T)] = np.arange(len(voxels))

    rows, cols, weights = [], [], []
    for offset in np.array([o for o in np.ndindex(3, 3, 3)]) - 1:
        if tuple(offset) <= (0, 0, 0):
            continue
        target = voxels + offset
        inside = (target >= 0).all(1) & (target < skeleton.shape).all(1)
        source_ids = np.nonzero(inside)[0]
        target_ids = index[tuple(target[inside].T)]
        linked = target_ids >= 0
        rows.append(source_ids[linked])
        cols.append(target_ids[linked])
        weights.append(np.full(linked.sum(), np.linalg.norm(offset * geometry.spacing)))
    adjacency = sparse.csr_matrix(
        (np.concatenate(weights), (np.concatenate(rows), np.concatenate(cols))),
        shape=(len(voxels),) * 2,
    )
    adjacency = adjacency + adjacency.T
    if csgraph.connected_components(adjacency)[0] != 1:
        raise ValueError("Airway skeleton is not connected")

    global_voxels = voxels + lo

    def nearest(seed: tuple[int, int, int], among: np.ndarray | None = None) -> int:
        candidates = np.arange(len(voxels)) if among is None else among
        offsets = (global_voxels[candidates] - np.asarray(seed)) * geometry.spacing
        return int(candidates[np.argmin(np.linalg.norm(offsets, axis=1))])

    root = nearest(ROOT_SEED_IJK)
    right_naris = nearest(RIGHT_NARIS_SEED_IJK)
    _, predecessors = csgraph.dijkstra(adjacency, directed=False, indices=root, return_predecessors=True)
    degree = np.asarray((adjacency > 0).sum(1)).ravel()
    endpoints = [
        int(v) for v in np.nonzero(degree == 1)[0] if global_voxels[v, 2] < BRONCHIAL_ENDPOINT_MAX_Z
    ]
    endpoints.append(right_naris)
    kept = prune_endpoints(endpoints, {right_naris}, root, predecessors, voxels, clearance, geometry)
    children = tree_children(kept, root, predecessors)

    # Every bronchial end point reaches the root through the trachea, larynx and nasopharynx.
    caudal_end = min((v for v in kept if v != right_naris), key=lambda v: global_voxels[v, 2])
    central = np.array(path_to_root(caudal_end, root, predecessors))
    split_voxels = {nearest(ADITUS_SEED_IJK, central), nearest(LARYNX_TRACHEA_SEED_IJK, central)}
    segments = tree_segments(children, root, split_voxels)
    return assemble_graph(segments, children, root, global_voxels, clearance, voxels, geometry, split_voxels)


def path_to_root(vertex: int, root: int, predecessors: np.ndarray) -> list[int]:
    path = [vertex]
    while vertex != root:
        vertex = int(predecessors[vertex])
        if vertex < 0:
            raise ValueError("Skeleton vertex is not reachable from the root")
        path.append(vertex)
    return path[::-1]


def tree_children(endpoints: list[int], root: int, predecessors: np.ndarray) -> dict[int, list[int]]:
    children: dict[int, set[int]] = {}
    for endpoint in endpoints:
        path = path_to_root(endpoint, root, predecessors)
        for parent, child in zip(path, path[1:]):
            children.setdefault(parent, set()).add(child)
    return {parent: sorted(values) for parent, values in children.items()}


def tree_segments(
    children: dict[int, list[int]], root: int, split_voxels: set[int] = frozenset()
) -> list[list[int]]:
    """Voxel paths between the root, forks, split points and end points, parents first."""
    segments, queue = [], deque([root])
    while queue:
        start = queue.popleft()
        for child in children.get(start, []):
            path = [start, child]
            while len(children.get(path[-1], [])) == 1 and path[-1] not in split_voxels:
                path.append(children[path[-1]][0])
            segments.append(path)
            if children.get(path[-1]):
                queue.append(path[-1])
    return segments


def path_length(path: list[int], voxels: np.ndarray, geometry: VolumeGeometry) -> float:
    points = voxels[path] * geometry.spacing
    return float(np.linalg.norm(np.diff(points, axis=0), axis=1).sum())


def prune_endpoints(
    endpoints: list[int],
    fixed: set[int],
    root: int,
    predecessors: np.ndarray,
    voxels: np.ndarray,
    clearance: np.ndarray,
    geometry: VolumeGeometry,
) -> list[int]:
    """Drop skeleton spurs: a kept branch must reach 4 mm beyond its parent lumen."""
    kept = list(endpoints)
    while True:
        children = tree_children(kept, root, predecessors)
        removed = False
        for path in tree_segments(children, root):
            end = path[-1]
            if children.get(end) or end in fixed:
                continue
            length = path_length(path, voxels, geometry)
            if length < clearance[tuple(voxels[path[0]])] + 4.0 or length < 5.0:
                kept.remove(end)
                removed = True
        if not removed:
            return kept


def smooth_and_resample(points: np.ndarray) -> np.ndarray:
    """Remove voxel stair steps; the first and last points (the shared nodes) stay put."""
    if len(points) > 4:
        smoothed = ndi.gaussian_filter1d(points, sigma=1.5, axis=0, mode="nearest")
        weight = np.minimum(np.arange(len(points)), np.arange(len(points))[::-1]) / 3.0
        weight = np.clip(weight, 0, 1)[:, None]
        points = points * (1 - weight) + smoothed * weight
    lengths = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))])
    count = max(2, int(np.ceil(lengths[-1] / CENTERLINE_SPACING_MM)) + 1)
    samples = np.linspace(0, lengths[-1], count)
    return np.stack([np.interp(samples, lengths, points[:, axis]) for axis in range(3)], axis=1)


def assemble_graph(
    segments: list[list[int]],
    children: dict[int, list[int]],
    root: int,
    global_voxels: np.ndarray,
    clearance: np.ndarray,
    crop_voxels: np.ndarray,
    geometry: VolumeGeometry,
    split_voxels: set[int],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    node_ids: dict[int, int] = {root: 0}
    nodes: list[dict[str, Any]] = [
        {
            "id": 0,
            "lps": geometry.lps(global_voxels[root]).tolist(),
            "kind": "root",
            "degree": 1,
            "rootDistanceMm": 0.0,
            "parentNodeId": None,
            "parentEdgeId": None,
            "childEdgeIds": [],
        }
    ]
    edges: list[dict[str, Any]] = []
    for path in segments:
        start, end = node_ids[path[0]], len(nodes)
        node_ids[path[-1]] = end
        points = smooth_and_resample(geometry.lps(global_voxels[path]))
        length = float(np.linalg.norm(np.diff(points, axis=0), axis=1).sum())
        radius = float(np.median(clearance[tuple(crop_voxels[path].T)]))
        edge_id = len(edges)
        edges.append(
            {
                "id": edge_id,
                "sourceCurve": "dolphin-airway-skeleton",
                "sourceCellId": edge_id,
                "startNodeId": start,
                "endNodeId": end,
                "lengthMm": round(length, 3),
                "radiusMm": round(radius, 3),
                "pointsLps": np.round(points, 4).tolist(),
            }
        )
        nodes[start]["childEdgeIds"].append(edge_id)
        fanout = len(children.get(path[-1], []))
        nodes.append(
            {
                "id": end,
                "lps": edges[-1]["pointsLps"][-1],
                "kind": "terminal" if fanout == 0 else "internal" if fanout == 1 else "bifurcation",
                "degree": 1 + fanout,
                "rootDistanceMm": round(nodes[start]["rootDistanceMm"] + length, 3),
                "parentNodeId": start,
                "parentEdgeId": edge_id,
                "childEdgeIds": [],
            }
        )

    graph = {
        "schema": "fluoroview_airway_graph/v1",
        "units": "mm",
        "coordinateSystem": "LPS",
        "source": {
            "method": "Shortest paths on the skeleton of the airway mask (segmentation plus CT-grown upper airway)",
            "airThresholdHu": AIR_THRESHOLD_HU,
            "note": "Derived from the Local-Data Dolphin_bronch export; raw source files remain untracked.",
        },
        "rootNodeId": 0,
        "carinaNodeId": -1,
        "carinaLpsMm": [0, 0, 0],
        "terminalNodeIds": [n["id"] for n in nodes if n["kind"] == "terminal"],
        "nodes": nodes,
        "edges": edges,
    }
    labels, review = label_graph(graph)
    return graph, labels, review


def subtree_lengths(graph: dict[str, Any]) -> dict[int, float]:
    """Total centerline length below and including each edge."""
    edges = {e["id"]: e for e in graph["edges"]}
    nodes = {n["id"]: n for n in graph["nodes"]}
    totals: dict[int, float] = {}
    for edge in reversed(graph["edges"]):
        totals[edge["id"]] = edge["lengthMm"] + sum(
            totals[c] for c in nodes[edge["endNodeId"]]["childEdgeIds"]
        )
    assert len(totals) == len(edges)
    return totals


def label_graph(graph: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    nodes = {n["id"]: n for n in graph["nodes"]}
    edges = {e["id"]: e for e in graph["edges"]}
    totals = subtree_lengths(graph)
    edge_labels: dict[int, tuple[str, str]] = {}

    def subtree(edge_id: int) -> list[int]:
        out, stack = [], [edge_id]
        while stack:
            current = stack.pop()
            out.append(current)
            stack.extend(nodes[edges[current]["endNodeId"]]["childEdgeIds"])
        return out

    def mean_x(edge_id: int) -> float:
        points = np.concatenate([np.asarray(edges[e]["pointsLps"]) for e in subtree(edge_id)])
        return float(points[:, 0].mean())

    def main_child(node_id: int) -> int:
        return max(nodes[node_id]["childEdgeIds"], key=lambda e: totals[e])

    # Central path: left bony nasal passage -> fork with the right passage -> two split points
    # (laryngeal aditus, then the larynx-trachea junction) -> trachea -> main carina.
    central = [0]
    while True:
        node = nodes[edges[central[-1]]["endNodeId"]]
        child_ids = node["childEdgeIds"]
        if len(child_ids) >= 2:
            ranked = sorted(child_ids, key=lambda e: totals[e], reverse=True)
            if totals[ranked[1]] > 0.4 * totals[ranked[0]]:
                carina = node
                break
        if not child_ids:
            raise ValueError("No main carina on the central path")
        central.append(main_child(node["id"]))
    graph["carinaNodeId"] = carina["id"]
    graph["carinaLpsMm"] = carina["lps"]
    carina["kind"] = "carina"

    internal_breaks = [i for i, e in enumerate(central) if nodes[edges[e]["endNodeId"]]["kind"] == "internal"]
    if len(internal_breaks) != 2:
        raise ValueError(f"Expected two split points on the central path, found {len(internal_breaks)}")
    aditus_index, larynx_end_index = internal_breaks
    first_fork = nodes[edges[central[0]]["endNodeId"]]
    if len(first_fork["childEdgeIds"]) != 2:
        raise ValueError("Expected the left and right nasal passages to meet at the first fork")
    for position, edge_id in enumerate(central):
        if position == 0:
            edge_labels[edge_id] = ("LNP", LABELS["LNP"])
        elif position <= aditus_index:
            edge_labels[edge_id] = ("NPX", LABELS["NPX"])
        elif position <= larynx_end_index:
            edge_labels[edge_id] = ("LX", LABELS["LX"])
        else:
            edge_labels[edge_id] = ("TR", LABELS["TR"])
    right_passage = next(e for e in first_fork["childEdgeIds"] if e != central[1])
    for edge_id in subtree(right_passage):
        edge_labels[edge_id] = ("RNP", LABELS["RNP"])

    review: dict[str, Any] = {"centralPathEdgeIds": central, "sideBranches": []}
    # Side branches from the nasopharynx, larynx or trachea. The tracheal bronchus is the
    # right-sided one with the largest subtree; anything else keeps its parent's label.
    tracheal_sides = []
    for position, edge_id in enumerate(central[1:], start=1):
        parent_node = nodes[edges[central[position - 1]]["endNodeId"]]
        for side in parent_node["childEdgeIds"]:
            if side not in (edge_id, right_passage):
                tracheal_sides.append((side, edge_labels[central[position - 1]][0]))
    right_sides = [s for s, parent in tracheal_sides if parent == "TR" and mean_x(s) < carina["lps"][0]]
    tracheal_bronchus = max(right_sides, key=lambda e: totals[e]) if right_sides else None
    for side, parent_abbr in tracheal_sides:
        abbr = "TB" if side == tracheal_bronchus else parent_abbr
        for edge_id in subtree(side):
            edge_labels[edge_id] = (abbr, LABELS[abbr])
        review["sideBranches"].append({"edgeId": side, "label": abbr, "subtreeMm": round(totals[side], 1)})

    # Principal bronchi: each continues along its largest subtree; the branches off that
    # stem are numbered from the carina outward and each label covers its whole subtree.
    for stem_start in carina["childEdgeIds"]:
        side = "L" if mean_x(stem_start) > carina["lps"][0] else "R"
        stem_abbr = f"{side}PB"
        stem = [stem_start]
        while nodes[edges[stem[-1]]["endNodeId"]]["childEdgeIds"]:
            stem.append(main_child(edges[stem[-1]]["endNodeId"]))
        number = 0
        for edge_id in stem:
            edge_labels[edge_id] = (stem_abbr, LABELS[stem_abbr])
            for branch in nodes[edges[edge_id]["endNodeId"]]["childEdgeIds"]:
                if branch in stem:
                    continue
                number += 1
                lung = "Left" if side == "L" else "Right"
                label = (f"{side}{number}", f"{lung} principal bronchus, branch {number}")
                for sub_edge in subtree(branch):
                    edge_labels[sub_edge] = label
        review[f"{stem_abbr}Branches"] = number

    missing = [e for e in edges if e not in edge_labels]
    if missing:
        raise ValueError(f"Unlabeled edges: {missing}")
    labels = {
        "schema": "airway_anatomy_centerline_labels/v1",
        "units": "mm",
        "coordinateSystem": "LPS",
        "source": "build-dolphin-case.py (rule-based from the centerline graph)",
        "edgeLabels": {
            str(edge_id): {"abbreviatedLabel": abbr, "fullLabel": full, "sourceCellIds": [edge_id]}
            for edge_id, (abbr, full) in sorted(edge_labels.items())
        },
        "polylines": [
            {
                "id": f"centerline-{edge_id}",
                "sourceCellId": edge_id,
                "sourceCurve": "dolphin-airway-skeleton",
                "abbreviatedLabel": abbr,
                "fullLabel": full,
                "pointsLps": edges[edge_id]["pointsLps"],
                "anchorLps": edges[edge_id]["pointsLps"][len(edges[edge_id]["pointsLps"]) // 2],
                "matchedEdgeId": edge_id,
                "matchedDistanceMm": 0,
            }
            for edge_id, (abbr, full) in sorted(edge_labels.items())
        ],
    }
    review["carinaNodeId"] = carina["id"]
    review["trachealBronchusEdgeId"] = tracheal_bronchus
    return labels, review


def build_lumen_mesh(mask: np.ndarray, geometry: VolumeGeometry) -> tuple[trimesh.Trimesh, dict[str, Any]]:
    present = np.argwhere(mask)
    lo = present.min(0) - 2
    hi = present.max(0) + 3
    crop = np.zeros(hi - lo, dtype=np.float32)
    inner = mask[max(lo[0], 0) : hi[0], max(lo[1], 0) : hi[1], max(lo[2], 0) : hi[2]]
    crop[: inner.shape[0], : inner.shape[1], : inner.shape[2]] = inner
    verts, faces, _, _ = marching_cubes(crop, level=0.5, method="lewiner")
    mesh = trimesh.Trimesh(geometry.lps(verts + lo), faces, process=True)
    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=12)
    if mesh.volume < 0:
        mesh.invert()
    edges_per_face = trimesh.grouping.group_rows(mesh.edges_sorted, require_count=None)
    counts = np.array([len(group) for group in edges_per_face])
    topology = {
        "boundary": int((counts == 1).sum()),
        "nonmanifold": int((counts > 2).sum()),
        "components": int(mesh.body_count),
    }
    if topology != {"boundary": 0, "nonmanifold": 0, "components": 1} or not mesh.is_winding_consistent:
        raise ValueError(f"Lumen is not closed and connected: {topology}")
    return mesh, {
        "topology": topology,
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.faces),
        "genus": int(round(1 - mesh.euler_number / 2)),
        "volumeMl": round(float(mesh.volume) / 1000, 2),
    }


def validate_centerlines(graph: dict[str, Any], mesh: trimesh.Trimesh) -> list[dict[str, Any]]:
    """Keep the centerline off the wall: guided driving sweeps the tip along it.

    A sample closer than MIN_CENTERLINE_CLEARANCE_MM to the surface (or outside it) is moved
    along the inward wall normal to that clearance. Shared node points move once for every
    edge that meets there. The last 1.5 mm of a terminal edge may approach its end cap.
    """
    query = trimesh.proximity.ProximityQuery(mesh)
    nodes = {n["id"]: n for n in graph["nodes"]}
    references: dict[tuple[float, ...], list[tuple[int, int]]] = {}
    for edge in graph["edges"]:
        for index, point in enumerate(edge["pointsLps"]):
            references.setdefault(tuple(np.round(point, 4)), []).append((edge["id"], index))
    edges = {e["id"]: e for e in graph["edges"]}
    repairs = []
    truncate: dict[int, int] = {}
    for key, users in references.items():
        point = np.asarray(key)
        protected = all(
            nodes[edges[e]["endNodeId"]]["kind"] == "terminal"
            and edges[e]["lengthMm"] - index * CENTERLINE_SPACING_MM < 1.5
            for e, index in users
        )
        depth = float(query.signed_distance([point])[0])
        if protected or depth >= MIN_CENTERLINE_CLEARANCE_MM:
            continue
        moved = point
        for _ in range(4):
            closest = query.on_surface([moved])[0][0]
            inward = (moved - closest) * (1 if depth > 0 else -1)
            moved = closest + inward / max(np.linalg.norm(inward), 1e-9) * MIN_CENTERLINE_CLEARANCE_MM
            depth = float(query.signed_distance([moved])[0])
            if depth >= MIN_CENTERLINE_CLEARANCE_MM * 0.8:
                break
        if depth <= 0.12:
            # A terminal twig narrower than the clearance: end the branch before this point.
            edge_id, index = users[0]
            if len(users) > 1 or nodes[edges[edge_id]["endNodeId"]]["kind"] != "terminal" or index < 4:
                raise ValueError(f"Centerline point {key} on edge {edge_id} cannot clear the wall")
            truncate[edge_id] = min(truncate.get(edge_id, index), index)
            continue
        repairs.append({"edgeIds": sorted({e for e, _ in users}), "fromDepthMm": round(float(query.signed_distance([point])[0]), 3)})
        for edge_id, index in users:
            edges[edge_id]["pointsLps"][index] = np.round(moved, 4).tolist()
    for edge_id, index in truncate.items():
        del edges[edge_id]["pointsLps"][index:]
        repairs.append({"edgeIds": [edge_id], "truncatedAtPoint": index})
    for edge in graph["edges"]:
        nodes[edge["endNodeId"]]["lps"] = edge["pointsLps"][-1]
        points = np.asarray(edge["pointsLps"])
        edge["lengthMm"] = round(float(np.linalg.norm(np.diff(points, axis=0), axis=1).sum()), 3)
    for node in graph["nodes"]:
        parent = node["parentEdgeId"]
        node["rootDistanceMm"] = (
            0.0 if parent is None else round(nodes[edges[parent]["startNodeId"]]["rootDistanceMm"] + edges[parent]["lengthMm"], 3)
        )
    if graph["carinaNodeId"] in nodes:
        graph["carinaLpsMm"] = nodes[graph["carinaNodeId"]]["lps"]
    return repairs


def write_glb(path: Path, mesh: trimesh.Trimesh) -> None:
    """One mesh, one node, no transform: positions are patient LPS millimeters."""
    positions = np.ascontiguousarray(mesh.vertices, dtype="<f4")
    indices = np.ascontiguousarray(mesh.faces.ravel(), dtype="<u4")
    position_bytes, index_bytes = positions.tobytes(), indices.tobytes()
    binary = position_bytes + index_bytes
    document = {
        "asset": {"version": "2.0", "generator": "build-dolphin-case.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "dolphin_airway_lumen"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4}]}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(position_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(position_bytes), "byteLength": len(index_bytes), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": len(positions),
                "type": "VEC3",
                "min": positions.min(0).tolist(),
                "max": positions.max(0).tolist(),
            },
            {"bufferView": 1, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
    }
    json_bytes = json.dumps(document, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with path.open("wb") as handle:
        handle.write(struct.pack("<III", 0x46546C67, 2, total))
        handle.write(struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes)
        handle.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


def build_ct_preview(
    ct: np.ndarray, geometry: VolumeGeometry, output_path: Path, *, min_z: int, skip: bool
) -> dict[str, Any]:
    """Body-cropped, strided preview from just caudal to the lungs, flipped so the index axes
    run along +L, +P and +S."""
    present = np.argwhere(ct[:, :, min_z:] > -500) + [0, 0, min_z]
    lo = np.maximum(present.min(0) - 4, 0)
    hi = np.minimum(present.max(0) + 5, ct.shape)
    stride = np.asarray(CT_STRIDE_XYZ)
    sampled = ct[lo[0] : hi[0] : stride[0], lo[1] : hi[1] : stride[1], lo[2] : hi[2] : stride[2]]
    last = lo + (np.asarray(sampled.shape) - 1) * stride
    for axis in range(3):
        if geometry.steps[axis] < 0:
            sampled = np.flip(sampled, axis=axis)
    corner = np.where(geometry.steps < 0, last, lo)
    if not skip or not output_path.exists():
        output_path.write_bytes(np.ascontiguousarray(sampled.transpose(2, 1, 0)).astype("<i2").tobytes())
    return {
        "sourceNrrd": CT_SOURCE_NAME,
        "previewRaw": f"ct/{CT_PREVIEW_NAME}",
        "previewRawUrl": f"{ASSET_BASE_URL}/ct/{CT_PREVIEW_NAME}",
        "format": "int16-raw",
        "sizeXyz": list(map(int, sampled.shape)),
        "originalSizeXyz": geometry.size.tolist(),
        "strideXyz": stride.tolist(),
        "spacingXyzMm": (geometry.spacing * stride).tolist(),
        "originalSpacingXyzMm": geometry.spacing.tolist(),
        "originLps": np.round(geometry.lps(corner), 4).tolist(),
        "directionLps": [1, 0, 0, 0, 1, 0, 0, 0, 1],
        "space": "left-posterior-superior",
        "windowPresets": [
            {"id": "lung", "label": "Lung", "low": -1000, "high": -300},
            {"id": "mediastinal", "label": "Mediastinal", "low": -160, "high": 240},
            {"id": "bone", "label": "Bone", "low": -450, "high": 1050},
        ],
    }


def orientation_landmarks(graph: dict[str, Any], labels: dict[str, Any]) -> list[dict[str, Any]]:
    """Roll the flexible view through the larynx so the trachea reads like the human module:
    ventral at the top of the screen and the right principal bronchus on the screen right.
    Parallel transport alone carries the twist of the curved nasal and laryngeal path."""
    abbr = {int(k): v["abbreviatedLabel"] for k, v in labels["edgeLabels"].items()}
    larynx = next(e for e in graph["edges"] if abbr[e["id"]] == "LX")
    carina = next(n for n in graph["nodes"] if n["id"] == graph["carinaNodeId"])
    principal = {abbr[e]: e for e in carina["childEdgeIds"]}
    return [
        {
            "id": "trachea",
            "label": "Trachea",
            "edgeId": larynx["id"],
            "distanceMm": round(larynx["lengthMm"] - 1, 1),
            "targetEdgeId": principal["LPB"],
            "oppositeEdgeId": principal["RPB"],
            "screenDirection": "left",
            "expectation": "Ventral wall at the top; the right tracheal bronchus and right principal bronchus to the right",
        }
    ]


def build_manifest(
    graph: dict[str, Any],
    labels: dict[str, Any],
    ct_asset: dict[str, Any],
    segmentation_sha: str,
    glb_sha: str,
    review: dict[str, Any],
) -> dict[str, Any]:
    lumen_url = f"{ASSET_BASE_URL}/{LUMEN_GLB_NAME}"
    identity = {"sceneScale": 1, "rotationDeg": [0, 0, 0], "positionOffsetMm": [0, 0, 0]}
    return {
        "schema": "airway_anatomy_case/v1",
        "id": f"airway-anatomy-{CASE_ID}",
        "title": "Dolphin Airway Synchronized Bronchoscopy",
        "version": "1.0.0",
        "coordinateSystem": "LPS",
        "units": "mm",
        "safetyLabel": "Educational simulation only - not for diagnosis, treatment, or procedure guidance.",
        "sourcePolicy": "Raw CT and segmentation remain in Local-Data/Dolphin_bronch. The app loads assets derived by scripts/airway-anatomy/build-dolphin-case.py.",
        "assetBaseUrl": ASSET_BASE_URL,
        "assets": {
            "airwayGlb": lumen_url,
            "reviewedLumenGlb": lumen_url,
            "airwayGraphJson": f"{ASSET_BASE_URL}/metadata/airway_graph.json",
            "centerlineLabelsJson": f"{ASSET_BASE_URL}/metadata/centerline_labels.json",
            "ctPreviewRaw": ct_asset["previewRawUrl"],
        },
        "airwayTransform": {**identity, "note": "lumen.glb is written in patient LPS millimeters."},
        "airwaySurfaceTransform": {**identity, "note": "lumen.glb is aligned with the CT and centerlines."},
        "ct": ct_asset,
        "geometryValidation": {
            "schema": "lumen-validation/v1",
            "closed": True,
            "sourceSha256": segmentation_sha,
            "displaySha256": glb_sha,
            "coordinateSystem": "LPS",
            "units": "mm",
            "topology": review["topology"],
        },
        "orientationLandmarks": orientation_landmarks(graph, labels),
        "ostialLandmarks": [],
        "interaction": {
            "rootNodeId": graph["rootNodeId"],
            "carinaNodeId": graph["carinaNodeId"],
            "defaultEdgeId": 0,
            "initialDistanceMm": 4,
            "stepMm": 3,
            "lookAheadMm": 14,
            "trailMaxPoints": 240,
            # The scope enters the left bony nasal passage heading ventrally; rostral is screen-up
            # there, which carries over to ventral-up in the trachea.
            "rootUpLps": [0, 0, 1],
        },
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
