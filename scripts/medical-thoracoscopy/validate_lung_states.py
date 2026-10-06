"""Check the lung states, the proxies and the zone samples against the committed records, reading
the files independently.

    python3 scripts/medical-thoracoscopy/validate_lung_states.py

Reads each GLB in the owner's local data with its own reader (`thorax_common.read_glb` and
`glb_accessor`, not the code that wrote it), dequantises the lung as a renderer would, and checks:

- each file's SHA-256 and size equal the record's; each carries the label, the attribution, the
  frame, the presentation and gravity; the lung and its proxy name their states and claims;
- the lung: three lobes sharing one vertex array and eight morph targets; together the lobes hold
  every face once and make a closed, outward surface;
- at every state, and at the blends between neighbouring states the scene will draw: no folded
  face, no face through another, no face through the drawn pleural surface, the lung inside that
  surface (winding number) and never closer to it than the record's floor; each state's volume
  and gap at the port equal the record's;
- the pleural-space proxy: closed, outward, inside the drawn surface without touching it; one
  sample-point primitive per zone, in the zone list's order, each point inside the proxy;
- the lung proxies, one per state: each closed, outward, never through itself, and around its
  state's drawn lung without touching it; and the drawn lung halfway between two states inside one
  of their two proxies, which is what lets the engine step the lung with room around the instrument;
- the fluid table: recomputed at every tenth height from the drawn surfaces and equal to the
  record, never negative, and never falling as the level rises.

A report is written to the owner's local data; the exit status is 1 on any failure.
"""
from __future__ import annotations

import json
import sys

import numpy as np

from thorax_common import (
    ATTRIBUTION,
    GRAVITY_LPS,
    LABEL,
    PRESENTATION_FROM_LPS,
    RECORDS,
    ZONES,
    glb_accessor,
    read_glb,
    sha256_file,
    work_path,
)
from thorax_mesh_checks import (
    crossing_pairs,
    distance_to_surface,
    edges_shared_twice,
    folded_faces,
    signed_distance_to_surface,
    signed_volume,
    volume_below,
    winding_numbers,
)

ZONE_IDS = [zone["id"] for zone in json.loads(ZONES.read_text())["zones"]]
LUNG = json.loads((RECORDS / "lung-states.json").read_text())
PROXIES = json.loads((RECORDS / "proxies.json").read_text())
SAMPLES = json.loads((RECORDS / "zone-samples.json").read_text())
FLUID = json.loads((RECORDS / "fluid-table.json").read_text())
failures: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)
        print("✗", message)


def f32(values: np.ndarray) -> np.ndarray:
    return values.astype(np.float32).astype(np.float64)


def load(name: str) -> tuple[dict, bytes, dict]:
    path = work_path("raw", f"{name}.glb")
    entry = LUNG["files"][name]
    check(sha256_file(path) == entry["sha256"], f"{name}: hash equals the record")
    check(path.stat().st_size == entry["bytes"], f"{name}: size equals the record")
    document, binary = read_glb(path)
    root = document["nodes"][document["scenes"][0]["nodes"][0]]
    extras = root.get("extras", {})
    check(extras.get("label") == LABEL, f"{name}: labelled {LABEL!r}")
    check(extras.get("attribution") == ATTRIBUTION, f"{name}: carries the attribution")
    check(extras.get("frame") == "LPS millimetres", f"{name}: states its frame")
    check(np.allclose(extras.get("presentationFromLps"), PRESENTATION_FROM_LPS), f"{name}: carries the presentation")
    check(np.allclose(extras.get("gravityLps"), GRAVITY_LPS), f"{name}: carries gravity")
    return document, binary, root


def morph_states(document: dict, binary: bytes, node: dict, primitive: dict) -> list[np.ndarray]:
    """The base and each morph target applied in full, in the node's frame."""
    base = glb_accessor(document, binary, primitive["attributes"]["POSITION"])
    states = [base] + [base + glb_accessor(document, binary, target["POSITION"]) for target in primitive.get("targets", [])]
    scale = np.array(node.get("scale", [1.0, 1.0, 1.0]))
    translation = np.array(node.get("translation", [0.0, 0.0, 0.0]))
    return [state * scale + translation for state in states]


def drawn_space() -> tuple[np.ndarray, np.ndarray]:
    document, binary = read_glb(work_path("raw", "pleural-space.glb"))
    root = document["nodes"][document["scenes"][0]["nodes"][0]]
    vertices, faces = None, []
    for index in root["children"]:
        primitive = document["meshes"][document["nodes"][index]["mesh"]]["primitives"][0]
        if vertices is None:
            vertices = glb_accessor(document, binary, primitive["attributes"]["POSITION"])
        faces.append(glb_accessor(document, binary, primitive["indices"]).astype(np.int64).reshape(-1, 3))
    return vertices, np.concatenate(faces)


def clearance(points: np.ndarray, vertices: np.ndarray, faces: np.ndarray, near_mm: float = 6.0) -> float:
    """The least distance from the points to a surface they are inside. Exact for the points whose
    nearest vertex of the surface is within near_mm; the rest are further than that."""
    from scipy.spatial import cKDTree

    rough = cKDTree(vertices).query(points)[0]
    near = np.flatnonzero(rough < near_mm)
    if len(near) == 0:
        return near_mm
    return float(distance_to_surface(points[near], vertices, faces)[0].min())


def main() -> int:
    space_vertices, space_faces = drawn_space()
    space32 = f32(space_vertices)
    report: dict = {}

    # ── the lung ──
    document, binary, root = load("lung-states")
    extras = root.get("extras", {})
    check(extras.get("statesLabel") == LUNG["statesLabel"] and extras.get("claims") == LUNG["claims"],
          "lung-states: labels its states and names their claims")
    lung_node = document["nodes"][root["children"][0]]
    mesh = document["meshes"][lung_node["mesh"]]
    primitives = mesh["primitives"]
    check([p.get("extras", {}).get("lobe") for p in primitives] == [lobe["id"] for lobe in LUNG["lung"]["lobes"]],
          "lung-states: one primitive per lobe, in the record's order")
    check(len({json.dumps(p["attributes"], sort_keys=True) for p in primitives}) == 1
          and len({json.dumps(p["targets"], sort_keys=True) for p in primitives}) == 1,
          "lung-states: the lobes share one vertex array and one set of targets")
    names = mesh.get("extras", {}).get("targetNames", [])
    check(names == [f"step {k}" for k in range(1, LUNG["collapse"]["steps"] + 1)], "lung-states: eight targets, step 1 to step 8")
    states = morph_states(document, binary, lung_node, primitives[0])
    faces = np.concatenate([glb_accessor(document, binary, p["indices"]).astype(np.int64).reshape(-1, 3) for p in primitives])
    check(len(faces) == LUNG["lung"]["faces"], "lung-states: every face is in a lobe")
    check(len(np.unique(np.sort(faces, axis=1), axis=0)) == len(faces), "lung-states: no face is in two lobes")
    check(edges_shared_twice(faces), "lung-states: closed, every edge shared by two faces")
    port = np.array(LUNG["collapse"]["portPleuraPointLps"])
    floor = LUNG["checks"]["clearanceFloorMm"]

    def lung_checks(label: str, state: np.ndarray) -> dict:
        folded = len(folded_faces(states[0], state, faces))
        crossing = len(crossing_pairs(f32(state), faces))
        through = len(crossing_pairs(f32(state), faces, space_faces, space32))
        inside = winding_numbers(state[:1], space_vertices, space_faces)[0]
        least = clearance(state, space_vertices, space_faces)
        check(folded == 0, f"lung {label}: no folded face ({folded})")
        check(crossing == 0, f"lung {label}: no face passes through another ({crossing})")
        check(through == 0, f"lung {label}: no face passes through the pleura ({through})")
        check(inside > 0.5, f"lung {label}: inside the drawn pleural surface")
        check(least >= floor, f"lung {label}: at least {floor} mm from the pleura ({least:.3f})")
        return {"volumeMl": signed_volume(state, faces) / 1000.0, "clearanceMm": least,
                "gapAtPortMm": float(distance_to_surface(port[None], state, faces)[0][0])}

    rows = []
    for k, state in enumerate(states):
        result = lung_checks(f"step {k}", state)
        record = LUNG["states"][k]
        check(abs(result["volumeMl"] - record["volumeMl"]) < 0.5, f"lung step {k}: volume equals the record")
        check(abs(result["gapAtPortMm"] - record["gapAtPortMm"]) < 0.05, f"lung step {k}: gap at the port equals the record")
        check(result["volumeMl"] > 0, f"lung step {k}: outward")
        rows.append({"step": k, **result})
    for k in range(len(states) - 1):
        for fraction in LUNG["checks"]["blendsCheckedAt"]:
            lung_checks(f"between steps {k} and {k + 1} at {fraction}", (1 - fraction) * states[k] + fraction * states[k + 1])
    report["lung"] = rows
    end = LUNG["collapse"]
    space_ml = signed_volume(space_vertices, space_faces) / 1000.0
    check(abs(space_ml - end["spaceVolumeMl"]) < 0.5, "lung: the drawn pleural space has the volume the record divides by")
    check(abs(end["endVolumeMl"] - end["endLungShareOfSpace"] * end["spaceVolumeMl"]) < 0.5,
          "lung: the end volume is the recorded share of the drawn pleural space")
    check(0.98 * end["endVolumeMl"] < rows[-1]["volumeMl"] <= end["endVolumeMl"] + 0.5,
          f"lung: the last state is the end volume, at most 2 per cent under it ({rows[-1]['volumeMl']:.1f} of {end['endVolumeMl']:.1f} mL)")

    # ── the pleural-space proxy and the zone samples ──
    document, binary, root = load("proxy-pleural-space")
    children = [document["nodes"][i] for i in root["children"]]
    check(children[0]["name"] == "proxy:pleural-space", "proxy-pleural-space: the proxy comes first")
    primitive = document["meshes"][children[0]["mesh"]]["primitives"][0]
    proxy = glb_accessor(document, binary, primitive["attributes"]["POSITION"])
    proxy_faces = glb_accessor(document, binary, primitive["indices"]).astype(np.int64).reshape(-1, 3)
    check(len(proxy_faces) == PROXIES["pleuralSpace"]["faces"], "space proxy: triangles equal the record")
    check(edges_shared_twice(proxy_faces), "space proxy: closed")
    check(signed_volume(proxy, proxy_faces) > 0, "space proxy: outward")
    check(len(crossing_pairs(f32(proxy), proxy_faces)) == 0, "space proxy: no face passes through another")
    check(len(crossing_pairs(f32(proxy), proxy_faces, space_faces, space32)) == 0, "space proxy: does not cross the drawn surface")
    check(winding_numbers(proxy[:1], space_vertices, space_faces)[0] > 0.5, "space proxy: inside the drawn surface")
    gap = min(clearance(proxy, space_vertices, space_faces), clearance(space_vertices, proxy, proxy_faces))
    check(gap >= PROXIES["method"]["marginMm"] - 0.05, f"space proxy: clear of the drawn surface by the margin ({gap:.3f})")
    sample_nodes = children[1:]
    check([node["name"] for node in sample_nodes] == [f"samples:{z}" for z in ZONE_IDS],
          "zone samples: one primitive per zone, in the zone list's order")
    for node, record in zip(sample_nodes, SAMPLES["zones"]):
        primitive = document["meshes"][node["mesh"]]["primitives"][0]
        check(primitive.get("mode") == 0, f"{node['name']}: drawn as points")
        points = glb_accessor(document, binary, primitive["attributes"]["POSITION"])
        check(len(points) == record["points"], f"{node['name']}: as many points as the record")
        winding = winding_numbers(points, proxy, proxy_faces)
        check(bool((winding > 0.5).all()), f"{node['name']}: every point inside the space proxy")
    report["spaceProxy"] = {"faces": int(len(proxy_faces)), "leastSeparationMm": gap}

    # ── the lung proxies ──
    document, binary, root = load("proxy-lung")
    nodes = [document["nodes"][i] for i in root["children"]]
    check([node["name"] for node in nodes] == [f"proxy:lung:step {k}" for k in range(len(states))],
          "lung proxies: one per state, in order")
    proxies = []
    for k, (node, drawn, record) in enumerate(zip(nodes, states, PROXIES["lung"]["states"])):
        primitive = document["meshes"][node["mesh"]]["primitives"][0]
        proxy = glb_accessor(document, binary, primitive["attributes"]["POSITION"])
        proxy_faces = glb_accessor(document, binary, primitive["indices"]).astype(np.int64).reshape(-1, 3)
        proxies.append((proxy, proxy_faces))
        label = f"lung proxy step {k}"
        check(len(proxy_faces) == record["faces"], f"{label}: triangles equal the record")
        check(edges_shared_twice(proxy_faces), f"{label}: closed")
        check(signed_volume(proxy, proxy_faces) > 0, f"{label}: outward")
        check(len(crossing_pairs(f32(proxy), proxy_faces)) == 0, f"{label}: no face through another")
        check(len(crossing_pairs(f32(proxy), proxy_faces, faces, f32(drawn))) == 0, f"{label}: does not cross the drawn lung")
        check(winding_numbers(drawn[:1], proxy, proxy_faces)[0] > 0.5, f"{label}: around the drawn lung")
        least = min(clearance(drawn, proxy, proxy_faces), clearance(proxy, drawn, faces))
        check(least >= PROXIES["method"]["marginMm"] - 0.01, f"{label}: clear of the drawn lung by the margin ({least:.3f})")
    check(len(PROXIES["pleuralSpace"]) > 0 and PROXIES["trianglesInUse"] <= PROXIES["method"]["trianglesBudget"],
          "proxies: within the triangle budget")
    for k in range(len(states) - 1):
        halfway = 0.5 * (states[k] + states[k + 1])
        inside = np.zeros(len(halfway), dtype=bool)
        for proxy, proxy_faces in proxies[k:k + 2]:
            inside |= signed_distance_to_surface(halfway, proxy, proxy_faces) < 0
        check(bool(inside.all()), f"lung between steps {k} and {k + 1}: inside one of the two proxies ({int((~inside).sum())} outside)")
    report["lungProxies"] = [int(len(f)) for _, f in proxies]

    # ── the fluid table ──
    up = -np.array(FLUID["gravityLps"], dtype=float)
    lowest = float((space_vertices @ up).min())
    heights = FLUID["heightsMm"]
    for index in range(0, len(heights), 10):
        height = heights[index]
        space_ml = volume_below(space_vertices, space_faces, up, lowest + height) / 1000.0
        check(abs(space_ml - FLUID["spaceMl"][index]) < 0.05, f"fluid table: the space below {height} mm equals the record")
        for row in FLUID["states"]:
            fluid = space_ml - volume_below(states[row["step"]], faces, up, lowest + height) / 1000.0
            check(abs(fluid - row["fluidMl"][index]) < 0.1, f"fluid table: step {row['step']} at {height} mm equals the record")
    for row in FLUID["states"]:
        values = np.array(row["fluidMl"])
        check(bool((values >= -0.01).all()), f"fluid table: step {row['step']} never negative")
        check(bool((np.diff(values) >= -0.01).all()), f"fluid table: step {row['step']} never falls as the level rises")

    report["failures"] = failures
    out = work_path("validation-lung-states.json")
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(f"{len(failures)} failures. Report: {out}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
