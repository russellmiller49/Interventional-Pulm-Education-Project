#!/usr/bin/env python3
"""Derive a pleural PLUS probe pose from Slicer markup landmarks."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
DEFAULT_MARKUPS_DIR = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "markups"
DEFAULT_POSE_FILE = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "current-probe-pose.json"


@dataclass(frozen=True)
class Point:
    name: str
    ras: tuple[float, float, float]
    source: Path


def _lps_to_ras(position: Sequence[float]) -> tuple[float, float, float]:
    return (-float(position[0]), -float(position[1]), float(position[2]))


def _read_current_pose(path: Path) -> dict[str, float | str]:
    fallback: dict[str, float | str] = {
        "name": "largest-pocket",
        "x": 146.4,
        "y": 130.0,
        "z": -335.7,
        "rx": 0.0,
        "ry": 0.0,
        "rz": 0.0,
    }
    if not path.exists():
        return fallback

    try:
        pose = json.loads(path.read_text())
    except json.JSONDecodeError:
        return fallback

    for key, value in fallback.items():
        pose.setdefault(key, value)
    return pose


def _load_points(markups_dir: Path) -> dict[str, Point]:
    points: dict[str, Point] = {}
    for path in sorted(markups_dir.glob("*.mrk.json")):
        data = json.loads(path.read_text())
        for markup in data.get("markups", []):
            coordinate_system = markup.get("coordinateSystem", "LPS")
            control_points = markup.get("controlPoints", [])
            for index, control_point in enumerate(control_points):
                position = control_point["position"]
                if coordinate_system == "LPS":
                    ras = _lps_to_ras(position)
                elif coordinate_system == "RAS":
                    ras = tuple(float(value) for value in position)
                else:
                    raise ValueError(f"Unsupported coordinate system {coordinate_system!r} in {path}")

                label = control_point.get("label") or f"point_{index + 1}"
                if len(control_points) == 1:
                    key = path.name.removesuffix(".mrk.json")
                else:
                    key = label
                points[key] = Point(name=key, ras=ras, source=path)
    return points


def _required(points: dict[str, Point], key: str) -> Point:
    try:
        return points[key]
    except KeyError as exc:
        available = ", ".join(sorted(points))
        raise SystemExit(f"Missing markup point {key!r}. Available: {available}") from exc


def _mean(values: Sequence[float]) -> float:
    return sum(values) / max(1, len(values))


def _recommended_pose(
    points: dict[str, Point],
    current_pose: dict[str, float | str],
    skin_offset_mm: float,
    diaphragm_clearance_mm: float,
) -> dict[str, float | str]:
    skin_entry = points.get("estimated_skin_entry_from_stl")
    rib_above = _required(points, "rib_above")
    rib_below = _required(points, "rib_below")

    dome_candidates = []
    for key in ("diaphragm_dome_2", "liver_top_2", "diaphragm_dome", "liver_top"):
        if key in points:
            dome_candidates.append(points[key].ras[2])

    rib_mid_z = _mean([rib_above.ras[2], rib_below.ras[2]])
    if dome_candidates:
        highest_diaphragm_or_liver_z = max(dome_candidates)
        target_z = max(rib_mid_z, highest_diaphragm_or_liver_z + diaphragm_clearance_mm)
    else:
        target_z = rib_mid_z

    if skin_entry is not None:
        target_x = skin_entry.ras[0] + skin_offset_mm
    else:
        target_x = float(current_pose["x"])

    # The user's latest good coronal alignment was at PA/y ~110 mm. Preserve it
    # by default; the rib PA positions are used as context rather than replacing it.
    target_y = float(current_pose["y"])

    return {
        "name": "markups-interspace-safe",
        "x": round(target_x, 3),
        "y": round(target_y, 3),
        "z": round(target_z, 3),
        "rx": float(current_pose.get("rx", 0.0)),
        "ry": float(current_pose.get("ry", 0.0)),
        "rz": float(current_pose.get("rz", 0.0)),
    }


def _write_pose(path: Path, pose: dict[str, float | str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(pose, indent=2, sort_keys=True) + "\n")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--markups-dir", type=Path, default=DEFAULT_MARKUPS_DIR)
    parser.add_argument("--pose-file", type=Path, default=DEFAULT_POSE_FILE)
    parser.add_argument(
        "--skin-offset-mm",
        type=float,
        default=-4.0,
        help="Offset from estimated skin entry along LR/x. Negative moves slightly medial.",
    )
    parser.add_argument(
        "--diaphragm-clearance-mm",
        type=float,
        default=20.0,
        help="Minimum superior clearance above diaphragm/liver landmarks.",
    )
    parser.add_argument("--apply", action="store_true", help="Write the recommended pose file.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    points = _load_points(args.markups_dir)
    current_pose = _read_current_pose(args.pose_file)
    pose = _recommended_pose(
        points,
        current_pose,
        skin_offset_mm=args.skin_offset_mm,
        diaphragm_clearance_mm=args.diaphragm_clearance_mm,
    )

    print(f"Markup directory: {args.markups_dir}")
    for key in sorted(points):
        point = points[key]
        print(
            f"{key:32s} "
            f"RAS=({point.ras[0]:7.1f}, {point.ras[1]:7.1f}, {point.ras[2]:7.1f}) "
            f"from {point.source.name}"
        )

    print("\nRecommended pose:")
    print(
        f"  x/LR={pose['x']}  y/PA={pose['y']}  z/IS={pose['z']}  "
        f"rx={pose['rx']}  ry={pose['ry']}  rz={pose['rz']}"
    )

    if args.apply:
        _write_pose(args.pose_file, pose)
        print(f"\nWrote {args.pose_file}")
    else:
        print("\nDry run only. Add --apply to update current-probe-pose.json.")


if __name__ == "__main__":
    main()
