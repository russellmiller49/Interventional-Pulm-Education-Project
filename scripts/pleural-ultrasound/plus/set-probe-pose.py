#!/usr/bin/env python3
"""Update the live probe pose used by the pleural PLUS transform sender."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
DEFAULT_POSE_FILE = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "current-probe-pose.json"

DEFAULT_POSE = {
    "x": 184.2,
    "y": 110.4,
    "z": -382.9,
    "rx": 0.0,
    "ry": 0.0,
    "rz": 0.0,
    "name": "largest-pocket",
}

PRESETS = {
    "largest-pocket": {
        "x": 184.2,
        "y": 110.4,
        "z": -382.9,
        "note": "Top-scored right lateral window through the right effusion.",
    },
    "alternate-interspace": {
        "x": 184.2,
        "y": 126.4,
        "z": -358.9,
        "note": "Nearby interspace for checking rib and pocket sensitivity.",
    },
    "cranial-pocket": {
        "x": 184.2,
        "y": 118.4,
        "z": -334.9,
        "note": "More cranial right effusion sweep point.",
    },
    "caudal-pocket": {
        "x": 184.2,
        "y": 126.4,
        "z": -406.9,
        "note": "More caudal right effusion sweep point.",
    },
}


def _load_pose(path: Path) -> dict[str, float | str]:
    if not path.exists():
        return dict(DEFAULT_POSE)

    try:
        pose = json.loads(path.read_text())
    except json.JSONDecodeError:
        return dict(DEFAULT_POSE)

    return {
        "x": float(pose.get("x", pose.get("lr", DEFAULT_POSE["x"]))),
        "y": float(pose.get("y", pose.get("pa", DEFAULT_POSE["y"]))),
        "z": float(pose.get("z", pose.get("is", DEFAULT_POSE["z"]))),
        "rx": float(pose.get("rx", pose.get("lrRotation", DEFAULT_POSE["rx"]))),
        "ry": float(pose.get("ry", pose.get("paRotation", DEFAULT_POSE["ry"]))),
        "rz": float(pose.get("rz", pose.get("isRotation", DEFAULT_POSE["rz"]))),
        "name": str(pose.get("name", "custom")),
    }


def _write_pose(path: Path, pose: dict[str, float | str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(pose, indent=2, sort_keys=True) + "\n")


def _print_pose(path: Path, pose: dict[str, float | str]) -> None:
    print(f"Wrote {path}")
    print(
        "Current probe pose: "
        f"LR/x={pose['x']:.1f} mm, "
        f"PA/y={pose['y']:.1f} mm, "
        f"IS/z={pose['z']:.1f} mm, "
        f"rx={pose['rx']:.1f} deg, "
        f"ry={pose['ry']:.1f} deg, "
        f"rz={pose['rz']:.1f} deg"
    )
    print("PLUS re-reads this file continuously when run-plus-simulator.sh is active.")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Set or nudge the live ProbeToReference pose used by PLUS."
    )
    parser.add_argument(
        "--pose-file",
        type=Path,
        default=DEFAULT_POSE_FILE,
        help="Pose JSON file read by send-probe-transform.py.",
    )
    parser.add_argument(
        "--preset",
        choices=sorted(PRESETS),
        help="Start from a known candidate pleural window.",
    )
    parser.add_argument("--x", "--lr", dest="x", type=float, help="LR/x position in mm.")
    parser.add_argument("--y", "--pa", dest="y", type=float, help="PA/y position in mm.")
    parser.add_argument("--z", "--is", "--is-mm", dest="z", type=float, help="IS/z position in mm.")
    parser.add_argument("--rx", type=float, help="Rotation about LR/x in degrees.")
    parser.add_argument("--ry", type=float, help="Rotation about PA/y in degrees.")
    parser.add_argument("--rz", type=float, help="Rotation about IS/z in degrees.")
    parser.add_argument(
        "--nudge",
        nargs=2,
        metavar=("AXIS", "MM"),
        action="append",
        help="Move one axis by MM. AXIS can be lr/x, pa/y, or is/z.",
    )
    parser.add_argument(
        "--rotate",
        nargs=2,
        metavar=("AXIS", "DEG"),
        action="append",
        help="Rotate one axis by DEG. AXIS can be lr/x/rx, pa/y/ry, or is/z/rz.",
    )
    parser.add_argument(
        "--list-presets",
        action="store_true",
        help="Print available presets and exit.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)

    if args.list_presets:
        for name, preset in PRESETS.items():
            print(
                f"{name}: LR/x={preset['x']:.1f}, "
                f"PA/y={preset['y']:.1f}, IS/z={preset['z']:.1f}, "
                f"rx=0.0, ry=0.0, rz=0.0 - {preset['note']}"
            )
        return

    pose = _load_pose(args.pose_file)

    if args.preset:
        preset = PRESETS[args.preset]
        pose = {
            "x": preset["x"],
            "y": preset["y"],
            "z": preset["z"],
            "rx": 0.0,
            "ry": 0.0,
            "rz": 0.0,
            "name": args.preset,
        }

    for key in ("x", "y", "z", "rx", "ry", "rz"):
        value = getattr(args, key)
        if value is not None:
            pose[key] = value
            pose["name"] = "custom"

    axis_map = {
        "x": "x",
        "lr": "x",
        "y": "y",
        "pa": "y",
        "z": "z",
        "is": "z",
    }
    for axis, mm_text in args.nudge or []:
        key = axis_map.get(axis.lower())
        if key is None:
            valid_axes = ", ".join(sorted(axis_map))
            raise SystemExit(f"Unknown axis '{axis}'. Use one of: {valid_axes}")
        pose[key] = float(pose[key]) + float(mm_text)
        pose["name"] = "custom"

    rotation_axis_map = {
        "x": "rx",
        "lr": "rx",
        "rx": "rx",
        "y": "ry",
        "pa": "ry",
        "ry": "ry",
        "z": "rz",
        "is": "rz",
        "rz": "rz",
    }
    for axis, deg_text in args.rotate or []:
        key = rotation_axis_map.get(axis.lower())
        if key is None:
            valid_axes = ", ".join(sorted(rotation_axis_map))
            raise SystemExit(f"Unknown rotation axis '{axis}'. Use one of: {valid_axes}")
        pose[key] = float(pose[key]) + float(deg_text)
        pose["name"] = "custom"

    _write_pose(args.pose_file, pose)
    _print_pose(args.pose_file, pose)


if __name__ == "__main__":
    main()
