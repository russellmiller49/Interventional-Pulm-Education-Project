"""Diagnose CT/segmentation versus PLUS STL coordinate alignment in Slicer.

Run with Slicer's Python:

/Applications/Slicer.app/Contents/bin/PythonSlicer \
  /Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-diagnose-stl-alignment.py

Or from Slicer's Python Interactor:

exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-diagnose-stl-alignment.py").read())
"""

from __future__ import annotations

from pathlib import Path

import slicer  # type: ignore
import vtk


REPO_ROOT = Path("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project")
CASE_DIR = REPO_ROOT / "Pleural_effusion_simulation"
CT_PATH = CASE_DIR / "19_CT_HR.nii"
SEGMENTATION_PATH = CASE_DIR / "19_CT_HR segmentation_final.seg.nrrd"
MODEL_DIR = CASE_DIR / "plus" / "Models"
LOW_RES_MODEL_DIR = CASE_DIR / "plus" / "ModelsLowRes"
SEGMENTATION_NODE_NAME = "19_CT_HR segmentation_final"

SURFACE_SEGMENTS = {
    "skin.stl": ["skin"],
    "muscle.stl": ["muscle"],
    "rib.stl": ["bone", "spine"],
    "lung.stl": [
        "upper lobe of left lung",
        "lower lobe of left lung",
        "upper lobe of right lung",
        "middle lobe of right lung",
        "lower lobe of right lung",
    ],
    "right-pleural-effusion.stl": ["right pleural effusion"],
    "diaphragm.stl": ["diaphragm"],
    "liver.stl": ["liver"],
    "spleen.stl": ["spleen"],
}


def normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().replace("_", " ").replace("-", " ").split())


def find_or_load_volume():
    try:
        return slicer.util.getNode("19_CT_HR")
    except slicer.util.MRMLNodeNotFoundException:
        success, node = slicer.util.loadVolume(str(CT_PATH), returnNode=True)
        if not success:
            raise RuntimeError(f"Could not load {CT_PATH}")
        node.SetName("19_CT_HR")
        return node


def find_or_load_segmentation():
    try:
        return slicer.util.getNode(SEGMENTATION_NODE_NAME)
    except slicer.util.MRMLNodeNotFoundException:
        success, node = slicer.util.loadSegmentation(str(SEGMENTATION_PATH), returnNode=True)
        if not success:
            raise RuntimeError(f"Could not load {SEGMENTATION_PATH}")
        node.SetName(SEGMENTATION_NODE_NAME)
        return node


def build_segment_lookup(segmentation_node):
    segmentation = segmentation_node.GetSegmentation()
    lookup = {}
    for index in range(segmentation.GetNumberOfSegments()):
        segment_id = segmentation.GetNthSegmentID(index)
        segment = segmentation.GetSegment(segment_id)
        lookup[normalize_name(segment.GetName())] = segment_id
    return lookup


def segment_polydata(segmentation_node, segment_id):
    representation_name = (
        slicer.vtkSegmentationConverter.GetSegmentationClosedSurfaceRepresentationName()
    )
    segment = segmentation_node.GetSegmentation().GetSegment(segment_id)
    polydata = segment.GetRepresentation(representation_name)
    if polydata is None:
        segmentation_node.CreateClosedSurfaceRepresentation()
        polydata = segment.GetRepresentation(representation_name)
    if polydata is None:
        raise RuntimeError(f"No closed surface for segment {segment.GetName()}")

    copied = vtk.vtkPolyData()
    copied.DeepCopy(polydata)

    parent_transform = segmentation_node.GetParentTransformNode()
    if parent_transform is None:
        return copied

    world_transform = vtk.vtkGeneralTransform()
    slicer.vtkMRMLTransformNode.GetTransformBetweenNodes(parent_transform, None, world_transform)

    transform_filter = vtk.vtkTransformPolyDataFilter()
    transform_filter.SetInputData(copied)
    transform_filter.SetTransform(world_transform)
    transform_filter.Update()

    output = vtk.vtkPolyData()
    output.DeepCopy(transform_filter.GetOutput())
    return output


def merged_segment_polydata(segmentation_node, segment_ids):
    append = vtk.vtkAppendPolyData()
    for segment_id in segment_ids:
        append.AddInputData(segment_polydata(segmentation_node, segment_id))
    append.Update()

    clean = vtk.vtkCleanPolyData()
    clean.SetInputConnection(append.GetOutputPort())
    clean.Update()

    output = vtk.vtkPolyData()
    output.DeepCopy(clean.GetOutput())
    return output


def read_stl(path: Path):
    reader = vtk.vtkSTLReader()
    reader.SetFileName(str(path))
    reader.Update()
    output = vtk.vtkPolyData()
    output.DeepCopy(reader.GetOutput())
    return output


def transformed(polydata, matrix):
    transform = vtk.vtkTransform()
    transform.SetMatrix(matrix)
    transform_filter = vtk.vtkTransformPolyDataFilter()
    transform_filter.SetInputData(polydata)
    transform_filter.SetTransform(transform)
    transform_filter.Update()
    output = vtk.vtkPolyData()
    output.DeepCopy(transform_filter.GetOutput())
    return output


def matrix_from_elements(elements):
    matrix = vtk.vtkMatrix4x4()
    for row in range(4):
        for col in range(4):
            matrix.SetElement(row, col, elements[row][col])
    return matrix


TRANSFORMS = {
    "raw/identity": matrix_from_elements(
        ((1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))
    ),
    "Slicer STL load assumption LPS->RAS": matrix_from_elements(
        ((-1, 0, 0, 0), (0, -1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))
    ),
    "flip X only": matrix_from_elements(
        ((-1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))
    ),
    "flip Y only": matrix_from_elements(
        ((1, 0, 0, 0), (0, -1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))
    ),
}


def center(bounds):
    return (
        (bounds[0] + bounds[1]) / 2,
        (bounds[2] + bounds[3]) / 2,
        (bounds[4] + bounds[5]) / 2,
    )


def center_error(a, b):
    ac = center(a)
    bc = center(b)
    return sum((ac[index] - bc[index]) ** 2 for index in range(3)) ** 0.5


def bounds_text(bounds):
    return (
        f"x[{bounds[0]:7.1f},{bounds[1]:7.1f}] "
        f"y[{bounds[2]:7.1f},{bounds[3]:7.1f}] "
        f"z[{bounds[4]:7.1f},{bounds[5]:7.1f}]"
    )


def main():
    ct = find_or_load_volume()
    segmentation_node = find_or_load_segmentation()
    segmentation_node.CreateClosedSurfaceRepresentation()
    lookup = build_segment_lookup(segmentation_node)

    ct_bounds = [0.0] * 6
    ct.GetRASBounds(ct_bounds)
    print("CT RAS bounds:")
    print(f"  {bounds_text(ct_bounds)}")
    print()

    print("Comparing segmentation closed surfaces with raw exported STL coordinates.")
    print("Small error under raw/identity means PLUS sees the same frame as segmentation.")
    print("Small error under LPS->RAS means Slicer display of raw STL is doing the flip.")
    print()

    summary = []
    for filename, segment_names in SURFACE_SEGMENTS.items():
        segment_ids = []
        missing = []
        for name in segment_names:
            segment_id = lookup.get(normalize_name(name))
            if segment_id is None:
                missing.append(name)
            else:
                segment_ids.append(segment_id)
        if missing or not segment_ids:
            print(f"SKIP {filename}: missing segments {missing}")
            continue

        stl_path = LOW_RES_MODEL_DIR / filename
        if not stl_path.exists():
            stl_path = MODEL_DIR / filename
        if not stl_path.exists():
            print(f"SKIP {filename}: missing STL")
            continue

        seg_poly = merged_segment_polydata(segmentation_node, segment_ids)
        seg_bounds = seg_poly.GetBounds()
        stl_poly = read_stl(stl_path)

        print(filename)
        print(f"  segmentation: {bounds_text(seg_bounds)}")
        errors = {}
        for transform_name, transform_matrix in TRANSFORMS.items():
            candidate = transformed(stl_poly, transform_matrix)
            error = center_error(seg_bounds, candidate.GetBounds())
            errors[transform_name] = error
            print(f"  {transform_name:32s} center error {error:7.2f} mm")
        best_name = min(errors, key=errors.get)
        summary.append((filename, best_name, errors[best_name]))
        print(f"  best: {best_name} ({errors[best_name]:.2f} mm)")
        print()

    print("Summary:")
    for filename, best_name, error in summary:
        print(f"  {filename:28s} {best_name:32s} {error:7.2f} mm")

    raw_wins = sum(1 for _, best_name, _ in summary if best_name == "raw/identity")
    lps_wins = sum(
        1 for _, best_name, _ in summary if best_name == "Slicer STL load assumption LPS->RAS"
    )
    print()
    if raw_wins >= max(1, len(summary) - 1):
        print("Interpretation: raw exported STLs align with the segmentation/CT frame.")
        print("If reloaded STL models look offset in Slicer, that is likely Slicer's")
        print("default STL LPS import assumption, not necessarily the PLUS geometry.")
    elif lps_wins >= max(1, len(summary) - 1):
        print("Interpretation: raw exported STLs look LPS relative to Slicer RAS.")
        print("PLUS is probably reading a mirrored frame unless the probe transform")
        print("is also being mirrored.")
    else:
        print("Interpretation: alignment is mixed. Inspect parent transforms and")
        print("surface export settings before trusting PLUS frame generation.")


main()
