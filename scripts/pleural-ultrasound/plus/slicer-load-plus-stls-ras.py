"""Load PLUS STL surfaces into Slicer without STL LPS/RAS auto-flipping.

Slicer's regular STL reader warns "does not contain coordinate system
information. Using LPS" and flips X/Y into RAS. These PLUS STLs were exported
from Slicer in raw RAS/world coordinates for PLUS, so loading them through the
regular model reader makes them appear mirrored/offset from the CT.

Run from Slicer's Python Interactor:

exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-load-plus-stls-ras.py").read())
"""

from __future__ import annotations

from pathlib import Path

import slicer  # type: ignore
import vtk


REPO_ROOT = Path("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project")
MODEL_DIR = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "ModelsLowRes"

MODEL_COLORS = {
    "skin": (0.74, 0.52, 0.36),
    "muscle": (0.62, 0.18, 0.18),
    "rib": (0.92, 0.90, 0.84),
    "lung": (0.55, 0.38, 0.30),
    "right-pleural-effusion": (0.05, 0.12, 0.9),
    "pleural-fluid": (0.05, 0.12, 0.9),
    "diaphragm": (0.88, 0.20, 0.43),
    "liver": (0.60, 0.28, 0.18),
    "spleen": (0.45, 0.22, 0.35),
}

MODEL_OPACITY = {
    "skin": 0.25,
    "muscle": 0.25,
    "rib": 0.75,
    "lung": 0.30,
    "right-pleural-effusion": 0.65,
    "pleural-fluid": 0.50,
    "diaphragm": 0.70,
    "liver": 0.35,
    "spleen": 0.35,
}


def remove_existing_node(name: str) -> None:
    try:
        node = slicer.util.getNode(name)
    except slicer.util.MRMLNodeNotFoundException:
        return
    slicer.mrmlScene.RemoveNode(node)


def hide_regular_stl_nodes() -> None:
    for node in slicer.util.getNodesByClass("vtkMRMLModelNode"):
        name = node.GetName()
        if name.startswith("PLUS_RAS_"):
            continue
        if name in MODEL_COLORS:
            display = node.GetDisplayNode()
            if display is not None:
                display.SetVisibility(False)


def load_raw_ras_stl(path: Path):
    reader = vtk.vtkSTLReader()
    reader.SetFileName(str(path))
    reader.Update()

    polydata = vtk.vtkPolyData()
    polydata.DeepCopy(reader.GetOutput())

    model_name = f"PLUS_RAS_{path.stem}"
    remove_existing_node(model_name)

    model = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLModelNode", model_name)
    model.SetAndObservePolyData(polydata)

    display = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLModelDisplayNode")
    slicer.mrmlScene.AddNode(display)
    model.SetAndObserveDisplayNodeID(display.GetID())

    color = MODEL_COLORS.get(path.stem, (0.8, 0.8, 0.2))
    opacity = MODEL_OPACITY.get(path.stem, 0.5)
    display.SetColor(color)
    display.SetOpacity(opacity)
    display.SetVisibility(True)
    display.BackfaceCullingOff()

    bounds = [0.0] * 6
    model.GetRASBounds(bounds)
    print(
        f"Loaded {model_name:32s} "
        f"x[{bounds[0]:7.1f},{bounds[1]:7.1f}] "
        f"y[{bounds[2]:7.1f},{bounds[3]:7.1f}] "
        f"z[{bounds[4]:7.1f},{bounds[5]:7.1f}]"
    )
    return model


def main():
    hide_regular_stl_nodes()
    paths = sorted(MODEL_DIR.glob("*.stl"))
    if not paths:
        raise RuntimeError(f"No STL files found in {MODEL_DIR}")

    for path in paths:
        load_raw_ras_stl(path)

    print()
    print("Loaded PLUS_RAS_* models using raw STL coordinates.")
    print("These should line up with 19_CT_HR and 19_CT_HR segmentation_final.")
    print("Regular STL model nodes with the same base names were hidden.")


main()
