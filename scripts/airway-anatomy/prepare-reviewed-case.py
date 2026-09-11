"""Slicer Python/VTK: validate lumen and centerlines, prepare native-HU CT bricks.

The primary checkout is an explicit read-only --source input. All writes go to
--output. Run after cook-surface.py; no Slicer scene or database is changed.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import vtk


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--skip-bricks", action="store_true")
    a = p.parse_args()
    source, out = a.source.resolve(), a.output.resolve()
    if source == out or source in out.parents:
        raise ValueError("Outputs must be outside the source directory")
    mesh_path = source / "airway_large.stl"
    reader = vtk.vtkSTLReader()
    reader.SetFileName(str(mesh_path)); reader.Update()
    mesh = reader.GetOutput()
    topology = {}
    for kind in ["boundary", "nonmanifold"]:
        edges = vtk.vtkFeatureEdges(); edges.SetInputData(mesh)
        edges.FeatureEdgesOff(); edges.ManifoldEdgesOff()
        edges.BoundaryEdgesOff(); edges.NonManifoldEdgesOff()
        if kind == "boundary": edges.BoundaryEdgesOn()
        else: edges.NonManifoldEdgesOn()
        edges.Update(); topology[kind] = edges.GetOutput().GetNumberOfCells()
    conn = vtk.vtkPolyDataConnectivityFilter(); conn.SetInputData(mesh)
    conn.SetExtractionModeToAllRegions(); conn.Update()
    topology["components"] = conn.GetNumberOfExtractedRegions()
    if topology != {"boundary": 0, "nonmanifold": 0, "components": 1}:
        raise ValueError(f"Lumen is not closed and connected: {topology}")
    distance = vtk.vtkImplicitPolyDataDistance(); distance.SetInput(mesh)
    graph_path = out / "metadata/airway_graph.json"
    source_graph = source.parent / "public/airway-anatomy/case-001/metadata/airway_graph.json"
    if not source_graph.exists():
        raise ValueError("Missing original graph in the source checkout")
    graph = json.loads(source_graph.read_text())
    fixes = []
    for edge in graph["edges"]:
        for i, point in enumerate(edge["pointsLps"]):
            closest = [0.0, 0.0, 0.0]
            d = distance.EvaluateFunctionAndGetClosestPoint(point, closest)
            if d > 0:
                direction = np.array(point) - closest
                if np.linalg.norm(direction) < 1e-8:
                    continue
                repaired = (np.array(closest) - direction / np.linalg.norm(direction) * 0.05).tolist()
                if distance.EvaluateFunction(repaired) >= 0:
                    # At a very thin terminal cap the closest-face normal may cross the
                    # opposite wall. Approach along a known interior centerline segment.
                    neighbors = sorted(edge["pointsLps"], key=lambda q: np.linalg.norm(np.array(q)-point))
                    anchor = next((q for q in neighbors if distance.EvaluateFunction(q) < -0.05), None)
                    if anchor is None:
                        raise ValueError(f"No interior anchor for edge {edge['id']}")
                    for t in np.linspace(0.01, 1, 200):
                        repaired = ((1-t)*np.array(point)+t*np.array(anchor)).tolist()
                        if distance.EvaluateFunction(repaired) < -0.02: break
                fixes.append({"edgeId": edge["id"], "pointIndex": i, "outsideMm": d, "from": point, "to": repaired})
                edge["pointsLps"][i] = repaired
        points = np.array(edge["pointsLps"])
        edge["lengthMm"] = round(float(np.linalg.norm(np.diff(points, axis=0), axis=1).sum()), 3)
    nodes = {n["id"]: n for n in graph["nodes"]}
    edges = {e["id"]: e for e in graph["edges"]}
    def walk(node_id, root_distance):
        n = nodes[node_id]; n["rootDistanceMm"] = round(root_distance, 3)
        for edge_id in n["childEdgeIds"]:
            e = edges[edge_id]; nodes[e["endNodeId"]]["lps"] = e["pointsLps"][-1]
            walk(e["endNodeId"], root_distance + e["lengthMm"])
    walk(graph["rootNodeId"], 0)
    write(graph_path, graph)
    manifest_path = out / "case_manifest.json"
    manifest = json.loads(manifest_path.read_text())
    glb = out / "lumen-v2.glb"
    manifest["version"] = "2.0.0"
    manifest["assets"]["reviewedLumenGlb"] = "/airway-anatomy/case-001/lumen-v2.glb"
    manifest["geometryValidation"] = {"schema": "lumen-validation/v1", "closed": True, "sourceSha256": digest(mesh_path), "displaySha256": digest(glb), "coordinateSystem": "LPS", "units": "mm", "topology": topology}
    # These are screen relationships requested by the clinical author, not device specs.
    manifest["orientationLandmarks"] = [
        {"id": "rul", "label": "Right upper lobe", "edgeId": 3, "distanceMm": 10, "targetEdgeId": 13, "screenDirection": "up", "expectation": "RB1 above RB2 and RB3"},
        {"id": "rml", "label": "Right middle lobe", "edgeId": 9, "distanceMm": 6, "targetEdgeId": 19, "oppositeEdgeId": 18, "screenDirection": "left", "expectation": "RB5 left of RB4"},
        {"id": "lul", "label": "Left upper lobe", "edgeId": 496, "distanceMm": 9, "targetEdgeId": 21, "oppositeEdgeId": 20, "screenDirection": "up", "expectation": "Upper division above lingula"},
    ]
    labels = json.loads((out / "metadata/centerline_labels.json").read_text())["edgeLabels"]
    manifest["ostialLandmarks"] = []
    for edge_id in [7, 12, 13, 18, 19, 20, 21]:
        edge = edges[edge_id]
        remain = min(3, edge["lengthMm"] * 0.3)
        for start, end in zip(edge["pointsLps"], edge["pointsLps"][1:]):
            length = float(np.linalg.norm(np.array(end)-start))
            if remain <= length:
                point = (np.array(start)+(np.array(end)-start)*remain/max(length,1e-9)).tolist()
                break
            remain -= length
        info=labels[str(edge_id)]
        manifest["ostialLandmarks"].append({"edgeId":edge_id,"pointLps":point,"label":"Upper division" if edge_id==21 else info["abbreviatedLabel"],"description":"Upper division" if edge_id==21 else info["fullLabel"]})
    if not a.skip_bricks:
        ct_path = source / "target_clean_ct.nrrd"
        with ct_path.open("rb") as f:
            while f.readline().strip(): pass
            volume = np.frombuffer(gzip.decompress(f.read()), dtype="<i2")
        sx, sy, sz = manifest["ct"]["originalSizeXyz"]
        volume = volume.reshape(sz, sy, sx)
        brick_size = 64
        dest = out / "ct/native-v1"; dest.mkdir(parents=True, exist_ok=True)
        total = 0
        for z in range(0, sz, brick_size):
            for y in range(0, sy, brick_size):
                for x in range(0, sx, brick_size):
                    block = volume[z:z+brick_size, y:y+brick_size, x:x+brick_size].copy()
                    data = gzip.compress(block.tobytes(), compresslevel=6, mtime=0)
                    (dest / f"{x//brick_size}-{y//brick_size}-{z//brick_size}.i16.gz").write_bytes(data)
                    total += len(data)
        manifest["ct"]["nativeBricks"] = {"schema": "ct-bricks/v1", "baseUrl": "/airway-anatomy/case-001/ct/native-v1", "brickSize": brick_size, "sizeXyz": [sx, sy, sz], "spacingXyzMm": manifest["ct"]["originalSpacingXyzMm"], "sourceSha256": digest(ct_path), "compressedBytes": total, "format": "int16-le-gzip"}
    write(manifest_path, manifest)
    write(out / "metadata/geometry-review.json", {"sourceMeshSha256": digest(mesh_path), "sourceSegmentationSha256": digest(source / "SEGMENTATION.seg.nrrd"), "topology": topology, "vertices": mesh.GetNumberOfPoints(), "triangles": mesh.GetNumberOfCells(), "centerlineRepairs": fixes, "surfaceDisplacementMm": 0, "note": "Welded indexed export; no anatomical vertices displaced. Outside centerline samples projected inside the original lumen; narrow terminal caps use an interior centerline anchor."})
    print(json.dumps({"topology": topology, "centerlineRepairs": len(fixes), "glbBytes": glb.stat().st_size}))


if __name__ == "__main__":
    main()
