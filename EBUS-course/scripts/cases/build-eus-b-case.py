"""Build the EUS-B simulator case from the case CT and its Slicer segmentation.

Inputs are read in place from Interventional-Pulm-Local-Data (docs/local-authoring-assets.md):

    raw-assets/eus-b-case-001/ct.nii.gz
    raw-assets/eus-b-case-001/EUS_segmentation.nrrd

Outputs are the runtime files the EUS-B simulator loads, written under
EBUS-course/apps/web/public/simulator/eus-b-case-001/:

    case_manifest.json          structures, landmarks, probe and asset index
    geometry/acoustic.u8.gz     label volume, patient LPS mm, 1 mm isotropic
    geometry/acoustic.json      acoustic-volume/v1 metadata plus per-label media
    geometry/scope_path.json    esophagus-to-stomach scope path, frames and wall table
    geometry/ct.u8.gz           windowed CT crop for the CT correlate pane
    models/eus_b_anatomy.glb    one surface per structure, web frame (x=L, y=S, z=-P), mm

Run with 3D Slicer's bundled Python, which carries numpy, scipy, SimpleITK and VTK:

    /Applications/Slicer.app/Contents/bin/PythonSlicer EBUS-course/scripts/cases/build-eus-b-case.py

Modeling decisions that the learner-facing copy must stay consistent with:

- The scope path is a centered route through the segmented esophagus and proximal stomach. It is
  an authored teaching path, not a recorded scope trajectory.
- The transducer is placed on the wall it faces (wall table), a stand-in for balloon or tip
  contact. Esophageal lumen air in the CT is ignored for that reason.
- Tissue outside the segmentation is classed from CT attenuation into air, fat, soft tissue and
  bone. Unsegmented organs and vessels (spleen, celiac trunk, hepatic veins) are therefore
  generic soft tissue, and the metadata says so.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import struct
import sys
from pathlib import Path

import numpy as np
import SimpleITK as sitk
import vtk
from scipy import interpolate, ndimage as ndi, sparse
from scipy.sparse.csgraph import dijkstra
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from local_data import require_local_data_path  # noqa: E402

CASE_ID = "eus-b-case-001"
ASSET_VERSION = "eus-b-v1"
OUT_DIR = REPO_ROOT / "EBUS-course/apps/web/public/simulator" / CASE_ID

ACOUSTIC_SPACING_MM = 1.0
ROI_MARGIN_MM = 85.0
PATH_STEP_MM = 1.0
STOMACH_REACH_MM = 110.0
WALL_STEP_DEG = 5
WALL_INSET_MM = 2.5
STOMACH_WALL_MM = 3.0
SECTOR_ANGLE_DEG = 60.0
DEFAULT_DEPTH_MM = 50.0
MIN_COMPONENT_VOXELS = 30
CT_SPACING_MM = (1.5, 1.5, 2.0)
CT_WINDOW_HU = (-160.0, 240.0)
# Estimate only: the segmented esophagus begins a short distance below the cricopharyngeus.
INCISOR_OFFSET_MM = 175.0

# (source segment name, key, label, group, medium, color, max triangles)
SEGMENTS = [
    ("liver", "liver", "Liver", "organ", "liver", "#9a5b3f", 14000),
    ("Kidney_left", "left_kidney", "Left kidney", "organ", "kidney", "#b06a4a", 5000),
    ("Kidney_right", "right_kidney", "Right kidney", "organ", "kidney", "#b06a4a", 4000),
    ("pancreas", "pancreas", "Pancreas", "organ", "pancreas", "#e3b071", 5000),
    ("gallbladder", "gallbladder", "Gallbladder", "organ", "fluid", "#4f9d69", 2000),
    ("adrenal_gland_right", "right_adrenal", "Right adrenal gland", "organ", "adrenal", "#f0c24b", 1200),
    ("adrenal_gland_left", "left_adrenal", "Left adrenal gland", "organ", "adrenal", "#f0c24b", 1500),
    ("duodenum", "duodenum", "Duodenum", "gi", "gi_wall", "#cf9f86", 4000),
    ("stomach", "stomach", "Stomach", "gi", "gi_wall", "#d58f8a", 9000),
    ("Left Ventricle", "left_ventricle", "Left ventricle", "heart", "blood", "#c8484a", 6000),
    ("Right Ventricle", "right_ventricle", "Right ventricle", "heart", "blood", "#3d7fc4", 5000),
    ("Right Atrium", "right_atrium", "Right atrium", "heart", "blood", "#3d7fc4", 5000),
    ("Left Atrium", "left_atrium", "Left atrium", "heart", "blood", "#c8484a", 6000),
    ("atrial_appendage_left", "left_atrial_appendage", "Left atrial appendage", "heart", "blood", "#e07a76", 2500),
    ("pulmonary venous system", "pulmonary_veins", "Pulmonary veins", "vessel", "blood", "#e07a76", 5000),
    ("pulmonary artery", "pulmonary_artery", "Pulmonary artery", "vessel", "blood", "#1f5fae", 9000),
    ("aorta", "aorta", "Aorta", "vessel", "blood", "#cf3d3d", 12000),
    ("inferior vena cava", "inferior_vena_cava", "Inferior vena cava", "vessel", "blood", "#2d78c8", 4000),
    ("superior_vena_cava", "superior_vena_cava", "Superior vena cava", "vessel", "blood", "#2d78c8", 3000),
    ("azygous", "azygos_vein", "Azygos vein", "vessel", "blood", "#2d78c8", 2500),
    ("portal_vein_and_splenic_vein", "portal_splenic_vein", "Portal and splenic veins", "vessel", "blood", "#5a6fd0", 3500),
    ("brachiocephalic trunk", "brachiocephalic_trunk", "Brachiocephalic trunk", "vessel", "blood", "#cf3d3d", 1500),
    ("right subclavian artery", "right_subclavian_artery", "Right subclavian artery", "vessel", "blood", "#cf3d3d", 2000),
    ("left subclavian artery", "left_subclavian_artery", "Left subclavian artery", "vessel", "blood", "#cf3d3d", 2000),
    ("right common carotid artery", "right_common_carotid_artery", "Right common carotid artery", "vessel", "blood", "#cf3d3d", 1500),
    ("left common carotid artery", "left_common_carotid_artery", "Left common carotid artery", "vessel", "blood", "#cf3d3d", 1500),
    ("left brachiocephalic vein", "left_brachiocephalic_vein", "Left brachiocephalic vein", "vessel", "blood", "#2d78c8", 2500),
    ("right brachiocephalic vein", "right_brachiocephalic_vein", "Right brachiocephalic vein", "vessel", "blood", "#2d78c8", 2000),
    ("esophagus", "esophagus", "Esophagus", "gi", "gi_wall", "#c9a36c", 6000),
    ("Station 1R", "station_1r", "Station 1R", "node", "node", "#8fca6b", 400),
    ("Station 1L", "station_1l", "Station 1L", "node", "node", "#8fca6b", 400),
    ("Station 2R", "station_2r", "Station 2R", "node", "node", "#8fca6b", 500),
    ("Station 2L", "station_2l", "Station 2L", "node", "node", "#8fca6b", 400),
    ("Station 3A", "station_3a", "Station 3A", "node", "node", "#8fca6b", 900),
    ("Station 4R", "station_4r", "Station 4R", "node", "node", "#8fca6b", 1200),
    ("Station 4L", "station_4l", "Station 4L", "node", "node", "#8fca6b", 1200),
    ("Station 5", "station_5", "Station 5", "node", "node", "#8fca6b", 600),
    ("Staion 6", "station_6", "Station 6", "node", "node", "#8fca6b", 600),
    ("Station 7", "station_7", "Station 7", "node", "node", "#8fca6b", 1400),
    ("Station 8", "station_8", "Station 8", "node", "node", "#8fca6b", 500),
    ("Station 9", "station_9", "Station 9", "node", "node", "#8fca6b", 400),
    ("Station 10R", "station_10r", "Station 10R", "node", "node", "#8fca6b", 700),
    ("Station 10L", "station_10l", "Station 10L", "node", "node", "#8fca6b", 300),
    ("Station 11Rs", "station_11rs", "Station 11Rs", "node", "node", "#8fca6b", 500),
    ("Station 11Ri", "station_11ri", "Station 11Ri", "node", "node", "#8fca6b", 300),
    ("Station 11L", "station_11l", "Station 11L", "node", "node", "#8fca6b", 300),
    # Painted last so no overlapping mask can fill the airway lumen.
    ("airway", "airway", "Airway", "airway", "air", "#27c4c6", 9000),
]

# Structures a landmark view is calibrated for. Each is searched over the whole path.
LANDMARK_TARGETS = [
    "station_2l", "station_4l", "station_5", "station_6", "station_7", "station_8", "station_9",
    "aorta", "pulmonary_artery", "left_atrium", "azygos_vein",
    "left_adrenal", "left_kidney", "liver", "pancreas", "portal_splenic_vein",
]

# Shared-renderer kind for each medium, so generic acoustic-volume tooling still reads the file.
MEDIUM_KIND = {
    "air": "air", "soft": "soft", "fat": "soft", "bone": "wall", "blood": "blood", "fluid": "blood",
    "node": "node", "gi_wall": "wall", "liver": "soft", "kidney": "soft", "adrenal": "node",
    "pancreas": "soft",
}
BLOCKING_MEDIA = {"air", "bone"}
# Targets whose teaching view belongs to one part of the path: (start, end) in mm past the
# gastroesophageal junction. The left lobe of the liver is the view just beyond the cardia.
LANDMARK_WINDOW_PAST_GEJ_MM = {"liver": (5.0, 50.0)}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_segmentation(path: Path):
    image = sitk.ReadImage(str(path))
    layers = sitk.GetArrayFromImage(image)  # z, y, x, layer
    if layers.ndim == 3:
        layers = layers[..., None]
    segments: dict[int, dict[str, str]] = {}
    for key in image.GetMetaDataKeys():
        match = re.match(r"Segment(\d+)_(\w+)", key)
        if match:
            segments.setdefault(int(match.group(1)), {})[match.group(2)] = image.GetMetaData(key)
    by_name = {}
    for segment in segments.values():
        by_name[segment["Name"]] = (int(segment["Layer"]), int(segment["LabelValue"]))
    return image, layers, by_name


def clean_mask(mask: np.ndarray) -> np.ndarray:
    """Drop stray islands; multi-node stations keep every real component."""
    labels, count = ndi.label(mask, structure=np.ones((3, 3, 3)))
    if count <= 1:
        return mask
    sizes = np.bincount(labels.ravel())
    keep = np.flatnonzero(sizes >= MIN_COMPONENT_VOXELS)
    keep = keep[keep != 0]
    return np.isin(labels, keep)


class Grid:
    """Axis-aligned LPS grid. Arrays are indexed z, y, x like SimpleITK."""

    def __init__(self, origin, spacing, size):
        self.origin = np.asarray(origin, dtype=float)
        self.spacing = np.asarray(spacing, dtype=float)
        self.size = np.asarray(size, dtype=int)

    @property
    def shape(self):
        return tuple(int(v) for v in self.size[::-1])

    def index(self, lps):
        return (np.asarray(lps, dtype=float) - self.origin) / self.spacing


def bbox(mask: np.ndarray, pad: int):
    idx = np.argwhere(mask)
    lo = np.maximum(idx.min(axis=0) - pad, 0)
    hi = np.minimum(idx.max(axis=0) + pad + 1, mask.shape)
    return tuple(slice(int(a), int(b)) for a, b in zip(lo, hi))


def resample_mask(mask: np.ndarray, source: Grid, target: Grid):
    """Shape-preserving resample of a binary mask onto the target grid.

    Returns (slices into the target array, boolean sub-array) or None when the mask lies outside.
    """
    if not mask.any():
        return None
    crop = bbox(mask, 8)
    sub = mask[crop].astype(np.float32)
    crop_origin = source.origin + np.array([crop[2].start, crop[1].start, crop[0].start]) * source.spacing
    crop_max = crop_origin + (np.array(sub.shape[::-1]) - 1) * source.spacing
    lo = np.maximum(np.floor(target.index(crop_origin)).astype(int), 0)
    hi = np.minimum(np.ceil(target.index(crop_max)).astype(int), target.size - 1)
    if np.any(hi < lo):
        return None
    image = sitk.GetImageFromArray(sub)
    image.SetSpacing([float(v) for v in source.spacing])
    image.SetOrigin([float(v) for v in crop_origin])
    image = sitk.SmoothingRecursiveGaussian(image, [0.6, 0.6, 1.0])
    out = sitk.Resample(
        image,
        [int(v) for v in (hi - lo + 1)],
        sitk.Transform(),
        sitk.sitkLinear,
        [float(v) for v in target.origin + lo * target.spacing],
        [float(v) for v in target.spacing],
        [1, 0, 0, 0, 1, 0, 0, 0, 1],
        0.0,
        sitk.sitkFloat32,
    )
    slices = (slice(lo[2], hi[2] + 1), slice(lo[1], hi[1] + 1), slice(lo[0], hi[0] + 1))
    return slices, sitk.GetArrayFromImage(out) > 0.5


def full_mask(resampled, shape) -> np.ndarray:
    out = np.zeros(shape, dtype=bool)
    if resampled is not None:
        slices, sub = resampled
        out[slices] = sub
    return out


def resample_ct(ct: sitk.Image, target: Grid, sigma_mm: float) -> np.ndarray:
    smoothed = sitk.SmoothingRecursiveGaussian(sitk.Cast(ct, sitk.sitkFloat32), sigma_mm) if sigma_mm else ct
    out = sitk.Resample(
        smoothed,
        [int(v) for v in target.size],
        sitk.Transform(),
        sitk.sitkLinear,
        [float(v) for v in target.origin],
        [float(v) for v in target.spacing],
        [1, 0, 0, 0, 1, 0, 0, 0, 1],
        -1024.0,
        sitk.sitkFloat32,
    )
    return sitk.GetArrayFromImage(out)


def body_mask(ct_array: np.ndarray) -> np.ndarray:
    """The patient, without the scanner table: the largest soft-tissue component, holes filled."""
    coarse = ndi.binary_opening(ct_array[:, ::2, ::2] > -300, structure=np.ones((1, 3, 3)))
    labels, count = ndi.label(coarse)
    if not count:
        return np.ones(ct_array.shape, dtype=bool)
    body = labels == (np.argmax(np.bincount(labels.ravel())[1:]) + 1)
    for z in range(body.shape[0]):
        body[z] = ndi.binary_fill_holes(body[z])
    full = np.repeat(np.repeat(body, 2, axis=1), 2, axis=2)
    return full[:, : ct_array.shape[1], : ct_array.shape[2]]


def bone_mask(ct_array: np.ndarray, segmented: np.ndarray) -> np.ndarray:
    """Cortical-threshold bone at source resolution, closed so vertebral bodies are solid."""
    dense = (ndi.gaussian_filter(ct_array.astype(np.float32), (0.4, 1.0, 1.0)) > 250) & ~segmented
    dense &= body_mask(ct_array)
    labels, count = ndi.label(dense)
    if not count:
        return dense
    sizes = np.bincount(labels.ravel())
    keep = np.flatnonzero(sizes >= 2500)
    keep = keep[keep != 0]
    bone = np.isin(labels, keep)
    disk = np.zeros((1, 7, 7), dtype=bool)
    yy, xx = np.mgrid[-3:4, -3:4]
    disk[0] = yy * yy + xx * xx <= 9
    bone = ndi.binary_closing(bone, structure=disk)
    for z in range(bone.shape[0]):
        if bone[z].any():
            bone[z] = ndi.binary_fill_holes(bone[z])
    return bone & ~segmented


# --------------------------------------------------------------------------------------------
# Scope path
# --------------------------------------------------------------------------------------------

def centered_route(lumen: np.ndarray, esophagus: np.ndarray, stomach: np.ndarray, grid: Grid):
    """Distance-weighted shortest path from the top of the esophagus into the stomach."""
    distance = ndi.distance_transform_edt(lumen, sampling=grid.spacing[::-1])
    voxels = np.argwhere(lumen)
    node = -np.ones(lumen.shape, dtype=np.int64)
    node[lumen] = np.arange(len(voxels))
    cost = 1.0 / (distance + 0.5) ** 2
    rows, cols, weights = [], [], []
    for dz in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if (dz, dy, dx) <= (0, 0, 0):
                    continue
                a = voxels
                b = voxels + np.array([dz, dy, dx])
                inside = np.all((b >= 0) & (b < np.array(lumen.shape)), axis=1)
                a, b = a[inside], b[inside]
                neighbor = node[b[:, 0], b[:, 1], b[:, 2]]
                linked = neighbor >= 0
                a, b, neighbor = a[linked], b[linked], neighbor[linked]
                step = float(np.linalg.norm(np.array([dz, dy, dx]) * grid.spacing[::-1]))
                rows.append(node[a[:, 0], a[:, 1], a[:, 2]])
                cols.append(neighbor)
                weights.append(step * 0.5 * (cost[a[:, 0], a[:, 1], a[:, 2]] + cost[b[:, 0], b[:, 1], b[:, 2]]))
    graph = sparse.csr_matrix(
        (np.concatenate(weights), (np.concatenate(rows), np.concatenate(cols))),
        shape=(len(voxels), len(voxels)),
    )
    top = int(np.argwhere(esophagus)[:, 0].max())
    candidates = np.argwhere(lumen[top])
    start = candidates[np.argmax(distance[top][candidates[:, 0], candidates[:, 1]])]
    source = node[top, start[0], start[1]]
    reach, previous = dijkstra(graph, directed=False, indices=source, return_predecessors=True)
    deep = np.argwhere(stomach & (distance >= 5))
    deep_nodes = node[deep[:, 0], deep[:, 1], deep[:, 2]]
    target = int(deep_nodes[np.argmax(np.where(np.isfinite(reach[deep_nodes]), reach[deep_nodes], -1))])
    route = []
    while target != source and target >= 0:
        route.append(target)
        target = int(previous[target])
    route.append(int(source))
    index = voxels[route[::-1]]
    return grid.origin + index[:, ::-1] * grid.spacing, distance


def smooth_path(raw_lps: np.ndarray, step_mm: float) -> np.ndarray:
    keep = np.r_[True, np.linalg.norm(np.diff(raw_lps, axis=0), axis=1) > 1e-6]
    points = raw_lps[keep]
    # ~2 mm RMS tolerance removes voxel stair-steps without leaving the lumen.
    spline, _ = interpolate.splprep(points.T, s=len(points) * 4.0, k=3)
    dense = np.array(interpolate.splev(np.linspace(0, 1, len(points) * 8), spline)).T
    lengths = np.r_[0, np.cumsum(np.linalg.norm(np.diff(dense, axis=0), axis=1))]
    samples = np.arange(0, lengths[-1], step_mm)
    return np.stack([np.interp(samples, lengths, dense[:, axis]) for axis in range(3)], axis=1)


def split_level(mask: np.ndarray):
    """Highest axial slice where the structure appears as two sizeable cross-sections."""
    occupied = np.flatnonzero(mask.any(axis=(1, 2)))
    for z in occupied[::-1]:
        labels, count = ndi.label(mask[z])
        if count >= 2 and (np.bincount(labels.ravel())[1:] >= 30).sum() >= 2:
            return int(z)
    return int(occupied[0])


def path_levels(points, gej_s, total, masks, source: Grid):
    """Named stretches of the path, bounded by this patient's own anatomy.

    An authored orientation scaffold: each boundary is where the path passes a landmark's
    superior-inferior level in the segmentation.
    """
    def level_s(z_index):
        target = source.origin[2] + z_index * source.spacing[2]
        esophageal = points[: int(gej_s / PATH_STEP_MM) + 1, 2]
        below = np.flatnonzero(esophageal <= target)
        return float(below[0] * PATH_STEP_MM) if len(below) else float(gej_s)

    aorta_top = int(np.flatnonzero(masks["aorta"].any(axis=(1, 2))).max())
    atrium = np.flatnonzero(masks["left_atrium"].any(axis=(1, 2)))
    bounds = [
        ("above_arch", "Above the aortic arch", 0.0),
        ("aortic_arch", "Aortic arch", level_s(aorta_top)),
        ("arch_to_carina", "Below the arch, above the carina", level_s(split_level(masks["aorta"]))),
        ("subcarinal", "Subcarinal", level_s(split_level(masks["airway"]))),
        ("left_atrium", "Behind the left atrium", level_s(int(atrium.max()))),
        ("lower_esophagus", "Lower esophagus", level_s(int(atrium.min()))),
        ("stomach", "Proximal stomach", float(gej_s)),
    ]
    # Boundaries must not run backward: in this patient the carina sits just above the level
    # where the arch separates, so that stretch collapses and is dropped.
    starts = np.maximum.accumulate([start for _, _, start in bounds])
    bounds = [(key, label, float(start)) for (key, label, _), start in zip(bounds, starts)]
    levels = []
    for index, (key, label, start) in enumerate(bounds):
        end = bounds[index + 1][2] if index + 1 < len(bounds) else float(total)
        if end > start:
            levels.append({"key": key, "label": label, "fromSMm": round(start, 1), "toSMm": round(end, 1)})
    return levels


def unit(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def path_frames(points: np.ndarray):
    """Tangents and a parallel-transported reference axis that starts facing anterior."""
    smooth = ndi.gaussian_filter1d(points, 4.0, axis=0, mode="nearest")
    tangents = unit(np.gradient(smooth, axis=0))
    anterior = np.array([0.0, -1.0, 0.0])
    ref = np.zeros_like(points)
    ref[0] = unit(anterior - tangents[0] * np.dot(anterior, tangents[0]))
    for i in range(1, len(points)):
        a, b = tangents[i - 1], tangents[i]
        axis = np.cross(a, b)
        sin = np.linalg.norm(axis)
        cos = float(np.clip(np.dot(a, b), -1, 1))
        v = ref[i - 1]
        if sin > 1e-9:
            k = axis / sin
            angle = np.arctan2(sin, cos)
            v = v * np.cos(angle) + np.cross(k, v) * np.sin(angle) + k * np.dot(k, v) * (1 - np.cos(angle))
        ref[i] = unit(v - b * np.dot(v, b))
    return tangents, ref


def sample_labels(volume: np.ndarray, grid: Grid, lps: np.ndarray) -> np.ndarray:
    idx = np.rint((lps - grid.origin) / grid.spacing).astype(int)
    inside = np.all((idx >= 0) & (idx < grid.size), axis=-1)
    out = np.zeros(lps.shape[:-1], dtype=volume.dtype)
    hit = idx[inside]
    out[inside] = volume[hit[:, 2], hit[:, 1], hit[:, 0]]
    return out


def roll_direction(tangent, ref, roll_deg):
    """Positive roll is clockwise seen from the operator, looking along the insertion direction."""
    angle = np.deg2rad(roll_deg)
    return ref * np.cos(angle)[..., None] + np.cross(tangent, ref) * np.sin(angle)[..., None]


def wall_table(points, tangents, ref, lumen: np.ndarray, grid: Grid):
    """Distance from the path to the transducer contact point, per path sample and roll angle."""
    angles = np.arange(0, 360, WALL_STEP_DEG)
    steps = np.arange(0.0, 60.0, 0.5)
    table = np.zeros((len(points), len(angles)), dtype=np.float32)
    exits = np.zeros_like(table)
    for i, (p, t, r) in enumerate(zip(points, tangents, ref)):
        directions = roll_direction(t, r, angles)  # A, 3
        samples = p + directions[:, None, :] * steps[None, :, None]
        inside = sample_labels(lumen.astype(np.uint8), grid, samples) > 0
        # First sample where the lumen has ended for two consecutive steps.
        outside = ~inside & ~np.roll(inside, -1, axis=1)
        outside[:, -1] = True
        exit_index = np.argmax(outside, axis=1)
        exits[i] = steps[exit_index]
    contact = np.maximum(exits - WALL_INSET_MM, 0.0)
    smoothed = ndi.gaussian_filter(contact, (3.0, 2.0), mode=("nearest", "wrap"))
    table = np.minimum(smoothed, np.maximum(exits - 0.5, 0.0))
    return angles, table


def contact_mm(table, s_index, roll_deg):
    position = (np.asarray(roll_deg) % 360) / WALL_STEP_DEG
    lower = np.floor(position).astype(int) % table.shape[1]
    upper = (lower + 1) % table.shape[1]
    f = position - np.floor(position)
    return table[s_index, lower] * (1 - f) + table[s_index, upper] * f


# --------------------------------------------------------------------------------------------
# Landmark calibration
# --------------------------------------------------------------------------------------------

def fan_scores(volume, grid, blocking, label_count, origin, depth, lateral):
    """Acoustically reachable sample weight per label for a batch of fans.

    origin / depth / lateral: (B, 3). Returns (B, label_count).
    """
    beams = np.deg2rad(np.linspace(-SECTOR_ANGLE_DEG / 2, SECTOR_ANGLE_DEG / 2, 41))
    radii = np.arange(1.0, 71.0, 1.0)
    direction = depth[:, None, :] * np.cos(beams)[None, :, None] + lateral[:, None, :] * np.sin(beams)[None, :, None]
    points = origin[:, None, None, :] + direction[:, :, None, :] * radii[None, None, :, None]
    labels = sample_labels(volume, grid, points)
    blocked = np.maximum.accumulate(blocking[labels], axis=2)
    weight = np.clip(1.0 - (radii - 45.0) / 36.0, 0.3, 1.0)[None, None, :] * (np.cos(beams * 1.5) ** 2)[None, :, None]
    weight = np.where(blocked, 0.0, weight)
    scores = np.zeros((len(origin), label_count))
    for b in range(len(origin)):
        scores[b] = np.bincount(labels[b].ravel(), weights=weight[b].ravel(), minlength=label_count)[:label_count]
    return scores


def pose_axes(points, tangents, ref, table, s_mm, roll_deg):
    s_index = np.clip(np.rint(np.asarray(s_mm) / PATH_STEP_MM).astype(int), 0, len(points) - 1)
    roll = np.asarray(roll_deg, dtype=float)
    depth = unit(roll_direction(tangents[s_index], ref[s_index], roll))
    origin = points[s_index] + depth * contact_mm(table, s_index, roll)[..., None]
    lateral = -tangents[s_index]
    return origin, depth, lateral


def calibrate_landmarks(volume, grid, labels, points, tangents, ref, table, gej_s):
    blocking = np.array([label["medium"] in BLOCKING_MEDIA for label in labels])
    ids = {label["key"]: label["id"] for label in labels}
    total = (len(points) - 1) * PATH_STEP_MM
    coarse_s = np.arange(0.0, total, 2.0)
    coarse_roll = np.arange(-180.0, 180.0, 6.0)
    grid_s, grid_roll = np.meshgrid(coarse_s, coarse_roll, indexing="ij")
    flat_s, flat_roll = grid_s.ravel(), grid_roll.ravel()
    scores = np.zeros((len(flat_s), len(labels)))
    for start in range(0, len(flat_s), 600):
        chunk = slice(start, start + 600)
        scores[chunk] = fan_scores(volume, grid, blocking, len(labels),
                                   *pose_axes(points, tangents, ref, table, flat_s[chunk], flat_roll[chunk]))
    landmarks = []
    for key in LANDMARK_TARGETS:
        label_id = ids[key]
        column = scores[:, label_id]
        window = LANDMARK_WINDOW_PAST_GEJ_MM.get(key)
        if window:
            column = np.where((flat_s >= gej_s + window[0]) & (flat_s <= gej_s + window[1]), column, -1.0)
        best = int(np.argmax(column))
        if scores[best, label_id] <= 0:
            print(f"  landmark {key}: no acoustic window on this path")
            continue
        low, high = (gej_s + window[0], gej_s + window[1]) if window else (0, total)
        fine_s = np.clip(np.arange(flat_s[best] - 3, flat_s[best] + 3.01, 1.0), low, min(high, total))
        fine_roll = np.arange(flat_roll[best] - 8, flat_roll[best] + 8.01, 1.0)
        fs, fr = [v.ravel() for v in np.meshgrid(fine_s, fine_roll, indexing="ij")]
        fine = fan_scores(volume, grid, blocking, len(labels), *pose_axes(points, tangents, ref, table, fs, fr))
        pick = int(np.argmax(fine[:, label_id]))
        s_mm, roll_deg = float(fs[pick]), float(((fr[pick] + 180) % 360) - 180)
        origin, depth, lateral = pose_axes(points, tangents, ref, table, np.array([s_mm]), np.array([roll_deg]))
        view = fine[pick]
        seen = [labels[i]["key"] for i in np.argsort(-view) if view[i] >= 8 and labels[i]["reportable"]]
        landmarks.append({
            "key": key,
            "sMm": round(s_mm, 1),
            "rollDeg": round(roll_deg, 1),
            "flexDeg": 0,
            "score": round(float(view[label_id]), 1),
            "inView": seen[:8],
            "expectedPose": {
                "originLps": [round(float(v), 3) for v in origin[0]],
                "depthAxisLps": [round(float(v), 5) for v in depth[0]],
                "lateralAxisLps": [round(float(v), 5) for v in lateral[0]],
            },
        })
        print(f"  landmark {key:22s} s={s_mm:6.1f} roll={roll_deg:7.1f} score={view[label_id]:7.1f} sees {seen[:5]}")
    return landmarks


# --------------------------------------------------------------------------------------------
# Surfaces
# --------------------------------------------------------------------------------------------

def surface(mask: np.ndarray, source: Grid, max_triangles: int):
    """Smoothed, decimated surface in LPS mm for one structure."""
    crop = bbox(mask, 3)
    sub = np.ascontiguousarray(mask[crop].astype(np.float32))
    image = vtk.vtkImageData()
    image.SetDimensions(sub.shape[2], sub.shape[1], sub.shape[0])
    image.SetSpacing(*source.spacing)
    image.SetOrigin(*(source.origin + np.array([crop[2].start, crop[1].start, crop[0].start]) * source.spacing))
    image.GetPointData().SetScalars(numpy_to_vtk(sub.ravel(), deep=True))
    # Large organs get a wider kernel: 2 mm slices leave terraces on their near-horizontal
    # surfaces that the small kernel suited to lymph nodes cannot remove.
    large = int(mask.sum()) > 20000
    blur = vtk.vtkImageGaussianSmooth()
    blur.SetInputData(image)
    blur.SetStandardDeviations(*((1.6, 1.6, 1.1) if large else (1.0, 1.0, 0.6)))
    blur.SetRadiusFactors(2.5, 2.5, 2.5)
    contour = vtk.vtkFlyingEdges3D()
    contour.SetInputConnection(blur.GetOutputPort())
    contour.SetValue(0, 0.5)
    contour.ComputeNormalsOff()
    smooth = vtk.vtkWindowedSincPolyDataFilter()
    smooth.SetInputConnection(contour.GetOutputPort())
    smooth.SetNumberOfIterations(45 if large else 25)
    smooth.SetPassBand(0.015 if large else 0.06)
    smooth.BoundarySmoothingOff()
    smooth.NormalizeCoordinatesOn()
    smooth.Update()
    poly = smooth.GetOutput()
    triangles = poly.GetNumberOfPolys()
    if triangles == 0:
        return None
    if triangles > max_triangles:
        decimate = vtk.vtkQuadricDecimation()
        decimate.SetInputData(poly)
        decimate.SetTargetReduction(1.0 - max_triangles / triangles)
        decimate.VolumePreservationOn()
        decimate.Update()
        poly = decimate.GetOutput()
    clean = vtk.vtkCleanPolyData()
    clean.SetInputData(poly)
    clean.Update()
    poly = clean.GetOutput()
    positions = vtk_to_numpy(poly.GetPoints().GetData()).astype(np.float64)
    faces = vtk_to_numpy(poly.GetPolys().GetConnectivityArray()).reshape(-1, 3).astype(np.uint32)
    return positions, faces


def lps_to_web(points: np.ndarray) -> np.ndarray:
    """web [x, y, z] = patient [L, S, -P]; a proper rotation, so winding is preserved."""
    return np.stack([points[:, 0], points[:, 2], -points[:, 1]], axis=1)


def hex_rgb(color: str):
    return [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def write_glb(path: Path, meshes) -> bytes:
    """Minimal binary glTF: one node, mesh and flat material per structure."""
    binary = bytearray()
    views, accessors, gltf_meshes, materials, nodes = [], [], [], [], []

    def push(data: bytes, target: int) -> int:
        while len(binary) % 4:
            binary.append(0)
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data), "target": target})
        binary.extend(data)
        return len(views) - 1

    for mesh in meshes:
        positions = mesh["positions"].astype("<f4")
        faces = mesh["faces"]
        small = len(positions) < 65535
        index_data = faces.astype("<u2" if small else "<u4")
        position_view = push(positions.tobytes(), 34962)
        accessors.append({"bufferView": position_view, "componentType": 5126, "count": len(positions), "type": "VEC3",
                          "min": positions.min(axis=0).tolist(), "max": positions.max(axis=0).tolist()})
        index_view = push(index_data.tobytes(), 34963)
        accessors.append({"bufferView": index_view, "componentType": 5123 if small else 5125,
                          "count": int(faces.size), "type": "SCALAR"})
        materials.append({"name": mesh["key"], "doubleSided": True,
                          "pbrMetallicRoughness": {"baseColorFactor": hex_rgb(mesh["color"]) + [1.0],
                                                   "metallicFactor": 0.0, "roughnessFactor": 0.75}})
        gltf_meshes.append({"name": mesh["key"], "primitives": [{
            "attributes": {"POSITION": len(accessors) - 2}, "indices": len(accessors) - 1,
            "material": len(materials) - 1, "mode": 4}]})
        nodes.append({"name": mesh["key"], "mesh": len(gltf_meshes) - 1})
    while len(binary) % 4:
        binary.append(0)
    document = {
        "asset": {"version": "2.0", "generator": "build-eus-b-case.py"},
        "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes, "meshes": gltf_meshes, "materials": materials,
        "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(binary)}],
    }
    text = json.dumps(document, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    glb = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(text) + 8 + len(binary))
    glb += struct.pack("<I4s", len(text), b"JSON") + text
    glb += struct.pack("<I4s", len(binary), b"BIN\x00") + bytes(binary)
    path.write_bytes(glb)
    return glb


# --------------------------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ct", type=Path, default=None)
    parser.add_argument("--segmentation", type=Path, default=None)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    ct_path = args.ct or require_local_data_path("raw-assets", CASE_ID, "ct.nii.gz")
    seg_path = args.segmentation or require_local_data_path("raw-assets", CASE_ID, "EUS_segmentation.nrrd")
    out_dir = args.out_dir.resolve()
    (out_dir / "geometry").mkdir(parents=True, exist_ok=True)
    (out_dir / "models").mkdir(parents=True, exist_ok=True)

    print("Reading inputs…")
    seg_image, layers, by_name = read_segmentation(seg_path)
    ct_image = sitk.ReadImage(str(ct_path))
    if ct_image.GetSize() != seg_image.GetSize() or not np.allclose(ct_image.GetOrigin(), seg_image.GetOrigin()):
        raise ValueError("CT and segmentation are not on the same grid")
    if not np.allclose(seg_image.GetDirection(), np.eye(3).ravel()):
        raise ValueError("Expected an axis-aligned LPS volume")
    source = Grid(seg_image.GetOrigin(), seg_image.GetSpacing(), seg_image.GetSize())
    source_hash = sha256(seg_path.read_bytes() + ct_path.read_bytes())

    masks = {}
    for name, key, *_ in SEGMENTS:
        if name not in by_name:
            raise KeyError(f"Segment '{name}' is missing from {seg_path.name}")
        layer, value = by_name[name]
        masks[key] = clean_mask(layers[..., layer] == value)
    unused = sorted(set(by_name) - {row[0] for row in SEGMENTS})
    if unused:
        print(f"  segments not used: {unused}")

    # ---- Scope path on a provisional grid covering the esophagus and stomach ----------------
    print("Tracing scope path…")
    gi = masks["esophagus"] | masks["stomach"]
    gi_idx = np.argwhere(gi)
    gi_lo = source.origin + gi_idx.min(axis=0)[::-1] * source.spacing - 6
    gi_hi = source.origin + gi_idx.max(axis=0)[::-1] * source.spacing + 6
    path_grid = Grid(np.floor(gi_lo), [1.0, 1.0, 1.0], np.ceil(gi_hi - np.floor(gi_lo)).astype(int) + 1)
    esophagus = full_mask(resample_mask(masks["esophagus"], source, path_grid), path_grid.shape)
    stomach = full_mask(resample_mask(masks["stomach"], source, path_grid), path_grid.shape)
    lumen = esophagus | stomach
    connected = ndi.binary_dilation(lumen)
    raw_route, distance = centered_route(connected, esophagus, stomach, path_grid)
    smoothed = smooth_path(raw_route, PATH_STEP_MM)
    in_esophagus = sample_labels(esophagus.astype(np.uint8), path_grid, smoothed) > 0
    clearance = ndi.map_coordinates(distance, ((smoothed - path_grid.origin) / path_grid.spacing)[:, ::-1].T, order=1)
    first = int(np.argmax(clearance >= 4.0))
    gej_index = int(np.flatnonzero(in_esophagus).max())
    last = min(len(smoothed) - 1, gej_index + int(STOMACH_REACH_MM / PATH_STEP_MM))
    points = smoothed[first:last + 1]
    gej_s = (gej_index - first) * PATH_STEP_MM
    tangents, ref = path_frames(points)
    total_length = (len(points) - 1) * PATH_STEP_MM
    print(f"  path {total_length:.0f} mm, gastroesophageal junction at {gej_s:.0f} mm")
    wall_angles, table = wall_table(points, tangents, ref, lumen, path_grid)

    # ---- Acoustic label volume ---------------------------------------------------------------
    print("Building acoustic volume…")
    ct_max = source.origin + (source.size - 1) * source.spacing
    roi_lo = np.maximum(np.floor(points.min(axis=0) - ROI_MARGIN_MM), np.ceil(source.origin))
    roi_hi = np.minimum(np.ceil(points.max(axis=0) + ROI_MARGIN_MM), np.floor(ct_max))
    grid = Grid(roi_lo, [ACOUSTIC_SPACING_MM] * 3, np.floor((roi_hi - roi_lo) / ACOUSTIC_SPACING_MM).astype(int) + 1)
    ct_array = sitk.GetArrayFromImage(ct_image)
    ct_iso = resample_ct(ct_image, grid, 1.0)

    labels = [
        {"id": 0, "key": "air", "label": "Air (lung or outside the body)", "kind": "air", "medium": "air", "group": "background", "reportable": False},
        {"id": 1, "key": "soft_tissue", "label": "Soft tissue (not segmented)", "kind": "soft", "medium": "soft", "group": "background", "reportable": False},
        {"id": 2, "key": "airway", "label": "Airway lumen", "kind": "air", "medium": "air", "group": "airway", "reportable": False},
        {"id": 3, "key": "fat", "label": "Fat (not segmented)", "kind": "soft", "medium": "fat", "group": "background", "reportable": False},
        {"id": 4, "key": "bone", "label": "Bone (CT threshold)", "kind": "wall", "medium": "bone", "group": "background", "reportable": False},
    ]
    volume = np.ones(grid.shape, dtype=np.uint8)
    volume[ct_iso < -20] = 3
    volume[ct_iso < -400] = 0
    any_segment = np.zeros(layers.shape[:3], dtype=bool)
    for mask in masks.values():
        any_segment |= mask
    bone_source = bone_mask(ct_array, any_segment)
    bone = resample_mask(bone_source, source, grid)
    if bone is not None:
        volume[bone[0]][bone[1]] = 4

    structures = []
    review = []
    for name, key, label, group, medium, color, max_triangles in SEGMENTS:
        resampled = resample_mask(masks[key], source, grid)
        volume_ml = float(masks[key].sum() * np.prod(source.spacing) / 1000)
        entry = {"key": key, "label": label, "group": group, "medium": medium, "color": color,
                 "volumeMl": round(volume_ml, 1), "sourceSegment": name}
        if key == "airway":
            label_id = 2
        else:
            label_id = len(labels)
            labels.append({"id": label_id, "key": key, "label": label, "kind": MEDIUM_KIND[medium], "medium": medium,
                           "group": group, "reportable": True})
        entry["labelId"] = label_id
        occupied = 0
        if resampled is not None:
            slices, sub = resampled
            if key == "stomach":
                # Wall shell plus contents: gas where the CT shows gas, otherwise fluid.
                inner = ndi.distance_transform_edt(np.pad(sub, 1))[1:-1, 1:-1, 1:-1] > STOMACH_WALL_MM
                gas = inner & (ct_iso[slices] < -300)
                contents_id, gas_id = len(labels), len(labels) + 1
                labels.append({"id": contents_id, "key": "gastric_contents", "label": "Gastric contents", "kind": "blood",
                               "medium": "fluid", "group": "gi", "reportable": False})
                labels.append({"id": gas_id, "key": "gastric_gas", "label": "Gastric gas", "kind": "air",
                               "medium": "air", "group": "gi", "reportable": False})
                region = volume[slices]
                region[sub] = label_id
                region[inner] = contents_id
                region[gas] = gas_id
            else:
                volume[slices][sub] = label_id
            occupied = int(sub.sum())
        review.append({"key": key, "sourceVoxels": int(masks[key].sum()), "occupiedVoxels": occupied})
        structures.append((entry, max_triangles))
    if len(labels) > 255:
        raise ValueError("Too many labels for a uint8 volume")

    raw = volume.tobytes()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    (out_dir / "geometry/acoustic.u8.gz").write_bytes(packed)
    acoustic_meta = {
        "schema": "acoustic-volume/v1", "assetVersion": ASSET_VERSION, "coordinateSystem": "LPS", "units": "mm",
        "sourceGeometrySha256": source_hash, "dataSha256": sha256(packed), "decodedSha256": sha256(raw),
        "format": "uint8-labels-gzip", "sizeXyz": [int(v) for v in grid.size],
        "spacingXyzMm": [ACOUSTIC_SPACING_MM] * 3, "originLps": [float(v) for v in grid.origin],
        "labels": labels, "review": review,
        "assumptions": [
            "Tissue outside the segmentation is classed from CT attenuation into air, fat, soft tissue and bone.",
            "Unsegmented organs and vessels are generic soft tissue.",
            "The esophagus is solid wall tissue: lumen air in the CT is ignored because the scope occupies the lumen.",
            "The stomach is a wall shell with CT-classed gas or fluid contents.",
            "Where masks overlap, the later structure in the build order wins and the airway lumen wins last.",
        ],
    }
    (out_dir / "geometry/acoustic.json").write_text(json.dumps(acoustic_meta, indent=2) + "\n")
    print(f"  acoustic volume {grid.size.tolist()} voxels, {len(packed) / 1e6:.2f} MB gzip, {len(labels)} labels")

    # ---- Landmarks ---------------------------------------------------------------------------
    print("Calibrating landmark views…")
    landmarks = calibrate_landmarks(volume, grid, labels, points, tangents, ref, table, gej_s)

    # ---- Path file ---------------------------------------------------------------------------
    path_doc = {
        "schema": "eus-b-scope-path/v1", "coordinateSystem": "LPS", "units": "mm", "stepMm": PATH_STEP_MM,
        "totalLengthMm": total_length, "gejSMm": gej_s, "wallStepDeg": WALL_STEP_DEG, "wallInsetMm": WALL_INSET_MM,
        "pointsLps": np.round(points, 2).tolist(),
        "tangentsLps": np.round(tangents, 4).tolist(),
        "refAxesLps": np.round(ref, 4).tolist(),
        "wallMm": np.round(table.astype(float), 1).tolist(),
    }
    (out_dir / "geometry/scope_path.json").write_text(json.dumps(path_doc, separators=(",", ":")) + "\n")

    # ---- CT correlate ------------------------------------------------------------------------
    print("Writing CT correlate…")
    ct_spacing = np.array(CT_SPACING_MM)
    ct_grid = Grid(roi_lo, ct_spacing, np.floor((roi_hi - roi_lo) / ct_spacing).astype(int) + 1)
    ct_crop = resample_ct(ct_image, ct_grid, 0.7)
    low, high = CT_WINDOW_HU
    # 64 gray levels: indistinguishable in a soft-tissue window and far more compressible.
    ct_u8 = (np.clip((ct_crop - low) / (high - low) * 255, 0, 255).astype(np.uint8) // 4) * 4
    ct_packed = gzip.compress(ct_u8.tobytes(), compresslevel=9, mtime=0)
    (out_dir / "geometry/ct.u8.gz").write_bytes(ct_packed)
    print(f"  CT {ct_grid.size.tolist()} voxels, {len(ct_packed) / 1e6:.2f} MB gzip")

    # ---- Surfaces ----------------------------------------------------------------------------
    print("Meshing structures…")
    meshes = []
    for entry, max_triangles in structures:
        built = surface(masks[entry["key"]], source, max_triangles)
        if built is None:
            continue
        positions, faces = built
        meshes.append({"key": entry["key"], "color": entry["color"], "positions": lps_to_web(positions), "faces": faces})
        entry["triangles"] = int(len(faces))
        entry["centroidLps"] = [round(float(v), 1) for v in positions.mean(axis=0)]
    # Spine context: thresholded bone near the midline, behind the esophagus.
    zz, yy, xx = np.nonzero(bone_source)
    lps_x = source.origin[0] + xx * source.spacing[0]
    lps_y = source.origin[1] + yy * source.spacing[1]
    lps_z = source.origin[2] + zz * source.spacing[2]
    near = (np.abs(lps_x - np.median(points[:, 0])) < 45) & (lps_y > points[:, 1].max() + 4) & \
           (lps_z > roi_lo[2]) & (lps_z < roi_hi[2])
    spine = np.zeros_like(bone_source)
    spine[zz[near], yy[near], xx[near]] = True
    spine_surface = surface(clean_mask(spine), source, 12000)
    context = []
    if spine_surface is not None:
        meshes.append({"key": "spine", "color": "#d9d2bd", "positions": lps_to_web(spine_surface[0]), "faces": spine_surface[1]})
        context.append({"key": "spine", "label": "Spine (CT threshold)", "group": "bone", "color": "#d9d2bd",
                        "triangles": int(len(spine_surface[1]))})
    glb = write_glb(out_dir / "models/eus_b_anatomy.glb", meshes)
    total_triangles = sum(len(m["faces"]) for m in meshes)
    print(f"  {len(meshes)} surfaces, {total_triangles} triangles, {len(glb) / 1e6:.2f} MB")

    all_points = np.concatenate([m["positions"] for m in meshes])
    manifest = {
        "schema": "eus-b-case/v1", "caseId": CASE_ID, "assetVersion": ASSET_VERSION,
        "sourceGeometrySha256": source_hash,
        "coordinateFrame": {"source": "LPS_mm", "web": "x=L, y=S, z=-P"},
        "probe": {"sectorAngleDeg": SECTOR_ANGLE_DEG, "defaultDepthMm": DEFAULT_DEPTH_MM, "frequencyMHz": 7.5,
                  "rollConvention": "positive = clockwise seen from the operator, looking along the insertion direction",
                  "imageConvention": "image right = proximal (toward the operator)"},
        "path": {"totalLengthMm": total_length, "gejSMm": gej_s,
                 "levels": path_levels(points, gej_s, total_length, masks, source),
                 "incisorOffsetMm": INCISOR_OFFSET_MM,
                 "incisorOffsetBasis": "Estimate. The segmented esophagus is assumed to begin 17.5 cm from the incisors."},
        "assets": {
            "acoustic": {"metadata": "geometry/acoustic.json", "data": "geometry/acoustic.u8.gz"},
            "path": "geometry/scope_path.json",
            "ct": {"data": "geometry/ct.u8.gz", "sizeXyz": [int(v) for v in ct_grid.size],
                   "spacingXyzMm": [float(v) for v in ct_spacing], "originLps": [float(v) for v in ct_grid.origin],
                   "windowHu": list(CT_WINDOW_HU), "dataSha256": sha256(ct_packed)},
            "model": {"asset": "models/eus_b_anatomy.glb", "frame": "web_mm", "sha256": sha256(glb)},
        },
        "bounds": {"min": [round(float(v), 1) for v in all_points.min(axis=0)],
                   "max": [round(float(v), 1) for v in all_points.max(axis=0)]},
        "structures": [entry for entry, _ in structures] + context,
        "landmarks": landmarks,
        "notes": {
            "intent": "Educational EUS-B orientation trainer. Simulated images are not clinically validated.",
            "path": "Authored centered route through the segmented esophagus and proximal stomach.",
            "contact": "The transducer is placed on the wall it faces; coupling is not simulated.",
            "background": "Unsegmented tissue is classed from CT attenuation (air, fat, soft tissue, bone).",
        },
    }
    (out_dir / "case_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {out_dir}")


if __name__ == "__main__":
    main()
