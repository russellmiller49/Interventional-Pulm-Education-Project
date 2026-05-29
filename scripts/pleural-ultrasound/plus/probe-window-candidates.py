#!/usr/bin/env python3
"""Score simple right-lateral pleural ultrasound probe windows from PLUS STL bounds.

Run with Slicer's Python so VTK is available:

  /Applications/Slicer.app/Contents/bin/PythonSlicer \
    scripts/pleural-ultrasound/plus/probe-window-candidates.py
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import vtk


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MODEL_DIR = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "ModelsLowRes"
MODELS = (
    "skin",
    "rib",
    "right-pleural-effusion",
    "lung",
    "diaphragm",
    "liver",
)


@dataclass(frozen=True)
class Model:
    name: str
    bounds: tuple[float, float, float, float, float, float]
    locator: vtk.vtkOBBTree


def load_model(model_dir: Path, name: str) -> Model:
    path = model_dir / f"{name}.stl"
    reader = vtk.vtkSTLReader()
    reader.SetFileName(str(path))
    reader.Update()

    poly = reader.GetOutput()
    locator = vtk.vtkOBBTree()
    locator.SetDataSet(poly)
    locator.BuildLocator()
    return Model(name=name, bounds=poly.GetBounds(), locator=locator)


def intersections(model: Model, start: tuple[float, float, float], end: tuple[float, float, float]) -> list[float]:
    points = vtk.vtkPoints()
    ids = vtk.vtkIdList()
    model.locator.IntersectWithLine(start, end, points, ids)
    xs = [points.GetPoint(index)[0] for index in range(points.GetNumberOfPoints())]
    return sorted(xs, reverse=True)


def paired_length(xs: list[float]) -> float:
    length = 0.0
    for index in range(0, len(xs) - 1, 2):
        length += abs(xs[index] - xs[index + 1])
    return length


def score_pose(
    models: dict[str, Model],
    x: float,
    y: float,
    z: float,
    medial_x: float,
) -> tuple[float, dict[str, list[float]]]:
    start = (x, y, z)
    end = (medial_x, y, z)
    hits = {name: intersections(model, start, end) for name, model in models.items()}

    fluid = paired_length(hits["right-pleural-effusion"])
    lung = paired_length(hits["lung"])
    rib = paired_length(hits["rib"])
    diaphragm = paired_length(hits["diaphragm"])
    liver = paired_length(hits["liver"])
    skin = paired_length(hits["skin"])

    score = fluid
    score += min(lung, 35.0) * 0.15
    score += min(skin, 20.0) * 0.05
    score -= rib * 1.5
    score -= diaphragm * 2.0
    score -= liver * 2.5

    return score, hits


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--count", type=int, default=12)
    parser.add_argument("--x-margin", type=float, default=10.0)
    parser.add_argument("--medial-x", type=float, default=-220.0)
    parser.add_argument("--y-step", type=float, default=8.0)
    parser.add_argument("--z-step", type=float, default=8.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    models = {name: load_model(args.model_dir, name) for name in MODELS}

    skin_bounds = models["skin"].bounds
    fluid_bounds = models["right-pleural-effusion"].bounds
    probe_x = skin_bounds[1] + args.x_margin

    y_min, y_max = fluid_bounds[2], fluid_bounds[3]
    z_min, z_max = fluid_bounds[4], fluid_bounds[5]

    candidates = []
    y = y_min
    while y <= y_max:
        z = z_min
        while z <= z_max:
            score, hits = score_pose(models, probe_x, y, z, args.medial_x)
            candidates.append((score, probe_x, y, z, hits))
            z += args.z_step
        y += args.y_step

    candidates.sort(key=lambda item: item[0], reverse=True)

    print(f"Model directory: {args.model_dir}")
    print(f"Probe x: {probe_x:.1f} mm, medial ray end x: {args.medial_x:.1f} mm")
    print("Top candidate central-ray windows:")
    for rank, (score, x, y, z, hits) in enumerate(candidates[: args.count], start=1):
        fluid = paired_length(hits["right-pleural-effusion"])
        lung = paired_length(hits["lung"])
        rib = paired_length(hits["rib"])
        diaphragm = paired_length(hits["diaphragm"])
        liver = paired_length(hits["liver"])
        print(
            f"{rank:2d}. x={x:6.1f} y={y:6.1f} z={z:7.1f} "
            f"score={score:6.1f} fluid={fluid:5.1f} lung={lung:5.1f} "
            f"rib={rib:4.1f} diaphragm={diaphragm:4.1f} liver={liver:4.1f}"
        )


if __name__ == "__main__":
    main()
