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

# IMPORTANT: x/y/z are the probe-origin (image apex) in the PLUS "Reference"
# frame, which is the STL coordinate frame of the ModelsLowRes surfaces.
# The transducer face must sit a few mm INSIDE the skin. If the apex is left
# in the air outside the skin, the "Air" spatial model (100 dB/cm/MHz) wipes
# out the beam before it reaches tissue and PLUS renders a black fan. The skin
# surface on this dataset is near x~151-167 (it varies with the z level), so
# every preset below is ray-cast to seat the apex ~5 mm inside the local skin.
# The previous presets used x=184.2, which is ~33 mm OUTSIDE the skin (in air)
# and was the reason the simulated ultrasound looked empty.
DEFAULT_POSE = {
    "x": 146.4,
    "y": 130.0,
    "z": -335.7,
    "rx": 0.0,
    "ry": 0.0,
    "rz": 0.0,
    "name": "largest-pocket",
}

# Presets may carry rx/ry/rz (degrees) but the verified views use a non-rotated
# beam. largest-pocket is the verified default: a bright pleural-line/chest-wall
# arc over a large anechoic effusion (see reference-frame-largest-pocket.png).
# NOTE: a clean diaphragm/lung "curtain" view was NOT achieved from these
# low-res surfaces with any fixed pose -- that needs interactive tuning in Slicer.
PRESETS = {
    "largest-pocket": {
        "x": 146.4,
        "y": 130.0,
        "z": -335.7,
        "note": "Pure fluid window: bright chest wall over a large anechoic pocket, no deep landmark.",
    },
    "alternate-interspace": {
        "x": 158.0,
        "y": 130.0,
        "z": -311.7,
        "note": "Seated starting point one interspace cranial; refine contact/tilt in Slicer.",
    },
    "cranial-pocket": {
        "x": 161.6,
        "y": 130.0,
        "z": -299.7,
        "note": "Seated starting point higher on the chest wall; refine in Slicer.",
    },
    "caudal-pocket": {
        "x": 148.9,
        "y": 130.0,
        "z": -359.7,
        "note": "Seated starting point toward the costophrenic recess; refine in Slicer.",
    },
}


def _skin_bounds(pose_file: Path) -> tuple[tuple[float, float, float], tuple[float, float, float]] | None:
    """Best-effort axis-aligned bounds of the skin surface used by PLUS.

    Returns (min_xyz, max_xyz) in the Reference/STL frame, or None if the
    decimated skin STL is not available or cannot be parsed.
    """
    import struct

    skin = pose_file.parent / "ModelsLowRes" / "skin.stl"
    if not skin.exists():
        return None
    try:
        with skin.open("rb") as handle:
            handle.read(80)
            (triangle_count,) = struct.unpack("<I", handle.read(4))
            mn = [float("inf")] * 3
            mx = [float("-inf")] * 3
            for _ in range(triangle_count):
                chunk = handle.read(50)
                if len(chunk) < 50:
                    break
                values = struct.unpack("<12fH", chunk)
                for vertex in range(3):
                    for axis in range(3):
                        coordinate = values[3 + vertex * 3 + axis]
                        mn[axis] = min(mn[axis], coordinate)
                        mx[axis] = max(mx[axis], coordinate)
    except (OSError, struct.error):
        return None
    if mn[0] == float("inf"):
        return None
    return (tuple(mn), tuple(mx))


def _warn_if_apex_in_air(pose: dict[str, float | str], pose_file: Path) -> None:
    """Warn when the probe apex is outside the body, where PLUS renders black.

    The PLUS UsSimulator extinguishes the beam in the high-attenuation "Air"
    model, so an apex left outside the skin produces an empty fan. This catches
    the common failure of nudging the probe off the patient.
    """
    bounds = _skin_bounds(pose_file)
    if bounds is None:
        return
    (min_x, min_y, min_z), (max_x, max_y, max_z) = bounds
    x, y, z = float(pose["x"]), float(pose["y"]), float(pose["z"])
    outside = (
        x < min_x or x > max_x or y < min_y or y > max_y or z < min_z or z > max_z
    )
    if not outside:
        return
    print(
        "\nWARNING: the probe apex is OUTSIDE the body, in the PLUS 'Air' model.\n"
        "         PLUS will render a black/empty fan from this pose because the\n"
        "         beam is fully attenuated before it reaches tissue.\n"
        f"         apex        = (x={x:.1f}, y={y:.1f}, z={z:.1f})\n"
        f"         skin bounds = x[{min_x:.0f}, {max_x:.0f}] "
        f"y[{min_y:.0f}, {max_y:.0f}] z[{min_z:.0f}, {max_z:.0f}]\n"
        "         Seat the apex a few mm inside the skin, e.g.:\n"
        "             python3 set-probe-pose.py --preset largest-pocket"
    )


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
                f"rx={preset.get('rx', 0.0):.1f}, ry={preset.get('ry', 0.0):.1f}, "
                f"rz={preset.get('rz', 0.0):.1f} - {preset['note']}"
            )
        return

    pose = _load_pose(args.pose_file)

    if args.preset:
        preset = PRESETS[args.preset]
        pose = {
            "x": preset["x"],
            "y": preset["y"],
            "z": preset["z"],
            "rx": preset.get("rx", 0.0),
            "ry": preset.get("ry", 0.0),
            "rz": preset.get("rz", 0.0),
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
    _warn_if_apex_in_air(pose, args.pose_file)


if __name__ == "__main__":
    main()
