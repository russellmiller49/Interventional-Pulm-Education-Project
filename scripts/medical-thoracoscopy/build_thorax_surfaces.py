"""Build the thorax surfaces the course's space is made of, from the audited CT segmentation.

    python3 scripts/medical-thoracoscopy/audit_thorax_sources.py --check
    python3 scripts/medical-thoracoscopy/build_thorax_surfaces.py [--install-dev]

Built, in LPS millimetres, and written to the owner's local data (never to the repository, because
the segmentation's terms are not settled: rights register, R-ANATOMY-SEGMENTATION):

- `pleural-space.glb`: the surface of the right pleural space, the right lung and effusion joined,
  closed at 3 mm and meshed as one watertight volume. It is divided into the seven survey zones of
  `pleural-zones.json`: one named node per zone, all sharing one vertex array, so together they hold
  every face of the surface exactly once.
- `ribs.glb`: the right ribs as twelve nodes, numbered 1 to 12 from their spinal ends, and the left
  ribs as one node.
- `context.glb`: the diaphragm, the heart, the great vessels and the skin, for the Chest view. The
  skin is left open where the scan's field ends; nothing is invented beyond it.

Measured, and written to the repository as numbers only (`content/data/anatomy/`):

- `surfaces.json`: each file's hash, size and nodes; each surface's triangles, area, and for closed
  ones volume, watertightness and outward orientation; each zone's share of the pleural surface.
- `ribs.json`: how each right rib was numbered.
- `port-candidates.json`: the 5th to 8th intercostal spaces on the anterior, mid- and posterior
  axillary lines: the gap between the ribs, measured bone to bone; the chest wall's thickness from
  the parietal pleura to the air outside the body, where the scan holds it; the depth to the lung
  along the same line; and the distance from the pleura to the nearest diaphragm.
- `port-record.json`: the prototype port (owner decisions, T6, a default): the pivot, the corridor
  axis, and the patch of chest wall the shaft may cross.

`--install-dev` copies the GLBs into `public/models/medical-thoracoscopy/v1/anatomy/`, which Git
ignores, so the dev server can show them. They are not uploaded and not published.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

import manifold3d
import numpy as np
import trimesh
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
from skimage.segmentation import watershed

from thorax_common import (
    ATTRIBUTION,
    DEV_INSTALL,
    GRAVITY_LPS,
    LABEL,
    PRESENTATION_FROM_LPS,
    RECORDS,
    ZONES,
    Volume,
    load_ct,
    rounded,
    sha256_file,
    work_path,
    write_glb,
    write_record,
)

ZONE_LIST = json.loads(ZONES.read_text())
SPLIT = ZONE_LIST["split"]
ZONE_IDS = [zone["id"] for zone in ZONE_LIST["zones"]]
SPACE_CLOSING_MM = 3.0
SMOOTH_SIGMA_VOXELS = 1.0
SIMPLIFY_MM = {"pleural-space": 0.5, "rib": 0.5}
# The Chest view shows context small: each structure is meshed on a coarser grid (voxels per cell)
# and reduced to about this many triangles.
CONTEXT_FACES = {"diaphragm": 6000, "heart": 6000, "aorta": 4000, "superior-vena-cava": 1200,
                 "inferior-vena-cava": 1200, "pulmonary-artery": 5000, "skin": 20000}
CONTEXT_DOWNSAMPLE = 3
STERNUM_HALF_WIDTH_MM = 18.0
ISLAND_FRACTION = 0.15  # a piece of a zone smaller than this share of the zone's largest piece is absorbed
ANTERIOR_CUT_FRACTION = 0.30  # of the right rib cage's front-to-back depth, cut away to separate the ribs
PORT_SPACES = (5, 6, 7, 8)
PORT_LINES = {"anterior axillary": "anteriorDeg", "mid-axillary": "midDeg", "posterior axillary": "posteriorDeg"}
PROTOTYPE_PORT = {"space": 7, "line": "mid-axillary"}  # owner decisions, T6: a default, not a decision
WEDGE_DEG = 6.0
AIR_HU = -500.0
T0 = time.time()


def log(message: str) -> None:
    print(f"[{time.time() - T0:5.0f}s] {message}", flush=True)


# ── meshing ───────────────────────────────────────────────────────────────────────────────────

def mesh_mask(volume: Volume, mask: np.ndarray, simplify_mm: float | None, closed: bool = True,
              target_faces: int | None = None, downsample: int = 1) -> trimesh.Trimesh:
    """Mesh a voxel mask in LPS millimetres. Closed masks are padded so the surface closes; an open
    one keeps the array's edge, so a surface cut by the scan's field stays open there."""
    idx = np.argwhere(mask)
    lo = idx.min(0) - (2 if closed else 0)
    hi = idx.max(0) + (3 if closed else 1)
    lo = np.maximum(lo, 0) if not closed else lo
    hi = np.minimum(hi, volume.shape) if not closed else hi
    if closed:
        crop = np.zeros(hi - lo, dtype=np.float32)
        src_lo = np.maximum(lo, 0)
        src_hi = np.minimum(hi, volume.shape)
        crop[tuple(slice(a - l, b - l) for a, b, l in zip(src_lo, src_hi, lo))] = mask[
            tuple(slice(a, b) for a, b in zip(src_lo, src_hi))]
    else:
        crop = mask[tuple(slice(a, b) for a, b in zip(lo, hi))].astype(np.float32)
    spacing = volume.spacing
    if downsample > 1:
        # Average blocks of voxels first: a coarser grid meshes to fewer, smoother triangles.
        shape = (np.array(crop.shape) // downsample) * downsample
        crop = crop[:shape[0], :shape[1], :shape[2]].reshape(
            shape[0] // downsample, downsample, shape[1] // downsample, downsample,
            shape[2] // downsample, downsample).mean(axis=(1, 3, 5))
        spacing = spacing * downsample
        lo = lo + (downsample - 1) / 2.0
    crop = ndimage.gaussian_filter(crop, SMOOTH_SIGMA_VOXELS)
    verts, faces, _, _ = marching_cubes(crop, 0.5, spacing=tuple(spacing))
    verts = verts + volume.origin + lo * volume.spacing
    mesh = trimesh.Trimesh(verts, faces, process=True)
    if target_faces is not None:
        return simplify_to(mesh, target_faces) if closed else decimate_open(mesh, target_faces)
    if closed:
        simplified = manifold3d.Manifold(manifold3d.Mesh(
            vert_properties=np.asarray(mesh.vertices, np.float32),
            tri_verts=np.asarray(mesh.faces, np.uint32))).simplify(simplify_mm).to_mesh()
        mesh = trimesh.Trimesh(simplified.vert_properties[:, :3], simplified.tri_verts, process=True)
        if mesh.volume < 0:
            mesh.invert()
    return mesh


def simplify_to(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """Simplify a closed surface by shape. Manifold's simplifier keeps fewest triangles at a small
    tolerance, so the smallest result of a few is taken; if it is still well over the target, the
    surface is reduced by clustering instead."""
    solid = manifold3d.Manifold(manifold3d.Mesh(vert_properties=np.asarray(mesh.vertices, np.float32),
                                                tri_verts=np.asarray(mesh.faces, np.uint32)))
    results = [solid.simplify(tolerance).to_mesh() for tolerance in (0.3, 0.5, 0.8)]
    best = min((out for out in results if len(out.tri_verts) > 0), key=lambda out: len(out.tri_verts), default=None)
    if best is not None and len(best.tri_verts) <= 1.5 * target_faces:
        result = trimesh.Trimesh(best.vert_properties[:, :3], best.tri_verts, process=True)
        if result.volume < 0:
            result.invert()
        return result
    return decimate_open(mesh, target_faces)


def decimate_open(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """Reduce an open surface by vertex clustering on a grid sized to reach about the target."""
    area = mesh.area
    cell = float(np.sqrt(2.0 * area / max(target_faces, 1)))
    keys = np.floor(mesh.vertices / cell).astype(np.int64)
    _, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.reshape(-1)
    counts = np.bincount(inverse)
    centres = np.zeros((counts.size, 3))
    np.add.at(centres, inverse, mesh.vertices)
    centres /= counts[:, None]
    faces = inverse[mesh.faces]
    keep = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    out = trimesh.Trimesh(centres, faces[keep], process=True)
    out.remove_unreferenced_vertices()
    return out


def central(volume: Volume, mask: np.ndarray, half_width_mm: float = 45.0) -> np.ndarray:
    """The part of a mask within a band either side of the midline: the trunk, not the branches."""
    spine_x = volume.to_lps(np.argwhere(volume.mask("spine")).mean(0))[0]
    xs = volume.origin[0] + np.arange(volume.shape[0]) * volume.spacing[0]
    return mask & (np.abs(xs - spine_x) < half_width_mm)[:, None, None]


def largest_piece(mask: np.ndarray) -> np.ndarray:
    labels, count = ndimage.label(mask, structure=np.ones((3, 3, 3)))
    if count <= 1:
        return mask
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    return labels == sizes.argmax()


# ── the pleural space ─────────────────────────────────────────────────────────────────────────

def pleural_space_mask(volume: Volume) -> np.ndarray:
    union = (volume.mask("right-lung-upper") | volume.mask("right-lung-middle")
             | volume.mask("right-lung-lower") | volume.mask("right-effusion"))
    rad = np.ceil(SPACE_CLOSING_MM / volume.spacing).astype(int)
    grid = np.ogrid[tuple(slice(-r, r + 1) for r in rad)]
    ball = sum((g * s) ** 2 for g, s in zip(grid, volume.spacing)) <= SPACE_CLOSING_MM ** 2
    space = ndimage.binary_fill_holes(ndimage.binary_closing(union, structure=ball))
    return largest_piece(space)


# ── ribs ──────────────────────────────────────────────────────────────────────────────────────

def number_right_ribs(volume: Volume) -> tuple[np.ndarray, list[dict], np.ndarray]:
    """Label each right rib 1–12 from its spinal end. Returns labels, the record, and the left cage."""
    cage = volume.mask("rib-cage")
    spine_x = volume.to_lps(np.argwhere(volume.mask("spine")).mean(0))[0]
    i_mid = int(round((spine_x - volume.origin[0]) / volume.spacing[0]))
    # The sternum, which the rib cage segment includes: bone within a band either side of the
    # midline, in front of the vertebral column.
    xs = volume.origin[0] + np.arange(volume.shape[0]) * volume.spacing[0]
    ys_axis = volume.origin[1] + np.arange(volume.shape[1]) * volume.spacing[1]
    spine_front = volume.to_lps(np.argwhere(volume.mask("spine")))[:, 1].min()
    band = np.abs(xs - spine_x) < STERNUM_HALF_WIDTH_MM
    front = ys_axis < spine_front
    sternum = cage & band[:, None, None] & front[None, :, None]
    cage = cage & ~sternum
    right = cage.copy()
    right[i_mid:] = False
    left = cage & ~right
    ys = volume.to_lps(np.argwhere(right))[:, 1]
    cut = ys.min() + ANTERIOR_CUT_FRACTION * (ys.max() - ys.min())
    j_cut = int(np.ceil((cut - volume.origin[1]) / volume.spacing[1]))
    back = right.copy()
    back[:, :j_cut] = False
    pieces, count = ndimage.label(back, structure=np.ones((3, 3, 3)))
    if count != 12:
        raise SystemExit(f"The right rib cage separates into {count} pieces, not 12; numbering stops here")
    ends = []
    for k in range(1, count + 1):
        vox = np.argwhere(pieces == k)
        end = volume.to_lps(vox[np.argmax(vox[:, 1])])  # the most posterior voxel: the spinal end
        ends.append((end[2], k, end, len(vox)))
    ends.sort(key=lambda item: -item[0])
    markers = np.zeros(pieces.shape, dtype=np.int32)
    record = []
    for number, (_, k, end, voxels) in enumerate(ends, start=1):
        markers[pieces == k] = number
        record.append({"number": number, "spinalEndLps": end.tolist(), "voxelsBehindCut": int(voxels)})
    labels = watershed(np.zeros(right.shape, dtype=np.uint8), markers=markers, mask=right)
    for entry in record:
        entry["volumeMl"] = float((labels == entry["number"]).sum() * volume.voxel_ml)
    return labels, record, left, sternum


# ── the zones ─────────────────────────────────────────────────────────────────────────────────

def surface_points(volume: Volume, mask: np.ndarray) -> np.ndarray:
    return volume.to_lps(np.argwhere(mask & ~ndimage.binary_erosion(mask)))


def slab_angles(points: np.ndarray, reference: np.ndarray) -> np.ndarray:
    """The axillary-line angle of each point: about the centroid of `reference` in its axial slab."""
    slab = SPLIT["axillaryLines"]["slabMm"]
    lo = reference[:, 2].min()
    theta = np.zeros(len(points))
    ref_slab = np.floor((reference[:, 2] - lo) / slab).astype(int)
    pt_slab = np.floor((points[:, 2] - lo) / slab).astype(int)
    centres = {}
    for s in np.unique(ref_slab):
        sel = ref_slab == s
        centres[s] = reference[sel, :2].mean(0)
    keys = np.array(sorted(centres))
    for s in np.unique(pt_slab):
        nearest = keys[np.argmin(np.abs(keys - s))]
        cx, cy = centres[nearest]
        sel = pt_slab == s
        theta[sel] = np.degrees(np.arctan2(points[sel, 1] - cy, -(points[sel, 0] - cx)))
    return theta


def split_zones(volume: Volume, mesh: trimesh.Trimesh, space: np.ndarray, rib_labels: np.ndarray) -> np.ndarray:
    centre = mesh.triangles_center
    normal = mesh.face_normals
    area = mesh.area_faces
    near = SPLIT["nearestTissueMm"]
    groups = {
        "chest wall": (rib_labels > 0) | volume.mask("spine"),
        "diaphragm": volume.mask("diaphragm") | volume.mask("liver"),
        "mediastinum": (volume.mask("heart") | volume.mask("aorta") | volume.mask("superior-vena-cava")
                        | volume.mask("inferior-vena-cava") | volume.mask("pulmonary-artery")
                        | volume.mask("pulmonary-vein") | volume.mask("esophagus") | volume.mask("airway")),
    }
    dist = {name: cKDTree(surface_points(volume, mask)).query(centre)[0] for name, mask in groups.items()}
    d_wall, d_dia, d_med = dist["chest wall"], dist["diaphragm"], dist["mediastinum"]
    names = np.array(["chest wall", "diaphragm", "mediastinum"], dtype=object)
    cls = np.zeros(len(centre), dtype=int)
    dia = (d_dia <= near["diaphragm"]) & (d_dia <= d_wall + 2) & (d_dia <= d_med)
    med = ~dia & (d_med <= near["mediastinum"]) & (d_med < d_wall)
    far = ~dia & ~med & (d_wall > near["chestWall"])
    cls[dia] = 1
    cls[med] = 2
    cls[far & (normal[:, 0] > 0.3)] = 2
    cls[far & (normal[:, 2] < -0.5)] = 1
    adj = mesh.face_adjacency
    for _ in range(SPLIT["smoothingPasses"]):
        votes = np.zeros((len(centre), 3))
        np.add.at(votes, (np.arange(len(centre)), cls), area * 1.5)
        np.add.at(votes, (adj[:, 0], cls[adj[:, 1]]), area[adj[:, 1]])
        np.add.at(votes, (adj[:, 1], cls[adj[:, 0]]), area[adj[:, 0]])
        cls = votes.argmax(1)
    # A face turned toward the chest wall is not mediastinum, and one turned upward is not diaphragm.
    cls[(cls == 2) & (normal[:, 0] < -0.2)] = 0
    cls[(cls == 1) & (normal[:, 2] > 0.3)] = 0

    zone = np.empty(len(centre), dtype=object)
    zone[cls == 1] = "diaphragm"
    zone[cls == 2] = "mediastinum"
    wall = cls == 0
    theta = slab_angles(centre, volume.to_lps(np.argwhere(space)[::7]))
    lines = SPLIT["axillaryLines"]
    zone[wall & (theta < lines["anteriorDeg"])] = "anterior-chest-wall"
    zone[wall & (theta > lines["posteriorDeg"])] = "posterior-chest-wall"
    zone[wall & (theta >= lines["anteriorDeg"]) & (theta <= lines["posteriorDeg"])] = "lateral-chest-wall"
    # The costophrenic recess: a band either side of the line where the chest wall meets the diaphragm.
    a, b = cls[adj[:, 0]], cls[adj[:, 1]]
    meeting = ((a == 0) & (b == 1)) | ((a == 1) & (b == 0))
    if meeting.any():
        line_points = mesh.vertices[mesh.face_adjacency_edges[meeting]].mean(axis=1)
        d_line = cKDTree(line_points).query(centre)[0]
        zone[(d_line < SPLIT["costophrenicBandMm"]) & (cls != 2)] = "costophrenic-recess"
    # The apex: everything cranial to the lower border of rib 2, measured over its lateral-most part.
    apex = SPLIT["apex"]
    rib = volume.to_lps(np.argwhere(rib_labels == apex["rib"]))
    lateral = rib[rib[:, 0] < rib[:, 0].min() + apex["measuredOverLateralMm"]]
    z_apex = lateral[:, 2].min() if apex["border"] == "lower" else lateral[:, 2].max()
    zone[centre[:, 2] > z_apex] = "apex"
    return absorb_islands(mesh, zone), float(z_apex)


def zone_pieces(mesh: trimesh.Trimesh, zone: np.ndarray, zone_id: str) -> list[np.ndarray]:
    faces = np.flatnonzero(zone == zone_id)
    adj = mesh.face_adjacency
    inside = np.zeros(len(zone), dtype=bool)
    inside[faces] = True
    edges = adj[inside[adj[:, 0]] & inside[adj[:, 1]]]
    return trimesh.graph.connected_components(edges, nodes=faces, min_len=1)


def absorb_islands(mesh: trimesh.Trimesh, zone: np.ndarray) -> np.ndarray:
    """Give each small, stray piece of a zone to the zone that surrounds it most."""
    adj = mesh.face_adjacency
    area = mesh.area_faces
    for _ in range(20):
        changed = False
        for zone_id in ZONE_IDS:
            pieces = zone_pieces(mesh, zone, zone_id)
            if len(pieces) <= 1:
                continue
            sizes = np.array([area[piece].sum() for piece in pieces])
            for piece, size in zip(pieces, sizes):
                if size >= ISLAND_FRACTION * sizes.max():
                    continue
                inside = np.zeros(len(zone), dtype=bool)
                inside[piece] = True
                edges = adj[inside[adj[:, 0]] != inside[adj[:, 1]]]
                neighbours = np.where(inside[edges[:, 0]], edges[:, 1], edges[:, 0])
                others = zone[neighbours]
                others = others[others != zone_id]
                if len(others) == 0:
                    continue
                values, counts = np.unique(others, return_counts=True)
                zone[piece] = values[np.argmax(counts)]
                changed = True
        if not changed:
            break
    return zone


# ── the port candidates ───────────────────────────────────────────────────────────────────────

def first_hit(volume: Volume, start: np.ndarray, direction: np.ndarray, test, limit_mm: float, step: float = 0.25):
    """Distance along a ray to the first voxel for which `test(ijk)` holds, or None."""
    for t in np.arange(0.0, limit_mm, step):
        p = start + t * direction
        ijk = np.round((p - volume.origin) / volume.spacing).astype(int)
        if np.any(ijk < 0) or np.any(ijk >= volume.shape):
            return None, "left the scan"
        if test(ijk):
            return t, None
    return None, "not reached"


def body_outline(volume: Volume, ct: np.ndarray, k_shift: int) -> np.ndarray:
    """The body, on the segmentation's grid: in each axial slice, tissue denser than air, its largest
    piece, with every hole inside it (the lungs, the airways) filled. What is not body is air outside
    it, or beyond the scan."""
    body = np.zeros(volume.labels.shape[1:], dtype=bool)
    for k in range(body.shape[2]):
        kc = k - k_shift
        if kc < 0 or kc >= ct.shape[2]:
            continue
        tissue = ct[:, :, kc] > AIR_HU
        labels, count = ndimage.label(tissue)
        if count == 0:
            continue
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        body[:, :, k] = ndimage.binary_fill_holes(labels == sizes.argmax())
    return body


def leave_layer(volume: Volume, start: np.ndarray, direction: np.ndarray, layer: np.ndarray, limit_mm: float,
                step: float = 0.25):
    """Distance along a ray to where it leaves `layer`, having entered it; None if it never does."""
    entered = False
    for t in np.arange(0.0, limit_mm, step):
        ijk = np.round((start + t * direction - volume.origin) / volume.spacing).astype(int)
        if np.any(ijk < 0) or np.any(ijk >= volume.shape):
            return None
        inside = bool(layer[tuple(ijk)])
        if inside:
            entered = True
        elif entered:
            return float(t)
    return None


def measure_ports(volume: Volume, mesh: trimesh.Trimesh, space: np.ndarray, rib_labels: np.ndarray) -> list[dict]:
    ct, ct_origin, _ = load_ct()
    k_shift = int(round((ct_origin[2] - volume.origin[2]) / volume.spacing[2]))
    lung = (volume.mask("right-lung-upper") | volume.mask("right-lung-middle") | volume.mask("right-lung-lower"))
    body = body_outline(volume, ct, k_shift)
    diaphragm_tree = cKDTree(surface_points(volume, volume.mask("diaphragm") | volume.mask("liver")))
    space_points = volume.to_lps(np.argwhere(space)[::7])
    skin = volume.mask("skin")
    rows = []
    for space_number in PORT_SPACES:
        upper = volume.to_lps(np.argwhere(rib_labels == space_number))
        lower = volume.to_lps(np.argwhere(rib_labels == space_number + 1))
        theta_upper = slab_angles(upper, space_points)
        theta_lower = slab_angles(lower, space_points)
        for line, key in PORT_LINES.items():
            angle = SPLIT["axillaryLines"][key]
            u = upper[np.abs(theta_upper - angle) <= WEDGE_DEG / 2]
            v = lower[np.abs(theta_lower - angle) <= WEDGE_DEG / 2]
            row = {"space": space_number, "line": line, "angleDeg": angle}
            if len(u) == 0 or len(v) == 0:
                row["status"] = "a rib does not reach this line in the scan"
                rows.append(row)
                continue
            dist, index = cKDTree(v).query(u)
            i = int(np.argmin(dist))
            a, b = u[i], v[index[i]]
            gap = float(dist[i])
            mid = (a + b) / 2
            face = mesh.nearest.on_surface([mid])[2][0]
            inward = -mesh.face_normals[face]
            pleura_point = mesh.nearest.on_surface([mid])[0][0]
            # outward from the pleura to the air outside the body, through the CT
            def is_air(ijk):
                return not body[tuple(ijk)]
            to_air, air_status = first_hit(volume, pleura_point, -inward, is_air, 150.0)
            to_skin_exit = leave_layer(volume, pleura_point, -inward, skin, 150.0)
            if to_air is not None and (to_skin_exit is None or to_air <= to_skin_exit + 3.0):
                to_skin, skin_status = to_air, None
            elif to_air is None:
                to_skin, skin_status = None, air_status
            else:
                to_skin = None
                skin_status = (f"the line leaves the skin layer at {to_skin_exit:.1f} mm but reaches air only at "
                               f"{to_air:.1f} mm: something lies against the chest wall here")
            to_lung, lung_status = first_hit(volume, pleura_point, inward, lambda ijk: lung[tuple(ijk)], 150.0)
            to_dia = float(diaphragm_tree.query(pleura_point)[0])
            row.update({
                "status": "measured",
                "ribGapMm": gap,
                "upperRibPointLps": a.tolist(),
                "lowerRibPointLps": b.tolist(),
                "spaceMidpointLps": mid.tolist(),
                "pleuraPointLps": pleura_point.tolist(),
                "inwardAxis": inward.tolist(),
                "skinInScan": to_skin is not None,
                "wallThicknessMm": to_skin,
                "skinNote": skin_status,
                "distanceToAirMm": to_air,
                "distanceOutOfSkinLayerMm": to_skin_exit,
                "depthToLungMm": to_lung,
                "lungNote": lung_status,
                "distanceToDiaphragmMm": to_dia,
            })
            rows.append(row)
            log(f"space {space_number} {line:18s} gap {gap:5.1f} mm  wall {to_skin}  air {to_air}  skin-exit {to_skin_exit}  lung {to_lung}  diaphragm {to_dia:.1f}")
    return rows


def port_record(rows: list[dict], sleeve_mm: float) -> dict:
    row = next(r for r in rows if r["space"] == PROTOTYPE_PORT["space"] and r["line"] == PROTOTYPE_PORT["line"])
    if row["status"] != "measured":
        raise SystemExit("The prototype port's space was not measured")
    axis = np.array(row["inwardAxis"])
    pleura = np.array(row["pleuraPointLps"])
    pivot = np.array(row["spaceMidpointLps"])
    return {
        "record": "medical-thoracoscopy-port-record",
        "version": 1,
        "script": "scripts/medical-thoracoscopy/build_thorax_surfaces.py",
        "decision": "Owner decisions, T6: a default, not a decision. Chosen for this model, not a recommended site.",
        "space": row["space"],
        "line": row["line"],
        "side": "right",
        "pivotLps": pivot.tolist(),
        "pivotIs": "The midpoint of the closest approach between the two ribs, at the level of the ribs.",
        "corridorAxis": axis.tolist(),
        "corridorAxisIs": "Into the chest, along the inward normal of the pleural surface nearest the pivot.",
        "pleuraPointLps": pleura.tolist(),
        "ribGapMm": row["ribGapMm"],
        "wallThicknessMm": row["wallThicknessMm"],
        "sleeveOuterDiameterMm": sleeve_mm,
        "clearanceEachSideMm": (row["ribGapMm"] - sleeve_mm) / 2,
        "wallPatch": {
            "centreLps": pivot.tolist(),
            "radiusMm": row["ribGapMm"] / 2,
            "is": "The disc of chest wall, across the corridor axis at the pivot, that the shaft may cross.",
        },
    }


# ── main ──────────────────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-dev", action="store_true")
    args = parser.parse_args()

    volume = Volume()
    log("segmentation loaded")
    space = pleural_space_mask(volume)
    space_ml = float(space.sum() * volume.voxel_ml)
    mesh = mesh_mask(volume, space, SIMPLIFY_MM["pleural-space"])
    log(f"pleural space: {space_ml:.1f} mL of voxels, {len(mesh.faces)} faces, {mesh.volume / 1000:.1f} mL meshed")
    rib_labels, rib_record, left_cage, sternum = number_right_ribs(volume)
    log("right ribs numbered 1 to 12")
    zone, z_apex = split_zones(volume, mesh, space, rib_labels)
    unknown = sorted(set(zone) - set(ZONE_IDS))
    if unknown or any(z is None for z in zone):
        raise SystemExit(f"Faces left outside the zone list: {unknown}")
    log("zones: " + ", ".join(f"{z} {int((zone == z).sum())}" for z in ZONE_IDS))

    raw = work_path("raw", "pleural-space.glb").parent
    root = {"label": LABEL, "attribution": ATTRIBUTION, "frame": "LPS millimetres",
            "presentationFromLps": PRESENTATION_FROM_LPS.tolist(), "gravityLps": GRAVITY_LPS.tolist()}
    faces = np.asarray(mesh.faces)
    write_glb(raw / "pleural-space.glb", [{
        "vertices": mesh.vertices,
        "parts": [{"name": f"zone:{z}", "faces": faces[zone == z], "extras": {"zone": z, "label": "Authored construct"}}
                  for z in ZONE_IDS],
    }], {**root, "name": "pleural-space", "surface": "parietal pleura, right", "zoneList": "pleural-zones.json"})

    rib_meshes = []
    rib_nodes = []
    for entry in rib_record:
        m = mesh_mask(volume, rib_labels == entry["number"], SIMPLIFY_MM["rib"])
        entry.update({"faces": len(m.faces), "watertight": bool(m.is_watertight)})
        rib_meshes.append({"vertices": m.vertices, "parts": [{"name": f"rib:right:{entry['number']}", "faces": m.faces,
                                                               "extras": {"side": "right", "number": entry["number"]}}]})
        rib_nodes.append(m)
    left = mesh_mask(volume, left_cage, SIMPLIFY_MM["rib"])
    rib_meshes.append({"vertices": left.vertices, "parts": [{"name": "ribs:left", "faces": left.faces,
                                                             "extras": {"side": "left", "numbered": False}}]})
    sternum_mesh = mesh_mask(volume, sternum, SIMPLIFY_MM["rib"])
    rib_meshes.append({"vertices": sternum_mesh.vertices, "parts": [{"name": "sternum", "faces": sternum_mesh.faces,
                                                                     "extras": {"structure": "sternum"}}]})
    write_glb(raw / "ribs.glb", rib_meshes, {**root, "name": "ribs"})
    log("ribs meshed")

    context_parts = {
        "diaphragm": volume.mask("diaphragm"),
        "heart": largest_piece(volume.mask("heart")),
        "aorta": volume.mask("aorta"),
        "superior-vena-cava": volume.mask("superior-vena-cava"),
        "inferior-vena-cava": volume.mask("inferior-vena-cava"),
        "pulmonary-artery": largest_piece(central(volume, volume.mask("pulmonary-artery"))),
    }
    context_meshes, context_summary = [], {}
    for name, mask in context_parts.items():
        m = mesh_mask(volume, mask, None, target_faces=CONTEXT_FACES[name], downsample=CONTEXT_DOWNSAMPLE)
        context_meshes.append({"vertices": m.vertices, "parts": [{"name": f"context:{name}", "faces": m.faces,
                                                                  "extras": {"structure": name}}]})
        context_summary[name] = m
    skin = mesh_mask(volume, volume.mask("skin"), None, closed=False, target_faces=CONTEXT_FACES["skin"],
                     downsample=CONTEXT_DOWNSAMPLE)
    context_meshes.append({"vertices": skin.vertices, "parts": [{"name": "context:skin", "faces": skin.faces,
                                                                 "extras": {"structure": "skin", "open": "where the scan's field ends"}}]})
    context_summary["skin"] = skin
    write_glb(raw / "context.glb", context_meshes, {**root, "name": "context"})
    log("context meshed")

    rows = measure_ports(volume, mesh, space, rib_labels)
    definitions = json.loads((RECORDS.parent / "device-definitions.json").read_text())
    sleeve = next(d for d in definitions["devices"] if d["id"] == "trocar-sleeve-flexible")
    sleeve_od = next(f for f in sleeve["facts"] if f.get("key") == "outerDiameter")["value"]
    port = port_record(rows, float(sleeve_od))

    area = mesh.area_faces
    total = float(area.sum())
    files = {}
    for name in ("pleural-space", "ribs", "context"):
        path = raw / f"{name}.glb"
        files[name] = {"file": f"{name}.glb", "sha256": sha256_file(path), "bytes": path.stat().st_size}
    surfaces = {
        "record": "medical-thoracoscopy-anatomy-surfaces",
        "version": 1,
        "script": "scripts/medical-thoracoscopy/build_thorax_surfaces.py",
        "statement": ("Numbers only. The surfaces are built in the owner's local data and are not in the repository: "
                      "the segmentation's terms are not settled (rights register, R-ANATOMY-SEGMENTATION)."),
        "label": LABEL,
        "frame": "LPS millimetres",
        "presentationFromLps": PRESENTATION_FROM_LPS.tolist(),
        "gravityLps": GRAVITY_LPS.tolist(),
        "attribution": ATTRIBUTION,
        "files": files,
        "pleuralSpace": {
            "voxelVolumeMl": space_ml,
            "meshVolumeMl": float(mesh.volume / 1000.0),
            "faces": int(len(mesh.faces)),
            "vertices": int(len(mesh.vertices)),
            "areaCm2": total / 100.0,
            "watertight": bool(mesh.is_watertight),
            "outward": bool(mesh.volume > 0),
            "closingMm": SPACE_CLOSING_MM,
            "simplifyMm": SIMPLIFY_MM["pleural-space"],
            "boundsLps": mesh.bounds.tolist(),
            "apexPlaneZ": z_apex,
            "zones": [{
                "id": z,
                "faces": int((zone == z).sum()),
                "areaCm2": float(area[zone == z].sum() / 100.0),
                "shareOfSurface": float(area[zone == z].sum() / total),
                "pieces": len(zone_pieces(mesh, zone, z)),
            } for z in ZONE_IDS],
            "facesInExactlyOneZone": int(len(zone)),
        },
        "context": {name: {"faces": int(len(m.faces))} for name, m in context_summary.items()},
        "sternum": {"faces": int(len(sternum_mesh.faces)), "volumeMl": float(sternum.sum() * volume.voxel_ml)},
    }
    write_record(RECORDS / "surfaces.json", rounded(surfaces, 3))
    write_record(RECORDS / "ribs.json", rounded({
        "record": "medical-thoracoscopy-right-ribs",
        "version": 1,
        "script": "scripts/medical-thoracoscopy/build_thorax_surfaces.py",
        "method": (f"The right half of the rib cage, with its front {int(ANTERIOR_CUT_FRACTION * 100)} per cent cut away, "
                   "separates into twelve pieces. Each is numbered by the height of its spinal end, highest first, and "
                   "the rest of the rib is assigned to the nearest numbered piece."),
        "status": "Numbering awaits the owner's check (owner decisions, T6).",
        "ribs": rib_record,
    }, 3))
    write_record(RECORDS / "port-candidates.json", rounded({
        "record": "medical-thoracoscopy-port-candidates",
        "version": 1,
        "script": "scripts/medical-thoracoscopy/build_thorax_surfaces.py",
        "statement": ("Measured on one scan, taken lying on the back with the arms down, for choosing the prototype's "
                      "port. Not a guide to choosing a port in a patient."),
        "lines": {line: SPLIT["axillaryLines"][key] for line, key in PORT_LINES.items()},
        "wedgeDeg": WEDGE_DEG,
        "airHu": AIR_HU,
        "rows": rows,
    }, 2))
    write_record(RECORDS / "port-record.json", rounded(port, 2))

    if args.install_dev:
        DEV_INSTALL.mkdir(parents=True, exist_ok=True)
        for name in ("pleural-space", "ribs", "context"):
            shutil.copy2(raw / f"{name}.glb", DEV_INSTALL / f"{name}.glb")
        log(f"installed for the dev server in {DEV_INSTALL} (ignored by Git)")
    log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
