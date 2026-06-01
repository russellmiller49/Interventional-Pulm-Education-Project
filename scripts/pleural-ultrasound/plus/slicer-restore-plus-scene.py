"""Restore the pleural PLUS/Slicer working scene after an unsaved Slicer restart.

Run from Slicer's Python Interactor:

exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-restore-plus-scene.py").read())
"""

from __future__ import annotations

from pathlib import Path

import vtk


REPO_ROOT = Path("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project")
CASE_DIR = REPO_ROOT / "Pleural_effusion_simulation"
CT_PATH = CASE_DIR / "19_CT_HR.nii"
SEGMENTATION_PATH = CASE_DIR / "19_CT_HR segmentation_final.seg.nrrd"
CONNECTOR_HOST = "localhost"
CONNECTOR_PORT = 18944
RECOVERED_PROBE_TO_REFERENCE = (184.2, 110.4, -382.9)


def find_node_by_name(name):
    try:
        return slicer.util.getNode(name)  # noqa: F821 - provided by Slicer
    except slicer.util.MRMLNodeNotFoundException:  # noqa: F821 - provided by Slicer
        return None


def load_volume_once(path: Path, name: str):
    node = find_node_by_name(name)
    if node is not None:
        return node

    success, node = slicer.util.loadVolume(str(path), returnNode=True)  # noqa: F821
    if not success:
        raise RuntimeError(f"Could not load CT volume: {path}")
    node.SetName(name)
    return node


def load_segmentation_once(path: Path, name: str):
    node = find_node_by_name(name)
    if node is not None:
        return node

    success, node = slicer.util.loadSegmentation(str(path), returnNode=True)  # noqa: F821
    if not success:
        raise RuntimeError(f"Could not load segmentation: {path}")
    node.SetName(name)
    return node


def set_probe_transform():
    transform = find_node_by_name("ProbeToReference")
    if transform is None:
        transform = slicer.mrmlScene.AddNewNodeByClass(  # noqa: F821
            "vtkMRMLLinearTransformNode",
            "ProbeToReference",
        )

    matrix = vtk.vtkMatrix4x4()
    matrix.Identity()
    matrix.SetElement(0, 3, RECOVERED_PROBE_TO_REFERENCE[0])
    matrix.SetElement(1, 3, RECOVERED_PROBE_TO_REFERENCE[1])
    matrix.SetElement(2, 3, RECOVERED_PROBE_TO_REFERENCE[2])
    transform.SetMatrixTransformToParent(matrix)
    return transform


def create_landmark_node():
    node = find_node_by_name("Pleural coordinate salvage landmarks")
    if node is not None:
        return node

    node = slicer.mrmlScene.AddNewNodeByClass(  # noqa: F821
        "vtkMRMLMarkupsFiducialNode",
        "Pleural coordinate salvage landmarks",
    )
    node.AddControlPointWorld(vtk.vtkVector3d(*RECOVERED_PROBE_TO_REFERENCE), "recovered_probe_origin")
    node.AddControlPointWorld(vtk.vtkVector3d(68.4, 130.0, -335.7), "right_effusion_center_from_stl")
    node.AddControlPointWorld(vtk.vtkVector3d(151.4, 110.4, -382.9), "estimated_skin_entry_from_stl")
    return node


def configure_connector():
    connector = find_node_by_name("PleuralPLUSConnector")
    if connector is None:
        connector = slicer.mrmlScene.AddNewNodeByClass(  # noqa: F821
            "vtkMRMLIGTLConnectorNode",
            "PleuralPLUSConnector",
        )

    connector.SetTypeClient(CONNECTOR_HOST, CONNECTOR_PORT)
    connector.Start()
    return connector


def set_slice_background(volume):
    layout_manager = slicer.app.layoutManager()  # noqa: F821
    for color in ("Red", "Yellow", "Green"):
        widget = layout_manager.sliceWidget(color)
        if widget is None:
            continue
        composite = widget.mrmlSliceCompositeNode()
        composite.SetBackgroundVolumeID(volume.GetID())


def main():
    ct = load_volume_once(CT_PATH, "19_CT_HR")
    segmentation = load_segmentation_once(
        SEGMENTATION_PATH,
        "19_CT_HR segmentation_final",
    )
    probe_transform = set_probe_transform()
    landmarks = create_landmark_node()
    connector = configure_connector()
    set_slice_background(ct)

    print("Pleural PLUS scene restored.")
    print(f"CT: {ct.GetName()}")
    print(f"Segmentation: {segmentation.GetName()}")
    print(
        "ProbeToReference recovered translation: "
        f"{RECOVERED_PROBE_TO_REFERENCE[0]}, "
        f"{RECOVERED_PROBE_TO_REFERENCE[1]}, "
        f"{RECOVERED_PROBE_TO_REFERENCE[2]} mm"
    )
    print(f"Connector: {connector.GetName()} -> {CONNECTOR_HOST}:{CONNECTOR_PORT}")
    print(f"Landmarks: {landmarks.GetName()}")
    print("Next: switch to OpenIGTLinkIF and confirm the connector is Active.")


main()
