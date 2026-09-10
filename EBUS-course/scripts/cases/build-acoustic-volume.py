"""Voxelize the active EBUS display geometry using Slicer Python/VTK.

Input is the case's primary GLB (including every node transform). This deliberately
does not substitute the original CT masks for relocated presentation anatomy.
The derived acoustic volume is patient LPS mm; the browser adapter converts once.
"""
import argparse
import base64
import gzip
import hashlib
import json
import re
import struct
from pathlib import Path

import numpy as np
import vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray, vtk_to_numpy


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_glb(path):
    data = path.read_bytes()
    offset = 12
    gltf, buffers = None, []
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            gltf = json.loads(chunk)
        elif kind == 0x004E4942:
            buffers.append(chunk)
        offset += 8 + size
    for b in gltf["buffers"]:
        if b.get("uri"):
            buffers.append(base64.b64decode(b["uri"].split(",", 1)[1]))
    return gltf, buffers, data


def meshes(path):
    g, buffers, raw = load_glb(path)
    def accessor(index):
        a = g["accessors"][index]
        v = g["bufferViews"][a["bufferView"]]
        dtype = {5126: "<f4", 5125: "<u4", 5123: "<u2", 5121: "u1"}[a["componentType"]]
        columns = {"SCALAR": 1, "VEC3": 3}[a["type"]]
        size = np.dtype(dtype).itemsize
        return np.ndarray((a["count"], columns), dtype=dtype, buffer=buffers[v["buffer"]],
                          offset=v.get("byteOffset", 0) + a.get("byteOffset", 0),
                          strides=(v.get("byteStride", columns * size), size)).copy()
    result = []
    def visit(index, parent):
        node = g["nodes"][index]
        if "matrix" in node:
            local = np.array(node["matrix"]).reshape((4, 4), order="F")
        else:
            x, y, z, w = node.get("rotation", [0, 0, 0, 1])
            rotation = np.array([[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                                 [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                                 [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]])
            local = np.eye(4)
            local[:3, :3] = rotation @ np.diag(node.get("scale", [1, 1, 1]))
            local[:3, 3] = node.get("translation", [0, 0, 0])
        world = parent @ local
        if "mesh" in node:
            mesh = g["meshes"][node["mesh"]]
            for primitive in mesh["primitives"]:
                if primitive.get("mode", 4) != 4:
                    continue
                p = accessor(primitive["attributes"]["POSITION"])
                web = (np.c_[p, np.ones(len(p))] @ world.T)[:, :3] * 1000
                lps = web[:, [0, 2, 1]].copy()
                lps[:, 1] *= -1
                indices = accessor(primitive["indices"]).reshape((-1, 3)).astype(np.int64)
                result.append((node.get("name", mesh.get("name", "mesh")), lps, web, indices))
        for child in node.get("children", []):
            visit(child, world)
    for root in g["scenes"][g.get("scene", 0)]["nodes"]:
        visit(root, np.eye(4))
    return result, sha(raw)


def polydata(points, triangles):
    poly = vtk.vtkPolyData()
    vp = vtk.vtkPoints()
    vp.SetData(numpy_to_vtk(np.asarray(points, dtype=np.float64), deep=True))
    poly.SetPoints(vp)
    cells = vtk.vtkCellArray()
    packed = np.c_[np.full(len(triangles), 3), triangles].reshape(-1)
    cells.SetCells(len(triangles), numpy_to_vtkIdTypeArray(packed, deep=True))
    poly.SetPolys(cells)
    clean = vtk.vtkCleanPolyData(); clean.SetInputData(poly); clean.Update()
    return clean.GetOutput()


def key_for(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--case-dir", type=Path, required=True)
    parser.add_argument("--spacing-mm", type=float, default=0.8)
    args = parser.parse_args()
    root = args.case_dir.resolve()
    manifest_path = root / "case_manifest.simplified.web.json"
    manifest = json.loads(manifest_path.read_text())
    model = next(m for m in manifest["assets"]["clean_models"] if m.get("primary"))
    source, geometry_hash = meshes(root / model["asset"])
    spacing = args.spacing_mm
    all_points = np.concatenate([m[1] for m in source])
    origin = np.floor((all_points.min(axis=0)-8)/spacing)*spacing
    size = np.ceil((all_points.max(axis=0)+8-origin)/spacing).astype(int)+1
    if int(np.prod(size)) > 100_000_000:
        raise ValueError(f"Unexpected acoustic volume bounds: {size}")
    volume = np.ones(tuple(size[::-1]), dtype=np.uint8)
    definitions = [
        {"id": 0, "key": "outside", "label": "Outside modeled anatomy", "kind": "air"},
        {"id": 1, "key": "soft_tissue", "label": "Surrounding soft tissue", "kind": "soft"},
        {"id": 2, "key": "airway", "label": "Airway lumen", "kind": "air"},
    ]
    reviews = []
    # Paint the airway last: overlapping presentation meshes must not fill its lumen.
    ordered = sorted(source, key=lambda m: (key_for(m[0]) == "airway", key_for(m[0]).startswith("station")))
    for name, points, web, triangles in ordered:
        key = key_for(name)
        kind = "air" if key == "airway" else "node" if key.startswith("station") else "wall" if key == "esophagus" else "blood"
        label_id = 2 if key == "airway" else len(definitions)
        if key != "airway":
            definitions.append({"id": label_id, "key": key, "label": name, "kind": kind})
        poly = polydata(points, triangles)
        edges = vtk.vtkFeatureEdges(); edges.SetInputData(poly)
        edges.FeatureEdgesOff(); edges.ManifoldEdgesOff(); edges.NonManifoldEdgesOff(); edges.BoundaryEdgesOn(); edges.Update()
        boundaries = edges.GetOutput().GetNumberOfCells()
        if boundaries:
            # Close the ends of exported vessel segments for finite acoustic occupancy.
            # This changes the voxelization only; the displayed mesh is untouched.
            fill = vtk.vtkFillHolesFilter(); fill.SetInputData(poly); fill.SetHoleSize(1000); fill.Update()
            poly = fill.GetOutput()
        stencil = vtk.vtkPolyDataToImageStencil(); stencil.SetInputData(poly)
        stencil.SetOutputOrigin(*origin); stencil.SetOutputSpacing(spacing, spacing, spacing)
        stencil.SetOutputWholeExtent(0, int(size[0])-1, 0, int(size[1])-1, 0, int(size[2])-1); stencil.Update()
        image = vtk.vtkImageStencilToImage(); image.SetInputConnection(stencil.GetOutputPort())
        image.SetInsideValue(1); image.SetOutsideValue(0); image.SetOutputScalarTypeToUnsignedChar(); image.Update()
        occupancy = vtk_to_numpy(image.GetOutput().GetPointData().GetScalars()).reshape(volume.shape).astype(bool)
        volume[occupancy] = label_id
        reviews.append({"key": key, "triangles": len(triangles), "sourceBoundaryEdges": boundaries, "occupiedVoxels": int(occupancy.sum())})
        if key == "airway":
            airway = {"vertices": web.tolist(), "triangles": triangles.tolist(), "coordinate_frame": "web_xyz_mm_from_lps", "source_geometry_sha256": geometry_hash}
            (root / "geometry/active_airway_v2.json").write_text(json.dumps(airway, separators=(",", ":"))+"\n")
    data = gzip.compress(volume.tobytes(), compresslevel=9, mtime=0)
    asset = "geometry/acoustic-v2.u8.gz"
    (root / asset).write_bytes(data)
    metadata = {"schema": "acoustic-volume/v1", "assetVersion": "simplified-v2", "coordinateSystem": "LPS", "units": "mm",
                "sourceGeometrySha256": geometry_hash, "dataSha256": sha(data), "decodedSha256": sha(volume.tobytes()), "format": "uint8-labels-gzip",
                "sizeXyz": size.tolist(), "spacingXyzMm": [spacing]*3, "originLps": origin.tolist(), "labels": definitions,
                "review": reviews, "assumptions": ["Background is a homogeneous soft-tissue approximation, not CT-derived anatomy.",
                "Source boundary loops are capped only for voxelization.", "Where presentation meshes overlap, airway lumen takes precedence."]}
    metadata_path = "geometry/acoustic-v2.json"
    (root / metadata_path).write_text(json.dumps(metadata, indent=2)+"\n")
    manifest["asset_version"] = "simplified-v2"
    manifest["assets"]["airway_mesh"] = "geometry/active_airway_v2.json"
    manifest["assets"]["acoustic_volume"] = {"metadata": metadata_path, "data": asset, "source_geometry_sha256": geometry_hash, "asset_version": "simplified-v2"}
    manifest["physics_snapshots"] = {}
    manifest.setdefault("notes", {})["acoustic_volume"] = "Continuous acoustic sampling uses the primary display model; the legacy CT physics image is retained offline but is not registered to this case version."
    manifest_path.write_text(json.dumps(manifest, indent=2)+"\n")
    print(json.dumps({"sizeXyz": size.tolist(), "compressedBytes": len(data), "labels": len(definitions), "sourceGeometrySha256": geometry_hash}))


if __name__ == "__main__":
    main()
