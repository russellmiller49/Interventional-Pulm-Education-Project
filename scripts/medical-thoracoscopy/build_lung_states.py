"""Build the lung's states, the collision proxies, the zone sample points and the fluid table.

    python3 scripts/medical-thoracoscopy/build_thorax_surfaces.py
    python3 scripts/medical-thoracoscopy/build_lung_states.py

Reads the segmentation and the drawn pleural space that `build_thorax_surfaces.py` wrote. Built in
LPS millimetres and written to the owner's local data, never to the repository (the segmentation's
terms are not settled: rights register, R-ANATOMY-SEGMENTATION):

- `lung-states.glb`: the right lung, one surface of even triangles with its three lobes as three
  primitives sharing one vertex array. The expanded lung is the base; eight states toward the
  collapsed lung are morph targets "step 1" to "step 8", positions only. Positions are quantised
  to 16 bits (KHR_mesh_quantization) under a node transform; normals are the expanded lung's, so a
  scene that morphs the lung recomputes them.
- `proxy-pleural-space.glb`: the pleural space's collision proxy, about 6,000 triangles, inside
  the drawn surface; and the zone sample points, one point primitive per survey zone, lifted just
  inside the proxy so that no zone hides itself behind its own proxy.
- `proxy-lung.glb`: the lung's collision proxy, about 4,000 triangles, around the drawn lung at
  every state; the states as morph targets at full precision.

The states are authored, not measured (MT-C-0001, MT-C-0002, both awaiting clinical review). The
surface is carried by the flow of a smooth velocity field: toward a point inside the lung near the
hilum, with a drift along gravity in the presented position; near the pleura, no outward motion
and sliding held back by friction, and a barrier that keeps the lung off the drawn surface. The
flow is a smooth deformation, so the surface cannot tear or pass through itself; along the way the
vertices are relaxed along the surface to keep the triangles even (which changes no shape), and a
crease that sharpens by more than a set angle is smoothed where it forms. Each state is checked for
folded and crossing triangles and for staying inside the drawn pleural surface, and so are the
points in between, because the scene blends neighbouring states.

Numbers only, to the repository (`content/data/anatomy/`): `lung-states.json`, `proxies.json`,
`zone-samples.json` and `fluid-table.json`.

`package-anatomy.ts` packages them with the surfaces; they are not uploaded and not published.
"""
from __future__ import annotations

import argparse
import json
import sys
import time

import numpy as np
import trimesh
from scipy import ndimage, sparse
from scipy.spatial import cKDTree

import build_thorax_surfaces as surfaces
from thorax_common import (
    ATTRIBUTION,
    GRAVITY_LPS,
    LABEL,
    PRESENTATION_FROM_LPS,
    RECORDS,
    ZONES,
    GlbBuilder,
    Volume,
    glb_accessor,
    read_glb,
    rounded,
    sha256_file,
    work_path,
    write_record,
)
from thorax_mesh_checks import (
    crossing_pairs,
    distance_to_surface,
    signed_distance_to_surface,
    edges_shared_twice,
    face_neighbours,
    folded_faces,
    signed_volume,
    volume_below,
    winding_numbers,
)
from thorax_remesh import Field, even_surface, face_normals, min_angles, vertex_normals

T0 = time.time()
ZONE_IDS = [zone["id"] for zone in json.loads(ZONES.read_text())["zones"]]
LOBES = {"upper": "right-lung-upper", "middle": "right-lung-middle", "lower": "right-lung-lower"}
STATES_LABEL = "Authored, illustrative"
CLAIMS = ["MT-C-0001", "MT-C-0002"]

# The expanded lung: the right lobes closed at 2 mm and holes filled, then eroded by 1 mm so that it
# sits inside the drawn pleural surface; meshed as the pleural space is.
LUNG = {"closingMm": 2.0, "erosionMm": 1.0, "gridMm": 1.0, "smoothingMm": 1.0, "edgeMm": 3.0, "marchingStep": 2}

# The collapse. Authored (MT-C-0002): the gap at the port and every value below are the author's
# choices, made so that the states stay clear of the pleura without folding; none is measured.
COLLAPSE = {
    "gapAtPortMm": 30.0,
    "steps": 8,
    "hilumSearchMm": 12.0,
    "targetDepthMm": 12.0,
    "gravityDriftMm": 40.0,
    "wallClearanceMm": 1.2,
    "wallReachMm": 10.0,
    "friction": 0.5,
    "barrierMm": 2.0,
    "barrierSpeed": 20.0,
    "fieldCellMm": 2.5,
    "fieldSmoothingCells": 1.5,
    "timeStep": 0.004,
    "tangentialRelaxation": 0.3,
    "creaseLimitDeg": 45.0,
}
BLEND_CHECKS = (0.25, 0.5, 0.75)  # where between neighbouring states the blends are checked
CLEARANCE_FLOOR_MM = 0.25  # the lung never comes closer than this to the drawn pleural surface

# The proxies. Each is meshed on a level set of a distance field, offset to its safe side: inside the
# drawn pleural surface, or outside the drawn lung. Where the drawn surface still comes within the
# margin, as it does where a small bump rises between a proxy's larger triangles or a thin margin of
# the lung runs under them, the proxy is refined there, new vertices on the same level set; anything
# left is pushed further to the safe side, no vertex more than settleLimitMm. The margin is the plan's
# 0.25 mm clearance skin.
# - The space's proxy never moves. It leaves out parts of the space thinner than twice openingMm,
#   which its triangles could not follow.
# - The lung has one proxy per state, each meshed from that state's drawn lung (voxelised at
#   voxelMm), so the engine swaps proxies as the lung steps rather than morphing one. A smaller,
#   more folded state gets smaller triangles, up to about lungTriangles. It is offset
#   2.5 mm, not the plan's 1 mm: the lung's thinnest margins would otherwise need triangles of about
#   3 mm along some 600 mm of margin, more than the triangle budget holds; 0.5 mm of the 2.5 covers
#   the voxel field's error.
PROXY = {"pleuralSpaceEdgeMm": 7.8, "lungEdgeMm": 7.9, "lungTriangles": 4400, "lungFieldSmoothingMm": 1.0,
         "lungFieldSmoothingLimitMm": 3.0,
         "offsetMm": {"pleuralSpace": 1.0, "lung": 2.5},
         "marginMm": 0.25, "openingMm": 3.0, "voxelMm": 1.0, "settleLimitMm": {"pleuralSpace": 3.0, "lung": 3.0},
         "refineRounds": 12, "trianglesBudget": 12000, "spaceTrianglesLimit": 7000}
SAMPLES = {"perCm2": 1.0, "minimumPerZone": 32, "insideProxyMm": 0.25}
FLUID_STEP_MM = 2.0


def log(message: str) -> None:
    print(f"[{time.time() - T0:5.0f}s] {message}", flush=True)


def ball(volume: Volume, radius_mm: float) -> np.ndarray:
    rad = np.ceil(radius_mm / volume.spacing).astype(int)
    grid = np.ogrid[tuple(slice(-r, r + 1) for r in rad)]
    return sum((g * s) ** 2 for g, s in zip(grid, volume.spacing)) <= radius_mm ** 2


def adjacency(vertex_count: int, faces: np.ndarray) -> tuple[sparse.csr_matrix, np.ndarray, list[np.ndarray]]:
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    matrix = sparse.coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(vertex_count,) * 2).tocsr()
    matrix = ((matrix + matrix.T) > 0).astype(float).tocsr()
    rings = [matrix.indices[matrix.indptr[i]:matrix.indptr[i + 1]] for i in range(vertex_count)]
    return matrix, np.asarray(matrix.sum(1)).ravel(), rings


# ── the drawn pleural space ───────────────────────────────────────────────────────────────────

def drawn_space() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The drawn pleural surface as built: its vertices, faces, and each face's zone."""
    document, binary = read_glb(work_path("raw", "pleural-space.glb"))
    root = next(node for node in document["nodes"] if "children" in node)
    vertices, faces, zones = None, [], []
    for index in root["children"]:
        node = document["nodes"][index]
        primitive = document["meshes"][node["mesh"]]["primitives"][0]
        if vertices is None:
            vertices = glb_accessor(document, binary, primitive["attributes"]["POSITION"])
        part = glb_accessor(document, binary, primitive["indices"]).astype(np.int64).reshape(-1, 3)
        faces.append(part)
        zones += [node["extras"]["zone"]] * len(part)
    return vertices, np.concatenate(faces), np.array(zones, dtype=object)


def distance_grid(field: Field) -> np.ndarray:
    """The signed distance to the field's iso-surface on its grid, positive inside: exact-transform
    distances, replaced near the surface by the first-order estimate, which follows the drawn
    surface more closely than a 1 mm grid can."""
    inside = field.values >= 0.5
    sdf = (ndimage.distance_transform_edt(inside, sampling=field.h)
           - ndimage.distance_transform_edt(~inside, sampling=field.h)).astype(np.float32)
    gradient = np.linalg.norm(field.grad, axis=-1)
    near = np.abs(field.values - 0.5) < 0.45
    sdf[near] = ((field.values - 0.5) / (gradient + 1e-9))[near]
    return sdf


# ── the lung ──────────────────────────────────────────────────────────────────────────────────

def lung_mask(volume: Volume) -> np.ndarray:
    union = np.zeros(volume.shape, dtype=bool)
    for key in LOBES.values():
        union |= volume.mask(key)
    closed = ndimage.binary_fill_holes(ndimage.binary_closing(union, structure=ball(volume, LUNG["closingMm"])))
    return ndimage.binary_erosion(closed, structure=ball(volume, LUNG["erosionMm"]))


def lobe_of_faces(volume: Volume, vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Each face's lobe: the nearest lobe surface, smoothed across neighbours, stray pieces absorbed."""
    centre = vertices[faces].mean(1)
    names = list(LOBES)
    distance = np.stack([cKDTree(surfaces.surface_points(volume, volume.mask(LOBES[name]))).query(centre)[0]
                         for name in names], 1)
    cls = distance.argmin(1)
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    adj = mesh.face_adjacency
    area = mesh.area_faces
    for _ in range(6):
        votes = np.zeros((len(faces), len(names)))
        np.add.at(votes, (np.arange(len(faces)), cls), area * 1.5)
        np.add.at(votes, (adj[:, 0], cls[adj[:, 1]]), area[adj[:, 1]])
        np.add.at(votes, (adj[:, 1], cls[adj[:, 0]]), area[adj[:, 0]])
        cls = votes.argmax(1)
    lobe = np.array(names, dtype=object)[cls]
    return surfaces.absorb_islands(mesh, lobe, names)


def hilum(volume: Volume, lung: np.ndarray, sdf_at) -> tuple[np.ndarray, np.ndarray]:
    """The centroid of the right hilar airway and pulmonary vessels within reach of the lung, and
    the flow's target: that point moved toward the lung's centroid until it is well inside the
    pleural surface."""
    near = (ndimage.distance_transform_edt(~lung, sampling=volume.spacing) <= COLLAPSE["hilumSearchMm"]) & ~lung
    spine_x = volume.to_lps(np.argwhere(volume.mask("spine")).mean(0))[0]
    xs = volume.origin[0] + np.arange(volume.shape[0]) * volume.spacing[0]
    hilar = ((volume.mask("airway") | volume.mask("pulmonary-artery") | volume.mask("pulmonary-vein"))
             & near & (xs < spine_x)[:, None, None])
    centroid = volume.to_lps(np.argwhere(hilar).mean(0))
    toward = volume.to_lps(np.argwhere(lung).mean(0)) - centroid
    toward /= np.linalg.norm(toward)
    target = centroid.copy()
    while sdf_at(target[None])[0] < COLLAPSE["targetDepthMm"]:
        target = target + 0.5 * toward
    return centroid, target


class CollapseField:
    """The velocity field on a coarse grid over the pleural space."""

    def __init__(self, space: Field, sdf: np.ndarray, target: np.ndarray) -> None:
        c = COLLAPSE
        self.cell = c["fieldCellMm"]
        self.lo = space.origin + 3.0
        hi = space.origin + (np.array(sdf.shape) - 1) * space.h - 3.0
        shape = np.floor((hi - self.lo) / self.cell).astype(int) + 1
        grid = np.stack(np.meshgrid(*[np.arange(n) for n in shape], indexing="ij"), -1).reshape(-1, 3)
        centres = self.lo + grid * self.cell
        wall = (ndimage.map_coordinates(sdf, space._ijk(centres), order=1, mode="nearest")
                - c["wallClearanceMm"]).reshape(shape).astype(np.float32)
        slope = np.stack(np.gradient(ndimage.gaussian_filter(wall, 0.8), self.cell), -1)
        outward = -slope / (np.linalg.norm(slope, axis=-1, keepdims=True) + 1e-9)
        depth = np.clip(wall / c["wallReachMm"], 0.0, 1.0)
        near_wall = 1.0 - depth * depth * (3.0 - 2.0 * depth)

        def at_wall(field: np.ndarray) -> np.ndarray:
            normal = np.sum(field * outward, -1)
            along = field - normal[..., None] * outward
            pressed = np.maximum(normal, 0.0)
            held = 1.0 - near_wall * np.minimum(1.0, c["friction"] * pressed / (np.linalg.norm(along, axis=-1) + 1e-9))
            return (normal - near_wall * pressed)[..., None] * outward + held[..., None] * along

        velocity = at_wall((target - centres.reshape(*shape, 3)) + c["gravityDriftMm"] * GRAVITY_LPS)
        for axis in range(3):
            velocity[..., axis] = ndimage.gaussian_filter(velocity[..., axis], c["fieldSmoothingCells"])
        velocity = at_wall(velocity)
        barrier = np.clip(1.0 - wall / c["barrierMm"], 0.0, 1.0) ** 2
        self.velocity = (velocity - (c["barrierSpeed"] * barrier)[..., None] * outward).astype(np.float32)

    def __call__(self, points: np.ndarray) -> np.ndarray:
        ijk = ((points - self.lo) / self.cell).T
        return np.stack([ndimage.map_coordinates(self.velocity[..., axis], ijk, order=1, mode="nearest")
                         for axis in range(3)], -1)


def collapse(vertices: np.ndarray, faces: np.ndarray, field: CollapseField, port_point: np.ndarray | None,
             end_time: float | None = None):
    """Integrate the flow until the gap at the port reaches the authored value, or to `end_time`;
    return the states at equal flow time, the flow time, and what the limiter did."""
    c = COLLAPSE
    matrix, degree, rings = adjacency(len(vertices), faces)
    neighbours = face_neighbours(faces)
    n0, _ = face_normals(vertices, faces)
    angle0 = np.arccos(np.clip(np.einsum("ij,ikj->ik", n0, n0[neighbours]), -1.0, 1.0))
    limit = np.radians(c["creaseLimitDeg"])
    p = vertices.copy()
    t = 0.0
    path = [(0.0, p.copy())]
    drift = np.zeros_like(p)
    smoothings, touched = 0, set()
    while True:
        k1 = field(p)
        k2 = field(p + 0.5 * c["timeStep"] * k1)
        p = p + c["timeStep"] * k2
        t += c["timeStep"]
        # tangential relaxation: slide vertices along the surface toward their neighbours' mean
        lap = (matrix @ p) / degree[:, None] - p
        normal = vertex_normals(p, faces)
        lap -= np.einsum("ij,ij->i", lap, normal)[:, None] * normal
        p = p + c["tangentialRelaxation"] * lap
        drift += c["tangentialRelaxation"] * lap
        # the crease limiter
        for _ in range(3):
            n1, _ = face_normals(p, faces)
            angle = np.arccos(np.clip(np.einsum("ij,ikj->ik", n1, n1[neighbours]), -1.0, 1.0))
            sharp = np.flatnonzero(np.any(angle - angle0 > limit, axis=1))
            if len(sharp) == 0:
                break
            region = set(faces[sharp].ravel().tolist())
            region |= {int(q) for v in list(region) for q in rings[v]}
            index = np.array(sorted(region))
            means = np.array([p[rings[v]].mean(0) for v in index])
            p[index] = 0.5 * p[index] + 0.5 * means
            smoothings += 1
            touched |= region
        path.append((t, p.copy()))
        if end_time is not None:
            if t >= end_time - 0.5 * c["timeStep"]:
                break
            continue
        gap = distance_to_surface(port_point[None], p, faces)[0][0]
        if gap >= c["gapAtPortMm"]:
            break
        if t > 3.0:
            raise SystemExit(f"The flow did not open a gap of {c['gapAtPortMm']} mm at the port")
    times = np.array([entry[0] for entry in path])
    states = [path[int(np.argmin(np.abs(times - t * k / c["steps"])))][1] for k in range(c["steps"] + 1)]
    drift_length = np.linalg.norm(drift, axis=1)
    return states, t, {"smoothings": smoothings, "verticesTouched": len(touched),
                       "tangentialDriftMm": {"median": float(np.median(drift_length)), "max": float(drift_length.max())}}


def check_state(reference: np.ndarray, state: np.ndarray, faces: np.ndarray, space_vertices: np.ndarray,
                space_faces: np.ndarray, space: Field) -> dict:
    """Folded and crossing faces, faces through the pleura, and the least clearance from it."""
    as_drawn = state.astype(np.float32).astype(np.float64)
    # Exact distances where the field's estimate puts a vertex within 5 mm of the pleura; the rest
    # are further than any clearance that matters here.
    near = np.flatnonzero(space.signed_distance(state) < 5.0)
    distance, _ = distance_to_surface(state[near], space_vertices, space_faces)
    inside = space.value(state[near]) >= 0.5
    clearance = np.where(inside, distance, -distance) if len(near) else np.array([5.0])
    return {
        "foldedFaces": int(len(folded_faces(reference, state, faces))),
        "crossingFaces": int(len(np.unique(crossing_pairs(as_drawn, faces)))),
        "facesThroughPleura": int(len(np.unique(crossing_pairs(as_drawn, faces, space_faces,
                                                               space_vertices.astype(np.float32).astype(np.float64))[:, 0]))),
        "clearanceMm": float(clearance.min()),
    }


# ── the proxies ───────────────────────────────────────────────────────────────────────────────

def signed_from(points: np.ndarray, vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Distance to a closed surface, negative inside."""
    return signed_distance_to_surface(points, vertices, faces)


def settle_proxy(proxy: np.ndarray, faces: np.ndarray, drawn: np.ndarray, drawn_faces: np.ndarray,
                 outward: bool) -> np.ndarray:
    """Push a proxy, already offset to its safe side (out of the lung, or into the space), further
    wherever the drawn surface comes within `marginMm` of it, until nowhere does. No vertex may move
    more than settleLimitMm this way: a proxy that needs more is wrong, and the build stops."""
    sign = 1.0 if outward else -1.0
    margin = PROXY["marginMm"]
    _, _, rings = adjacency(len(proxy), faces)
    p = proxy.copy()
    moved = np.zeros(len(p))
    for _ in range(30):
        # the drawn surface must lie on the proxy's unsafe side (inside it for the lung, outside it
        # for the space), and the proxy on the drawn surface's safe side, each by the margin
        drawn_depth = -sign * signed_from(drawn, p, faces)
        proxy_depth = sign * signed_from(p, drawn, drawn_faces)
        _, nearest = distance_to_surface(drawn, p, faces)
        push = np.zeros(len(p))
        for i in np.flatnonzero(drawn_depth < margin):
            for v in faces[nearest[i]]:
                push[v] = max(push[v], margin - drawn_depth[i] + 0.05)
        close = proxy_depth < margin
        push[close] = np.maximum(push[close], margin - proxy_depth[close] + 0.05)
        if not push.any():
            return p
        spread = np.array([push[ring].max() if len(ring) else 0.0 for ring in rings])
        push = np.maximum(push, 0.5 * spread)
        moved += push
        if moved.max() > PROXY["settleLimitMm"]["lung" if outward else "pleuralSpace"]:
            raise SystemExit(f"A proxy vertex had to move {moved.max():.2f} mm past its offset to clear the drawn surface")
        p = p + sign * push[:, None] * vertex_normals(p, faces)
    raise SystemExit("A proxy could not be moved clear of its drawn surface")


def refine_proxy(proxy: np.ndarray, faces: np.ndarray, place, drawn: np.ndarray, drawn_faces: np.ndarray,
                 outward: bool, limit: int) -> tuple[np.ndarray, np.ndarray, int]:
    """Split the proxy's triangles where the drawn surface comes within the margin of them or passes
    through them, worst first, putting each new vertex back on the proxy's level set (`place`), until
    the drawn surface keeps its distance everywhere, the rounds run out, or the proxy reaches `limit`
    triangles. Returns the refined proxy and the number of edges split."""
    from thorax_remesh import split_long

    sign = 1.0 if outward else -1.0
    p, f = proxy, faces
    splits = 0
    for _ in range(PROXY["refineRounds"]):
        severity = np.full(len(f), -np.inf)
        drawn_depth = -sign * signed_from(drawn, p, f)
        _, nearest = distance_to_surface(drawn, p, f)
        short = drawn_depth < PROXY["marginMm"]
        np.maximum.at(severity, nearest[short], PROXY["marginMm"] - drawn_depth[short])
        proxy_depth = sign * signed_from(p, drawn, drawn_faces)
        close = np.flatnonzero(proxy_depth < PROXY["marginMm"])
        for i in np.flatnonzero(np.isin(f, close).any(1)):
            severity[i] = max(severity[i], PROXY["marginMm"] - proxy_depth[f[i]].min())
        through = crossing_pairs(p.astype(np.float32).astype(np.float64), f, drawn_faces,
                                 drawn.astype(np.float32).astype(np.float64))
        np.maximum.at(severity, through[:, 0], np.inf)
        bad = np.flatnonzero(severity > 0)
        room = (limit - len(f)) // 2
        if len(bad) == 0 or room <= 0:
            break
        bad = bad[np.argsort(-severity[bad], kind="stable")][:room]
        n = len(p)
        only = set()
        for face in bad:
            tri = f[face]
            lengths = [np.linalg.norm(p[tri[i]] - p[tri[(i + 1) % 3]]) for i in range(3)]
            i = int(np.argmax(lengths))
            a, b = int(tri[i]), int(tri[(i + 1) % 3])
            only.add(min(a, b) * n + max(a, b))
        p, f, done = split_long(p, f, 0.0, only=only)
        if done == 0:
            break
        midpoints = p[n:].copy()
        p[n:] = place(p[n:])
        # A new vertex pulled across a sharp crease of the level set folds the surface; such a vertex
        # stays at its edge's midpoint, where a split cannot fold anything.
        for _ in range(5):
            pairs = crossing_pairs(p.astype(np.float32).astype(np.float64), f)
            involved = np.unique(f[pairs.ravel()]) if len(pairs) else np.zeros(0, dtype=np.int64)
            back = involved[involved >= n]
            if len(back) == 0:
                break
            p[back] = midpoints[back - n]
        splits += done
    return p, f, splits


def unfold(proxy: np.ndarray, faces: np.ndarray, rounds: int = 30) -> tuple[np.ndarray, int]:
    """Smooth the neighbourhood of every face that passes through another, until none does. On a
    level set these form in the creases of concave places, where smoothing lifts the surface away
    from what it wraps, toward the safe side. (A face folded over on a closed surface passes
    through another, so this also finds folds.)"""
    _, _, rings = adjacency(len(proxy), faces)
    p = proxy.copy()
    touched: set[int] = set()
    for round_index in range(rounds):
        pairs = crossing_pairs(p.astype(np.float32).astype(np.float64), faces)
        bad = np.unique(pairs.ravel())
        if len(bad) == 0:
            return p, len(touched)
        region = set(faces[bad].ravel().tolist())
        for _ in range(1 + round_index // 5):
            region |= {int(q) for v in list(region) for q in rings[v]}
        index = np.array(sorted(region))
        for _ in range(3):
            means = np.array([p[rings[v]].mean(0) for v in index])
            p[index] = 0.5 * p[index] + 0.5 * means
        touched |= region
    raise SystemExit("A proxy still passes through itself after smoothing")


def voxel_distance(vertices: np.ndarray, faces: np.ndarray, h: float, pad_mm: float = 8.0) -> tuple[np.ndarray, np.ndarray]:
    """The signed distance of a closed surface on a grid, positive inside, erring outward. Each column
    of the grid along z is cut by the surface and filled between successive crossings (the column
    centres nudged off the grid so that no column meets an edge or a vertex exactly), and every voxel
    the surface passes through is filled too. Then the exact distance transform, both ways."""
    low = vertices.min(0) - pad_mm
    size = np.ceil((vertices.max(0) + pad_mm - low) / h).astype(int) + 1
    tri = vertices[faces]
    ox, oy = low[0] + 0.5e-4 * h, low[1] + 0.73e-4 * h
    i0 = np.floor((tri[:, :, 0].min(1) - ox) / h).astype(int)
    i1 = np.ceil((tri[:, :, 0].max(1) - ox) / h).astype(int)
    j0 = np.floor((tri[:, :, 1].min(1) - oy) / h).astype(int)
    j1 = np.ceil((tri[:, :, 1].max(1) - oy) / h).astype(int)
    columns, heights = [], []
    for di in range(int((i1 - i0).max()) + 1):
        for dj in range(int((j1 - j0).max()) + 1):
            sel = np.flatnonzero((di <= i1 - i0) & (dj <= j1 - j0))
            ci, cj = i0[sel] + di, j0[sel] + dj
            a, b, c = tri[sel, 0], tri[sel, 1], tri[sel, 2]
            v0, v1 = b[:, :2] - a[:, :2], c[:, :2] - a[:, :2]
            v2 = np.stack([ox + ci * h, oy + cj * h], 1) - a[:, :2]
            det = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
            usable = np.abs(det) > 1e-12
            det = np.where(usable, det, 1.0)
            w1 = (v2[:, 0] * v1[:, 1] - v1[:, 0] * v2[:, 1]) / det
            w2 = (v0[:, 0] * v2[:, 1] - v2[:, 0] * v0[:, 1]) / det
            hit = usable & (w1 >= 0) & (w2 >= 0) & (w1 + w2 <= 1)
            columns.append(ci[hit] * size[1] + cj[hit])
            heights.append((a[:, 2] + w1 * (b[:, 2] - a[:, 2]) + w2 * (c[:, 2] - a[:, 2]))[hit])
    columns, heights = np.concatenate(columns), np.concatenate(heights)
    order = np.lexsort((heights, columns))
    columns, heights = columns[order], heights[order]
    grid = np.zeros(size, dtype=bool)
    starts = np.flatnonzero(np.r_[True, columns[1:] != columns[:-1]])
    for start, end in zip(starts, np.r_[starts[1:], len(columns)]):
        if (end - start) % 2:
            raise SystemExit("A column crossed a closed surface an odd number of times")
        i, j = divmod(int(columns[start]), int(size[1]))
        for m in range(start, end, 2):
            k0 = int(np.ceil((heights[m] - low[2]) / h))
            k1 = int(np.floor((heights[m + 1] - low[2]) / h))
            if k1 >= k0:
                grid[i, j, k0:k1 + 1] = True
    # The surface's own voxels too, so that a sheet of lung thinner than a voxel is not lost between
    # column centres: points spread over every face, no further apart than a third of a voxel.
    parts = int(np.ceil(np.linalg.norm(tri - np.roll(tri, 1, axis=1), axis=2).max() / (h / 3.0)))
    steps = np.array([(i, j) for i in range(parts + 1) for j in range(parts + 1 - i)], dtype=float) / parts
    for start in range(0, len(tri), 20000):
        part = tri[start:start + 20000]
        points = (part[:, None, 0] + steps[None, :, 0:1] * (part[:, None, 1] - part[:, None, 0])
                  + steps[None, :, 1:2] * (part[:, None, 2] - part[:, None, 0])).reshape(-1, 3)
        index = np.round((points - low) / h).astype(int)
        grid[index[:, 0], index[:, 1], index[:, 2]] = True
    sdf = ndimage.distance_transform_edt(grid, sampling=h) - ndimage.distance_transform_edt(~grid, sampling=h)
    return sdf.astype(np.float32), low


def lung_proxy(state: np.ndarray, faces: np.ndarray, limit: int) -> tuple[np.ndarray, np.ndarray, dict]:
    """The lung's proxy at one state: meshed on the level set offsetMm outside that state's drawn
    lung, settled where the lung still comes close, and checked exactly. The level set is taken from
    the distance field rounded a little, so that where the offsets of two parts of the lung meet, the
    crease between them is not too sharp to mesh; a state whose proxy folds or fails a check is built
    again from a field rounded 0.5 mm more. The exact checks, not the rounding, decide what is clear."""
    h = PROXY["voxelMm"]
    sdf, low = voxel_distance(state, faces, h)
    iso = -PROXY["offsetMm"]["lung"]
    smoothing = PROXY["lungFieldSmoothingMm"]
    edge = None
    problem = ""
    while smoothing <= PROXY["lungFieldSmoothingLimitMm"] + 1e-9:
        field = Field.of_values(ndimage.gaussian_filter(sdf, smoothing / h), low, h)
        if edge is None:
            # A smaller, more folded lung gets smaller triangles, up to about lungTriangles in all.
            _, first_faces = even_surface(field, PROXY["lungEdgeMm"], step=2, iso=iso)
            edge = PROXY["lungEdgeMm"] * min(1.0, float(np.sqrt(len(first_faces) / PROXY["lungTriangles"])))
        try:
            proxy, proxy_faces = even_surface(field, edge, step=2, iso=iso)
            if len(crossing_pairs(proxy.astype(np.float32).astype(np.float64), proxy_faces)):
                raise SystemExit("the mesh folds at a crease")
            proxy, proxy_faces, dropped = largest_piece(proxy, proxy_faces)
            if len(proxy_faces) > limit:
                raise SystemExit(f"{len(proxy_faces)} triangles, over the {limit} left in the budget")
            smoothed = 0
            for _ in range(6):
                proxy = settle_proxy(proxy, proxy_faces, state, faces, outward=True)
                proxy, done = unfold(proxy, proxy_faces)
                smoothed += done
                if done == 0:
                    break
            else:
                raise SystemExit("did not settle")
            report = proxy_report(proxy, proxy_faces, state, faces, outward=True)
            if report["facesCrossingDrawn"] or min(report["proxyFromDrawnMm"][0], report["drawnFromProxyMm"][0]) < PROXY["marginMm"] - 1e-6:
                raise SystemExit(f"not clear of the drawn lung: {report}")
            return proxy, proxy_faces, {"edgeMm": edge, "fieldSmoothingMm": smoothing, "piecesLeftOut": int(dropped),
                                        "verticesSmoothed": int(smoothed)}
        except SystemExit as error:
            problem = str(error)
            smoothing += 0.5
    raise SystemExit(f"The lung proxy could not be built for a state: {problem}")


def opened_offset(sdf: np.ndarray, h: float) -> np.ndarray:
    """A field whose zero level lies the space's offset inside the drawn surface, except that parts of the space
    thinner than twice openingMm there are left out: the region is eroded by openingMm and dilated
    back, and never passes the plain offset."""
    radius = PROXY["openingMm"]
    inner = sdf >= PROXY["offsetMm"]["pleuralSpace"] + radius
    reach = ndimage.distance_transform_edt(~inner, sampling=h) - ndimage.distance_transform_edt(inner, sampling=h)
    return np.minimum(radius - reach, sdf - PROXY["offsetMm"]["pleuralSpace"]).astype(np.float32)


def largest_piece(vertices: np.ndarray, faces: np.ndarray) -> tuple[np.ndarray, np.ndarray, int]:
    """The largest connected piece of a surface, and how many smaller pieces were left out."""
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    pieces = trimesh.graph.connected_components(mesh.face_adjacency, nodes=np.arange(len(faces)), min_len=1)
    largest = max(pieces, key=len)
    from thorax_remesh import compact
    kept_vertices, kept_faces = compact(vertices, faces[np.sort(largest)])
    return kept_vertices, kept_faces, len(pieces) - 1


def proxy_report(proxy: np.ndarray, faces: np.ndarray, drawn: np.ndarray, drawn_faces: np.ndarray,
                 outward: bool) -> dict:
    """How far the proxy lies from the drawn surface, both ways, and that the two never cross."""
    sign = 1.0 if outward else -1.0
    proxy_depth = sign * signed_from(proxy, drawn, drawn_faces)
    drawn_depth = -sign * signed_from(drawn, proxy, faces)
    through = crossing_pairs(proxy.astype(np.float32).astype(np.float64), faces, drawn_faces,
                             drawn.astype(np.float32).astype(np.float64))
    return {
        "proxyFromDrawnMm": [float(proxy_depth.min()), float(np.median(proxy_depth)), float(proxy_depth.max())],
        "drawnFromProxyMm": [float(drawn_depth.min()), float(np.median(drawn_depth)), float(drawn_depth.max())],
        "facesCrossingDrawn": int(len(through)),
    }


# ── zone samples and the fluid table ──────────────────────────────────────────────────────────

def zone_samples(vertices: np.ndarray, faces: np.ndarray, zones: np.ndarray, proxy: np.ndarray,
                 proxy_faces: np.ndarray) -> tuple[dict[str, np.ndarray], dict]:
    """Area-weighted points on each zone of the drawn surface, each moved to the nearest point of the
    space's proxy and then just inside it, so that no zone hides behind its own proxy. Where the
    proxy ends in a thin edge, short of a thin part of the space (the tip of the costophrenic
    recess), a point goes instead to the nearest of a set of points checked to lie inside the proxy,
    one just in from each of its vertices and face centres. How far each point moved is recorded."""
    vertex_in = proxy - 0.35 * vertex_normals(proxy, proxy_faces)
    face_n, _ = face_normals(proxy, proxy_faces)
    face_in = proxy[proxy_faces].mean(1) - 0.35 * face_n
    candidates = np.concatenate([vertex_in, face_in])
    candidates = candidates[-signed_from(candidates, proxy, proxy_faces) >= SAMPLES["insideProxyMm"]]
    inside_points = cKDTree(candidates)
    _, area = face_normals(vertices, faces)
    centre = vertices[faces].mean(1)
    points, stats = {}, []
    for zone_id in ZONE_IDS:
        members = np.flatnonzero(zones == zone_id)
        cumulative = np.cumsum(area[members])
        count = max(SAMPLES["minimumPerZone"], int(round(cumulative[-1] / 100.0 * SAMPLES["perCm2"])))
        chosen = members[np.searchsorted(cumulative, (np.arange(count) + 0.5) / count * cumulative[-1])]
        start = centre[chosen]
        if (signed_from(start, proxy, proxy_faces) <= 0).any():
            raise SystemExit(f"Zone {zone_id}: a point of the drawn surface lies inside the proxy")
        _, _, nearest = distance_to_surface(start, proxy, proxy_faces, closest=True)
        # Onward past the nearest point, the way in from outside
        inward = nearest - start
        inward /= np.linalg.norm(inward, axis=1)[:, None]
        step = np.full(count, SAMPLES["insideProxyMm"])
        placed = nearest + step[:, None] * inward
        for _ in range(15):
            depth = -signed_from(placed, proxy, proxy_faces)
            short = depth < SAMPLES["insideProxyMm"] - 1e-6
            if not short.any():
                break
            step[short] += 0.05
            placed[short] = nearest[short] + step[short, None] * inward[short]
        missed = np.flatnonzero(-signed_from(placed, proxy, proxy_faces) < SAMPLES["insideProxyMm"] - 1e-6)
        if len(missed):
            placed[missed] = candidates[inside_points.query(start[missed])[1]]
        lift = np.linalg.norm(placed - start, axis=1)
        points[zone_id] = placed
        stats.append({"id": zone_id, "points": count, "liftMm": [float(lift.min()), float(lift.max())],
                      "placedFromTheSet": int(len(missed))})
    return points, {"zones": stats, "total": int(sum(len(p) for p in points.values()))}


def fluid_table(space_vertices: np.ndarray, space_faces: np.ndarray, states: list[np.ndarray],
                lung_faces: np.ndarray) -> dict:
    """In the presented position: the volume of the pleural space below a level plane, less the
    lung's, at each height from the space's lowest point, at each lung state."""
    up = -GRAVITY_LPS
    lowest = float((space_vertices @ up).min())
    top = float((space_vertices @ up).max())
    heights = np.arange(0.0, top - lowest + FLUID_STEP_MM, FLUID_STEP_MM)
    space_below = [volume_below(space_vertices, space_faces, up, lowest + h) / 1000.0 for h in heights]
    rows = []
    for k, state in enumerate(states):
        lung_below = [volume_below(state, lung_faces, up, lowest + h) / 1000.0 for h in heights]
        rows.append({"step": k, "fluidMl": [s - l for s, l in zip(space_below, lung_below)]})
    return {"heightsMm": heights.tolist(), "spaceMl": space_below, "states": rows}


# ── writing ───────────────────────────────────────────────────────────────────────────────────

def root_extras(name: str, **more) -> dict:
    return {"name": name, "label": LABEL, "attribution": ATTRIBUTION, "frame": "LPS millimetres",
            "presentationFromLps": PRESENTATION_FROM_LPS.tolist(), "gravityLps": GRAVITY_LPS.tolist(), **more}


def write_lung(path, base: np.ndarray, states: list[np.ndarray], faces: np.ndarray, lobe: np.ndarray) -> dict:
    everything = np.concatenate(states)
    low, high = everything.min(0), everything.max(0)
    centre = (low + high) / 2.0
    half = float((high - low).max() / 2.0) * 1.001
    q = 32767.0
    quantised = np.round((base - centre) / half * q).astype(np.int16)
    glb = GlbBuilder("scripts/medical-thoracoscopy/build_lung_states.py")
    position = glb.attribute(quantised, GlbBuilder.SHORT, normalized=True, bounds=True)
    normal = glb.attribute(np.round(vertex_normals(base, faces) * 127.0), GlbBuilder.BYTE, normalized=True)
    targets = []
    worst = 0.0
    for state in states[1:]:
        delta = np.round((state - base) / half * q)
        if np.abs(delta).max() > q:
            raise SystemExit("A lung state moves further than its quantisation can hold")
        worst = max(worst, float(np.abs((quantised + delta) / q * half + centre - state).max()))
        targets.append({"POSITION": glb.attribute(delta.astype(np.int16), GlbBuilder.SHORT, normalized=True, bounds=True)})
    primitives = []
    for lobe_id in LOBES:
        primitives.append({"attributes": {"POSITION": position, "NORMAL": normal},
                           "indices": glb.indices(faces[lobe == lobe_id], len(base)), "targets": targets,
                           "extras": {"lobe": lobe_id}})
    names = [f"step {k}" for k in range(1, len(states))]
    mesh = glb.mesh("lung", primitives, weights=[0.0] * len(names), extras={"targetNames": names})
    lung = glb.node("lung", mesh=mesh, translation=centre.tolist(), scale=[half] * 3,
                    extras={"quantisation": "positions: 16-bit, dequantised by this node's scale and translation"})
    root = glb.node("lung-states", children=[lung], extras=root_extras(
        "lung-states", statesLabel=STATES_LABEL, claims=CLAIMS, lobes=list(LOBES), targets=names,
        normals="The expanded lung's; recompute them after morphing"))
    glb.write(path, root)
    return {"positionStepMm": half / q, "largestErrorMm": worst}


def write_space_proxy(path, vertices: np.ndarray, faces: np.ndarray, samples: dict[str, np.ndarray]) -> None:
    glb = GlbBuilder("scripts/medical-thoracoscopy/build_lung_states.py")
    position = glb.attribute(vertices, bounds=True)
    proxy = glb.node("proxy:pleural-space", mesh=glb.mesh("proxy:pleural-space", [
        {"attributes": {"POSITION": position}, "indices": glb.indices(faces, len(vertices))}]),
        extras={"side": "inside the drawn pleural surface", "offsetMm": PROXY["offsetMm"]["pleuralSpace"]})
    children = [proxy]
    for zone_id, points in samples.items():
        mesh = glb.mesh(f"samples:{zone_id}", [{"attributes": {"POSITION": glb.attribute(points, bounds=True)}, "mode": 0}])
        children.append(glb.node(f"samples:{zone_id}", mesh=mesh, extras={"zone": zone_id, "label": "Authored construct"}))
    root = glb.node("proxy-pleural-space", children=children, extras=root_extras(
        "proxy-pleural-space", zoneList="pleural-zones.json"))
    glb.write(path, root)


def write_lung_proxy(path, proxies: list[tuple[np.ndarray, np.ndarray]]) -> None:
    glb = GlbBuilder("scripts/medical-thoracoscopy/build_lung_states.py")
    children = []
    for k, (vertices, faces) in enumerate(proxies):
        mesh = glb.mesh(f"proxy:lung:step {k}", [{"attributes": {"POSITION": glb.attribute(vertices, bounds=True)},
                                                  "indices": glb.indices(faces, len(vertices))}])
        children.append(glb.node(f"proxy:lung:step {k}", mesh=mesh, extras={
            "step": k, "side": "around the drawn lung", "offsetMm": PROXY["offsetMm"]["lung"]}))
    root = glb.node("proxy-lung", children=children, extras=root_extras(
        "proxy-lung", statesLabel=STATES_LABEL, claims=CLAIMS, states=len(proxies)))
    glb.write(path, root)


# ── main ──────────────────────────────────────────────────────────────────────────────────────

def main() -> int:
    argparse.ArgumentParser(description=__doc__.split("\n")[0]).parse_args()

    volume = Volume()
    space_vertices, space_faces, space_zones = drawn_space()
    space = surfaces.space_field(volume, surfaces.pleural_space_mask(volume))
    sdf = distance_grid(space)

    def sdf_at(points: np.ndarray) -> np.ndarray:
        return ndimage.map_coordinates(sdf, space._ijk(points), order=1, mode="nearest")

    log(f"drawn pleural space: {len(space_faces)} faces; its field and distance rebuilt")

    lung = lung_mask(volume)
    lung_voxel_ml = float(lung.sum() * volume.voxel_ml)
    base, faces = even_surface(Field(volume, lung, LUNG["gridMm"], sigma_mm=LUNG["smoothingMm"]), LUNG["edgeMm"],
                               step=LUNG["marchingStep"])
    lobe = lobe_of_faces(volume, base, faces)
    log(f"lung: {lung_voxel_ml:.1f} mL of voxels, {len(faces)} faces, {signed_volume(base, faces) / 1000:.1f} mL meshed; "
        + ", ".join(f"{name} {int((lobe == name).sum())}" for name in LOBES))

    hilar, target = hilum(volume, lung, sdf_at)
    field = CollapseField(space, sdf, target)
    port = json.loads((RECORDS / "port-record.json").read_text())
    port_point = np.array(port["pleuraPointLps"], dtype=float)
    states, flow_time, limiter = collapse(base, faces, field, port_point)
    log(f"collapse: flow time {flow_time:.3f}; limiter smoothed {limiter['smoothings']} times")

    table, failures = [], []
    for k, state in enumerate(states):
        row = {"step": k, "flowTimeFraction": k / COLLAPSE["steps"], "volumeMl": signed_volume(state, faces) / 1000.0,
               "gapAtPortMm": float(distance_to_surface(port_point[None], state, faces)[0][0]),
               **check_state(base, state, faces, space_vertices, space_faces, space)}
        row["volumeFraction"] = row["volumeMl"] / table[0]["volumeMl"] if table else 1.0
        table.append(row)
        log(f"  step {k}: {row['volumeMl']:7.1f} mL, gap {row['gapAtPortMm']:5.1f} mm, clearance {row['clearanceMm']:.2f} mm, "
            f"folded {row['foldedFaces']}, crossing {row['crossingFaces']}, through the pleura {row['facesThroughPleura']}")
    between = []
    for k in range(COLLAPSE["steps"]):
        worst = {"foldedFaces": 0, "crossingFaces": 0, "facesThroughPleura": 0, "clearanceMm": np.inf}
        for fraction in BLEND_CHECKS:
            result = check_state(base, (1 - fraction) * states[k] + fraction * states[k + 1], faces,
                                 space_vertices, space_faces, space)
            for key in ("foldedFaces", "crossingFaces", "facesThroughPleura"):
                worst[key] = max(worst[key], result[key])
            worst["clearanceMm"] = min(worst["clearanceMm"], result["clearanceMm"])
        between.append({"from": k, "to": k + 1, "checkedAt": list(BLEND_CHECKS), **worst})
    for row in table + between:
        where = f"step {row['step']}" if "step" in row else f"between steps {row['from']} and {row['to']}"
        for key in ("foldedFaces", "crossingFaces", "facesThroughPleura"):
            if row[key]:
                failures.append(f"{where}: {row[key]} {key}")
        if row["clearanceMm"] < CLEARANCE_FLOOR_MM:
            failures.append(f"{where}: clearance {row['clearanceMm']:.2f} mm")
    if failures:
        raise SystemExit("Lung states failed their checks:\n" + "\n".join(failures))
    log("every state and every blend between them: no folded or crossing faces, inside the pleura")

    # the proxies. The space's is meshed on the level set offsetMm inside the drawn surface, opened so
    # that it stops short where the space is too thin for its triangles.
    proxy_field = Field.of_values(opened_offset(sdf, space.h), space.origin, space.h)
    space_proxy_raw, space_proxy_faces = even_surface(proxy_field, PROXY["pleuralSpaceEdgeMm"], step=4, iso=0.0)
    unrefined_faces = len(space_proxy_faces)
    space_proxy_raw, space_proxy_faces, dropped = largest_piece(space_proxy_raw, space_proxy_faces)
    space_proxy_raw, space_proxy_faces, refined = refine_proxy(
        space_proxy_raw, space_proxy_faces, lambda points: proxy_field.project(points, 0.0),
        space_vertices, space_faces, outward=False, limit=PROXY["spaceTrianglesLimit"])
    space_proxy, space_smoothed = unfold(space_proxy_raw, space_proxy_faces)
    for _ in range(6):
        # settling can fold a thin part over itself, and unfolding can bring it back within the margin
        space_proxy = settle_proxy(space_proxy, space_proxy_faces, space_vertices, space_faces, outward=False)
        space_proxy, smoothed = unfold(space_proxy, space_proxy_faces)
        space_smoothed += smoothed
        if smoothed == 0:
            break
    else:
        raise SystemExit("The pleural-space proxy did not settle")
    space_proxy_report = proxy_report(space_proxy, space_proxy_faces, space_vertices, space_faces, outward=False)
    log(f"pleural-space proxy: {len(space_proxy_faces)} faces ({refined} edges split where the pleura rose close), "
        f"{dropped} separate small pieces left out; {space_proxy_report}")

    lung_limit = PROXY["trianglesBudget"] - len(space_proxy_faces)
    lung_proxies, lung_proxy_rows = [], []
    for k, state in enumerate(states):
        proxy_vertices, proxy_faces, made = lung_proxy(state, faces, lung_limit)
        report = proxy_report(proxy_vertices, proxy_faces, state, faces, outward=True)
        row = {"step": k, "faces": int(len(proxy_faces)), "vertices": int(len(proxy_vertices)), **made, **report,
               "watertight": edges_shared_twice(proxy_faces), "outward": signed_volume(proxy_vertices, proxy_faces) > 0,
               "crossingFaces": int(len(crossing_pairs(proxy_vertices.astype(np.float32).astype(np.float64), proxy_faces)))}
        lung_proxies.append((proxy_vertices, proxy_faces))
        lung_proxy_rows.append(row)
        log(f"  lung proxy, step {k}: {row['faces']} faces, edges {row['edgeMm']:.2f} mm, field rounded "
            f"{row['fieldSmoothingMm']:.1f} mm; {np.round(report['proxyFromDrawnMm'], 2).tolist()} mm from the lung")
    problems = [row for row in lung_proxy_rows
                if row["facesCrossingDrawn"] or row["crossingFaces"] or not row["watertight"] or not row["outward"]
                or min(row["drawnFromProxyMm"][0], row["proxyFromDrawnMm"][0]) < PROXY["marginMm"] - 1e-6]
    # The drawn lung is blended between neighbouring states; halfway, it must lie inside one of the two
    # states' proxies, which is what lets the engine step the lung with room around the instrument.
    halfway_outside = []
    for k in range(len(states) - 1):
        halfway = 0.5 * (states[k] + states[k + 1])
        inside = np.zeros(len(halfway), dtype=bool)
        for proxy_vertices, proxy_faces in lung_proxies[k:k + 2]:
            inside |= signed_from(halfway, proxy_vertices, proxy_faces) < 0
        halfway_outside.append({"from": k, "to": k + 1, "verticesOutsideBoth": int((~inside).sum())})
    problems += [row for row in halfway_outside if row["verticesOutsideBoth"]]
    space_self = len(crossing_pairs(space_proxy.astype(np.float32).astype(np.float64), space_proxy_faces))
    if space_self or space_proxy_report["facesCrossingDrawn"] or min(space_proxy_report["drawnFromProxyMm"][0],
                                                       space_proxy_report["proxyFromDrawnMm"][0]) < PROXY["marginMm"] - 1e-6:
        problems.append({"pleuralSpace": space_proxy_report})
    if problems:
        raise SystemExit(f"Proxies failed their checks: {problems}")
    if winding_numbers(space_proxy[:1], space_vertices, space_faces)[0] < 0.5:
        raise SystemExit("The pleural-space proxy is not inside the drawn surface")
    for (proxy_vertices, proxy_faces), state in zip(lung_proxies, states):
        if winding_numbers(state[:1], proxy_vertices, proxy_faces)[0] < 0.5:
            raise SystemExit("A drawn lung state is not inside its proxy")
    log("proxies: each clear of its drawn surface by the margin, on its safe side, at every state")

    samples, sample_stats = zone_samples(space_vertices, space_faces, space_zones, space_proxy, space_proxy_faces)
    log(f"zone samples: {sample_stats['total']} points")
    fluid = fluid_table(space_vertices, space_faces, states, faces)
    log("fluid table built")

    raw = work_path("raw", "lung-states.glb").parent
    quantisation = write_lung(raw / "lung-states.glb", base, states, faces, lobe)
    write_space_proxy(raw / "proxy-pleural-space.glb", space_proxy, space_proxy_faces, samples)
    write_lung_proxy(raw / "proxy-lung.glb", lung_proxies)
    files = {name: {"file": f"{name}.glb", "sha256": sha256_file(raw / f"{name}.glb"), "bytes": (raw / f"{name}.glb").stat().st_size}
             for name in ("lung-states", "proxy-pleural-space", "proxy-lung")}
    log(f"quantisation: step {quantisation['positionStepMm']:.4f} mm, largest error {quantisation['largestErrorMm']:.4f} mm")

    common = {"script": "scripts/medical-thoracoscopy/build_lung_states.py",
              "statement": ("Numbers only. The files are built in the owner's local data and are not in the repository: "
                            "the segmentation's terms are not settled (rights register, R-ANATOMY-SEGMENTATION)."),
              "frame": "LPS millimetres"}
    area = face_normals(base, faces)[1]
    write_record(RECORDS / "lung-states.json", rounded({
        "record": "medical-thoracoscopy-lung-states",
        "version": 1,
        **common,
        "label": LABEL,
        "statesLabel": STATES_LABEL,
        "claims": CLAIMS,
        "files": files,
        "lung": {
            **LUNG,
            "lobes": [{"id": name, "segment": LOBES[name], "faces": int((lobe == name).sum()),
                       "areaCm2": float(area[lobe == name].sum() / 100.0)} for name in LOBES],
            "voxelVolumeMl": lung_voxel_ml,
            "faces": int(len(faces)),
            "vertices": int(len(base)),
            "watertight": edges_shared_twice(faces),
            "smallestAngleDeg": float(min_angles(base, faces).min()),
        },
        "collapse": {**COLLAPSE, "hilarCentroidLps": hilar.tolist(), "targetLps": target.tolist(), "flowTime": flow_time,
                     "portPleuraPointLps": port_point.tolist(), **limiter},
        "checks": {"clearanceFloorMm": CLEARANCE_FLOOR_MM, "blendsCheckedAt": list(BLEND_CHECKS),
                   "foldedMeans": ("the angle between a face and a neighbour has grown by more than 90 degrees since the "
                                   "expanded state, or the face has shrunk below 5 per cent of its area")},
        "states": table,
        "between": between,
        "quantisation": quantisation,
    }, 3))
    write_record(RECORDS / "proxies.json", rounded({
        "record": "medical-thoracoscopy-collision-proxies",
        "version": 1,
        **common,
        "label": LABEL,
        "method": PROXY,
        "pleuralSpace": {"faces": int(len(space_proxy_faces)), "vertices": int(len(space_proxy)),
                         "facesBeforeRefinement": int(unrefined_faces), "edgesSplit": int(refined),
                         "verticesSmoothed": int(space_smoothed),
                         "piecesLeftOut": int(dropped),
                         "watertight": edges_shared_twice(space_proxy_faces),
                         "outward": signed_volume(space_proxy, space_proxy_faces) > 0,
                         "crossingFaces": int(space_self),
                         "side": "inside the drawn pleural surface", **space_proxy_report},
        "lung": {"side": "around the drawn lung", "perState": "one closed surface for each lung state",
                 "states": lung_proxy_rows, "halfwayBetweenStates": halfway_outside},
        "trianglesInUse": int(len(space_proxy_faces) + max(row["faces"] for row in lung_proxy_rows)),
    }, 3))
    write_record(RECORDS / "zone-samples.json", rounded({
        "record": "medical-thoracoscopy-zone-samples",
        "version": 1,
        **common,
        "label": "Authored construct",
        "method": {**SAMPLES, "placement": ("Area-weighted, stratified along each zone's faces in order; each point starts "
                                            "at a face centre, moves to the nearest point of the pleural-space proxy and then "
                                            "insideProxyMm inside it; where the proxy ends in a thin edge, it goes instead to "
                                            "the nearest point checked to lie that far inside, one of a set just in from each "
                                            "proxy vertex and face centre. liftMm is how far the points moved.")},
        "file": "proxy-pleural-space.glb",
        **sample_stats,
    }, 3))
    write_record(RECORDS / "fluid-table.json", rounded({
        "record": "medical-thoracoscopy-fluid-table",
        "version": 1,
        **common,
        "label": STATES_LABEL,
        "method": ("In the presented position, gravity toward the patient's left: the volume of the drawn pleural space "
                   "below a level plane at right angles to gravity, less the drawn lung's volume below it at each lung "
                   "state. Heights are measured against gravity from the space's lowest point."),
        "gravityLps": GRAVITY_LPS.tolist(),
        "stepMm": FLUID_STEP_MM,
        **fluid,
    }, 2))

    log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
