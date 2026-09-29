"""Even triangle surfaces of voxel masks, for surfaces that are drawn close up or that move.

Marching cubes on a smoothed mask leaves slivers, and simplifying it leaves long thin triangles;
both shade badly close up, and both fold at the first push when a surface moves. `even_surface`
meshes the mask's smoothed iso-surface with triangles of about one edge length and no small
angles:

1. `Field` samples the mask, smoothed, on an isotropic grid; its trilinear value and gradient put
   any point back on the iso-surface (`Field.project`).
2. Marching cubes on every `step`-th grid point gives the first surface.
3. Rounds of: split edges longer than 4/3 of the target; collapse edges shorter than 4/5 of it,
   only where the surface stays a manifold (the link condition), no edge grows past 4/3 and no
   neighbouring face turns by more than 60 degrees; flip edges between nearly flat pairs of faces
   where that widens the smaller angle; relax the vertices along the surface; put them back on it.

Deterministic: the same mask gives the same surface, vertex for vertex.
"""
from __future__ import annotations

from collections import defaultdict

import numpy as np
from scipy import ndimage, sparse
from skimage import measure


class Field:
    """A mask smoothed by a gaussian of `sigma_mm` and sampled on an isotropic grid of `h` mm."""

    def __init__(self, volume, mask: np.ndarray, h: float, sigma_mm: float = 1.0, pad_mm: float = 6.0) -> None:
        idx = np.argwhere(mask)
        pad = np.ceil(pad_mm / volume.spacing).astype(int) + 2
        lo = idx.min(0) - pad
        hi = idx.max(0) + pad + 1
        src_lo = np.maximum(lo, 0)
        src_hi = np.minimum(hi, volume.shape)
        crop = np.zeros(hi - lo, dtype=np.float32)
        crop[tuple(slice(a - l, b - l) for a, b, l in zip(src_lo, src_hi, lo))] = mask[
            tuple(slice(a, b) for a, b in zip(src_lo, src_hi))]
        smooth = ndimage.gaussian_filter(crop, sigma_mm / volume.spacing)
        self.origin = volume.origin + lo * volume.spacing
        extent = (np.array(crop.shape) - 1) * volume.spacing
        n = np.floor(extent / h).astype(int) + 1
        grid = np.stack(np.meshgrid(*[np.arange(k) for k in n], indexing="ij"), -1).reshape(-1, 3)
        self.values = ndimage.map_coordinates(smooth, (grid * h / volume.spacing).T, order=1).reshape(n).astype(np.float32)
        self.h = float(h)
        self.grad = np.stack(np.gradient(self.values, self.h), -1).astype(np.float32)

    @classmethod
    def of_values(cls, values: np.ndarray, origin: np.ndarray, h: float) -> "Field":
        """A field of given values on a grid, such as a signed distance, for `even_surface` at any iso-value."""
        field = cls.__new__(cls)
        field.values = np.asarray(values, dtype=np.float32)
        field.origin = np.asarray(origin, dtype=float)
        field.h = float(h)
        field.grad = np.stack(np.gradient(field.values, field.h), -1).astype(np.float32)
        return field

    def _ijk(self, points: np.ndarray) -> np.ndarray:
        return ((np.asarray(points) - self.origin) / self.h).T

    def value(self, points: np.ndarray) -> np.ndarray:
        return ndimage.map_coordinates(self.values, self._ijk(points), order=1, mode="nearest")

    def gradient(self, points: np.ndarray) -> np.ndarray:
        ijk = self._ijk(points)
        return np.stack([ndimage.map_coordinates(self.grad[..., c], ijk, order=1, mode="nearest") for c in range(3)], -1)

    def signed_distance(self, points: np.ndarray, iso: float = 0.5) -> np.ndarray:
        """First-order distance to the iso-surface, positive inside; good within a few mm of it."""
        g = np.linalg.norm(self.gradient(points), axis=1)
        return (self.value(points) - iso) / (g + 1e-9)

    def project(self, points: np.ndarray, iso: float = 0.5, iterations: int = 3) -> np.ndarray:
        """Newton steps along the gradient onto the iso-surface, each at most half a cell."""
        p = np.asarray(points, dtype=float).copy()
        for _ in range(iterations):
            f = self.value(p) - iso
            g = self.gradient(p)
            step = (f / (np.einsum("ij,ij->i", g, g) + 1e-12))[:, None] * g
            length = np.linalg.norm(step, axis=1)
            p -= step * np.minimum(1.0, 0.5 * self.h / (length + 1e-12))[:, None]
        return p


def face_normals(vertices: np.ndarray, faces: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]], vertices[faces[:, 2]] - vertices[faces[:, 0]])
    length = np.linalg.norm(n, axis=1)
    return n / (length[:, None] + 1e-12), length / 2.0


def vertex_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Area-weighted vertex normals."""
    n = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]], vertices[faces[:, 2]] - vertices[faces[:, 0]])
    out = np.zeros_like(vertices)
    for i in range(3):
        np.add.at(out, faces[:, i], n)
    return out / (np.linalg.norm(out, axis=1)[:, None] + 1e-12)


def min_angles(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Each face's smallest angle, in degrees."""
    corners = [vertices[faces[:, i]] for i in range(3)]
    out = np.full(len(faces), 180.0)
    for i in range(3):
        p, q, r = corners[i], corners[(i + 1) % 3], corners[(i + 2) % 3]
        u, v = q - p, r - p
        cos = np.einsum("ij,ij->i", u, v) / (np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) + 1e-12)
        out = np.minimum(out, np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))
    return out


def compact(vertices: np.ndarray, faces: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    used = np.unique(faces)
    remap = -np.ones(len(vertices), dtype=np.int64)
    remap[used] = np.arange(len(used))
    return vertices[used], remap[faces]


def split_long(vertices: np.ndarray, faces: np.ndarray, max_len: float,
               only: set[int] | None = None) -> tuple[np.ndarray, np.ndarray, int]:
    """Split edges longer than max_len at their midpoints, longest first, each face in at most one
    split per pass; the two faces on a split edge become four. `only`, if given, limits the splits
    to those edges, keyed min(a, b) * vertex count + max(a, b). New vertices are appended."""
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    owner = np.tile(np.arange(len(faces)), 3)
    length = np.linalg.norm(vertices[edges[:, 0]] - vertices[edges[:, 1]], axis=1)
    n = len(vertices)
    lookup = dict(zip((edges[:, 0] * n + edges[:, 1]).tolist(), owner.tolist()))
    busy = np.zeros(len(faces), bool)
    keep = np.ones(len(faces), bool)
    new_vertices, new_faces = [], []
    for i in np.argsort(-length, kind="stable"):
        if length[i] <= max_len:
            break
        a, b = int(edges[i, 0]), int(edges[i, 1])
        if only is not None and min(a, b) * n + max(a, b) not in only:
            continue
        f, g = int(owner[i]), lookup.get(b * n + a)
        if g is None or busy[f] or busy[g]:
            continue
        c = int(next(x for x in faces[f] if x != a and x != b))
        d = int(next(x for x in faces[g] if x != a and x != b))
        m = n + len(new_vertices)
        new_vertices.append(0.5 * (vertices[a] + vertices[b]))
        keep[f] = keep[g] = False
        busy[f] = busy[g] = True
        new_faces += [[a, m, c], [m, b, c], [b, m, d], [m, a, d]]
    if not new_faces:
        return vertices, faces, 0
    return (np.concatenate([vertices, np.array(new_vertices)]),
            np.concatenate([faces[keep], np.array(new_faces, dtype=np.int64)]), len(new_vertices))


def collapse_short(vertices: np.ndarray, faces: np.ndarray, min_len: float, max_len: float,
                   max_turn_cos: float = 0.5) -> tuple[np.ndarray, np.ndarray, int]:
    """Collapse edges shorter than min_len to their midpoints, shortest first, where the surface
    stays a manifold, no edge at the new vertex exceeds max_len, and no face turns by more than
    arccos(max_turn_cos)."""
    V = vertices.copy()
    F = faces.copy()
    alive = np.ones(len(F), bool)
    vertex_faces: dict[int, set[int]] = defaultdict(set)
    for f, tri in enumerate(F):
        for v in tri:
            vertex_faces[int(v)].add(f)
    edges = np.unique(np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1), axis=0)
    length = np.linalg.norm(V[edges[:, 0]] - V[edges[:, 1]], axis=1)
    removed = np.zeros(len(V), bool)
    collapsed = 0
    for i in np.argsort(length, kind="stable"):
        if length[i] >= min_len:
            break
        a, b = int(edges[i, 0]), int(edges[i, 1])
        if removed[a] or removed[b] or np.linalg.norm(V[a] - V[b]) >= min_len:
            continue
        shared = vertex_faces[a] & vertex_faces[b]
        if len(shared) != 2:
            continue
        opposite = {int(v) for f in shared for v in F[f] if v != a and v != b}
        ring_a = {int(v) for f in vertex_faces[a] for v in F[f]} - {a}
        ring_b = {int(v) for f in vertex_faces[b] for v in F[f]} - {b}
        if (ring_a & ring_b) != opposite:
            continue
        m = 0.5 * (V[a] + V[b])
        if max(np.linalg.norm(V[x] - m) for x in (ring_a | ring_b) - {a, b}) > max_len:
            continue
        acceptable = True
        for f in sorted((vertex_faces[a] | vertex_faces[b]) - shared):
            tri = F[f]
            before = np.cross(V[tri[1]] - V[tri[0]], V[tri[2]] - V[tri[0]])
            moved = V[tri].copy()
            moved[(tri == a) | (tri == b)] = m
            after = np.cross(moved[1] - moved[0], moved[2] - moved[0])
            if np.linalg.norm(after) < 1e-12 or np.dot(before, after) < max_turn_cos * np.linalg.norm(before) * np.linalg.norm(after):
                acceptable = False
                break
        if not acceptable:
            continue
        V[a] = m
        for f in vertex_faces[b] - shared:
            F[f][F[f] == b] = a
        for f in shared:
            alive[f] = False
            for v in F[f]:
                vertex_faces[int(v)].discard(f)
        vertex_faces[a] |= vertex_faces[b] - shared
        vertex_faces[a] -= shared
        del vertex_faces[b]
        removed[b] = True
        collapsed += 1
    V, F = compact(V, F[alive])
    return V, F, collapsed


def flip_edges(vertices: np.ndarray, faces: np.ndarray, max_dihedral_deg: float = 20.0) -> tuple[np.ndarray, int]:
    """One pass of edge flips between nearly flat pairs of faces, where flipping widens the smaller
    of the two faces' smallest angles by more than a degree; each face in at most one flip."""
    F = faces.copy()
    n = len(vertices)
    edges = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    lookup = dict(zip((edges[:, 0] * n + edges[:, 1]).tolist(), np.tile(np.arange(len(F)), 3).tolist()))
    undirected = set((np.minimum(edges[:, 0], edges[:, 1]) * n + np.maximum(edges[:, 0], edges[:, 1])).tolist())
    normals, _ = face_normals(vertices, F)
    angles = min_angles(vertices, F)
    cos_limit = np.cos(np.radians(max_dihedral_deg))
    busy = np.zeros(len(F), bool)
    flips = 0
    for k in np.argsort(angles, kind="stable"):
        if busy[k]:
            continue
        for j in range(3):
            tri = F[k]
            a, b, c = int(tri[j]), int(tri[(j + 1) % 3]), int(tri[(j + 2) % 3])
            g = lookup.get(b * n + a)
            if g is None or busy[g]:
                continue
            d = int(next(x for x in F[g] if x != a and x != b))
            if min(c, d) * n + max(c, d) in undirected or np.dot(normals[k], normals[g]) < cos_limit:
                continue
            new = np.array([[a, d, c], [d, b, c]])
            if min_angles(vertices, new).min() <= min(angles[k], angles[g]) + 1.0:
                continue
            new_normals, _ = face_normals(vertices, new)
            average = normals[k] + normals[g]
            if np.dot(new_normals[0], average) <= 0 or np.dot(new_normals[1], average) <= 0:
                continue
            for x, y in ((a, b), (b, c), (c, a), (b, a), (a, d), (d, b)):
                lookup.pop(x * n + y, None)
            F[k], F[g] = new[0], new[1]
            for x, y in ((a, d), (d, c), (c, a)):
                lookup[x * n + y] = int(k)
            for x, y in ((d, b), (b, c), (c, d)):
                lookup[x * n + y] = int(g)
            undirected.discard(min(a, b) * n + max(a, b))
            undirected.add(min(c, d) * n + max(c, d))
            busy[k] = busy[g] = True
            flips += 1
            break
    return F, flips


def relax(vertices: np.ndarray, faces: np.ndarray, field: Field, iterations: int = 2, lam: float = 0.5,
          iso: float = 0.5) -> np.ndarray:
    """Move each vertex part way to the mean of its neighbours, along the surface only, then back
    onto the iso-surface."""
    n = len(vertices)
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    adjacency = sparse.coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(n, n)).tocsr()
    adjacency = ((adjacency + adjacency.T) > 0).astype(float)
    degree = np.asarray(adjacency.sum(1)).ravel()
    V = vertices
    for _ in range(iterations):
        d = (adjacency @ V) / degree[:, None] - V
        normals = vertex_normals(V, faces)
        d -= np.einsum("ij,ij->i", d, normals)[:, None] * normals
        V = field.project(V + lam * d, iso)
    return V


def even_surface(field: Field, target_edge: float, step: int = 1, rounds: int = 8, iso: float = 0.5,
                 log=None) -> tuple[np.ndarray, np.ndarray]:
    """An even triangle surface of the field's iso-surface, edges near target_edge, faces outward."""
    verts, faces, _, _ = measure.marching_cubes(field.values, level=iso, spacing=(field.h,) * 3, step_size=step)
    V = verts + field.origin
    F = faces.astype(np.int64)
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    if np.einsum("ij,ij->i", a, np.cross(b, c)).sum() < 0:
        F = F[:, [0, 2, 1]]
    V = field.project(V, iso)
    low, high = 0.8 * target_edge, 4.0 / 3.0 * target_edge
    for r in range(rounds):
        V, F, splits = split_long(V, F, high)
        V, F, collapsed = collapse_short(V, F, low, high)
        V = field.project(V, iso)
        flips = 0
        for _ in range(3):
            F, done = flip_edges(V, F)
            flips += done
        V = relax(V, F, field, 2, 0.5, iso)
        if log is not None:
            log(f"   remesh round {r}: {splits} split, {collapsed} collapsed, {flips} flipped; {len(F)} faces, "
                f"smallest angle {min_angles(V, F).min():.1f} degrees")
    return V, F
