"""Derived airway graph utilities for FluoroView centerline assets."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
import csv
import json
import re
from pathlib import Path
from typing import Any

Vec3 = tuple[float, float, float]

_NETWORK_CURVE_RE = re.compile(r"Network curve(?: \((\d+)\))?\.mrk\.json$")


@dataclass(frozen=True)
class NetworkCurve:
    cell_id: int
    source_curve: str
    points_lps: list[Vec3]
    radius_mm: float | None = None
    length_mm: float | None = None


def load_network_curves(centerline_dir: str | Path) -> list[NetworkCurve]:
    """Load non-empty Slicer network curve markups from a centerline folder."""

    centerline_path = Path(centerline_dir)
    properties = load_network_properties(centerline_path / "Network properties.tsv")
    curves: list[NetworkCurve] = []
    for path in sorted(centerline_path.glob("Network curve*.mrk.json"), key=_network_curve_sort_key):
        match = _NETWORK_CURVE_RE.match(path.name)
        if not match:
            continue
        raw_id = match.group(1)
        if raw_id is None:
            continue
        points = _read_curve_points(path)
        if not points:
            continue
        cell_id = int(raw_id)
        curve_properties = properties.get(cell_id, {})
        curves.append(
            NetworkCurve(
                cell_id=cell_id,
                source_curve=f"Network curve ({cell_id})",
                points_lps=points,
                radius_mm=_optional_float(curve_properties.get("Radius")),
                length_mm=_optional_float(curve_properties.get("Length")),
            )
        )
    return curves


def build_airway_graph(centerline_dir: str | Path) -> dict[str, Any]:
    """Build a routeable graph JSON payload from Slicer network curves."""

    curves = load_network_curves(centerline_dir)
    if not curves:
        raise ValueError("No non-empty Network curve markups were found.")

    node_key_to_id: dict[tuple[int, int, int], int] = {}
    node_positions: list[Vec3] = []

    def node_id_for(point: Vec3) -> int:
        key = tuple(round(component * 100) for component in point)
        existing = node_key_to_id.get(key)
        if existing is not None:
            return existing
        node_id = len(node_positions)
        node_key_to_id[key] = node_id
        node_positions.append(point)
        return node_id

    edges: list[dict[str, Any]] = []
    children_by_node: dict[int, list[int]] = defaultdict(list)
    parents_by_node: dict[int, list[int]] = defaultdict(list)

    for curve in curves:
        start_node = node_id_for(curve.points_lps[0])
        end_node = node_id_for(curve.points_lps[-1])
        edge = {
            "id": curve.cell_id,
            "sourceCurve": curve.source_curve,
            "startNodeId": start_node,
            "endNodeId": end_node,
            "lengthMm": curve.length_mm if curve.length_mm is not None else _polyline_length(curve.points_lps),
            "radiusMm": curve.radius_mm,
            "pointsLps": curve.points_lps,
        }
        edges.append(edge)
        children_by_node[start_node].append(curve.cell_id)
        parents_by_node[end_node].append(curve.cell_id)

    root_node_id = edges[0]["startNodeId"]
    carina_node_id = edges[0]["endNodeId"]
    root_distances, parent_edge_by_node, parent_node_by_node = _compute_root_distances(
        root_node_id,
        node_positions,
        edges,
    )

    nodes = []
    for node_id, point in enumerate(node_positions):
        child_edges = children_by_node.get(node_id, [])
        parent_edges = parents_by_node.get(node_id, [])
        if node_id == root_node_id:
            kind = "root"
        elif node_id == carina_node_id:
            kind = "carina"
        elif not child_edges:
            kind = "terminal"
        elif len(child_edges) > 1:
            kind = "bifurcation"
        else:
            kind = "internal"
        nodes.append(
            {
                "id": node_id,
                "lps": point,
                "kind": kind,
                "degree": len(child_edges) + len(parent_edges),
                "rootDistanceMm": round(root_distances.get(node_id, 0.0), 3),
                "parentNodeId": parent_node_by_node.get(node_id),
                "parentEdgeId": parent_edge_by_node.get(node_id),
                "childEdgeIds": child_edges,
            }
        )

    return {
        "schema": "fluoroview_airway_graph/v1",
        "units": "mm",
        "coordinateSystem": "LPS",
        "source": {
            "networkCurveCount": len(curves),
            "networkPointCount": sum(len(curve.points_lps) for curve in curves),
            "properties": "Network properties.tsv",
            "note": "Derived from local Slicer centerline/network curves; raw source files remain untracked.",
        },
        "rootNodeId": root_node_id,
        "carinaNodeId": carina_node_id,
        "carinaLpsMm": node_positions[carina_node_id],
        "terminalNodeIds": [node["id"] for node in nodes if node["kind"] == "terminal"],
        "nodes": nodes,
        "edges": sorted(edges, key=lambda edge: edge["id"]),
    }


def load_network_properties(path: Path) -> dict[int, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        return {
            int(row["CellId"]): row
            for row in reader
            if row.get("CellId") and row["CellId"].strip().isdigit()
        }


def write_airway_graph(centerline_dir: str | Path, output_path: str | Path) -> dict[str, Any]:
    graph = build_airway_graph(centerline_dir)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(graph, indent=2) + "\n", encoding="utf-8")
    return graph


def _read_curve_points(path: Path) -> list[Vec3]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    markups = payload.get("markups", [])
    if not markups:
        return []
    if markups[0].get("coordinateSystem") != "LPS":
        raise ValueError(f"{path.name} is not in LPS coordinates.")
    points: list[Vec3] = []
    for control_point in markups[0].get("controlPoints", []):
        position = control_point.get("position")
        if not isinstance(position, list) or len(position) != 3:
            continue
        points.append((float(position[0]), float(position[1]), float(position[2])))
    return points


def _compute_root_distances(
    root_node_id: int,
    node_positions: list[Vec3],
    edges: list[dict[str, Any]],
) -> tuple[dict[int, float], dict[int, int], dict[int, int]]:
    outgoing: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for edge in edges:
        outgoing[int(edge["startNodeId"])].append(edge)

    distances = {root_node_id: 0.0}
    parent_edge_by_node: dict[int, int] = {}
    parent_node_by_node: dict[int, int] = {}
    queue = deque([root_node_id])
    while queue:
        node_id = queue.popleft()
        for edge in outgoing.get(node_id, []):
            next_node = int(edge["endNodeId"])
            next_distance = distances[node_id] + float(edge["lengthMm"])
            if next_node in distances and distances[next_node] <= next_distance:
                continue
            distances[next_node] = next_distance
            parent_edge_by_node[next_node] = int(edge["id"])
            parent_node_by_node[next_node] = node_id
            queue.append(next_node)

    for node_id, point in enumerate(node_positions):
        if node_id not in distances:
            distances[node_id] = _polyline_length([node_positions[root_node_id], point])
    return distances, parent_edge_by_node, parent_node_by_node


def _network_curve_sort_key(path: Path) -> int:
    match = _NETWORK_CURVE_RE.match(path.name)
    if not match or match.group(1) is None:
        return 10_000
    return int(match.group(1))


def _optional_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _polyline_length(points: list[Vec3]) -> float:
    total = 0.0
    for index in range(1, len(points)):
        a = points[index - 1]
        b = points[index]
        total += ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5
    return round(total, 3)
