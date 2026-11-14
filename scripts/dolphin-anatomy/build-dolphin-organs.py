#!/usr/bin/env python3
"""Build the dolphin whole-body anatomy model from the Local-Data CT.

Input, read in place from <Local-Data>/Dolphin_bronch (never copied into the repo):
  KaneDICOM/                      the bottlenose dolphin CT study; series 8 is used, the
                                  soft-tissue reconstruction of the third acquisition and the
                                  only series that reaches the abdomen (bony nares to just
                                  behind the dorsal fin; 512 x 512 x 1120 at 1.27 x 1.27 x 1.25 mm)
  "3 DOLPHIN LUNG 1.25MM.nrrd"    series 3, the grid of the hand-drawn airway label
  "Airway Label.seg.nrrd"         hand-drawn tracheobronchial segmentation (label 1)

Working files, kept beside the input in Dolphin_bronch/organ-segmentation:
  "8 DOLPHIN ST 1.25MM.nrrd"      series 8 stacked from the DICOM files (cache)
  totalsegmentator/*.nii.gz       TotalSegmentator `total` and `trunk_cavities` on series 8
                                  (cache; run with the TOTALSEGMENTATOR executable when missing)
  "Dolphin Organs.seg.nrrd"       the labelmap, one segment per structure, for review in Slicer

The scan was registered head-first prone with the animal ventral side down, so the scanner
axes read as the animal's: superior = rostral, posterior = dorsal, anterior = ventral, and
left/right are the animal's own.

How each structure is found:
  - Body: tissue denser than the foam pad under the animal (about -200 HU): above -150 HU on
    a 3x3x3 median, opened, the largest piece, filled slice by slice.
  - Skin and blubber: the fat-density shell (-400 to -25 HU) that reaches the skin, out to
    its local inner boundary (the deepest shell fat within about 11 mm, smoothed, at most 50 mm).
  - Air below -500 HU, by connected piece: the largest is the lungs with the intrathoracic
    airway; in the head the largest is the nasal passages and nasopharynx and the next two are
    the pterygoid sinuses, sided by position; pieces touching the esophagus are its gas; pieces
    inside the abdominal cavity are gas in the stomach and intestines.
  - Larynx, trachea and bronchi: the hand-drawn label, moved from series 3 by a rigid
    translation (registration on the thorax) and refit to the air of series 8; the laryngeal
    lumen inside the goosebeak, cut off from the lungs by the airway shell, is added back.
  - Lungs: lung air minus a 2-voxel shell around the airway, split into the two largest pieces.
  - Bone above 180 HU, split by seeded flooding (watershed on a flat image, so each bone voxel
    goes to the nearest seed through bone) from TotalSegmentator's skull, vertebra, rib,
    sternum, scapula and humerus labels, with rules for what a human-trained model cannot
    know: the mandibular rami are the separate C-shaped pieces beside the braincase, the
    tympanoperiotic bones grow from the densest bone in the scan (> 1200 HU), the hyoid
    apparatus is the bone in the floor of the throat, there are no ribs caudal to the last
    pair, and the scapulae and flipper bones are lateral. Unseeded bone in the flipper level
    and lateral is flipper; anything rostral to the occipital condyles is skull.
  - Heart, aorta, brain, spinal cord, esophagus: TotalSegmentator `total`, largest piece each.
  - Abdominal cavity: TotalSegmentator `trunk_cavities`. The liver, stomach chambers,
    intestines, kidneys and spleen are not visible as separate organs on this non-contrast
    scan of a 213 kg animal, so the abdomen is one structure.

Output:
  public/dolphin-anatomy/dolphin-001/organs.glb
      one Draco-compressed surface per structure plus the body surface, node name = structure
      id, patient LPS millimetres
  src/features/dolphin-anatomy/content/dolphin-001-manifest.json
      structure ids, names, systems, colours and volumes, and the CT's geometry

Needs, besides the airway-case Python stack (nrrd, scipy, skimage, trimesh): SimpleITK,
fast-simplification (pip install fast-simplification), and gltf-pipeline and prettier from npm install.
TotalSegmentator (2.13, run on Apple MPS here) is only needed when its cache is missing.

Usage: python3 scripts/dolphin-anatomy/build-dolphin-organs.py [--meshes-only]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import nrrd
import numpy as np
import SimpleITK as sitk
import trimesh
from scipy import ndimage as ndi
from skimage.measure import marching_cubes
from skimage.segmentation import watershed

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from local_data import local_data_path  # noqa: E402

SOURCE_DIR = local_data_path("Dolphin_bronch")
DICOM_DIR = SOURCE_DIR / "KaneDICOM"
CT_SERIES_NUMBER = 8
AIRWAY_CT_NAME = "3 DOLPHIN LUNG 1.25MM.nrrd"
AIRWAY_LABEL_NAME = "Airway Label.seg.nrrd"
WORK_DIR = SOURCE_DIR / "organ-segmentation"
CT_CACHE = WORK_DIR / "8 DOLPHIN ST 1.25MM.nrrd"
SEGMENTATION_OUTPUT = WORK_DIR / "Dolphin Organs.seg.nrrd"
TOTALSEGMENTATOR_DIR = WORK_DIR / "totalsegmentator"
TOTALSEGMENTATOR = os.environ.get(
    "TOTALSEGMENTATOR", str(Path.home() / "totalseg_env" / "bin" / "TotalSegmentator")
)
CASE_ID = "dolphin-001"
OUTPUT_DIR = REPO_ROOT / "public" / "dolphin-anatomy" / CASE_ID
GLB_NAME = "organs.glb"
MANIFEST_PATH = REPO_ROOT / "src" / "features" / "dolphin-anatomy" / "content" / f"{CASE_ID}-manifest.json"

FACE = ndi.generate_binary_structure(3, 1)
CUBE = np.ones((3, 3, 3), bool)

# TotalSegmentator 2.13 class ids ("total" and "trunk_cavities" tasks).
TS_HEART, TS_AORTA, TS_BRAIN, TS_SPINAL_CORD, TS_ESOPHAGUS = 51, 52, 90, 79, 15
TS_SKULL, TS_STERNUM, TS_COSTAL_CARTILAGES = 91, 116, 117
TS_VERTEBRAE = range(25, 51)  # sacrum, S1 .. C1
TS_RIBS = range(92, 116)
TS_SCAPULA_LEFT, TS_SCAPULA_RIGHT, TS_HUMERUS_LEFT, TS_HUMERUS_RIGHT = 71, 72, 69, 70
TS_ABDOMINAL_CAVITY = 1

# Bone classes of the flooding step.
SKULL, MANDIBLE, SPINE, RIBS, STERNUM = 1, 2, 3, 4, 5
SCAPULA_LEFT, SCAPULA_RIGHT, FLIPPER_LEFT, FLIPPER_RIGHT = 6, 7, 8, 9
HYOID, EAR_LEFT, EAR_RIGHT = 10, 11, 12

# Slice indices (k, series 8; 1.25 mm, rostral = high k) of the landmarks the rules use.
OCCIPITAL_K = 990  # rostral to the occipital condyles there is no vertebra
HEAD_K = 1000  # vertebra seeds above this are skull (the rostrum's midline bones)
MANDIBLE_K = 1036  # the mandibular rami stand free of the braincase rostral to this
EAR_K = 960  # the tympanoperiotic bones lie rostral to this
THROAT_K = (950, 1050)  # hyoid apparatus
LAST_RIB_K = 300  # no ribs caudal to this
FLIPPER_K = (560, 920)  # flipper level, for unseeded lateral bone


@dataclass(frozen=True)
class Structure:
    id: str
    name: str
    system: str
    color: tuple[float, float, float]


# Painting order: later structures win where masks overlap.
STRUCTURES = [
    Structure("skin-blubber", "Skin and blubber", "body-wall", (0.93, 0.80, 0.55)),
    Structure("abdominal-cavity", "Abdominal cavity", "digestive", (0.85, 0.55, 0.45)),
    Structure("gi-gas", "Gas in stomach and intestines", "digestive", (0.40, 0.80, 0.40)),
    Structure("esophagus", "Esophagus", "digestive", (0.95, 0.75, 0.30)),
    Structure("heart", "Heart", "cardiovascular", (0.80, 0.10, 0.12)),
    Structure("aorta", "Aorta", "cardiovascular", (0.95, 0.30, 0.45)),
    Structure("brain", "Brain", "nervous", (0.95, 0.80, 0.80)),
    Structure("spinal-cord", "Spinal cord", "nervous", (1.00, 0.95, 0.60)),
    Structure("nasal-passages", "Nasal passages and nasopharynx", "respiratory", (0.30, 0.85, 0.95)),
    Structure("pterygoid-sinus-left", "Left pterygoid sinus", "respiratory", (0.55, 0.65, 1.00)),
    Structure("pterygoid-sinus-right", "Right pterygoid sinus", "respiratory", (0.55, 0.65, 1.00)),
    Structure("airway", "Larynx, trachea and bronchi", "respiratory", (0.20, 0.55, 0.95)),
    Structure("lung-left", "Left lung", "respiratory", (0.95, 0.65, 0.70)),
    Structure("lung-right", "Right lung", "respiratory", (0.85, 0.60, 0.75)),
    Structure("skull", "Skull", "skeleton", (0.95, 0.93, 0.85)),
    Structure("mandible", "Mandible", "skeleton", (0.95, 0.72, 0.45)),
    Structure("hyoid", "Hyoid apparatus", "skeleton", (0.70, 0.88, 0.86)),
    Structure("tympanoperiotic-left", "Left tympanoperiotic bone", "skeleton", (1.00, 0.85, 0.45)),
    Structure("tympanoperiotic-right", "Right tympanoperiotic bone", "skeleton", (1.00, 0.85, 0.45)),
    Structure("vertebral-column", "Vertebral column", "skeleton", (0.98, 0.96, 0.88)),
    Structure("ribs", "Ribs", "skeleton", (0.86, 0.90, 0.78)),
    Structure("sternum", "Sternum", "skeleton", (0.95, 0.60, 0.55)),
    Structure("scapula-left", "Left scapula", "skeleton", (0.78, 0.80, 0.95)),
    Structure("scapula-right", "Right scapula", "skeleton", (0.78, 0.80, 0.95)),
    Structure("flipper-left", "Left flipper skeleton", "skeleton", (0.98, 0.88, 0.60)),
    Structure("flipper-right", "Right flipper skeleton", "skeleton", (0.98, 0.88, 0.60)),
]
BONE_STRUCTURE = {
    SKULL: "skull", MANDIBLE: "mandible", HYOID: "hyoid", EAR_LEFT: "tympanoperiotic-left",
    EAR_RIGHT: "tympanoperiotic-right", SPINE: "vertebral-column", RIBS: "ribs", STERNUM: "sternum",
    SCAPULA_LEFT: "scapula-left", SCAPULA_RIGHT: "scapula-right", FLIPPER_LEFT: "flipper-left",
    FLIPPER_RIGHT: "flipper-right",
}
BODY_SURFACE = Structure("body-surface", "Body surface", "body-wall", (0.85, 0.78, 0.70))

# Face budget per mesh after decimation; anything not listed keeps at most 20 000 faces.
FACE_BUDGET = {
    "body-surface": 60000, "skin-blubber": 50000, "vertebral-column": 70000, "ribs": 45000,
    "skull": 50000, "airway": 40000, "abdominal-cavity": 25000, "gi-gas": 25000,
    "lung-left": 25000, "lung-right": 25000, "mandible": 15000, "sternum": 12000,
    "tympanoperiotic-left": 5000, "tympanoperiotic-right": 5000,
}
DEFAULT_FACE_BUDGET = 20000


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--meshes-only", action="store_true", help="rebuild the GLB and manifest from the saved labelmap")
    parser.add_argument("--ts-device", default="mps", help="TotalSegmentator device (mps, gpu, cpu)")
    args = parser.parse_args()

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    ct, header = load_ct()
    body = body_mask(ndi.median_filter(ct, size=3))
    if args.meshes_only:
        labelmap, _ = nrrd.read(str(SEGMENTATION_OUTPUT))
    else:
        total = run_totalsegmentator("total", args.ts_device)
        cavities = run_totalsegmentator("trunk_cavities", args.ts_device)
        labelmap = segment(ct, header, body, total, cavities)
        write_segmentation(labelmap, header)
    write_runtime(labelmap, body, header)


# --- inputs ---------------------------------------------------------------------------------


def load_ct() -> tuple[np.ndarray, dict]:
    """Series 8 as an (i, j, k) int16 volume with LPS geometry, stacked by slice position."""
    if CT_CACHE.exists():
        ct, header = nrrd.read(str(CT_CACHE))
        return ct, header
    import pydicom

    slices = []
    for path in DICOM_DIR.iterdir():
        meta = pydicom.dcmread(path, stop_before_pixels=True)
        if meta.get("SeriesNumber") == CT_SERIES_NUMBER and meta.get("Modality") == "CT":
            slices.append((float(meta.ImagePositionPatient[2]), path, meta))
    slices.sort(key=lambda item: item[0])
    z = np.array([item[0] for item in slices])
    if not np.allclose(np.diff(z), 1.25, atol=1e-3):
        raise ValueError("Series 8 slices are not evenly spaced at 1.25 mm")
    first = slices[0][2]
    if [float(v) for v in first.ImageOrientationPatient] != [-1, 0, 0, 0, -1, 0]:
        raise ValueError("Unexpected slice orientation")
    # SimpleITK decodes the JPEG-lossless pixels; its series reader got the slice direction
    # wrong for this study, so the volume is stacked here by ImagePositionPatient.
    volume = np.stack(
        [sitk.GetArrayFromImage(sitk.ReadImage(str(path)))[0].astype(np.int16).T for _, path, _ in slices],
        axis=2,
    )
    row_spacing, column_spacing = (float(v) for v in first.PixelSpacing)
    header = {
        "type": "short",
        "dimension": 3,
        "space": "left-posterior-superior",
        "space directions": np.array([[-column_spacing, 0, 0], [0, -row_spacing, 0], [0, 0, 1.25]]),
        "kinds": ["domain"] * 3,
        "encoding": "gzip",
        "space origin": np.array([float(first.ImagePositionPatient[0]), float(first.ImagePositionPatient[1]), z[0]]),
    }
    nrrd.write(str(CT_CACHE), volume, header)
    return volume, header


def run_totalsegmentator(task: str, device: str) -> np.ndarray:
    output = TOTALSEGMENTATOR_DIR / f"{task}.nii.gz"
    if not output.exists():
        TOTALSEGMENTATOR_DIR.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as scratch:
            nifti = Path(scratch) / "ct.nii.gz"
            sitk.WriteImage(sitk.ReadImage(str(CT_CACHE)), str(nifti))
            subprocess.run(
                [TOTALSEGMENTATOR, "-i", str(nifti), "-o", str(output), "--ml", "-ta", task, "-d", device]
                + (["-bs"] if task == "total" else []),
                check=True,
            )
    return sitk.GetArrayFromImage(sitk.ReadImage(str(output))).transpose(2, 1, 0).astype(np.int16)


def airway_label_on_series_8() -> np.ndarray:
    """The hand-drawn airway label (series 3 grid), moved onto series 8 by a rigid translation."""
    fixed = sitk.ReadImage(str(CT_CACHE), sitk.sitkFloat32)
    moving = sitk.ReadImage(str(SOURCE_DIR / AIRWAY_CT_NAME), sitk.sitkFloat32)
    label = sitk.ReadImage(str(SOURCE_DIR / AIRWAY_LABEL_NAME))

    def clamp(image: sitk.Image) -> sitk.Image:
        return sitk.Clamp(image, sitk.sitkFloat32, -1000, 300)

    registration = sitk.ImageRegistrationMethod()
    registration.SetMetricAsMeanSquares()
    registration.SetMetricSamplingStrategy(registration.RANDOM)
    registration.SetMetricSamplingPercentage(0.05, seed=1)
    registration.SetOptimizerAsRegularStepGradientDescent(2.0, 0.01, 200)
    registration.SetOptimizerScalesFromPhysicalShift()
    # Coarse start from an air-mask overlap search: series 8 sits about 6 mm caudal.
    registration.SetInitialTransform(sitk.TranslationTransform(3, (0, 0, -6.0)))
    registration.SetShrinkFactorsPerLevel([4, 2, 1])
    registration.SetSmoothingSigmasPerLevel([2, 1, 0])
    registration.SetInterpolator(sitk.sitkLinear)
    thorax = clamp(fixed)[100:420, 150:420, 540:980]
    transform = registration.Execute(thorax, clamp(moving))
    print("airway label translation (mm):", np.round(transform.GetParameters(), 2))
    moved = sitk.Resample(label, fixed, transform, sitk.sitkNearestNeighbor, 0, sitk.sitkUInt8)
    return sitk.GetArrayFromImage(moved).transpose(2, 1, 0) > 0


# --- segmentation ---------------------------------------------------------------------------


def largest(mask: np.ndarray, structure: np.ndarray = CUBE) -> np.ndarray:
    labels, count = ndi.label(mask, structure)
    if count == 0:
        return mask
    sizes = ndi.sum(mask, labels, range(1, count + 1))
    return labels == (np.argmax(sizes) + 1)


def body_mask(median: np.ndarray) -> np.ndarray:
    """The animal without the foam pad (about -200 HU) it lies on."""
    core = largest(ndi.binary_opening(median > -150, FACE, iterations=2), FACE)
    disk = np.hypot(*np.mgrid[-4:5, -4:5]) <= 4
    for k in range(core.shape[2]):
        closed = ndi.binary_closing(np.pad(core[:, :, k], 6), structure=disk)[6:-6, 6:-6]
        core[:, :, k] = ndi.binary_fill_holes(closed)
    # The partial-volume skin edge, at most 2 voxels, never into air.
    body = (ndi.binary_dilation(core, FACE, iterations=2) & (median > -350)) | core
    for k in range(body.shape[2]):
        body[:, :, k] = ndi.binary_fill_holes(body[:, :, k])
    return body


def blubber_mask(smooth: np.ndarray, body: np.ndarray, depth: np.ndarray) -> np.ndarray:
    fat = (smooth < -25) & (smooth > -400) & body & (depth < 55)
    reaches_skin = fat & (depth > 4) & (depth < 14)
    labels, _ = ndi.label(fat)
    shell = np.isin(labels, np.setdiff1d(np.unique(labels[reaches_skin]), [0]))
    inner = ndi.gaussian_filter(ndi.maximum_filter(np.where(shell, depth, 0).astype(np.float32), size=9), 3)
    blubber = body & ((depth <= np.minimum(inner, 50)) | (depth <= 3.5))
    return blubber & ~((smooth > 180) & body) & (smooth > -500)


def segment(ct: np.ndarray, header: dict, body: np.ndarray, total: np.ndarray, cavities: np.ndarray) -> np.ndarray:
    spacing = np.abs(np.diag(header["space directions"]))
    smooth = ndi.gaussian_filter(ct.astype(np.float32), 1.0)
    depth = ndi.distance_transform_edt(body, sampling=spacing).astype(np.float32)
    print("body", round(body.sum() * spacing.prod() / 1e6, 1), "L")

    masks: dict[str, np.ndarray] = {"skin-blubber": blubber_mask(smooth, body, depth)}

    air_labels, _ = ndi.label((smooth < -500) & body)
    air_sizes = np.bincount(air_labels.ravel())
    air_sizes[0] = 0
    lung_piece = int(np.argmax(air_sizes))

    abdomen = largest((cavities == TS_ABDOMINAL_CAVITY) & body)
    masks["abdominal-cavity"] = abdomen
    head_pieces = head_air_pieces(air_labels, air_sizes)
    masks["nasal-passages"] = air_labels == head_pieces["nasal"]
    masks["pterygoid-sinus-left"] = air_labels == head_pieces["left"]
    masks["pterygoid-sinus-right"] = air_labels == head_pieces["right"]

    airway, lung_left, lung_right = airway_and_lungs(smooth, air_labels == lung_piece, airway_label_on_series_8())
    masks["airway"], masks["lung-left"], masks["lung-right"] = airway, lung_left, lung_right

    esophagus = largest(total == TS_ESOPHAGUS)
    not_gas = {0, lung_piece, *head_pieces.values()}
    esophageal_gas = pieces_touching(air_labels, ndi.binary_dilation(esophagus, FACE, iterations=3), not_gas)
    masks["esophagus"] = esophagus | esophageal_gas
    gi_gas = pieces_touching(air_labels, abdomen, not_gas)
    masks["gi-gas"] = gi_gas & ~esophageal_gas & ~(lung_left | lung_right | airway)

    for structure_id, ts_class in (
        ("heart", TS_HEART), ("aorta", TS_AORTA), ("brain", TS_BRAIN), ("spinal-cord", TS_SPINAL_CORD),
    ):
        masks[structure_id] = largest(total == ts_class)

    bones = classify_bone(smooth, body, total)
    for bone_class, structure_id in BONE_STRUCTURE.items():
        masks[structure_id] = bones == bone_class

    labelmap = np.zeros(ct.shape, np.uint8)
    for value, structure in enumerate(STRUCTURES, start=1):
        labelmap[masks[structure.id]] = value
    voxel_ml = spacing.prod() / 1000
    for value, structure in enumerate(STRUCTURES, start=1):
        print(f"{structure.name:34s} {(labelmap == value).sum() * voxel_ml:9.1f} mL")
    return labelmap


def head_air_pieces(air_labels: np.ndarray, air_sizes: np.ndarray) -> dict[str, int]:
    """The nasal passages are the largest air space in the head; the next two are the
    pterygoid sinuses, one each side of it."""
    pieces = np.argsort(air_sizes)[::-1][:40]
    centres = ndi.center_of_mass(air_labels > 0, air_labels, pieces)
    head = [(int(p), c) for p, c in zip(pieces, centres) if air_sizes[p] > 5000 and c[2] > HEAD_K - 10]
    if len(head) < 3:
        raise ValueError("Expected the nasal passages and two pterygoid sinuses in the head")
    (nasal, nasal_centre), *sinuses = head[:3]
    sides = {("left" if centre[0] < nasal_centre[0] else "right"): piece for piece, centre in sinuses}
    if set(sides) != {"left", "right"}:
        raise ValueError("The two pterygoid sinuses are on the same side")
    return {"nasal": nasal, **sides}


def pieces_touching(air_labels: np.ndarray, region: np.ndarray, excluded: set[int]) -> np.ndarray:
    touching = np.setdiff1d(np.unique(air_labels[region]), list(excluded))
    return np.isin(air_labels, touching)


def airway_and_lungs(smooth: np.ndarray, lung_air: np.ndarray, label: np.ndarray):
    # The moved label where the lumen is dark, plus a 1-voxel rim that is clearly lumen.
    airway = largest((label & (smooth < -350)) | (ndi.binary_dilation(label, FACE) & (smooth < -900)), FACE)
    lung = lung_air & ~ndi.binary_dilation(airway, FACE, iterations=2)
    labels, count = ndi.label(lung, FACE)
    order = np.argsort(ndi.sum(lung, labels, range(1, count + 1)))[::-1]
    first, second = labels == order[0] + 1, labels == order[1] + 1
    # Image index i runs toward the animal's right.
    left, right = (first, second) if np.argwhere(first)[:, 0].mean() < np.argwhere(second)[:, 0].mean() else (second, first)
    rest = lung & ~left & ~right
    # Leftover pieces that touch the airway (the laryngeal lumen in the goosebeak, cut off by
    # the airway shell) are airway; the others go to the nearer lung.
    rest_labels, _ = ndi.label(rest, FACE)
    near_airway = ndi.binary_dilation(airway, FACE, iterations=3)
    to_airway = np.isin(rest_labels, np.setdiff1d(np.unique(rest_labels[near_airway]), [0]))
    airway = airway | to_airway | (lung_air & near_airway & ~ndi.binary_dilation(first | second, FACE))
    rest &= ~to_airway
    to_left = rest & (ndi.distance_transform_edt(~left) <= ndi.distance_transform_edt(~right))
    left, right = left | to_left, right | (rest & ~to_left)
    # Vessels and small airways inside each lung belong to it.
    for lung_mask in (left, right):
        for k in range(lung_mask.shape[2]):
            if lung_mask[:, :, k].any():
                lung_mask[:, :, k] = ndi.binary_fill_holes(lung_mask[:, :, k])
    right &= ~left
    return airway, left & ~airway, right & ~airway


def classify_bone(smooth: np.ndarray, body: np.ndarray, total: np.ndarray) -> np.ndarray:
    bone = (smooth > 180) & body
    labels, count = ndi.label(bone, CUBE)
    sizes = ndi.sum(bone, labels, range(1, count + 1))
    bone = np.isin(labels, 1 + np.where(sizes >= 40)[0])
    # Fill small marrow holes slice by slice, never the cranial vault or the vertebral canal.
    neural = np.isin(total, [TS_SPINAL_CORD, TS_BRAIN])
    for k in range(bone.shape[2]):
        section = bone[:, :, k]
        if not section.any():
            continue
        holes = ndi.binary_fill_holes(section) & ~section
        hole_labels, hole_count = ndi.label(holes)
        if hole_count == 0:
            continue
        index = range(1, hole_count + 1)
        small = (ndi.sum(holes, hole_labels, index) <= 120) & (ndi.maximum(neural[:, :, k], hole_labels, index) == 0)
        bone[:, :, k] = section | np.concatenate([[False], small])[hole_labels]

    K = np.arange(bone.shape[2])[None, None, :]
    J = np.arange(bone.shape[1])[None, :, None]
    I = np.arange(bone.shape[0])[:, None, None]
    skull_ts = (total == TS_SKULL) & (K > 940)
    midline_i = np.argwhere(skull_ts)[:, 0].mean()

    seeds = np.zeros(bone.shape, np.uint8)
    seeds[skull_ts] = SKULL
    seeds[np.isin(total, list(TS_VERTEBRAE)) | (total == TS_SPINAL_CORD)] = SPINE
    seeds[np.isin(total, list(TS_RIBS)) | (total == TS_COSTAL_CARTILAGES)] = RIBS
    seeds[total == TS_STERNUM] = STERNUM
    seeds[total == TS_SCAPULA_LEFT] = SCAPULA_LEFT
    seeds[total == TS_SCAPULA_RIGHT] = SCAPULA_RIGHT
    seeds[total == TS_HUMERUS_LEFT] = FLIPPER_LEFT
    seeds[total == TS_HUMERUS_RIGHT] = FLIPPER_RIGHT
    # Tympanoperiotic bones: the densest bone in the scan, at the skull base.
    ear_labels, ear_count = ndi.label((smooth > 1200) & (K > EAR_K), CUBE)
    for piece in range(1, ear_count + 1):
        core = ear_labels == piece
        if core.sum() >= 200:
            seeds[core] = EAR_LEFT if np.argwhere(core)[:, 0].mean() < 256 else EAR_RIGHT
    # Hyoid apparatus: separate pieces in the floor of the throat behind the skull base.
    piece_labels, _ = ndi.label(bone, CUBE)
    for piece, box in enumerate(ndi.find_objects(piece_labels), start=1):
        if box is None:
            continue
        kc, jc = (box[2].start + box[2].stop) / 2, (box[1].start + box[1].stop) / 2
        if THROAT_K[0] < kc < THROAT_K[1] and jc > 340 and box[2].stop < 1070 and (piece_labels[box] == piece).sum() > 300:
            seeds[(piece_labels == piece) & (seeds == 0)] = HYOID
    seeds[~bone] = 0
    # Mandibular rami: in each slice rostral to the jaw joint, the bone pieces that stand
    # free of the braincase, ventral and to the side of it.
    for k in range(MANDIBLE_K, bone.shape[2]):
        section_labels, section_count = ndi.label(bone[:, :, k])
        if section_count < 2:
            continue
        index = range(1, section_count + 1)
        areas = ndi.sum(bone[:, :, k], section_labels, index)
        braincase = int(np.argmax(areas)) + 1
        for piece, (ci, cj) in enumerate(ndi.center_of_mass(bone[:, :, k], section_labels, index), start=1):
            if piece != braincase and cj > 328 and abs(ci - midline_i) > 40 and areas[piece - 1] > 8:
                seeds[:, :, k][section_labels == piece] = MANDIBLE
    seeds[bone & (K > HEAD_K) & (seeds == SPINE)] = SKULL
    # The whole tympanoperiotic complex, not only its dense core, before the throat rule.
    near_ear = ndi.binary_dilation(np.isin(seeds, [EAR_LEFT, EAR_RIGHT]), FACE, iterations=6) & bone & (seeds != MANDIBLE)
    seeds[near_ear] = np.broadcast_to(np.where(I < midline_i, EAR_LEFT, EAR_RIGHT), bone.shape)[near_ear]
    seeds[bone & (K > THROAT_K[0]) & (K < THROAT_K[1]) & (J > 345) & ~np.isin(seeds, [MANDIBLE, EAR_LEFT, EAR_RIGHT])] = HYOID

    classes = flood(bone, seeds)

    # Second pass: correct what the human-trained labels get wrong on a dolphin, then re-flood.
    seeds = classes.copy()
    seeds[(seeds == RIBS) & (K < LAST_RIB_K)] = SPINE  # lumbar transverse processes
    seeds[(seeds == SPINE) & (K > HEAD_K)] = SKULL
    seeds[np.isin(seeds, [SCAPULA_LEFT, SCAPULA_RIGHT, FLIPPER_LEFT, FLIPPER_RIGHT]) & (np.abs(I - 256) < 45)] = SPINE
    for bone_class in (SKULL, MANDIBLE, STERNUM, SCAPULA_LEFT, SCAPULA_RIGHT, FLIPPER_LEFT, FLIPPER_RIGHT, HYOID, EAR_LEFT, EAR_RIGHT):
        mask = seeds == bone_class
        class_labels, class_count = ndi.label(mask, CUBE)
        if class_count < 2:
            continue
        sizes = ndi.sum(mask, class_labels, range(1, class_count + 1))
        if bone_class in (MANDIBLE, HYOID):  # paired rami; basihyal with paired thyro- and stylohyals
            seeds[mask & np.isin(class_labels, 1 + np.where(sizes < 300)[0])] = 0
        else:  # one piece each: strays re-flood from their neighbours
            seeds[mask & (class_labels != np.argmax(sizes) + 1)] = 0
    seeded = set(np.unique(piece_labels[seeds > 0]).tolist())
    for piece, box in enumerate(ndi.find_objects(piece_labels), start=1):
        if box is None or piece in seeded:
            continue
        ic, kc = (box[0].start + box[0].stop) / 2, (box[2].start + box[2].stop) / 2
        if FLIPPER_K[0] < kc < FLIPPER_K[1] and abs(ic - 256) > 90:
            bone_class = FLIPPER_LEFT if ic < 256 else FLIPPER_RIGHT
        elif kc > 950:
            bone_class = SKULL
        elif abs(ic - 256) > 60 and kc > LAST_RIB_K:
            bone_class = RIBS
        else:
            bone_class = SPINE
        seeds[box][piece_labels[box] == piece] = bone_class
    classes = flood(bone, seeds)
    classes[(classes == SPINE) & (K > OCCIPITAL_K)] = SKULL
    return classes


def flood(bone: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """Each bone voxel takes the class of the nearest seed through bone."""
    low = np.argwhere(bone).min(0)
    high = np.argwhere(bone).max(0) + 1
    box = tuple(slice(a, b) for a, b in zip(low, high))
    classes = np.zeros(bone.shape, np.uint8)
    classes[box] = watershed(np.zeros(bone[box].shape, np.uint8), markers=seeds[box], mask=bone[box], connectivity=1)
    return classes


# --- outputs --------------------------------------------------------------------------------


def write_segmentation(labelmap: np.ndarray, header: dict) -> None:
    out = {
        "type": "unsigned char",
        "dimension": 3,
        "space": "left-posterior-superior",
        "space directions": header["space directions"],
        "space origin": header["space origin"],
        "kinds": ["domain"] * 3,
        "encoding": "gzip",
    }
    written = 0
    for value, structure in enumerate(STRUCTURES, start=1):
        voxels = np.argwhere(labelmap == value)
        if len(voxels) == 0:
            raise ValueError(f"{structure.name} is empty")
        low, high = voxels.min(0), voxels.max(0)
        prefix = f"Segment{written}_"
        out[prefix + "Color"] = " ".join(f"{c:.3f}" for c in structure.color)
        out[prefix + "ColorAutoGenerated"] = "0"
        out[prefix + "Extent"] = f"{low[0]} {high[0]} {low[1]} {high[1]} {low[2]} {high[2]}"
        out[prefix + "ID"] = structure.id
        out[prefix + "LabelValue"] = str(value)
        out[prefix + "Layer"] = "0"
        out[prefix + "Name"] = structure.name
        out[prefix + "NameAutoGenerated"] = "0"
        out[prefix + "Tags"] = f"Segmentation.Status:inprogress|DolphinSystem:{structure.system}|"
        written += 1
    out["Segmentation_ContainedRepresentationNames"] = "Binary labelmap|"
    out["Segmentation_MasterRepresentation"] = "Binary labelmap"
    out["Segmentation_ReferenceImageExtentOffset"] = "0 0 0"
    custom = {key: "string" for key in out if key.startswith("Segment")}
    nrrd.write(str(SEGMENTATION_OUTPUT), labelmap, out, custom_field_map=custom)
    print("wrote", SEGMENTATION_OUTPUT)


def surface(mask: np.ndarray, header: dict, budget: int) -> trimesh.Trimesh:
    try:
        import fast_simplification
    except ImportError as error:
        raise SystemExit("pip install fast-simplification (mesh decimation)") from error
    spacing = np.diag(header["space directions"])
    origin = np.asarray(header["space origin"], dtype=float)
    count = int(mask.sum())
    large = count > 400_000
    step = 3 if count > 3_000_000 else 2 if large else 1
    low = np.maximum(np.argwhere(mask).min(0) - 3, 0)
    high = np.argwhere(mask).max(0) + 4
    crop = mask[low[0] : high[0], low[1] : high[1], low[2] : high[2]].astype(np.float32)
    vertices, faces, _, _ = marching_cubes(ndi.gaussian_filter(crop, 1.0 if large else 0.7), 0.5, step_size=step, allow_degenerate=False)
    mesh = trimesh.Trimesh((vertices + low) * spacing + origin, faces, process=True)
    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=10)
    if len(mesh.faces) > budget:
        vertices, faces = fast_simplification.simplify(
            mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), target_reduction=1 - budget / len(mesh.faces)
        )
        mesh = trimesh.Trimesh(vertices, faces, process=True)
    return mesh


def write_runtime(labelmap: np.ndarray, body: np.ndarray, header: dict) -> None:
    spacing = np.abs(np.diag(header["space directions"]))
    voxel_ml = float(spacing.prod() / 1000)
    scene = trimesh.Scene()
    entries = []
    for value, structure in [(0, BODY_SURFACE), *enumerate(STRUCTURES, start=1)]:
        mask = body if value == 0 else labelmap == value
        mesh = surface(mask, header, FACE_BUDGET.get(structure.id, DEFAULT_FACE_BUDGET))
        mesh.visual = trimesh.visual.TextureVisuals(
            material=trimesh.visual.material.PBRMaterial(
                name=structure.id, baseColorFactor=[*structure.color, 1.0], metallicFactor=0.0, roughnessFactor=0.7
            )
        )
        scene.add_geometry(mesh, node_name=structure.id, geom_name=structure.id)
        entries.append(
            {
                "id": structure.id,
                "name": structure.name,
                "system": structure.system,
                "color": [round(c, 3) for c in structure.color],
                "volumeMl": round(float(mask.sum()) * voxel_ml, 1),
            }
        )
        print(f"{structure.name:34s} {len(mesh.faces):7d} faces")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    glb_path = OUTPUT_DIR / GLB_NAME
    with tempfile.TemporaryDirectory() as scratch:
        raw = Path(scratch) / "organs.raw.glb"
        raw.write_bytes(scene.export(file_type="glb", include_normals=True))
        subprocess.run([node_executable("gltf-pipeline"), "-i", str(raw), "-o", str(glb_path), "-d"], cwd=REPO_ROOT, check=True)
    shape = [int(n) for n in labelmap.shape]
    manifest = {
        "caseId": CASE_ID,
        "modelUrl": f"/dolphin-anatomy/{CASE_ID}/{GLB_NAME}",
        "frame": "Patient LPS millimetres of series 8. The animal lay head-first prone: superior = rostral, posterior = dorsal, anterior = ventral; left and right are the animal's own.",
        "ct": {
            "series": CT_SERIES_NUMBER,
            "description": "DOLPHIN ST 1.25MM",
            "size": shape,
            "spacingMm": [round(float(s), 6) for s in spacing],
            "originLps": [round(float(o), 3) for o in header["space origin"]],
            "coverage": "Bony nares to just behind the dorsal fin; the rostrum, melon and flukes are outside the scan.",
        },
        "structures": entries,
        "source": {
            "script": "scripts/dolphin-anatomy/build-dolphin-organs.py",
            "labelmapSha256": hashlib.sha256(np.ascontiguousarray(labelmap).tobytes()).hexdigest(),
            "note": "Derived from the Local-Data Dolphin_bronch CT; the raw study and the Slicer segmentation stay untracked.",
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    # The commit hook formats JSON with Prettier; format here so a rebuild matches the commit.
    subprocess.run([node_executable("prettier"), "--write", str(MANIFEST_PATH)], cwd=REPO_ROOT, check=True)
    print(f"{glb_path.relative_to(REPO_ROOT)}: {glb_path.stat().st_size / 1e6:.1f} MB")


def node_executable(name: str) -> str:
    local = REPO_ROOT / "node_modules" / ".bin" / name
    if local.exists():
        return str(local)
    executable = shutil.which(name)
    if executable:
        return executable
    raise RuntimeError(f"{name} is required; run npm install first")


if __name__ == "__main__":
    main()
