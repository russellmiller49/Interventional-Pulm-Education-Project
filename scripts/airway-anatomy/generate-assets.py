#!/usr/bin/env python3
"""Generate browser assets for the synchronized airway anatomy module."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPELINE_SRC = REPO_ROOT / "tools" / "fluoroview-pipeline" / "src"
sys.path.insert(0, str(PIPELINE_SRC))

from fluoroview_pipeline.airway_graph import build_airway_graph  # noqa: E402

SOURCE_DIR = REPO_ROOT / "new_anatomy_module"
OUTPUT_DIR = REPO_ROOT / "public" / "airway-anatomy" / "case-001"
CT_SOURCE_NAME = "target_clean_ct.nrrd"
CT_PREVIEW_NAME = "target_clean_ct_preview_i16.raw"
AIRWAY_GLB_NAME = "airway.glb"
AIRWAY_STL_SOURCE_NAME = "airway_large.stl"
AIRWAY_STL_NAME = "airway_large.stl"
LABEL_SOURCE_NAME = "labels_cleaned_names.xlsx"
STRIDE_XYZ = (2, 2, 3)

Vec3 = tuple[float, float, float]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument(
        "--skip-ct",
        action="store_true",
        help="Regenerate JSON/GLB assets without rewriting the CT preview raw file.",
    )
    args = parser.parse_args()

    source_dir = args.source_dir.resolve()
    output_dir = args.output_dir.resolve()
    centerline_dir = source_dir / "Centerline_data"
    ct_path = source_dir / CT_SOURCE_NAME

    if not ct_path.exists():
        raise FileNotFoundError(f"Expected CT source at {ct_path}")
    airway_stl_path = source_dir / AIRWAY_STL_SOURCE_NAME
    if not airway_stl_path.exists():
        raise FileNotFoundError(f"Expected airway surface source at {airway_stl_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "metadata").mkdir(parents=True, exist_ok=True)
    (output_dir / "ct").mkdir(parents=True, exist_ok=True)

    graph = build_airway_graph(centerline_dir)
    labels = build_centerline_labels(centerline_dir, source_dir / LABEL_SOURCE_NAME, graph)
    ct_asset = build_ct_preview(ct_path, output_dir / "ct" / CT_PREVIEW_NAME, skip=args.skip_ct)

    shutil.copy2(source_dir / "Airway.glb", output_dir / AIRWAY_GLB_NAME)
    shutil.copy2(airway_stl_path, output_dir / AIRWAY_STL_NAME)

    write_json(output_dir / "metadata" / "airway_graph.json", graph)
    write_json(output_dir / "metadata" / "centerline_labels.json", labels)

    manifest = {
        "schema": "airway_anatomy_case/v1",
        "id": "airway-anatomy-case-001",
        "title": "Airway Anatomy Synchronized Bronchoscopy",
        "version": "0.1.0",
        "coordinateSystem": "LPS",
        "units": "mm",
        "safetyLabel": "Educational simulation only - not for diagnosis, treatment, or procedure guidance.",
        "sourcePolicy": (
            "Raw source assets remain in new_anatomy_module. The app loads derived public/module "
            "assets generated from target_clean_ct.nrrd, airway_large.stl, Airway.glb, Slicer centerlines, and labels."
        ),
        "assetBaseUrl": "/airway-anatomy/case-001",
        "assets": {
            "airwayGlb": "/airway-anatomy/case-001/airway.glb",
            "airwayStl": f"/airway-anatomy/case-001/{AIRWAY_STL_NAME}",
            "airwayGraphJson": "/airway-anatomy/case-001/metadata/airway_graph.json",
            "centerlineLabelsJson": "/airway-anatomy/case-001/metadata/centerline_labels.json",
            "ctPreviewRaw": f"/airway-anatomy/case-001/ct/{CT_PREVIEW_NAME}",
        },
        "airwayTransform": {
            "sceneScale": 1,
            "rotationDeg": [0, 0, 0],
            "positionOffsetMm": [0, 0, 0],
            "note": "Airway.glb is preserved as a source-derived asset. The rendered module uses airway_large.stl because the GLB contains an embedded node transform.",
        },
        "airwaySurfaceTransform": {
            "sceneScale": 1,
            "rotationDeg": [0, 0, 0],
            "positionOffsetMm": [0, 0, 0],
            "note": "airway_large.stl is exported in patient LPS millimeters and is already aligned with the CT and centerlines.",
        },
        "ct": ct_asset,
        "interaction": {
            "rootNodeId": graph["rootNodeId"],
            "carinaNodeId": graph["carinaNodeId"],
            "defaultEdgeId": first_child_edge_id(graph),
            "initialDistanceMm": 30,
            "stepMm": 3,
            "lookAheadMm": 12,
            "trailMaxPoints": 180,
        },
    }
    write_json(output_dir / "case_manifest.json", manifest)

    print(
        "\n".join(
            [
                f"Wrote {output_dir.relative_to(REPO_ROOT)}",
                f"  graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges",
                f"  labels: {len(labels['polylines'])} centerline polylines",
                f"  CT preview: {ct_asset['sizeXyz']} from {ct_asset['sourceNrrd']}",
            ]
        )
    )


def first_child_edge_id(graph: dict[str, Any]) -> int:
    root = graph["nodes"][graph["rootNodeId"]]
    children = root.get("childEdgeIds") or []
    return int(children[0] if children else 0)


def build_ct_preview(ct_path: Path, output_path: Path, *, skip: bool) -> dict[str, Any]:
    header, data_offset = read_nrrd_header(ct_path)
    sizes = parse_int_vector(header["sizes"])
    if len(sizes) != 3:
        raise ValueError(f"Expected 3D NRRD sizes, got {sizes}")
    if header.get("type") not in {"short", "int16", "signed short", "signed short int"}:
        raise ValueError(f"Expected int16 CT NRRD, got type {header.get('type')!r}")
    if header.get("encoding", "").lower() != "gzip":
        raise ValueError(f"Expected gzip NRRD encoding, got {header.get('encoding')!r}")

    directions = parse_space_directions(header["space directions"])
    spacing = [vector_length(vector) for vector in directions]
    direction_lps = []
    for vector, step in zip(directions, spacing, strict=True):
        direction_lps.extend([component / step if step else 0 for component in vector])
    origin = parse_tuple(header["space origin"])
    stride = STRIDE_XYZ
    preview_size = [
        math.ceil(sizes[0] / stride[0]),
        math.ceil(sizes[1] / stride[1]),
        math.ceil(sizes[2] / stride[2]),
    ]
    preview_spacing = [spacing[index] * stride[index] for index in range(3)]

    if not skip or not output_path.exists():
        with ct_path.open("rb") as handle:
            handle.seek(data_offset)
            compressed = handle.read()
        raw = gzip.decompress(compressed)
        expected_bytes = sizes[0] * sizes[1] * sizes[2] * np.dtype("<i2").itemsize
        if len(raw) != expected_bytes:
            raise ValueError(f"Unexpected CT payload size: {len(raw)} bytes, expected {expected_bytes}")

        volume_zyx = np.frombuffer(raw, dtype="<i2").reshape((sizes[2], sizes[1], sizes[0]))
        preview = volume_zyx[:: stride[2], :: stride[1], :: stride[0]]
        output_path.write_bytes(preview.astype("<i2", copy=False).tobytes(order="C"))

    return {
        "sourceNrrd": CT_SOURCE_NAME,
        "sourceSha256": sha256(ct_path),
        "previewRaw": f"ct/{CT_PREVIEW_NAME}",
        "previewRawUrl": f"/airway-anatomy/case-001/ct/{CT_PREVIEW_NAME}",
        "format": "int16-raw",
        "sizeXyz": preview_size,
        "originalSizeXyz": sizes,
        "strideXyz": list(stride),
        "spacingXyzMm": preview_spacing,
        "originalSpacingXyzMm": spacing,
        "originLps": origin,
        "directionLps": direction_lps,
        "space": header.get("space", ""),
        "windowPresets": [
            {"id": "lung", "label": "Lung", "low": -1000, "high": -300},
            {"id": "mediastinal", "label": "Mediastinal", "low": -160, "high": 240},
        ],
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_nrrd_header(path: Path) -> tuple[dict[str, str], int]:
    header: dict[str, str] = {}
    with path.open("rb") as handle:
        magic = handle.readline().decode("ascii", errors="replace").strip()
        if not magic.startswith("NRRD"):
            raise ValueError(f"{path} is not an NRRD file")
        while True:
            line = handle.readline()
            if not line:
                raise ValueError(f"{path} ended before the NRRD header terminator")
            if line in {b"\n", b"\r\n"}:
                return header, handle.tell()
            text = line.decode("utf-8", errors="replace").strip()
            if not text or text.startswith("#"):
                continue
            key, _, value = text.partition(":")
            if key and value:
                header[key.strip().lower()] = value.strip()


def build_centerline_labels(
    centerline_dir: Path, labels_xlsx: Path, graph: dict[str, Any]
) -> dict[str, Any]:
    label_rows = read_centerline_label_rows(labels_xlsx)
    polylines = []
    for cell_id, row in sorted(label_rows.items()):
        path = centerline_dir / f"Centerline curve_1 ({cell_id}).mrk.json"
        if not path.exists():
            continue
        points = read_markup_points(path)
        if len(points) < 2:
            continue
        matched_edge_id, matched_distance_mm = match_polyline_to_graph_edge(points, graph["edges"])
        polylines.append(
            {
                "id": f"centerline-{cell_id}",
                "sourceCellId": cell_id,
                "sourceCurve": f"Centerline curve_1 ({cell_id}).mrk",
                "abbreviatedLabel": row["abbreviatedLabel"],
                "fullLabel": row["fullLabel"],
                "pointsLps": points,
                "anchorLps": points[len(points) // 2],
                "matchedEdgeId": matched_edge_id,
                "matchedDistanceMm": round(matched_distance_mm, 3),
            }
        )

    edge_label_candidates: dict[int, list[dict[str, Any]]] = {}
    for polyline in polylines:
        edge_label_candidates.setdefault(int(polyline["matchedEdgeId"]), []).append(polyline)
    edge_labels: dict[int, dict[str, Any]] = {}
    for edge_id, candidates in edge_label_candidates.items():
        candidates.sort(key=lambda item: (float(item["matchedDistanceMm"]), -len(item["pointsLps"])))
        best = candidates[0]
        edge_labels[edge_id] = {
            "abbreviatedLabel": best["abbreviatedLabel"],
            "fullLabel": best["fullLabel"],
            "matchedDistanceMm": best["matchedDistanceMm"],
            "sourceCellIds": sorted(int(item["sourceCellId"]) for item in candidates),
        }

    return {
        "schema": "airway_anatomy_centerline_labels/v1",
        "units": "mm",
        "coordinateSystem": "LPS",
        "source": labels_xlsx.name,
        "edgeLabels": edge_labels,
        "polylines": polylines,
    }


def match_polyline_to_graph_edge(points: list[list[float]], edges: list[dict[str, Any]]) -> tuple[int, float]:
    sample_stride = max(1, len(points) // 16)
    sampled_points = points[::sample_stride]
    if points[-1] not in sampled_points:
        sampled_points.append(points[-1])

    best_edge_id = int(edges[0]["id"])
    best_distance = float("inf")
    for edge in edges:
        edge_points = edge["pointsLps"]
        if len(edge_points) < 2:
            continue
        total = 0.0
        for point in sampled_points:
            total += min(
                point_to_segment_distance(point, edge_points[index - 1], edge_points[index])
                for index in range(1, len(edge_points))
            )
        mean_distance = total / len(sampled_points)
        if mean_distance < best_distance:
            best_distance = mean_distance
            best_edge_id = int(edge["id"])
    return best_edge_id, best_distance


def point_to_segment_distance(point: list[float], start: list[float], end: list[float]) -> float:
    segment = [end[index] - start[index] for index in range(3)]
    offset = [point[index] - start[index] for index in range(3)]
    denominator = sum(component * component for component in segment)
    if denominator <= 1e-12:
        return vector_distance(point, start)
    t = max(0.0, min(1.0, sum(offset[index] * segment[index] for index in range(3)) / denominator))
    closest = [start[index] + segment[index] * t for index in range(3)]
    return vector_distance(point, closest)


def vector_distance(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((a[index] - b[index]) ** 2 for index in range(3)))


def read_centerline_label_rows(path: Path) -> dict[int, dict[str, str]]:
    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive, ns)
        sheet_xml = archive.read("xl/worksheets/sheet1.xml")
    root = ElementTree.fromstring(sheet_xml)
    rows: list[dict[str, str]] = []
    for row in root.findall(".//main:sheetData/main:row", ns):
        values: dict[str, str] = {}
        for cell in row.findall("main:c", ns):
            cell_ref = cell.attrib.get("r", "")
            column = column_name_from_cell_ref(cell_ref)
            if column:
                values[column] = read_cell(cell, shared_strings, ns)
        rows.append(values)

    if not rows:
        return {}

    header = {column: normalize_header(value) for column, value in rows[0].items()}
    centerline_col = find_header_column(header, ("centerline", "curve")) or "A"
    abbreviated_col = find_header_column(header, ("abbreviation",)) or "B"
    full_col = (
        find_header_column(header, ("full", "segment"))
        or find_header_column(header, ("airway", "name"))
        or "C"
    )

    output: dict[int, dict[str, str]] = {}
    for row in rows[1:]:
        cell_id = centerline_cell_id(row.get(centerline_col, ""))
        if cell_id is None:
            continue
        output[cell_id] = {
            "abbreviatedLabel": row.get(abbreviated_col, "").strip(),
            "fullLabel": row.get(full_col, "").strip(),
        }
    return output


def column_name_from_cell_ref(cell_ref: str) -> str:
    match = re.match(r"([A-Z]+)", cell_ref.upper())
    return match.group(1) if match else ""


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def find_header_column(header: dict[str, str], required_terms: tuple[str, ...]) -> str | None:
    normalized_terms = tuple(normalize_header(term) for term in required_terms)
    for column, value in header.items():
        if all(term in value for term in normalized_terms):
            return column
    return None


def centerline_cell_id(value: str) -> int | None:
    parenthesized = re.search(r"\((\d+)\)\s*$", value)
    if parenthesized:
        return int(parenthesized.group(1))
    match = re.search(r"Centerline\s+curve_(\d+)", value, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def read_shared_strings(archive: zipfile.ZipFile, ns: dict[str, str]) -> list[str]:
    try:
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    strings: list[str] = []
    for item in root.findall("main:si", ns):
        parts = [node.text or "" for node in item.findall(".//main:t", ns)]
        strings.append("".join(parts))
    return strings


def read_cell(cell: ElementTree.Element, shared_strings: list[str], ns: dict[str, str]) -> str:
    value_node = cell.find("main:v", ns)
    if value_node is None or value_node.text is None:
        return ""
    value = value_node.text
    if cell.attrib.get("t") == "s":
        return shared_strings[int(value)]
    return value


def read_markup_points(path: Path) -> list[list[float]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    markups = payload.get("markups") or []
    if not markups:
        return []
    coordinate_system = markups[0].get("coordinateSystem")
    points: list[list[float]] = []
    for control_point in markups[0].get("controlPoints") or []:
        position = control_point.get("position")
        if not isinstance(position, list) or len(position) != 3:
            continue
        point = [float(position[0]), float(position[1]), float(position[2])]
        if coordinate_system == "RAS":
            point = [-point[0], -point[1], point[2]]
        points.append(point)
    return points


def parse_int_vector(value: str) -> list[int]:
    return [int(item) for item in value.split()]


def parse_space_directions(value: str) -> list[Vec3]:
    matches = re.findall(r"\(([^)]+)\)", value)
    return [tuple(float(part) for part in match.split(",")) for match in matches]  # type: ignore[return-value]


def parse_tuple(value: str) -> list[float]:
    return [float(part) for part in value.strip("()").split(",")]


def vector_length(vector: Vec3) -> float:
    return math.sqrt(sum(component * component for component in vector))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
