#!/usr/bin/env python3
"""Check the device kit's raw models against the device definitions.

    python3 scripts/medical-thoracoscopy/validate_device_kit.py

Reads the uncompressed models that `build_device_kit.py` wrote to the owner's local data. The
compressed models in the repository are checked again in Blender, against these, by
`validate_device_kit_blender.py`.

What is checked, for every model:

- it names the definitions, the measurement record and the generator it was built from, by hash,
  and those are the files in the repository now;
- it carries the label every model must carry, and no manufacturer name or mark anywhere;
- it has no textures, a material on every surface, finite geometry and fewer triangles than the
  budget allows;
- its anchors are all present, and each anchor's node sits where its extras say;
- its published lengths and diameters are those in the definitions, within a modelling tolerance
  of 0.02 mm (the geometry is built to these numbers, so this finds a builder that drifted);
- the dimensional comparisons the course relies on hold: the closed jaws and every tool fit inside
  the channel's measured circle, and the telescope inside the sleeve. A dimensional comparison is
  not a statement of compatibility; the definitions record that separately.

A report is written to the owner's local data. The exit status is 1 if anything failed.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from local_data import local_data_path  # noqa: E402

DEFINITIONS = REPO / "src/features/medical-thoracoscopy/content/data/device-definitions.json"
MEASUREMENTS = REPO / "src/features/medical-thoracoscopy/content/data/reference-measurements.json"
GENERATOR = REPO / "scripts/medical-thoracoscopy/build_device_kit.py"
RAW = ("raw-assets", "medical-thoracoscopy", "devices", "raw")
REPORT = ("raw-assets", "medical-thoracoscopy", "devices", "validation-raw.json")
TOLERANCE = 0.02  # mm, modelling tolerance on a dimension the builder is given
TRIANGLE_BUDGET = 50_000
MARKS = re.compile(r"wolf|eragon|endocam|endolight|panoview|richard", re.IGNORECASE)

ANCHORS = {
    "operative-telescope": ["distalFace", "opticalOrigin", "channelExit", "shaftAxis", "workingLengthEnd",
                            "channelEntry", "eyepiece", "lightPost", "stopcock", "grip"],
    "operative-telescope-cutaway": ["distalFace", "opticalOrigin", "channelExit"],
    "trocar-sleeve-flexible": ["distalEnd", "lumenAxis", "headUnderside", "proximalEnd"],
    "trocar-sleeve-with-valves": ["distalEnd", "lumenAxis", "headUnderside"],
    "trocar-for-flexible-sleeve": ["tip", "handleFace"],
    "trocar-for-sleeve-with-valves": ["tip", "handleFace"],
    "double-spoon-forceps": ["sheathEnd", "jawHinge", "workingElement", "toolTip", "handleFront"],
    "dissection-forceps": ["sheathEnd", "jawHinge", "workingElement", "toolTip", "handleFront"],
    "hook-electrode": ["insulationEnd", "toolTip", "handleFront"],
    "button-electrode": ["insulationEnd", "toolTip", "handleFront"],
    "probe": ["toolTip", "handleFront"],
    "suction-tube": ["toolTip", "stopcock"],
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Glb:
    """A GLB read without a library: its JSON, its binary chunk, and node world matrices."""

    def __init__(self, path: Path):
        data = path.read_bytes()
        magic, _version, _length = struct.unpack_from("<III", data, 0)
        if magic != 0x46546C67:
            raise ValueError(f"{path.name} is not a GLB")
        json_length, _ = struct.unpack_from("<II", data, 12)
        self.json = json.loads(data[20:20 + json_length])
        self.json_text = data[20:20 + json_length].decode("utf-8")
        offset = 20 + json_length
        bin_length, _ = struct.unpack_from("<II", data, offset)
        self.bin = data[offset + 8:offset + 8 + bin_length]
        self.bytes = len(data)
        self.world = {}
        for scene in self.json.get("scenes", []):
            for index in scene.get("nodes", []):
                self._walk(index, np.eye(4))

    def _walk(self, index: int, parent: np.ndarray) -> None:
        node = self.json["nodes"][index]
        self.world[index] = parent @ local_matrix(node)
        for child in node.get("children", []):
            self._walk(child, self.world[index])

    def accessor(self, index: int) -> np.ndarray:
        accessor = self.json["accessors"][index]
        view = self.json["bufferViews"][accessor["bufferView"]]
        dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[accessor["componentType"]]
        width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        count = accessor["count"]
        stride = view.get("byteStride")
        itemsize = np.dtype(dtype).itemsize * width
        if stride and stride != itemsize:
            raw = np.frombuffer(self.bin, dtype=np.uint8, count=stride * count, offset=start)
            rows = raw.reshape(count, stride)[:, :itemsize].copy()
            return np.frombuffer(rows.tobytes(), dtype=dtype).reshape(count, width)
        return np.frombuffer(self.bin, dtype=dtype, count=count * width, offset=start).reshape(count, width)

    def nodes_named(self, name: str) -> list[int]:
        return [i for i, node in enumerate(self.json["nodes"]) if node.get("name") == name]

    def mesh_vertices(self, node_name: str, material: str | None = None) -> np.ndarray:
        """World positions of a node's mesh, optionally only of faces using one material."""
        out = []
        for index in self.nodes_named(node_name):
            node = self.json["nodes"][index]
            if "mesh" not in node:
                continue
            for primitive in self.json["meshes"][node["mesh"]]["primitives"]:
                if material is not None:
                    if self.json["materials"][primitive["material"]]["name"] != material:
                        continue
                positions = self.accessor(primitive["attributes"]["POSITION"]).astype(np.float64)
                homogeneous = np.c_[positions, np.ones(len(positions))]
                out.append((self.world[index] @ homogeneous.T).T[:, :3])
        return np.concatenate(out) if out else np.zeros((0, 3))

    def triangles(self) -> int:
        count = 0
        for mesh in self.json.get("meshes", []):
            for primitive in mesh["primitives"]:
                if "indices" in primitive:
                    count += self.json["accessors"][primitive["indices"]]["count"] // 3
                else:
                    count += self.json["accessors"][primitive["attributes"]["POSITION"]]["count"] // 3
        return count


def local_matrix(node: dict) -> np.ndarray:
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.array(node.get("translation", [0.0, 0.0, 0.0]))
    x, y, z, w = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    r = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    s = np.diag(node.get("scale", [1.0, 1.0, 1.0]))
    m = np.eye(4)
    m[:3, :3] = r @ s
    m[:3, 3] = t
    return m


def main() -> int:
    definitions = json.loads(DEFINITIONS.read_text())
    devices = {device["id"]: device for device in definitions["devices"]}

    def fact(device: str, key: str) -> float:
        for entry in devices[device]["facts"]:
            if entry["key"] == key:
                return float(entry["value"])
        raise KeyError(f"{device}.{key}")

    expected_hashes = {
        "definitionsSha256": sha256(DEFINITIONS),
        "measurementsSha256": sha256(MEASUREMENTS),
        "generatorSha256": sha256(GENERATOR),
    }
    raw = local_data_path(*RAW)
    failures: list[dict] = []
    summaries: list[dict] = []
    models: dict[str, Glb] = {}

    def check(name: str, what: str, ok: bool, detail) -> None:
        if not ok:
            failures.append({"model": name, "check": what, "detail": detail})

    for name, anchors in ANCHORS.items():
        path = raw / f"{name}.glb"
        if not path.exists():
            failures.append({"model": name, "check": "exists", "detail": str(path)})
            continue
        glb = Glb(path)
        models[name] = glb
        roots = glb.nodes_named(f"device:{name}")
        check(name, "one root node", len(roots) == 1, len(roots))
        extras = glb.json["nodes"][roots[0]].get("extras", {}) if roots else {}
        for key, value in expected_hashes.items():
            check(name, key, extras.get(key) == value, {"model": extras.get(key), "now": value})
        check(name, "label", extras.get("label") == definitions["labelUntilCad"], extras.get("label"))
        check(name, "units", extras.get("units") == "mm", extras.get("units"))
        check(name, "no manufacturer name or mark", not MARKS.search(glb.json_text),
              MARKS.findall(glb.json_text)[:5])
        check(name, "no textures", not glb.json.get("images") and not glb.json.get("textures"), "textures present")
        for mesh in glb.json.get("meshes", []):
            for primitive in mesh["primitives"]:
                check(name, f"material on {mesh['name']}", "material" in primitive, mesh["name"])
        vertices = [glb.mesh_vertices(glb.json["nodes"][i]["name"]) for i in glb.world if "mesh" in glb.json["nodes"][i]]
        everything = np.concatenate(vertices)
        check(name, "finite geometry", bool(np.isfinite(everything).all()), "non-finite vertex")
        triangles = glb.triangles()
        check(name, "triangle budget", triangles <= TRIANGLE_BUDGET, triangles)
        found = {}
        for anchor in anchors:
            nodes = glb.nodes_named(f"anchor:{anchor}")
            check(name, f"anchor {anchor}", len(nodes) == 1, len(nodes))
            if len(nodes) != 1:
                continue
            node = glb.json["nodes"][nodes[0]]
            position = np.array(node["extras"]["position"])
            direction = np.array(node["extras"]["direction"])
            at = glb.world[nodes[0]][:3, 3]
            along = glb.world[nodes[0]][:3, 2]
            check(name, f"anchor {anchor} placed as its extras say", float(np.abs(at - position).max()) < 1e-3,
                  {"node": at.round(4).tolist(), "extras": position.tolist()})
            check(name, f"anchor {anchor} direction", abs(np.linalg.norm(direction) - 1) < 1e-4
                  and float(np.abs(along / np.linalg.norm(along) - direction).max()) < 1e-3,
                  {"node": along.round(4).tolist(), "extras": direction.tolist()})
            found[anchor] = position
        low, high = everything.min(axis=0), everything.max(axis=0)
        summaries.append({"model": name, "bytes": glb.bytes, "triangles": triangles,
                          "bounds": [low.round(3).tolist(), high.round(3).tolist()],
                          "anchors": {key: value.round(4).tolist() for key, value in found.items()}})
        models[name].anchors = found

    def radial(points: np.ndarray, centre=(0.0, 0.0)) -> np.ndarray:
        return np.hypot(points[:, 0] - centre[0], points[:, 1] - centre[1])

    def near(name: str, what: str, got: float, want: float, tolerance: float = TOLERANCE) -> None:
        check(name, what, abs(got - want) <= tolerance, {"model": round(got, 4), "definitions": want,
                                                          "tolerance": tolerance})

    # Telescope
    T = "operative-telescope"
    if T in models:
        glb = models[T]
        shaft = glb.mesh_vertices("shaft")
        along = shaft[shaft[:, 2] < fact(T, "shaftLength")]
        near(T, "shaft diameter", 2 * radial(along).max(), fact(T, "shaftOuterDiameter"))
        body = glb.mesh_vertices("body")
        near(T, "body begins at the working length", body[:, 2].min(), fact(T, "shaftLength"), 0.5)
        near(T, "working length ends", glb.anchors["workingLengthEnd"][2], fact(T, "shaftLength"))
        near(T, "total length, tip to the eyepiece end along the shaft", glb.anchors["eyepiece"][2],
             fact(T, "totalLength"), 1.5)
        near(T, "optic above the centre", glb.anchors["opticalOrigin"][1], fact(T, "opticOffsetOnTip"))
        near(T, "channel exit below the centre", -glb.anchors["channelExit"][1], fact(T, "channelExitOnTip"))
        near(T, "channel length", glb.anchors["channelEntry"][2] - glb.anchors["channelExit"][2],
             fact(T, "channelLength"))
        # The channel's wall is the only dark-metal surface of the distal face.
        wall = glb.mesh_vertices("distalFace", "mt-black")
        channel_centre = (0.0, glb.anchors["channelExit"][1])
        inscribed = 2 * radial(wall, channel_centre).min()
        check(T, "channel admits the published channel diameter", inscribed >= fact(T, "workingChannelDiameter") - TOLERANCE,
              {"model": round(inscribed, 4), "published": fact(T, "workingChannelDiameter")})
        near(T, "channel's largest circle, as measured", inscribed, fact(T, "channelInscribedDiameter"), 0.05)
        summaries.append({"model": T, "channelInscribedDiameter": round(inscribed, 4)})

    # Sleeves and trocars
    S = "trocar-sleeve-flexible"
    if S in models:
        glb = models[S]
        tube = glb.mesh_vertices("sleeveTube")
        near(S, "lumen diameter (capacity)", 2 * radial(tube).min(), fact(S, "capacity"))
        near(S, "outer diameter over the thread", 2 * radial(tube[tube[:, 2] < fact(S, "workingLength") - 3]).max(),
             fact(S, "outerDiameter"), 0.05)
        near(S, "working length", glb.anchors["headUnderside"][2], fact(S, "workingLength"))
        head = glb.mesh_vertices("sleeveHead")
        near(S, "head diameter", 2 * radial(head).max(), fact(S, "headDiameter"))
        near(S, "head and cap length", glb.anchors["proximalEnd"][2] - fact(S, "workingLength"),
             fact(S, "headLength") + fact(S, "capLength"))
    V = "trocar-sleeve-with-valves"
    if V in models:
        glb = models[V]
        near(V, "lumen diameter (capacity)", 2 * radial(glb.mesh_vertices("sleeveTube")).min(), fact(V, "capacity"))
        near(V, "working length", glb.anchors["headUnderside"][2], fact(V, "workingLength"))
    for trocar in ("trocar-for-flexible-sleeve", "trocar-for-sleeve-with-valves"):
        if trocar in models:
            glb = models[trocar]
            near(trocar, "rod diameter (size)", 2 * radial(glb.mesh_vertices("trocarRod")).max(), fact(trocar, "size"))
            near(trocar, "working length", glb.anchors["handleFace"][2], fact(trocar, "workingLength"))

    # Tools
    channel_limit = None
    if T in models:
        channel_limit = inscribed / 2
    for tool in ("double-spoon-forceps", "dissection-forceps"):
        if tool not in models:
            continue
        glb = models[tool]
        sheath = glb.mesh_vertices("sheath")
        near(tool, "sheath diameter", 2 * radial(sheath).max(), fact(tool, "shaftOuterDiameter"))
        near(tool, "sheath length", glb.anchors["handleFront"][2], fact(tool, "sheathLength"))
        near(tool, "jaw length, hinge to tip", glb.anchors["jawHinge"][2] - glb.anchors["toolTip"][2],
             fact(tool, "jawLength"))
        jaws = np.concatenate([glb.mesh_vertices("jaw.upper"), glb.mesh_vertices("jaw.lower")])
        if channel_limit is not None:
            check(tool, "closed jaws fit the channel's measured circle", radial(jaws).max() <= channel_limit,
                  {"jaws": round(float(radial(jaws).max()), 4), "channel": round(channel_limit, 4)})
            check(tool, "sheath fits the channel's measured circle", radial(sheath).max() <= channel_limit + TOLERANCE,
                  {"sheath": round(float(radial(sheath).max()), 4), "channel": round(channel_limit, 4)})
        hinge = glb.anchors["jawHinge"]
        for jaw in ("jaw.upper", "jaw.lower"):
            index = glb.nodes_named(jaw)[0]
            check(tool, f"{jaw} turns about the hinge", float(np.abs(glb.world[index][:3, 3] - hinge).max()) < 1e-3,
                  glb.world[index][:3, 3].round(4).tolist())
    for tool, shaft_node in (("hook-electrode", "insulatedShaft"), ("button-electrode", "insulatedShaft"),
                             ("probe", "probeRod"), ("suction-tube", "suctionTube")):
        if tool not in models:
            continue
        glb = models[tool]
        shaft = glb.mesh_vertices(shaft_node, "mt-black" if tool.endswith("electrode") else "mt-steel")
        key = "outerDiameter" if tool == "suction-tube" else "shaftOuterDiameter"
        near(tool, "shaft diameter", 2 * radial(shaft[shaft[:, 2] > 20]).max(), fact(tool, key))
        if tool != "suction-tube":
            near(tool, "working length", glb.anchors["handleFront"][2], fact(tool, "workingLength"))
        else:
            near(tool, "working length", glb.anchors["stopcock"][2], fact(tool, "workingLength"))
        if channel_limit is not None:
            distal = shaft[shaft[:, 2] < 250]
            tips = [glb.mesh_vertices("electrodeTip")] if tool.endswith("electrode") else []
            widest = max([radial(distal).max()] + [radial(t).max() for t in tips if len(t)])
            check(tool, "fits the channel's measured circle", widest <= channel_limit + TOLERANCE,
                  {"tool": round(float(widest), 4), "channel": round(channel_limit, 4)})
    if T in models and S in models:
        check("fit", "telescope inside the flexible sleeve's lumen",
              fact(T, "shaftOuterDiameter") <= fact(S, "capacity"), "dimensional comparison only")

    report = {
        "report": "medical-thoracoscopy-device-kit-raw-validation",
        "definitionsSha256": expected_hashes["definitionsSha256"],
        "generatorSha256": expected_hashes["generatorSha256"],
        "passed": not failures,
        "models": summaries,
        "failures": failures,
    }
    path = local_data_path(*REPORT)
    path.write_text(json.dumps(report, indent=2) + "\n")
    for failure in failures:
        print("✗", failure["model"], "—", failure["check"], json.dumps(failure["detail"]))
    checked = len([name for name in ANCHORS if name in models])
    print(f"{checked} models checked; {len(failures)} failures. Report: {path}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
