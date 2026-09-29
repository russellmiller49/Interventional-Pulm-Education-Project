"""Mesh checks the lung states and proxies must pass at every step, written without mesh libraries.

These are the independent checks the build plan asks for: they share no code with the code that
moves the lung, so a fault in one does not hide itself in the other.

- `folded_faces`: faces whose normal has turned more than 90 degrees from the reference state, or
  whose area has fallen to almost nothing.
- `crossing_pairs`: pairs of faces that pass through each other. A uniform grid finds the pairs
  whose boxes meet; an exact segment-triangle test, both ways, decides each pair. Faces that share
  a vertex touch by construction and are not tested.
- `edges_shared_twice`: every edge belongs to exactly two faces (a closed surface).
- `signed_volume`: positive when the faces turn outward.
- `distance_to_surface`: each point's exact distance to the nearest point of a triangle surface.
- `volume_below`: the volume of a closed surface on one side of a plane.
- `winding_numbers`: for each point, how many times a closed surface winds around it (1 inside,
  0 outside), from the solid angles its faces subtend; no ray and no parity is relied on.
"""
from __future__ import annotations

import numpy as np

EPS = 1e-9


def face_normals(vertices: np.ndarray, faces: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    a, b, c = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
    cross = np.cross(b - a, c - a)
    area = np.linalg.norm(cross, axis=1) / 2.0
    return cross / (2.0 * area[:, None] + EPS), area


def face_neighbours(faces: np.ndarray) -> np.ndarray:
    """For each face, the faces that share an edge with it, as an (m, 3) array (-1 where none)."""
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    owner = np.tile(np.arange(len(faces)), 3)
    key = np.sort(edges, axis=1)
    order = np.lexsort((key[:, 1], key[:, 0]))
    key, owner = key[order], owner[order]
    same = np.all(key[1:] == key[:-1], axis=1)
    out = np.full((len(faces), 3), -1, dtype=np.int64)
    fill = np.zeros(len(faces), dtype=np.int64)
    for a, b in zip(owner[:-1][same], owner[1:][same]):
        out[a, fill[a]] = b; fill[a] += 1
        out[b, fill[b]] = a; fill[b] += 1
    return out


def folded_faces(reference: np.ndarray, moved: np.ndarray, faces: np.ndarray, min_area_ratio: float = 0.05,
                 neighbours: np.ndarray | None = None) -> np.ndarray:
    """Faces the motion has folded over: the angle between a face and a face sharing its edge has
    grown by more than 90 degrees since the reference state, or the face has shrunk to almost
    nothing. A crease the surface already had is not a fold, and a patch that turns as a whole is
    not one either."""
    n0, a0 = face_normals(reference, faces)
    n1, a1 = face_normals(moved, faces)
    nb = face_neighbours(faces) if neighbours is None else neighbours
    valid = nb >= 0
    safe = np.where(valid, nb, 0)
    angle0 = np.arccos(np.clip(np.einsum("ij,ikj->ik", n0, n0[safe]), -1.0, 1.0))
    angle1 = np.arccos(np.clip(np.einsum("ij,ikj->ik", n1, n1[safe]), -1.0, 1.0))
    creased = np.any(valid & (angle1 - angle0 > np.pi / 2), axis=1)
    return np.flatnonzero(creased | (a1 < min_area_ratio * a0))


def edges_shared_twice(faces: np.ndarray) -> bool:
    edges = np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1)
    _, counts = np.unique(edges, axis=0, return_counts=True)
    return bool((counts == 2).all())


def signed_volume(vertices: np.ndarray, faces: np.ndarray) -> float:
    a, b, c = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)


def _candidate_pairs(vertices: np.ndarray, faces: np.ndarray, faces_b: np.ndarray | None = None,
                     vertices_b: np.ndarray | None = None) -> np.ndarray:
    """Pairs of faces whose bounding boxes share a grid cell and overlap. The cell is twice the
    smaller surface's median edge, so a cell holds few faces of either surface."""
    same = faces_b is None
    vb = vertices if same else vertices_b
    fb = faces if same else faces_b
    tri_a = vertices[faces]
    tri_b = vb[fb]
    lo_a, hi_a = tri_a.min(1), tri_a.max(1)
    lo_b, hi_b = tri_b.min(1), tri_b.max(1)
    edge = min(np.median(np.linalg.norm(tri_a[:, 1] - tri_a[:, 0], axis=1)),
               np.median(np.linalg.norm(tri_b[:, 1] - tri_b[:, 0], axis=1)))
    cell = max(edge * 2.0, 1e-3)
    origin = np.minimum(lo_a.min(0), lo_b.min(0))

    def cells(lo, hi):
        c0 = np.floor((lo - origin) / cell).astype(np.int64)
        c1 = np.floor((hi - origin) / cell).astype(np.int64)
        out_tri, out_key = [], []
        span = c1 - c0 + 1
        for dx in range(span[:, 0].max()):
            for dy in range(span[:, 1].max()):
                for dz in range(span[:, 2].max()):
                    idx = np.flatnonzero((dx < span[:, 0]) & (dy < span[:, 1]) & (dz < span[:, 2]))
                    key = c0[idx] + np.array([dx, dy, dz])
                    out_tri.append(idx)
                    out_key.append((key[:, 0] * 73856093) ^ (key[:, 1] * 19349663) ^ (key[:, 2] * 83492791))
        return np.concatenate(out_tri), np.concatenate(out_key)

    ta, ka = cells(lo_a, hi_a)
    tb, kb = (ta, ka) if same else cells(lo_b, hi_b)
    order = np.argsort(ka, kind="stable")
    ta, ka = ta[order], ka[order]
    order = np.argsort(kb, kind="stable")
    tb, kb = tb[order], kb[order]
    keys, count_a = np.unique(ka, return_counts=True)
    start_b = np.searchsorted(kb, keys, side="left")
    count_b = np.searchsorted(kb, keys, side="right") - start_b
    group = np.repeat(np.arange(len(keys)), count_a)  # each A entry's cell
    per_entry = count_b[group]                         # how many B entries share that cell
    total = int(per_entry.sum())
    if total == 0:
        return np.zeros((0, 2), dtype=np.int64)
    first = np.cumsum(per_entry) - per_entry
    a_index = np.repeat(ta, per_entry)
    b_index = tb[np.repeat(start_b[group], per_entry) + (np.arange(total) - np.repeat(first, per_entry))]
    if same:
        keep = a_index < b_index
        a_index, b_index = a_index[keep], b_index[keep]
    code = np.unique(a_index * np.int64(len(fb)) + b_index)
    pairs = np.stack([code // len(fb), code % len(fb)], axis=1)
    overlap = np.all(lo_a[pairs[:, 0]] <= hi_b[pairs[:, 1]], axis=1) & np.all(lo_b[pairs[:, 1]] <= hi_a[pairs[:, 0]], axis=1)
    pairs = pairs[overlap]
    if same:
        share = (faces[pairs[:, 0]][:, :, None] == faces[pairs[:, 1]][:, None, :]).any(axis=(1, 2))
        pairs = pairs[~share]
    return pairs


def _segments_hit_triangles(p0: np.ndarray, p1: np.ndarray, tri: np.ndarray) -> np.ndarray:
    """Whether each segment p0→p1 passes through its triangle (Möller–Trumbore, strict interior)."""
    d = p1 - p0
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    h = np.cross(d, e2)
    a = np.einsum("ij,ij->i", e1, h)
    ok = np.abs(a) > 1e-12
    f = np.where(ok, 1.0 / np.where(ok, a, 1.0), 0.0)
    s = p0 - tri[:, 0]
    u = f * np.einsum("ij,ij->i", s, h)
    q = np.cross(s, e1)
    v = f * np.einsum("ij,ij->i", d, q)
    t = f * np.einsum("ij,ij->i", e2, q)
    margin = 1e-7
    return ok & (u > margin) & (v > margin) & (u + v < 1 - margin) & (t > margin) & (t < 1 - margin)


def crossing_pairs(vertices: np.ndarray, faces: np.ndarray, faces_b: np.ndarray | None = None,
                   vertices_b: np.ndarray | None = None, chunk: int = 200000) -> np.ndarray:
    """Pairs of faces that pass through each other (within one surface, or between two)."""
    pairs = _candidate_pairs(vertices, faces, faces_b, vertices_b)
    vb = vertices if faces_b is None else vertices_b
    fb = faces if faces_b is None else faces_b
    hits = np.zeros(len(pairs), dtype=bool)
    for start in range(0, len(pairs), chunk):
        part = pairs[start:start + chunk]
        ta = vertices[faces[part[:, 0]]]
        tb = vb[fb[part[:, 1]]]
        hit = np.zeros(len(part), dtype=bool)
        for i, j in ((0, 1), (1, 2), (2, 0)):
            hit |= _segments_hit_triangles(ta[:, i], ta[:, j], tb)
            hit |= _segments_hit_triangles(tb[:, i], tb[:, j], ta)
        hits[start:start + chunk] = hit
    return pairs[hits]


def repair_crossings(vertices: np.ndarray, faces: np.ndarray, rounds: int = 25) -> tuple[np.ndarray, int]:
    """Smooth the neighbourhood of every crossing pair until no face passes through another.

    Checked on float32 positions, the precision the files are written in. Returns the repaired
    vertices and the number of rounds taken; raises if crossings remain."""
    out = np.asarray(vertices, dtype=np.float64).copy()
    neighbours: dict[int, set[int]] = {}
    for tri in faces:
        for i in range(3):
            neighbours.setdefault(int(tri[i]), set()).update(int(tri[j]) for j in range(3) if j != i)
    for round_index in range(rounds):
        pairs = crossing_pairs(out.astype(np.float32).astype(np.float64), faces)
        if len(pairs) == 0:
            return out, round_index
        region = set(np.unique(faces[pairs.ravel()]).tolist())
        for _ in range(1 + round_index // 5):
            region |= {n for v in list(region) for n in neighbours[v]}
        region_list = np.array(sorted(region))
        for _ in range(3):
            means = np.array([out[list(neighbours[v])].mean(0) for v in region_list])
            out[region_list] = 0.5 * out[region_list] + 0.5 * means
    raise RuntimeError(f"{len(crossing_pairs(out, faces))} crossing pairs remain after {rounds} rounds")


def _closest_on_triangles(p: np.ndarray, a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    """The closest point of each triangle abc to each point p (Ericson, Real-Time Collision
    Detection, 5.1.5), vectorised."""
    ab, ac, ap = b - a, c - a, p - a
    d1 = np.einsum("ij,ij->i", ab, ap)
    d2 = np.einsum("ij,ij->i", ac, ap)
    bp = p - b
    d3 = np.einsum("ij,ij->i", ab, bp)
    d4 = np.einsum("ij,ij->i", ac, bp)
    cp = p - c
    d5 = np.einsum("ij,ij->i", ab, cp)
    d6 = np.einsum("ij,ij->i", ac, cp)
    va = d3 * d6 - d5 * d4
    vb = d5 * d2 - d1 * d6
    vc = d1 * d4 - d3 * d2
    denom = va + vb + vc
    safe = np.where(np.abs(denom) > EPS, denom, 1.0)
    out = a + (vb / safe)[:, None] * ab + (vc / safe)[:, None] * ac  # inside the face
    def ratio(numerator: np.ndarray, denominator: np.ndarray, where: np.ndarray) -> np.ndarray:
        usable = where & (denominator > EPS)
        return np.where(usable, numerator / np.where(usable, denominator, 1.0), 0.0)

    edge_bc = (va <= 0) & (d4 - d3 >= 0) & (d5 - d6 >= 0)
    w = ratio(d4 - d3, (d4 - d3) + (d5 - d6), edge_bc)
    out = np.where(edge_bc[:, None], b + w[:, None] * (c - b), out)
    edge_ac = (vb <= 0) & (d2 >= 0) & (d6 <= 0)
    w = ratio(d2, d2 - d6, edge_ac)
    out = np.where(edge_ac[:, None], a + w[:, None] * ac, out)
    edge_ab = (vc <= 0) & (d1 >= 0) & (d3 <= 0)
    w = ratio(d1, d1 - d3, edge_ab)
    out = np.where(edge_ab[:, None], a + w[:, None] * ab, out)
    out = np.where(((d6 >= 0) & (d5 <= d6))[:, None], c, out)
    out = np.where(((d3 >= 0) & (d4 <= d3))[:, None], b, out)
    out = np.where(((d1 <= 0) & (d2 <= 0))[:, None], a, out)
    return out


def distance_to_surface(points: np.ndarray, vertices: np.ndarray, faces: np.ndarray,
                        chunk: int = 4000, closest: bool = False):
    """Each point's exact distance to a triangle surface, and the face that holds the closest point.

    A face can hold a point's closest point only if its centroid lies within (the point's distance
    to some face + the face's own reach from centroid to corner). So: exact distances to the eight
    faces with the nearest centroids give an upper bound; every face whose centroid lies within that
    bound plus the usual reach is then tested exactly, and so is every face whose reach is larger
    than usual, whatever its distance."""
    from scipy.spatial import cKDTree

    tri = vertices[faces]
    centroid = tri.mean(1)
    reach = np.linalg.norm(tri - centroid[:, None], axis=2).max(1)
    usual = float(np.percentile(reach, 99.0))
    small = np.flatnonzero(reach <= usual)
    large = np.flatnonzero(reach > usual)
    tree = cKDTree(centroid[small])
    points = np.asarray(points, dtype=float)
    best = np.empty(len(points))
    best_face = np.empty(len(points), dtype=np.int64)

    def exact(owner: np.ndarray, candidates: np.ndarray, part: np.ndarray) -> np.ndarray:
        q = _closest_on_triangles(part[owner], tri[candidates, 0], tri[candidates, 1], tri[candidates, 2])
        return np.linalg.norm(part[owner] - q, axis=1)

    for start in range(0, len(points), chunk):
        part = points[start:start + chunk]
        k = min(8, len(small))
        _, first = tree.query(part, k=k)
        first = small[first.reshape(len(part), k)]
        owner = np.repeat(np.arange(len(part)), k)
        bound = exact(owner, first.ravel(), part).reshape(len(part), k).min(1)
        lists = tree.query_ball_point(part, bound + usual)
        counts = np.array([len(x) for x in lists])
        owner = np.repeat(np.arange(len(part)), counts)
        candidates = small[np.concatenate([np.asarray(x, dtype=np.int64) for x in lists])]
        if len(large):
            owner = np.concatenate([owner, np.repeat(np.arange(len(part)), len(large))])
            candidates = np.concatenate([candidates, np.tile(large, len(part))])
        d = exact(owner, candidates, part)
        order = np.argsort(owner, kind="stable")
        owner, candidates, d = owner[order], candidates[order], d[order]
        edges = np.flatnonzero(np.r_[True, owner[1:] != owner[:-1]])
        minima = np.minimum.reduceat(d, edges)
        at_min = d == np.repeat(minima, np.diff(np.r_[edges, len(d)]))
        first_min = np.maximum.accumulate(np.where(at_min, np.arange(len(d)), -1))
        pick = first_min[np.r_[edges[1:] - 1, len(d) - 1]]
        best[start + owner[edges]] = minima
        best_face[start + owner[edges]] = candidates[pick]
    if closest:
        points_on = _closest_on_triangles(points, tri[best_face, 0], tri[best_face, 1], tri[best_face, 2])
        return best, best_face, points_on
    return best, best_face


def signed_distance_to_surface(points: np.ndarray, vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Distance to a closed, outward surface, negative inside. The sign comes from the angle-weighted
    pseudo-normal of the feature that holds the closest point: the face's normal inside a face, the
    sum of the two faces' normals on an edge, the angle-weighted normal at a vertex (Baerentzen and
    Aanaes, 2005). Exact for a closed surface that does not pass through itself, however far the
    point lies or however the surface bends."""
    points = np.asarray(points, dtype=float)
    distance, face, on = distance_to_surface(points, vertices, faces, closest=True)
    tri = vertices[faces]
    cross = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    normal = cross / (np.linalg.norm(cross, axis=1)[:, None] + EPS)
    corner = np.zeros((len(faces), 3))
    for i in range(3):
        u = tri[:, (i + 1) % 3] - tri[:, i]
        v = tri[:, (i + 2) % 3] - tri[:, i]
        cos = np.einsum("ij,ij->i", u, v) / (np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) + EPS)
        corner[:, i] = np.arccos(np.clip(cos, -1.0, 1.0))
    vertex_normal = np.zeros_like(vertices, dtype=float)
    for i in range(3):
        np.add.at(vertex_normal, faces[:, i], corner[:, i:i + 1] * normal)
    edge_faces: dict[tuple[int, int], list[int]] = {}
    for f, (a, b, c) in enumerate(faces.tolist()):
        for x, y in ((a, b), (b, c), (c, a)):
            edge_faces.setdefault((min(x, y), max(x, y)), []).append(f)
    # barycentric coordinates of each closest point in its face
    a, b, c = tri[face, 0], tri[face, 1], tri[face, 2]
    v0, v1, v2 = b - a, c - a, on - a
    d00, d01, d11 = (np.einsum("ij,ij->i", x, y) for x, y in ((v0, v0), (v0, v1), (v1, v1)))
    d20, d21 = np.einsum("ij,ij->i", v2, v0), np.einsum("ij,ij->i", v2, v1)
    denominator = d00 * d11 - d01 * d01
    w1 = (d11 * d20 - d01 * d21) / np.where(np.abs(denominator) > EPS, denominator, 1.0)
    w2 = (d00 * d21 - d01 * d20) / np.where(np.abs(denominator) > EPS, denominator, 1.0)
    weights = np.stack([1.0 - w1 - w2, w1, w2], 1)
    zero = weights < 1e-7
    pseudo = normal[face].copy()
    for i in np.flatnonzero(zero.sum(1) == 1):          # on an edge: the one coordinate that is zero
        k = int(np.flatnonzero(zero[i])[0])
        x, y = int(faces[face[i], (k + 1) % 3]), int(faces[face[i], (k + 2) % 3])
        pseudo[i] = normal[edge_faces[(min(x, y), max(x, y))]].sum(0)
    for i in np.flatnonzero(zero.sum(1) >= 2):          # at a vertex: the one coordinate that is not
        k = int(np.argmax(weights[i]))
        pseudo[i] = vertex_normal[faces[face[i], k]]
    side = np.einsum("ij,ij->i", points - on, pseudo)
    return np.where(side >= 0, distance, -distance)


def volume_below(vertices: np.ndarray, faces: np.ndarray, normal: np.ndarray, height: float) -> float:
    """The volume of a closed, outward-facing surface on the side of the plane {x : x.normal = height}
    that `normal` points away from. Each face is clipped to that side and its signed volume taken
    about a point on the plane, so the cut face the plane would add contributes nothing."""
    normal = np.asarray(normal, dtype=float) / np.linalg.norm(normal)
    origin = normal * height
    tri = vertices[faces] - origin
    s = np.einsum("ijk,k->ij", tri, normal)
    total = 0.0
    below = s <= 0
    count = below.sum(1)
    full = tri[count == 3]
    total += np.einsum("ij,ij->i", full[:, 0], np.cross(full[:, 1], full[:, 2])).sum()
    for index in np.flatnonzero((count == 1) | (count == 2)):
        polygon = []
        t, d = tri[index], s[index]
        for i in range(3):
            j = (i + 1) % 3
            if d[i] <= 0:
                polygon.append(t[i])
            if (d[i] <= 0) != (d[j] <= 0):
                polygon.append(t[i] + (d[i] / (d[i] - d[j])) * (t[j] - t[i]))
        for k in range(1, len(polygon) - 1):
            total += float(np.dot(polygon[0], np.cross(polygon[k], polygon[k + 1])))
    return total / 6.0


def winding_numbers(points: np.ndarray, vertices: np.ndarray, faces: np.ndarray, chunk: int = 2_000_000) -> np.ndarray:
    """The generalised winding number of a closed, outward surface at each point (van Oosterom and
    Strackee's solid angle of each face, summed, over 4 pi)."""
    points = np.asarray(points, dtype=float)
    tri = vertices[faces]
    out = np.zeros(len(points))
    rows = max(1, chunk // max(len(faces), 1))
    for start in range(0, len(points), rows):
        p = points[start:start + rows]
        a = tri[None, :, 0, :] - p[:, None, :]
        b = tri[None, :, 1, :] - p[:, None, :]
        c = tri[None, :, 2, :] - p[:, None, :]
        la, lb, lc = np.linalg.norm(a, axis=2), np.linalg.norm(b, axis=2), np.linalg.norm(c, axis=2)
        numerator = np.einsum("ijk,ijk->ij", a, np.cross(b, c))
        denominator = (la * lb * lc + np.einsum("ijk,ijk->ij", a, b) * lc + np.einsum("ijk,ijk->ij", b, c) * la
                       + np.einsum("ijk,ijk->ij", c, a) * lb)
        out[start:start + rows] = 2.0 * np.arctan2(numerator, denominator).sum(1) / (4.0 * np.pi)
    return out
