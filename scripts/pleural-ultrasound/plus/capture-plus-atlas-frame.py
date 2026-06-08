#!/usr/bin/env python3
"""Capture one PLUS OpenIGTLink IMAGE frame for the web pleural atlas.

Run this while `run-plus-simulator.sh` is active and PlusServer is streaming on
port 18944. The script intentionally captures a single cached frame; the web app
should consume reviewed frame atlases, not depend on native PLUS at runtime.
"""

from __future__ import annotations

import argparse
import json
import socket
import struct
from collections.abc import Sequence
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
DEFAULT_POSE_FILE = REPO_ROOT / "Pleural_effusion_simulation" / "plus" / "current-probe-pose.json"
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "public"
    / "module-assets"
    / "v1"
    / "pleural-ultrasound-simulator"
    / "pleural-effusion-001"
    / "frame-atlas"
    / "plus-captured-frame.png"
)

IGTL_HEADER = ">H12s20sQQQ"
IGTL_HEADER_SIZE = struct.calcsize(IGTL_HEADER)
IGTL_IMAGE_BODY_HEADER_BYTES = 72


def _read_exact(sock: socket.socket, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining > 0:
        chunk = sock.recv(remaining)
        if not chunk:
            raise ConnectionError("PLUS closed the OpenIGTLink connection before a frame arrived.")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _message_type(raw: bytes) -> str:
    return raw.split(b"\0", 1)[0].decode("ascii", errors="replace")


def _load_pose(path: Path) -> dict[str, object] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def _capture_image_payload(
    host: str,
    port: int,
    timeout_sec: float,
    skip_images: int,
) -> bytes:
    with socket.create_connection((host, port), timeout=timeout_sec) as sock:
        sock.settimeout(timeout_sec)
        seen_images = 0

        while True:
            header = _read_exact(sock, IGTL_HEADER_SIZE)
            _version, raw_type, _device_name, _timestamp, body_size, _crc = struct.unpack(
                IGTL_HEADER,
                header,
            )
            body = _read_exact(sock, body_size)

            if _message_type(raw_type) != "IMAGE":
                continue

            seen_images += 1
            if seen_images <= skip_images:
                continue

            return body[IGTL_IMAGE_BODY_HEADER_BYTES:]


def _write_png(output: Path, pixels: bytes, width: int, height: int) -> None:
    try:
        from PIL import Image
    except ImportError as error:  # pragma: no cover - environment-specific guidance.
        raise SystemExit(
            "Pillow is required to write PNG files. Install it in the Python environment "
            "used for this script, or capture from a Python that already has PIL."
        ) from error

    expected_bytes = width * height
    if len(pixels) < expected_bytes:
        raise ValueError(
            f"PLUS IMAGE payload is too small for {width}x{height}: "
            f"got {len(pixels)} bytes, expected at least {expected_bytes}."
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    image = Image.frombytes("L", (width, height), pixels[:expected_bytes])
    image.save(output)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture a single PLUS UsSimulator frame for the pleural web atlas.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="PlusServer OpenIGTLink host.")
    parser.add_argument("--port", default=18944, type=int, help="PlusServer OpenIGTLink port.")
    parser.add_argument("--timeout-sec", default=8.0, type=float, help="Socket timeout in seconds.")
    parser.add_argument(
        "--skip-images",
        default=4,
        type=int,
        help="Ignore the first N IMAGE messages so the stream can settle.",
    )
    parser.add_argument(
        "--width",
        default=640,
        type=int,
        help="Expected PLUS output width from the ScanConversion XML.",
    )
    parser.add_argument(
        "--height",
        default=480,
        type=int,
        help="Expected PLUS output height from the ScanConversion XML.",
    )
    parser.add_argument("--output", default=DEFAULT_OUTPUT, type=Path, help="PNG output path.")
    parser.add_argument(
        "--pose-file",
        default=DEFAULT_POSE_FILE,
        type=Path,
        help="Pose JSON read by send-probe-transform.py.",
    )
    parser.add_argument(
        "--atlas-id",
        default=None,
        help="Optional atlas frame id to include in the JSON sidecar.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    pixels = _capture_image_payload(args.host, args.port, args.timeout_sec, args.skip_images)
    _write_png(args.output, pixels, args.width, args.height)

    sidecar = args.output.with_suffix(".json")
    sidecar.write_text(
        json.dumps(
            {
                "atlasId": args.atlas_id,
                "imagePath": str(args.output),
                "width": args.width,
                "height": args.height,
                "source": "plus-offline",
                "pose": _load_pose(args.pose_file),
                "notes": [
                    "Captured from a running PLUS UsSimulator/OpenIGTLink stream.",
                    "Review image quality before adding this frame to case.json.",
                ],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
    )

    print(f"Wrote {args.output}")
    print(f"Wrote {sidecar}")


if __name__ == "__main__":
    main()
