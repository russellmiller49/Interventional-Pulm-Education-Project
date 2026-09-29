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
DEV_INSTALL = REPO / "public/models/medical-thoracoscopy/v1/anatomy"

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
        "The material was modified. Surfaces were built from a segmentation of the scan, then simplified "
        "and divided into named regions. Nothing shown is the scan itself."
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
