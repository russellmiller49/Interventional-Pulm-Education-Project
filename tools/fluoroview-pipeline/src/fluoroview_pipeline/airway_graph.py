"""Derived airway graph utilities for FluoroView centerline assets."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
import csv
import json
import math
import re
from pathlib import Path
from typing import Any

Vec3 = tuple[float, float, float]

_CURVE_ID_RE = re.compile(r"\((\d+)\)\.mrk\.json$")
_OLD_NETWORK_CURVE_RE = re.compile(r"Network curve(?: \((\d+)\))?\.mrk\.json$")
SNAP_RADIUS_MM = 2.0


@dataclass(frozen=True)
class NetworkCurve:
    cell_id: int
    source_curve: str
    points_lps: list[Vec3]
    radius_mm: float | None = None
    length_mm: float | None = None


def load_network_curves(centerline_dir: str | Path) -> list[NetworkCurve]:
    """Load Slicer network or centerline curve markups from old and new case layouts."""

    centerline_path = Path(centerline_dir)
    network_dir = centerline_path / "Network_curves"
    curve_dir = network_dir if network_dir.exists() else centerline_path
    properties = load_network_properties(
        _first_existing(
            [
                centerline_path / "Network properties_1.tsv",
                centerline_path / "Network properties.tsv",
                curve_dir / "Network properties.tsv",
            ]
        )
    )

    network_paths = [path for path in curve_dir.glob("*.mrk.json") if "Network curve" in path.name]
    markup_paths = network_paths or [
        path for path in curve_dir.glob("*.mrk.json") if "Centerline curve" in path.name
    ]

    curves: list[NetworkCurve] = []
    for path in sorted(markup_paths, key=_curve_sort_key):
        cell_id = _curve_id_from_path(path)
        if cell_id is None:
            continue
        points = _read_curve_points(path)
        if len(points) < 2:
            continue
        curve_properties = properties.get(cell_id, {})
        curves.append(
            NetworkCurve(
                cell_id=cell_id,
                source_curve=path.stem,
                points_lps=points,
                radius_mm=_optional_float(curve_properties.get("Radius")),
                length_mm=_optional_float(curve_properties.get("Length")),
            )
        )

    if curves:
        return curves

    centerline_curves_dir = centerline_path / "Centerline_curves"
    if not centerline_curves_dir.exists():
        return []
    quantification = load_network_properties(centerline_path / "Centerline quantification_1.tsv")
    for path in sorted(centerline_curves_dir.glob("*.mrk.json"), key=_curve_sort_key):
        cell_id = _curve_id_from_path(path)
        if cell_id is None:
            continue
        points = _read_curve_points(path)
        if len(points) < 2:
            continue
        curve_properties = quantification.get(cell_id, {})
        curves.append(
            NetworkCurve(
                cell_id=cell_id,
                source_curve=path.stem,
                points_lps=points,
                radius_mm=_optional_float(curve_properties.get("Radius")),
                length_mm=_optional_float(curve_properties.get("Length")),
            )
        )
    return curves


def build_airway_graph(centerline_dir: str | Path) -> dict[str, Any]:
    """Build a routeable graph JSON payload from Slicer network curves."""

    centerline_path = Path(centerline_dir)
    curves = load_network_curves(centerline_path)
    if not curves:
        raise ValueError("No non-empty Network/Centerline curve markups were found.")

    node_positions: list[Vec3] = []

    def node_id_for(point: Vec3) -> int:
        for index, existing in enumerate(node_positions):
            if _distance(existing, point) <= SNAP_RADIUS_MM:
                return index
        node_id = len(node_positions)
        node_positions.append(point)
        return node_id

    edges: list[dict[str, Any]] = []
    undirected_edges_by_node: dict[int, list[int]] = defaultdict(list)
    for curve in sorted(curves, key=lambda item: item.cell_id):
        start_node = node_id_for(curve.points_lps[0])
        end_node = node_id_for(curve.points_lps[-1])
        if start_node == end_node:
            continue
        edge = {
            "id": len(edges),
            "sourceCurve": curve.source_curve,
            "sourceCellId": curve.cell_id,
            "startNodeId": start_node,
            "endNodeId": end_node,
            "lengthMm": curve.length_mm
            if curve.length_mm is not None
            else _polyline_length(curve.points_lps),
            "radiusMm": curve.radius_mm,
            "pointsLps": curve.points_lps,
        }
        edges.append(edge)
        undirected_edges_by_node[start_node].append(edge["id"])
        undirected_edges_by_node[end_node].append(edge["id"])

    if not edges:
        raise ValueError("No usable airway graph edges were produced from centerline curves.")

    root_node_id = int(edges[0]["startNodeId"])
    root_distances = {root_node_id: 0.0}
    parent_edge_by_node: dict[int, int] = {}
    parent_node_by_node: dict[int, int] = {}
    child_edges_by_node: dict[int, list[int]] = defaultdict(list)
    queue = deque([root_node_id])

    while queue:
        node_id = queue.popleft()
        for edge_id in undirected_edges_by_node.get(node_id, []):
            edge = edges[edge_id]
            start = int(edge["startNodeId"])
            end = int(edge["endNodeId"])
            next_node = end if start == node_id else start
            if next_node in root_distances:
                continue
            if start != node_id:
                edge["startNodeId"], edge["endNodeId"] = node_id, next_node
                edge["pointsLps"] = list(reversed(edge["pointsLps"]))
            root_distances[next_node] = root_distances[node_id] + float(edge["lengthMm"])
            parent_edge_by_node[next_node] = edge_id
            parent_node_by_node[next_node] = node_id
            child_edges_by_node[node_id].append(edge_id)
            queue.append(next_node)

    reachable_node_ids = set(root_distances)
    reachable_edge_ids = set(parent_edge_by_node.values())
    node_remap = {old_id: new_id for new_id, old_id in enumerate(sorted(reachable_node_ids))}
    edge_remap = {old_id: new_id for new_id, old_id in enumerate(sorted(reachable_edge_ids))}

    remapped_edges: list[dict[str, Any]] = []
    remapped_children: dict[int, list[int]] = defaultdict(list)
    for old_edge_id in sorted(reachable_edge_ids):
        edge = dict(edges[old_edge_id])
        edge["id"] = edge_remap[old_edge_id]
        edge["startNodeId"] = node_remap[int(edge["startNodeId"])]
        edge["endNodeId"] = node_remap[int(edge["endNodeId"])]
        remapped_edges.append(edge)
        remapped_children[edge["startNodeId"]].append(edge["id"])

    root_node_id = node_remap[root_node_id]
    first_edge_end = remapped_edges[0]["endNodeId"] if remapped_edges else root_node_id
    carina_node_id = _first_branch_node(root_node_id, remapped_edges, remapped_children) or first_edge_end

    nodes = []
    for old_node_id in sorted(reachable_node_ids):
        node_id = node_remap[old_node_id]
        child_edges = remapped_children.get(node_id, [])
        parent_node = parent_node_by_node.get(old_node_id)
        parent_edge = parent_edge_by_node.get(old_node_id)
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
                "lps": node_positions[old_node_id],
                "kind": kind,
                "degree": len(child_edges) + (1 if parent_node is not None else 0),
                "rootDistanceMm": round(root_distances.get(old_node_id, 0.0), 3),
                "parentNodeId": node_remap.get(parent_node) if parent_node is not None else None,
                "parentEdgeId": edge_remap.get(parent_edge) if parent_edge is not None else None,
                "childEdgeIds": child_edges,
            }
        )

    terminal_node_ids = [node["id"] for node in nodes if node["kind"] == "terminal"]
    graph = {
        "schema": "fluoroview_airway_graph/v1",
        "units": "mm",
        "coordinateSystem": "LPS",
        "source": {
            "networkCurveCount": len(curves),
            "networkPointCount": sum(len(curve.points_lps) for curve in curves),
            "snapRadiusMm": SNAP_RADIUS_MM,
            "properties": "Network properties_1.tsv",
            "note": "Derived from local Slicer centerline/network curves; raw source files remain untracked.",
        },
        "rootNodeId": root_node_id,
        "carinaNodeId": carina_node_id,
        "carinaLpsMm": nodes[carina_node_id]["lps"],
        "terminalNodeIds": terminal_node_ids,
        "nodes": nodes,
        "edges": sorted(remapped_edges, key=lambda edge: edge["id"]),
    }
    _validate_graph(graph)
    return graph


def load_network_properties(path: Path | None) -> dict[int, dict[str, str]]:
    if path is None or not path.exists():
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


def build_centerline_overlay(graph: dict[str, Any], *, max_edges: int = 250) -> dict[str, Any]:
    return {
        "units": "mm",
        "coordinateSystem": "detector-percent",
        "polylines": [
            {
                "id": f"edge-{edge['id']}",
                "label": edge["sourceCurve"],
                "points": _normalize_overlay_points(edge["pointsLps"]),
            }
            for edge in graph["edges"][:max_edges]
        ],
    }


def build_segment_metadata(graph: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "fluoroview_pipeline.airway_graph",
        "segments": [
            {
                "id": f"edge-{edge['id']}",
                "label": edge["sourceCurve"],
                "groupKey": "trachea" if edge["id"] == 0 else "other",
                "medianRadiusMm": float(edge["radiusMm"]) if edge.get("radiusMm") else 0.0,
            }
            for edge in graph["edges"]
        ],
    }


def _read_curve_points(path: Path) -> list[Vec3]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    markups = payload.get("markups", [])
    if not markups:
        return []
    markup = markups[0]
    coordinate_system = markup.get("coordinateSystem")
    if coordinate_system not in {"LPS", "RAS"}:
        raise ValueError(f"{path.name} has unsupported or missing coordinateSystem {coordinate_system!r}.")
    points: list[Vec3] = []
    for control_point in markup.get("controlPoints", []):
        if control_point.get("positionStatus") not in {None, "defined"}:
            continue
        position = control_point.get("position")
        if not isinstance(position, list) or len(position) != 3:
            continue
        point = (float(position[0]), float(position[1]), float(position[2]))
        points.append(_ras_to_lps(point) if coordinate_system == "RAS" else point)
    return points


def _first_branch_node(
    root_node_id: int,
    edges: list[dict[str, Any]],
    children_by_node: dict[int, list[int]],
) -> int | None:
    by_id = {edge["id"]: edge for edge in edges}
    queue = deque([root_node_id])
    seen = {root_node_id}
    while queue:
        node_id = queue.popleft()
        children = children_by_node.get(node_id, [])
        if node_id != root_node_id and len(children) > 1:
            return node_id
        for edge_id in children:
            next_node = by_id[edge_id]["endNodeId"]
            if next_node not in seen:
                seen.add(next_node)
                queue.append(next_node)
    return None


def _normalize_overlay_points(points: list[Vec3]) -> list[list[float]]:
    if not points:
        return []
    xs = [point[0] for point in points]
    zs = [point[2] for point in points]
    min_x, max_x = min(xs), max(xs)
    min_z, max_z = min(zs), max(zs)
    span = max(max_x - min_x, max_z - min_z, 1.0)
    return [
        [
            round(50 + ((point[0] - (min_x + max_x) / 2) / span) * 70, 3),
            round(50 - ((point[2] - (min_z + max_z) / 2) / span) * 70, 3),
        ]
        for point in points
    ]


def _validate_graph(graph: dict[str, Any]) -> None:
    required = ["rootNodeId", "carinaNodeId", "terminalNodeIds", "nodes", "edges"]
    missing = [key for key in required if key not in graph]
    if missing:
        raise ValueError(f"Airway graph is missing required fields: {', '.join(missing)}")
    if not graph["nodes"] or not graph["edges"] or not graph["terminalNodeIds"]:
        raise ValueError("Airway graph must contain nodes, edges, and terminalNodeIds.")
    root_node = graph["nodes"][graph["rootNodeId"]]
    carina_node = graph["nodes"][graph["carinaNodeId"]]
    if root_node["kind"] != "root":
        raise ValueError("Airway graph rootNodeId does not point to a root node.")
    if carina_node["kind"] != "carina":
        raise ValueError("Airway graph carinaNodeId does not point to a carina node.")


def _first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def _curve_id_from_path(path: Path) -> int | None:
    match = _CURVE_ID_RE.search(path.name)
    if match:
        return int(match.group(1))
    old_match = _OLD_NETWORK_CURVE_RE.match(path.name)
    if old_match and old_match.group(1) is not None:
        return int(old_match.group(1))
    return None


def _curve_sort_key(path: Path) -> int:
    curve_id = _curve_id_from_path(path)
    return curve_id if curve_id is not None else 10_000


def _ras_to_lps(point: Vec3) -> Vec3:
    return (-point[0], -point[1], point[2])


def _optional_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    numeric = float(value)
    if math.isnan(numeric):
        return None
    return numeric


def _distance(a: Vec3, b: Vec3) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def _polyline_length(points: list[Vec3]) -> float:
    total = 0.0
    for index in range(1, len(points)):
        total += _distance(points[index - 1], points[index])
    return round(total, 3)
