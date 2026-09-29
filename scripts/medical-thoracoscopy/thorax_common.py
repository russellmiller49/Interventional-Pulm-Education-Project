"""Shared by the thorax anatomy scripts: the source files, the segments by content, the frame.

The anatomy is one CT scan and its segmentation, held in the owner's local data. Nothing here
writes to the repository: the committed records are written by the scripts that import this.

The segmentation's segment names do not match what the segments contain (the one named "thoracic
cavity" holds the rib cage), so every segment the build uses is named here by what it was
measured to contain, and `audit_thorax_sources.py` checks each one against its fingerprint before
anything is built from it.

Coordinates are LPS millimetres (+x toward the patient's left, +y toward the back, +z toward the
head), the frame both files are stored in. The anatomy frame never changes; the scene alone applies
`PRESENTATION_FROM_LPS`.
"""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from local_data import local_data_path, require_local_data_path  # noqa: E402

SOURCE_DIR = ("raw-assets", "pleural-effusion-simulation")
CT_FILE = "19_CT_HR.nii"
SEGMENTATION_FILE = "19_CT_HR segmentation_final.seg.nrrd"
WORK = ("raw-assets", "medical-thoracoscopy", "anatomy")
RECORDS = REPO / "src/features/medical-thoracoscopy/content/data/anatomy"
ZONES = REPO / "src/features/medical-thoracoscopy/content/data/pleural-zones.json"

LABEL = "Derived from CT segmentation"
ATTRIBUTION = {
    "dataset": (
        "Hofstad E, Bouget D, Pedersen A, Støverud K-H, Langø T, Leira HO. AeroPath: An airway "
        "segmentation benchmark dataset with challenging pathology. Zenodo; 2023, version 1. "
        "https://doi.org/10.5281/zenodo.10069289"
    ),
    "describedIn": (
        "Støverud KH, Bouget D, Pedersen A, et al. AeroPath: An airway segmentation benchmark dataset "
        "with challenging pathology and baseline method. PLoS One. 2024;19(10):e0311416. "
        "https://doi.org/10.1371/journal.pone.0311416"
    ),
    "licence": "Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/",
    "changes": (
        "The material was modified. Surfaces were built from a segmentation of the scan, remeshed or "
        "simplified, divided into named regions and, for the lung, reshaped into authored states. The scan "
        "was taken with the patient lying on their back and is shown with the patient lying on their side. "
        "Nothing shown is the scan itself."
    ),
    "identity": "Asserted to be case 19 of the dataset; not verified against the archive.",
}

# The presented position: left lateral decubitus, right side up, gravity toward the patient's left.
# Scene axes (three.js): +Y up = the patient's right (-x LPS); +X = toward the head (+z LPS), so the
# head is to the right of a screen that looks at the patient's front; +Z toward the viewer = the
# patient's front (-y LPS). Rows map LPS to scene. Owner decisions, T7: a default, not a decision.
PRESENTATION_FROM_LPS = np.array([
    [0.0, 0.0, 1.0],
    [-1.0, 0.0, 0.0],
    [0.0, -1.0, 0.0],
])
GRAVITY_LPS = np.array([1.0, 0.0, 0.0])


@dataclass(frozen=True)
class Segment:
    """One segment the build uses, named by what it was measured to contain."""

    key: str
    layer: int
    value: int
    file_name: str
    contains: str
    volume_ml: tuple[float, float]
    hu_mean: tuple[float, float]


SEGMENTS: tuple[Segment, ...] = (
    Segment("right-lung-upper", 0, 78, "upper lobe of right lung", "Right upper lobe", (1100, 1350), (-760, -520)),
    Segment("right-lung-middle", 0, 79, "middle lobe of right lung", "Right middle lobe", (420, 560), (-800, -600)),
    Segment("right-lung-lower", 2, 2, "lower lobe of right lung", "Right lower lobe", (620, 800), (-760, -520)),
    Segment("right-effusion", 3, 3, "right pleural effusion", "Right pleural effusion", (850, 1010), (-30, 40)),
    Segment("rib-cage", 1, 3, "thoracic cavity", "The rib cage, both sides (the file names it thoracic cavity)", (820, 1000), (180, 320)),
    Segment("spine", 0, 82, "spine", "The vertebral column", (480, 600), (170, 300)),
    Segment("diaphragm", 4, 2, "diaphragm", "The diaphragm", (530, 660), (-110, 30)),
    Segment("liver", 1, 1, "liver", "The liver", (1650, 2050), (20, 80)),
    Segment("heart", 1, 4, "heart", "The heart", (830, 1030), (0, 70)),
    Segment("aorta", 0, 83, "aorta", "The aorta", (270, 340), (0, 120)),
    Segment("superior-vena-cava", 0, 84, "superior vena cava", "The superior vena cava", (25, 37), (0, 70)),
    Segment("inferior-vena-cava", 0, 87, "inferior vena cava", "The inferior vena cava", (55, 76), (0, 80)),
    Segment("pulmonary-artery", 3, 1, "pulmonary artery", "The pulmonary arteries", (270, 350), (-120, 40)),
    Segment("pulmonary-vein", 4, 1, "pulmonary vein", "The pulmonary veins", (130, 180), (-250, 0)),
    Segment("esophagus", 0, 73, "esophagus", "The oesophagus", (40, 56), (-60, 40)),
    Segment("airway", 1, 2, "trachea and bronchus", "The trachea and bronchi", (70, 95), (-1000, -880)),
    Segment("left-lung-upper", 0, 76, "upper lobe of left lung", "Left upper lobe", (1250, 1520), (-780, -580)),
    Segment("left-lung-lower", 2, 1, "lower lobe of left lung", "Left lower lobe", (870, 1070), (-740, -540)),
    Segment("skin", 2, 3, "skin", "Skin and subcutaneous tissue, where the scan holds them", (3200, 3900), (-110, -30)),
)
SEGMENT = {segment.key: segment for segment in SEGMENTS}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def source_path(name: str) -> Path:
    return require_local_data_path(*SOURCE_DIR, name)


def work_path(*parts: str) -> Path:
    path = local_data_path(*WORK, *parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


class Volume:
    """The segmentation, with its frame. Loaded once and cached in the owner's local data."""

    def __init__(self) -> None:
        import nrrd

        path = source_path(SEGMENTATION_FILE)
        cache = work_path("cache", f"segmentation-{sha256_file(path)[:16]}.npz")
        header_cache = cache.with_suffix(".json")
        if cache.exists() and header_cache.exists():
            self.labels = np.load(cache)["labels"]
            header = json.loads(header_cache.read_text())
        else:
            labels, raw = nrrd.read(str(path), index_order="F")
            self.labels = labels
            header = {
                "spacing": [raw["space directions"][1][0], raw["space directions"][2][1], raw["space directions"][3][2]],
                "origin": list(map(float, raw["space origin"])),
                "space": raw["space"],
                "segments": {key: raw[key] for key in raw if key.startswith("Segment")},
            }
            np.savez_compressed(cache, labels=labels)
            header_cache.write_text(json.dumps(header))
        self.spacing = np.array(header["spacing"], dtype=float)
        self.origin = np.array(header["origin"], dtype=float)
        self.space = header["space"]
        self.header_segments = header["segments"]
        self.shape = np.array(self.labels.shape[1:])

    def mask(self, key: str) -> np.ndarray:
        segment = SEGMENT[key]
        return self.labels[segment.layer] == segment.value

    def to_lps(self, ijk: np.ndarray) -> np.ndarray:
        return self.origin + np.asarray(ijk, dtype=float) * self.spacing

    def to_ijk(self, lps: np.ndarray) -> np.ndarray:
        ijk = np.round((np.asarray(lps, dtype=float) - self.origin) / self.spacing).astype(int)
        return np.clip(ijk, 0, self.shape - 1)

    @property
    def voxel_ml(self) -> float:
        return float(np.prod(self.spacing)) / 1000.0


def load_ct():
    """The CT as an (i, j, k) array of HU, with its origin and spacing."""
    import SimpleITK as sitk

    image = sitk.ReadImage(str(source_path(CT_FILE)))
    array = np.transpose(sitk.GetArrayFromImage(image), (2, 1, 0))
    return array, np.array(image.GetOrigin()), np.array(image.GetSpacing())


def write_glb(path: Path, meshes: list[dict], root_extras: dict) -> None:
    """Write triangle meshes as one GLB, positions in LPS millimetres.

    `meshes`: [{"vertices" (n,3), "parts": [{"name", "faces" (m,3), "extras"}]}]. Every part becomes
    its own named node; the parts of one mesh share its vertex and normal arrays, so parts that
    divide a surface keep exactly its vertices and together hold each of its faces once. Normals are
    area-weighted vertex normals of the whole mesh. Written by hand so that vertex and index order
    are exactly the arrays given.
    """
    import trimesh

    buffers = bytearray()
    accessors, views, gltf_meshes, gltf_nodes = [], [], [], []

    def add_view(data: bytes, target: int) -> int:
        while len(buffers) % 4:
            buffers.append(0)
        views.append({"buffer": 0, "byteOffset": len(buffers), "byteLength": len(data), "target": target})
        buffers.extend(data)
        return len(views) - 1

    for mesh in meshes:
        vertices = np.asarray(mesh["vertices"], dtype=np.float32)
        all_faces = np.concatenate([np.asarray(part["faces"], dtype=np.int64) for part in mesh["parts"]])
        normals = trimesh.Trimesh(vertices, all_faces, process=False).vertex_normals.astype(np.float32)
        accessors.append({
            "bufferView": add_view(vertices.tobytes(), 34962), "componentType": 5126,
            "count": len(vertices), "type": "VEC3",
            "min": vertices.min(0).tolist(), "max": vertices.max(0).tolist(),
        })
        position = len(accessors) - 1
        accessors.append({"bufferView": add_view(normals.tobytes(), 34962), "componentType": 5126,
                          "count": len(normals), "type": "VEC3"})
        normal = len(accessors) - 1
        for part in mesh["parts"]:
            faces = np.asarray(part["faces"], dtype=np.uint32)
            accessors.append({"bufferView": add_view(faces.reshape(-1).tobytes(), 34963),
                              "componentType": 5125, "count": int(faces.size), "type": "SCALAR"})
            gltf_meshes.append({"name": part["name"], "primitives": [
                {"attributes": {"POSITION": position, "NORMAL": normal}, "indices": len(accessors) - 1}]})
            gltf_nodes.append({"name": part["name"], "mesh": len(gltf_meshes) - 1, "extras": part.get("extras", {})})

    children = list(range(len(gltf_nodes)))
    gltf_nodes.append({"name": root_extras["name"], "children": children, "extras": root_extras})
    document = {
        "asset": {"version": "2.0", "generator": "scripts/medical-thoracoscopy/build_thorax_surfaces.py"},
        "scene": 0,
        "scenes": [{"nodes": [len(gltf_nodes) - 1]}],
        "nodes": gltf_nodes,
        "meshes": gltf_meshes,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(buffers)}],
    }
    body = json.dumps(document, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()
    while len(body) % 4:
        body += b" "
    while len(buffers) % 4:
        buffers.append(0)
    total = 12 + 8 + len(body) + 8 + len(buffers)
    with path.open("wb") as handle:
        handle.write(struct.pack("<III", 0x46546C67, 2, total))
        handle.write(struct.pack("<II", len(body), 0x4E4F534A))
        handle.write(body)
        handle.write(struct.pack("<II", len(buffers), 0x004E4942))
        handle.write(bytes(buffers))


class GlbBuilder:
    """A glTF 2 binary built accessor by accessor, for files `write_glb` cannot express: morph
    targets, quantised attributes (KHR_mesh_quantization), node transforms and point primitives.
    Vertex attributes are padded to four-byte strides, as glTF requires. Deterministic: the same
    calls give the same bytes."""

    FLOAT, BYTE, SHORT, UNSIGNED_SHORT, UNSIGNED_INT = 5126, 5120, 5122, 5123, 5125
    _DTYPES = {5126: np.float32, 5120: np.int8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32}

    def __init__(self, generator: str) -> None:
        self.generator = generator
        self.buffer = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []
        self.meshes: list[dict] = []
        self.nodes: list[dict] = []
        self.extensions: set[str] = set()

    def _view(self, data: bytes, target: int | None, stride: int | None) -> int:
        while len(self.buffer) % 4:
            self.buffer.append(0)
        view = {"buffer": 0, "byteOffset": len(self.buffer), "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        if stride is not None:
            view["byteStride"] = stride
        self.views.append(view)
        self.buffer.extend(data)
        return len(self.views) - 1

    def attribute(self, values: np.ndarray, component: int = 5126, normalized: bool = False,
                  bounds: bool = False) -> int:
        """A VEC3 vertex attribute. Integer components are padded to a four-byte stride."""
        array = np.asarray(values, dtype=self._DTYPES[component])
        stride = None
        if component in (self.BYTE, self.SHORT):
            width = 4 if component == self.BYTE else 4
            padded = np.zeros((len(array), width), dtype=array.dtype)
            padded[:, :3] = array
            data = padded.tobytes()
            stride = 4 if component == self.BYTE else 8
            self.extensions.add("KHR_mesh_quantization")
        else:
            data = array.tobytes()
        accessor = {"bufferView": self._view(data, 34962, stride), "componentType": component,
                    "count": len(array), "type": "VEC3"}
        if normalized:
            accessor["normalized"] = True
        if bounds:
            cast = float if component == self.FLOAT else int
            accessor["min"] = [cast(x) for x in array.min(0)]
            accessor["max"] = [cast(x) for x in array.max(0)]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def indices(self, faces: np.ndarray, vertex_count: int) -> int:
        component = self.UNSIGNED_SHORT if vertex_count < 65535 else self.UNSIGNED_INT
        array = np.asarray(faces).reshape(-1).astype(self._DTYPES[component])
        self.accessors.append({"bufferView": self._view(array.tobytes(), 34963, None), "componentType": component,
                               "count": int(array.size), "type": "SCALAR"})
        return len(self.accessors) - 1

    def mesh(self, name: str, primitives: list[dict], weights: list[float] | None = None,
             extras: dict | None = None) -> int:
        mesh = {"name": name, "primitives": primitives}
        if weights is not None:
            mesh["weights"] = weights
        if extras:
            mesh["extras"] = extras
        self.meshes.append(mesh)
        return len(self.meshes) - 1

    def node(self, name: str, mesh: int | None = None, children: list[int] | None = None, extras: dict | None = None,
             translation: list[float] | None = None, scale: list[float] | None = None) -> int:
        node: dict = {"name": name}
        for key, value in (("mesh", mesh), ("children", children), ("translation", translation), ("scale", scale)):
            if value is not None:
                node[key] = value
        if extras:
            node["extras"] = extras
        self.nodes.append(node)
        return len(self.nodes) - 1

    def write(self, path: Path, root: int) -> None:
        document = {
            "asset": {"version": "2.0", "generator": self.generator},
            "scene": 0,
            "scenes": [{"nodes": [root]}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.buffer)}],
        }
        if self.extensions:
            document["extensionsUsed"] = sorted(self.extensions)
            document["extensionsRequired"] = sorted(self.extensions)
        body = json.dumps(document, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()
        while len(body) % 4:
            body += b" "
        binary = bytes(self.buffer) + b"\0" * ((4 - len(self.buffer) % 4) % 4)
        with path.open("wb") as handle:
            handle.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(body) + 8 + len(binary)))
            handle.write(struct.pack("<II", len(body), 0x4E4F534A))
            handle.write(body)
            handle.write(struct.pack("<II", len(binary), 0x004E4942))
            handle.write(binary)


def glb_accessor(document: dict, binary: bytes, index: int) -> np.ndarray:
    """An accessor's values as floats, dequantised if normalized, read without a library. Handles
    the strides `GlbBuilder` writes."""
    entry = document["accessors"][index]
    view = document["bufferViews"][entry["bufferView"]]
    dtype = GlbBuilder._DTYPES[entry["componentType"]]
    width = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[entry["type"]]
    item = np.dtype(dtype).itemsize
    stride = view.get("byteStride", item * width)
    offset = view.get("byteOffset", 0) + entry.get("byteOffset", 0)
    raw = np.frombuffer(binary, dtype=np.uint8, count=stride * (entry["count"] - 1) + item * width, offset=offset)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(entry["count"], item * width), strides=(stride, 1)).copy()
    values = rows.view(dtype).reshape(entry["count"], width).astype(np.float64)
    if entry.get("normalized"):
        values = np.maximum(values / float(np.iinfo(dtype).max), -1.0)
    return values if width > 1 else values[:, 0]


def read_glb(path: Path) -> tuple[dict, bytes]:
    """The JSON document and binary chunk of a GLB, read without a library."""
    data = path.read_bytes()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise ValueError(f"{path} is not a glTF 2 binary")
    json_length, _ = struct.unpack_from("<II", data, 12)
    document = json.loads(data[20:20 + json_length])
    bin_start = 20 + json_length
    bin_length, _ = struct.unpack_from("<II", data, bin_start)
    return document, data[bin_start + 8: bin_start + 8 + bin_length]


def write_record(path: Path, record: dict) -> None:
    """Write a committed record as JSON the repository's formatter leaves unchanged."""
    import subprocess

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    subprocess.run(["npx", "prettier", "--write", str(path)], cwd=REPO, check=True, capture_output=True)


def rounded(value, places: int = 2):
    """Round floats inside nested structures, so records hold numbers a reader can check."""
    if isinstance(value, dict):
        return {key: rounded(item, places) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [rounded(item, places) for item in value]
    if isinstance(value, (float, np.floating)):
        return round(float(value), places)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value
