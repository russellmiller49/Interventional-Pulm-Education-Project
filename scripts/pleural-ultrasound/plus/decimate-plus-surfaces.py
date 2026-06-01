#!/usr/bin/env python3
"""Create lightweight STL surfaces for the PLUS ultrasound simulator.

Run with Slicer's Python so VTK is available:

  /Applications/Slicer.app/Contents/bin/PythonSlicer \
    scripts/pleural-ultrasound/plus/decimate-plus-surfaces.py

The original high-resolution Slicer exports are left untouched in Models/.
The decimated files are written to ModelsLowRes/ and are intended for the
real-time PLUS UsSimulator XML.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import vtk


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_INPUT_DIR = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "Models"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "ModelsLowRes"

TARGET_TRIANGLES = {
    "skin.stl": 60_000,
    "muscle.stl": 50_000,
    "rib.stl": 180_000,
    "lung.stl": 90_000,
    "right-pleural-effusion.stl": 60_000,
    "pleural-fluid.stl": 70_000,
    "diaphragm.stl": 55_000,
    "liver.stl": 55_000,
    "spleen.stl": 30_000,
}


def read_stl(path: Path) -> vtk.vtkPolyData:
    reader = vtk.vtkSTLReader()
    reader.SetFileName(str(path))
    reader.Update()

    triangle_filter = vtk.vtkTriangleFilter()
    triangle_filter.SetInputConnection(reader.GetOutputPort())

    clean_filter = vtk.vtkCleanPolyData()
    clean_filter.SetInputConnection(triangle_filter.GetOutputPort())
    clean_filter.Update()

    output = vtk.vtkPolyData()
    output.DeepCopy(clean_filter.GetOutput())
    return output


def decimate(polydata: vtk.vtkPolyData, target_triangles: int) -> vtk.vtkPolyData:
    input_triangles = polydata.GetNumberOfPolys()
    if input_triangles <= target_triangles:
        output = vtk.vtkPolyData()
        output.DeepCopy(polydata)
        return output

    reduction = 1.0 - (target_triangles / max(input_triangles, 1))
    decimator = vtk.vtkQuadricDecimation()
    decimator.SetInputData(polydata)
    decimator.SetTargetReduction(min(max(reduction, 0.0), 0.99))
    if hasattr(decimator, "VolumePreservationOn"):
        decimator.VolumePreservationOn()
    decimator.Update()

    clean_filter = vtk.vtkCleanPolyData()
    clean_filter.SetInputConnection(decimator.GetOutputPort())

    normals = vtk.vtkPolyDataNormals()
    normals.SetInputConnection(clean_filter.GetOutputPort())
    normals.ConsistencyOn()
    normals.SplittingOff()
    normals.Update()

    output = vtk.vtkPolyData()
    output.DeepCopy(normals.GetOutput())
    return output


def write_stl(polydata: vtk.vtkPolyData, path: Path) -> None:
    writer = vtk.vtkSTLWriter()
    writer.SetFileName(str(path))
    writer.SetInputData(polydata)
    writer.SetFileTypeToBinary()
    if writer.Write() != 1:
        raise RuntimeError(f"Could not write STL: {path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Decimate PLUS simulator STL surfaces for interactive frame generation."
    )
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate files that already exist.",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    for filename, target_triangles in TARGET_TRIANGLES.items():
        input_path = args.input_dir / filename
        output_path = args.output_dir / filename
        if not input_path.exists():
            print(f"SKIP {filename}: missing {input_path}")
            continue
        if output_path.exists() and not args.force:
            print(f"KEEP {output_path}")
            continue

        polydata = read_stl(input_path)
        input_count = polydata.GetNumberOfPolys()
        reduced = decimate(polydata, target_triangles)
        output_count = reduced.GetNumberOfPolys()
        write_stl(reduced, output_path)
        print(
            f"WROTE {output_path} "
            f"({input_count:,} -> {output_count:,} triangles)"
        )


if __name__ == "__main__":
    main()
