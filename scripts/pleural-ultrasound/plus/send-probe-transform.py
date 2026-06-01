#!/usr/bin/env python3
"""Tiny OpenIGTLink TDATA source for the pleural PLUS simulator.

PlusServer's OpenIGTLinkTracker connects to this process on port 18946 and
receives `Probe` and `Reference` TDATA elements in the `Tracker` frame. PLUS
combines those names with ToolReferenceFrame="Tracker" to create
ProbeToTracker and ReferenceToTracker internally.
"""

from __future__ import annotations

import argparse
import json
import math
import socket
import struct
import time
from collections.abc import Sequence
from pathlib import Path


IGTL_HEADER_VERSION = 1
IGTL_TRANSFORM_SIZE = 48
IGTL_TDATA_ELEMENT_SIZE = 70
IGTL_TDATA_TYPE_6D = 2
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 18946


Matrix3x4 = tuple[
    tuple[float, float, float, float],
    tuple[float, float, float, float],
    tuple[float, float, float, float],
]


def _padded_ascii(value: str, length: int) -> bytes:
    return value.encode("ascii")[:length].ljust(length, b"\0")


def _identity_transform(x_mm: float, y_mm: float, z_mm: float) -> Matrix3x4:
    return (
        (1.0, 0.0, 0.0, x_mm),
        (0.0, 1.0, 0.0, y_mm),
        (0.0, 0.0, 1.0, z_mm),
    )


def _multiply_3x3(
    left: tuple[tuple[float, float, float], ...],
    right: tuple[tuple[float, float, float], ...],
) -> tuple[tuple[float, float, float], ...]:
    return tuple(
        tuple(sum(left[row][index] * right[index][col] for index in range(3)) for col in range(3))
        for row in range(3)
    )


def _rotation_matrix(
    rx_deg: float,
    ry_deg: float,
    rz_deg: float,
) -> tuple[tuple[float, float, float], ...]:
    rx = math.radians(rx_deg)
    ry = math.radians(ry_deg)
    rz = math.radians(rz_deg)

    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)

    rot_x = (
        (1.0, 0.0, 0.0),
        (0.0, cx, -sx),
        (0.0, sx, cx),
    )
    rot_y = (
        (cy, 0.0, sy),
        (0.0, 1.0, 0.0),
        (-sy, 0.0, cy),
    )
    rot_z = (
        (cz, -sz, 0.0),
        (sz, cz, 0.0),
        (0.0, 0.0, 1.0),
    )
    return _multiply_3x3(rot_z, _multiply_3x3(rot_y, rot_x))


def _pose_transform(
    x_mm: float,
    y_mm: float,
    z_mm: float,
    rx_deg: float,
    ry_deg: float,
    rz_deg: float,
) -> Matrix3x4:
    rotation = _rotation_matrix(rx_deg, ry_deg, rz_deg)
    return (
        (rotation[0][0], rotation[0][1], rotation[0][2], x_mm),
        (rotation[1][0], rotation[1][1], rotation[1][2], y_mm),
        (rotation[2][0], rotation[2][1], rotation[2][2], z_mm),
    )


def _read_pose(args: argparse.Namespace) -> tuple[float, float, float, float, float, float]:
    if not args.pose_file:
        return (args.x, args.y, args.z, args.rx, args.ry, args.rz)

    try:
        pose = json.loads(Path(args.pose_file).read_text())
    except (OSError, json.JSONDecodeError):
        return (args.x, args.y, args.z, args.rx, args.ry, args.rz)

    return (
        float(pose.get("x", pose.get("lr", args.x))),
        float(pose.get("y", pose.get("pa", args.y))),
        float(pose.get("z", pose.get("is", args.z))),
        float(pose.get("rx", pose.get("lrRotation", args.rx))),
        float(pose.get("ry", pose.get("paRotation", args.ry))),
        float(pose.get("rz", pose.get("isRotation", args.rz))),
    )


def _pack_transform_body(matrix: Matrix3x4) -> bytes:
    # OpenIGTLink stores TRANSFORM in column-major order for the first 3 rows:
    # R11 R21 R31, R12 R22 R32, R13 R23 R33, TX TY TZ.
    body_values = (
        matrix[0][0],
        matrix[1][0],
        matrix[2][0],
        matrix[0][1],
        matrix[1][1],
        matrix[2][1],
        matrix[0][2],
        matrix[1][2],
        matrix[2][2],
        matrix[0][3],
        matrix[1][3],
        matrix[2][3],
    )
    return struct.pack(">12f", *body_values)


def _pack_transform_message(device_name: str, matrix: Matrix3x4) -> bytes:
    body = _pack_transform_body(matrix)
    header = struct.pack(
        ">H12s20sQQQ",
        IGTL_HEADER_VERSION,
        _padded_ascii("TRANSFORM", 12),
        _padded_ascii(device_name, 20),
        0,
        IGTL_TRANSFORM_SIZE,
        0,
    )
    return header + body


def _pack_tdata_element(name: str, matrix: Matrix3x4) -> bytes:
    return struct.pack(
        ">20sBB12f",
        _padded_ascii(name, 20),
        IGTL_TDATA_TYPE_6D,
        0,
        *struct.unpack(">12f", _pack_transform_body(matrix)),
    )


def _pack_tdata_message(elements: Sequence[tuple[str, Matrix3x4]]) -> bytes:
    body = b"".join(_pack_tdata_element(name, matrix) for name, matrix in elements)
    header = struct.pack(
        ">H12s20sQQQ",
        IGTL_HEADER_VERSION,
        _padded_ascii("TDATA", 12),
        _padded_ascii("Tracker", 20),
        0,
        len(body),
        0,
    )
    return header + body


def _probe_transform(args: argparse.Namespace, frame_index: int) -> Matrix3x4:
    x_mm, y_mm, z_mm, rx_deg, ry_deg, rz_deg = _read_pose(args)

    if not args.sweep:
        return _pose_transform(x_mm, y_mm, z_mm, rx_deg, ry_deg, rz_deg)

    phase = frame_index * args.sweep_step
    x_mm = x_mm + args.sweep_x * math.sin(phase)
    y_mm = y_mm + args.sweep_y * math.sin(phase * 0.7)
    z_mm = z_mm + args.sweep_z * math.cos(phase * 0.5)
    return _pose_transform(x_mm, y_mm, z_mm, rx_deg, ry_deg, rz_deg)


def _send_loop(client: socket.socket, args: argparse.Namespace) -> None:
    frame_index = 0
    interval_sec = 1.0 / max(args.rate, 0.1)

    while True:
        message = _pack_tdata_message(
            (
                ("Probe", _probe_transform(args, frame_index)),
                ("Reference", _identity_transform(0.0, 0.0, 0.0)),
            )
        )
        client.sendall(message)
        frame_index += 1
        time.sleep(interval_sec)


def run_server(args: argparse.Namespace) -> None:
    bind_address = (args.host, args.port)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(bind_address)
        server.listen(1)
        print(f"Listening for PLUS OpenIGTLinkTracker on {args.host}:{args.port}")
        print("Sending Probe and Reference TDATA elements in the Tracker frame")

        while True:
            client, address = server.accept()
            with client:
                client.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                print(f"PLUS connected from {address[0]}:{address[1]}")
                try:
                    _send_loop(client, args)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    print("PLUS disconnected; waiting for the next connection")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send minimal OpenIGTLink TDATA messages to PlusServer."
    )
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--rate", type=float, default=30.0, help="Frames per second.")
    parser.add_argument(
        "--x",
        type=float,
        default=146.4,
        help="Probe x (image apex) in mm, seated ~5 mm inside the lateral skin.",
    )
    parser.add_argument(
        "--y",
        type=float,
        default=130.0,
        help="Probe y position in mm. Default is centered on the right effusion.",
    )
    parser.add_argument(
        "--z",
        type=float,
        default=-335.7,
        help="Probe z position in mm. Default is centered on the right effusion.",
    )
    parser.add_argument("--rx", type=float, default=0.0, help="Rotation about LR/x in degrees.")
    parser.add_argument("--ry", type=float, default=0.0, help="Rotation about PA/y in degrees.")
    parser.add_argument("--rz", type=float, default=0.0, help="Rotation about IS/z in degrees.")
    parser.add_argument(
        "--sweep",
        action="store_true",
        help="Oscillate the probe translation so Slicer shows a live transform.",
    )
    parser.add_argument("--sweep-x", type=float, default=22.0)
    parser.add_argument("--sweep-y", type=float, default=8.0)
    parser.add_argument("--sweep-z", type=float, default=18.0)
    parser.add_argument("--sweep-step", type=float, default=0.08)
    parser.add_argument(
        "--pose-file",
        help="Optional JSON file with x/y/z or lr/pa/is values. Re-read every frame.",
    )
    return parser.parse_args(argv)


def main() -> None:
    run_server(parse_args())


if __name__ == "__main__":
    main()
