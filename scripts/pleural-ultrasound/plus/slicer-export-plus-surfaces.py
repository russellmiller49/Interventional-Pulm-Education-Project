"""
Export pleural simulator surfaces from 3D Slicer for PLUS Toolkit.

How to use:
1. Open 3D Slicer.
2. Load the CT and segmentation, or let the script load the default segmentation
   from Pleural_effusion_simulation.
3. Open View > Python Interactor.
4. Adjust SEGMENTATION_NODE_NAME, SEGMENTATION_PATH, and OUTPUT_DIR below if needed.
5. Run the file with:
   exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-export-plus-surfaces.py").read())

Avoid pasting only part of the script into the interactor; indented config lines
inside OUTPUT_SURFACES will fail if Slicer executes them as standalone input.

This version is tailored to Russell's actual segment names. It merges related
segments, such as lung lobes and bilateral pleural effusions, into the STL
files expected by the PLUS UsSimulator template.
"""

import os
import re

import slicer
import vtk


SEGMENTATION_NODE_NAME = "19_CT_HR segmentation_final"
SEGMENTATION_PATH = "/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/Pleural_effusion_simulation/19_CT_HR segmentation_final.seg.nrrd"
OUTPUT_DIR = "/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/Pleural_effusion_simulation/plus/Models"

LUNG_SEGMENTS = [
    "upper lobe of left lung",
    "lower lobe of left lung",
    "upper lobe of right lung",
    "middle lobe of right lung",
    "lower lobe of right lung",
]

EFFUSION_SEGMENTS = [
    "right pleural effusion",
    "left pleural effusion",
]

OUTPUT_SURFACES = [
    {
        "filename": "skin.stl",
        "segments": ["skin"],
        "required": True,
    },
    {
        "filename": "muscle.stl",
        "segments": ["muscle"],
        "required": True,
    },
    {
        "filename": "rib.stl",
        # This case's rib cage is stored in the "thoracic cavity" segment.
        # The generic "bone" and "spine" segments do not include the ribs
        # needed for PLUS rib shadows.
        "segments": ["thoracic cavity"],
        "required": True,
    },
    {
        "filename": "lung.stl",
        "segments": LUNG_SEGMENTS,
        "required": True,
    },
    {
        "filename": "pleural-fluid.stl",
        "segments": EFFUSION_SEGMENTS,
        "required": True,
    },
    {
        "filename": "right-pleural-effusion.stl",
        "segments": ["right pleural effusion"],
        "required": False,
    },
    {
        "filename": "left-pleural-effusion.stl",
        "segments": ["left pleural effusion"],
        "required": False,
    },
    {
        "filename": "diaphragm.stl",
        "segments": ["diaphragm"],
        "required": True,
    },
    {
        "filename": "liver.stl",
        "segments": ["liver"],
        "required": True,
    },
    {
        "filename": "spleen.stl",
        "segments": ["spleen"],
        "required": True,
    },
    {
        "filename": "heart.stl",
        "segments": ["heart"],
        "required": False,
    },
    {
        "filename": "airway.stl",
        "segments": ["trachea and bronchus"],
        "required": False,
    },
    {
        "filename": "great-vessels.stl",
        "segments": [
            "pulmonary artery",
            "pulmonary vein",
            "aorta",
            "inferior vena cava",
            "superior vena cava",
            "portal vein and splenic vein",
        ],
        "required": False,
    },
    {
        "filename": "upper-abdominal-organs.stl",
        "segments": [
            "stomach",
            "pancreas",
            "gallbladder",
            "left kidney",
            "right kidney",
        ],
        "required": False,
    },
    {
        "filename": "thoracic-cavity.stl",
        "segments": ["thoracic cavity"],
        "required": False,
    },
    {
        "filename": "esophagus.stl",
        "segments": ["esophagus"],
        "required": False,
    },
    {
        "filename": "thyroid.stl",
        "segments": ["thyroid"],
        "required": False,
    },
]


def normalize_name(name):
    return re.sub(r"\s+", " ", name.strip().lower().replace("_", " ").replace("-", " "))


def find_segmentation_node():
    try:
        return slicer.util.getNode(SEGMENTATION_NODE_NAME)
    except slicer.util.MRMLNodeNotFoundException:
        if os.path.exists(SEGMENTATION_PATH):
            success, node = slicer.util.loadSegmentation(SEGMENTATION_PATH, returnNode=True)
            if success:
                node.SetName(SEGMENTATION_NODE_NAME)
                return node

        nodes = slicer.util.getNodesByClass("vtkMRMLSegmentationNode")
        if len(nodes) == 1:
            return nodes[0]
        raise RuntimeError(
            "Could not find segmentation node. Set SEGMENTATION_NODE_NAME to the exact Slicer node name."
        )


def build_segment_lookup(segmentation):
    lookup = {}
    for index in range(segmentation.GetNumberOfSegments()):
        segment_id = segmentation.GetNthSegmentID(index)
        name = segmentation.GetSegment(segment_id).GetName()
        lookup[normalize_name(name)] = segment_id
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
        raise RuntimeError(f"Segment has no closed surface representation: {segment.GetName()}")

    copied = vtk.vtkPolyData()
    copied.DeepCopy(polydata)

    parent_transform = segmentation_node.GetParentTransformNode()
    if parent_transform is None:
        return copied

    world_transform = vtk.vtkGeneralTransform()
    slicer.vtkMRMLTransformNode.GetTransformBetweenNodes(
        parent_transform,
        None,
        world_transform,
    )

    transform_filter = vtk.vtkTransformPolyDataFilter()
    transform_filter.SetInputData(copied)
    transform_filter.SetTransform(world_transform)
    transform_filter.Update()

    transformed = vtk.vtkPolyData()
    transformed.DeepCopy(transform_filter.GetOutput())
    return transformed


def write_merged_surface(segmentation_node, segment_ids, output_path):
    append_filter = vtk.vtkAppendPolyData()
    for segment_id in segment_ids:
        append_filter.AddInputData(segment_polydata(segmentation_node, segment_id))
    append_filter.Update()

    clean_filter = vtk.vtkCleanPolyData()
    clean_filter.SetInputConnection(append_filter.GetOutputPort())

    triangle_filter = vtk.vtkTriangleFilter()
    triangle_filter.SetInputConnection(clean_filter.GetOutputPort())
    triangle_filter.Update()

    writer = vtk.vtkSTLWriter()
    writer.SetFileName(output_path)
    writer.SetInputConnection(triangle_filter.GetOutputPort())
    writer.SetFileTypeToBinary()
    if writer.Write() != 1:
        raise RuntimeError(f"Could not write STL: {output_path}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    segmentation_node = find_segmentation_node()
    segmentation_node.CreateClosedSurfaceRepresentation()
    segmentation = segmentation_node.GetSegmentation()
    segment_lookup = build_segment_lookup(segmentation)

    print(f"Exporting PLUS surfaces from: {segmentation_node.GetName()}")
    print(f"Output directory: {OUTPUT_DIR}")

    missing_required = []
    used_segment_ids = set()

    for surface in OUTPUT_SURFACES:
        matched_segment_ids = []
        missing_names = []

        for requested_name in surface["segments"]:
            segment_id = segment_lookup.get(normalize_name(requested_name))
            if segment_id:
                matched_segment_ids.append(segment_id)
                used_segment_ids.add(segment_id)
            else:
                missing_names.append(requested_name)

        output_path = os.path.join(OUTPUT_DIR, surface["filename"])
        if not matched_segment_ids:
            message = f"SKIP {surface['filename']}: no matching segments"
            if surface["required"]:
                missing_required.append(surface["filename"])
                message = f"REQUIRED MISSING {surface['filename']}: {surface['segments']}"
            print(message)
            continue

        write_merged_surface(segmentation_node, matched_segment_ids, output_path)
        matched_names = [
            segmentation.GetSegment(segment_id).GetName() for segment_id in matched_segment_ids
        ]
        print(f"WROTE {output_path}")
        print(f"  from: {', '.join(matched_names)}")
        if missing_names:
            print(f"  missing optional contributors: {', '.join(missing_names)}")

    unused_names = []
    for index in range(segmentation.GetNumberOfSegments()):
        segment_id = segmentation.GetNthSegmentID(index)
        if segment_id not in used_segment_ids:
            unused_names.append(segmentation.GetSegment(segment_id).GetName())

    if unused_names:
        print("Segments not exported as PLUS surfaces:")
        for name in sorted(unused_names):
            print(f"  - {name}")

    if missing_required:
        raise RuntimeError(
            "Missing required PLUS surfaces: " + ", ".join(sorted(missing_required))
        )

    print("Done. Review the STL files before running PlusServer.")


main()
