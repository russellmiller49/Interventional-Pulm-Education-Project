"""Ingest a 3D Slicer / SlicerHeart C-arm scene export into FluoroView.

The input folder may contain Slicer scene files, H5 transforms, VTK C-arm models, and NRRD C-arm
render volumes. This script publishes only web-safe derived assets and sanitized metadata:

- C-arm X-ray NRRD volumes are converted to PNG.
- Raw NRRD, H5, VTK, MRML, and source paths are not copied into ``public``.
- Virtual Cath Lab parameters, detector geometry, camera geometry, and rendering presets are
  extracted from the MRML/JSON files so the browser can use SlicerHeart as calibration evidence.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from typing import Any

from PIL import Image


PUBLIC_SUBDIR = "virtual-cath-lab"
METADATA_FILENAME = "slicer_c_arm_scene_manifest.json"
SCENE_REFERENCE_FILENAME = "slicerheart_frontal_reference.png"
UINT8_NRRD_TYPES = {"unsigned char", "uchar", "uint8", "uint8_t"}


@dataclass(frozen=True)
class NrrdImage:
    pixels: bytes
    size: tuple[int, int]
    spacing_mm: tuple[float, float]
    header: dict[str, str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene-dir", required=True, help="Folder containing the Slicer scene export")
    parser.add_argument("--case-dir", required=True, help="Public case folder to update")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    scene_dir = Path(args.scene_dir)
    case_dir = Path(args.case_dir)
    public_vcl_dir = case_dir / PUBLIC_SUBDIR
    metadata_dir = case_dir / "metadata"
    manifest_path = case_dir / "case_manifest.json"

    mrml_path = find_single(scene_dir, "*.mrml")
    public_vcl_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    mrml_root = ET.parse(mrml_path).getroot()
    frame = convert_frontal_nrrd(scene_dir, public_vcl_dir, case_dir)
    scene_manifest = build_scene_manifest(scene_dir, mrml_root, frame)

    scene_manifest_path = metadata_dir / METADATA_FILENAME
    scene_manifest_path.write_text(json.dumps(scene_manifest, indent=2) + "\n", encoding="utf-8")
    update_case_manifest(manifest_path, scene_manifest)

    print(f"Converted SlicerHeart C-arm frame to {public_vcl_dir / SCENE_REFERENCE_FILENAME}")
    print(f"Wrote {scene_manifest_path}")
    print(f"Updated {manifest_path}")


def find_single(root: Path, pattern: str) -> Path:
    matches = sorted(root.glob(pattern))
    if not matches:
        raise SystemExit(f"No {pattern} file found in {root}")
    if len(matches) > 1:
        raise SystemExit(f"Expected one {pattern} file in {root}, found {len(matches)}")
    return matches[0]


def convert_frontal_nrrd(scene_dir: Path, public_vcl_dir: Path, case_dir: Path) -> dict[str, Any]:
    nrrd_path = scene_dir / "CArmFrontalXRay.nrrd"
    if not nrrd_path.exists():
        raise SystemExit(f"Missing {nrrd_path}")

    nrrd = read_uint8_nrrd(nrrd_path)
    output_path = public_vcl_dir / SCENE_REFERENCE_FILENAME
    Image.frombytes("L", nrrd.size, nrrd.pixels).save(output_path)

    case_id = case_dir.name
    return {
        "id": "slicerheart-frontal-reference",
        "view": "frontal",
        "imageUrl": f"/fluoroview/cases/{case_id}/{PUBLIC_SUBDIR}/{output_path.name}",
        "relativePath": str(output_path.relative_to(case_dir)),
        "sourceFileName": nrrd_path.name,
        "sourceSha256": sha256(nrrd_path),
        "sha256": sha256(output_path),
        "dimensionsIJK": [nrrd.size[0], nrrd.size[1], 1],
        "spacingIJKMm": [nrrd.spacing_mm[0], nrrd.spacing_mm[1], 1.0],
        "detectorSizeMm": [
            round(nrrd.size[0] * nrrd.spacing_mm[0], 6),
            round(nrrd.size[1] * nrrd.spacing_mm[1], 6),
        ],
        "encoding": nrrd.header.get("encoding"),
        "space": nrrd.header.get("space"),
        "content": "SlicerHeart rendered frontal C-arm frame",
    }


def read_uint8_nrrd(path: Path) -> NrrdImage:
    data = path.read_bytes()
    try:
        header_blob, payload = data.split(b"\n\n", 1)
    except ValueError as exc:
        raise ValueError(f"{path} is not a single-file NRRD with inline data") from exc

    header = parse_nrrd_header(header_blob.decode("utf-8", errors="replace"))
    if header.get("type", "").lower() not in UINT8_NRRD_TYPES:
        raise ValueError(f"{path} has unsupported NRRD type {header.get('type')!r}")
    if header.get("dimension") != "3":
        raise ValueError(f"{path} must be a 3D C-arm volume")

    sizes = [int(part) for part in header["sizes"].split()]
    if len(sizes) != 3 or sizes[2] != 1:
        raise ValueError(f"{path} must contain a single 2D frame; got sizes {sizes}")

    encoding = header.get("encoding", "raw").lower()
    if encoding == "gzip":
        pixels = gzip.decompress(payload)
    elif encoding == "raw":
        pixels = payload
    else:
        raise ValueError(f"{path} has unsupported encoding {encoding!r}")

    expected = sizes[0] * sizes[1] * sizes[2]
    if len(pixels) < expected:
        raise ValueError(f"{path} payload is shorter than expected")

    spacing = parse_space_directions(header.get("space directions", ""))
    return NrrdImage(
        pixels=pixels[:expected],
        size=(sizes[0], sizes[1]),
        spacing_mm=(spacing[0], spacing[1]),
        header=header,
    )


def parse_nrrd_header(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        fields[key.strip()] = value.strip()
    return fields


def parse_space_directions(value: str) -> tuple[float, float, float]:
    vectors = re.findall(r"\(([^)]+)\)", value)
    spacing = []
    for vector in vectors:
        parts = [float(part.strip()) for part in vector.split(",")]
        spacing.append(sum(part * part for part in parts) ** 0.5)
    if len(spacing) < 3:
        return (1.0, 1.0, 1.0)
    return (spacing[0], spacing[1], spacing[2])


def build_scene_manifest(
    scene_dir: Path,
    mrml_root: ET.Element,
    frame: dict[str, Any],
) -> dict[str, Any]:
    vcl_node = find_named_node(mrml_root, "ScriptedModule", "VirtualCathLab")
    c_arm_volume = find_named_node(mrml_root, "Volume", "CArmFrontalXRay")
    patient_volume = find_named_node(mrml_root, "Volume", "Patient_4_CT")
    camera = find_camera(mrml_root, "CArmFrontal")
    rendering_preset = load_rendering_preset(scene_dir / "FluoroRenderingPreset_01.vp.json")

    return {
        "schemaVersion": 2,
        "source": "SlicerHeart Virtual Cath Lab scene export",
        "ingestedUtc": datetime.now(timezone.utc).isoformat(),
        "sourceFiles": {
            "mrml": find_single(scene_dir, "*.mrml").name,
            "frontalNrrd": "CArmFrontalXRay.nrrd",
            "renderingPreset": "FluoroRenderingPreset_01.vp.json",
        },
        "coordinateSystems": {
            "slicerScene": "RAS",
            "fluoroView": "LPS",
            "cArmImageSpace": frame.get("space", "left-posterior-superior"),
        },
        "frames": [frame],
        "virtualCathLab": {
            "parameters": extract_scripted_parameters(vcl_node),
            "nodeReferences": parse_references(vcl_node.get("references", "")) if vcl_node is not None else {},
        },
        "frontalProjection": build_frontal_projection(frame, c_arm_volume, camera),
        "patientVolume": volume_summary(patient_volume),
        "transforms": transform_summaries(mrml_root),
        "models": model_summaries(mrml_root, scene_dir),
        "renderingPreset": rendering_preset,
        "qualityNotes": [
            "This is a derived SlicerHeart C-arm reference frame, not raw CT data.",
            "The exported frame may include the airway model rendered into the X-ray if the model was visible in Slicer.",
            "Use this as projection/calibration evidence and as an optional reference image source.",
        ],
    }


def find_named_node(root: ET.Element, tag: str, name: str) -> ET.Element | None:
    for node in root.iter(tag):
        if node.get("name") == name:
            return node
    return None


def find_camera(root: ET.Element, singleton_tag: str) -> ET.Element | None:
    for node in root.iter("Camera"):
        if node.get("singletonTag") == singleton_tag:
            return node
    return None


def extract_scripted_parameters(node: ET.Element | None) -> dict[str, Any]:
    if node is None:
        return {}
    parameters: dict[str, Any] = {}
    for key, value in sorted(node.attrib.items()):
        if not key.startswith("parameter"):
            continue
        name, parsed = parse_parameter_value(value)
        parameters[name] = parsed
    return parameters


def parse_parameter_value(value: str) -> tuple[str, Any]:
    stripped = value.strip()
    if not stripped:
        return ("", "")
    if " " not in stripped:
        return (stripped, "")
    name, raw = stripped.split(" ", 1)
    raw = raw.strip()
    return (name, coerce_scalar(raw))


def coerce_scalar(value: str) -> Any:
    if value == "":
        return ""
    lower = value.lower()
    if lower in {"true", "false"}:
        return lower == "true"
    try:
        numeric = float(value)
    except ValueError:
        return value
    if numeric.is_integer():
        return int(numeric)
    return numeric


def parse_references(value: str) -> dict[str, str]:
    refs = {}
    for item in value.split(";"):
        if ":" not in item:
            continue
        key, ref = item.split(":", 1)
        refs[key] = ref
    return refs


def parse_attributes(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    attrs: dict[str, Any] = {}
    for item in value.split(";"):
        if ":" not in item:
            continue
        key, raw = item.split(":", 1)
        attrs[key] = parse_number_list(raw.strip())
    return attrs


def parse_number_list(value: str) -> Any:
    parts = value.split()
    if not parts:
        return ""
    try:
        numbers = [float(part) for part in parts]
    except ValueError:
        return value
    if len(numbers) == 1:
        return int(numbers[0]) if numbers[0].is_integer() else numbers[0]
    return numbers


def build_frontal_projection(
    frame: dict[str, Any],
    c_arm_volume: ET.Element | None,
    camera: ET.Element | None,
) -> dict[str, Any]:
    volume_attrs = parse_attributes(c_arm_volume.get("attributes") if c_arm_volume is not None else None)
    camera_position = volume_attrs.get("VirtualCathLab.CameraPosition")
    camera_focal = volume_attrs.get("VirtualCathLab.CameraFocalPoint")
    camera_view_up = volume_attrs.get("VirtualCathLab.CameraViewUp")
    source_to_image = volume_attrs.get("VirtualCathLab.SourceToImageDistance")
    width_mm = volume_attrs.get("VirtualCathLab.WidthMm")
    height_mm = volume_attrs.get("VirtualCathLab.HeightMm")

    if camera is not None:
        camera_position = camera_position or parse_number_list(camera.get("position", ""))
        camera_focal = camera_focal or parse_number_list(camera.get("focalPoint", ""))
        camera_view_up = camera_view_up or parse_number_list(camera.get("viewUp", ""))
        source_to_image = source_to_image or parse_attributes(camera.get("attributes")).get(
            "VirtualCathLab.SourceToImageDistance"
        )

    return {
        "coordinateSystem": "RAS",
        "positionRasMm": camera_position,
        "focalPointRasMm": camera_focal,
        "viewUpRas": camera_view_up,
        "sourceToImageDistanceMm": source_to_image,
        "detectorPixels": frame.get("dimensionsIJK", [])[:2],
        "detectorSizeMm": [
            float(width_mm) if width_mm is not None else frame.get("detectorSizeMm", [None, None])[0],
            float(height_mm)
            if height_mm is not None
            else frame.get("detectorSizeMm", [None, None])[1],
        ],
        "pixelSpacingMm": frame.get("spacingIJKMm", [])[:2],
        "viewAngleDeg": float(camera.get("viewAngle")) if camera is not None and camera.get("viewAngle") else None,
        "imageOrientation": "slicer-nrrd-lps",
    }


def volume_summary(node: ET.Element | None) -> dict[str, Any] | None:
    if node is None:
        return None
    return {
        "id": node.get("id"),
        "name": node.get("name"),
        "spacingMm": parse_number_list(node.get("spacing", "")),
        "originRasMm": parse_number_list(node.get("origin", "")),
        "ijkToRASDirections": parse_number_list(node.get("ijkToRASDirections", "")),
        "references": parse_references(node.get("references", "")),
    }


def transform_summaries(root: ET.Element) -> list[dict[str, Any]]:
    transforms = []
    for node in root.iter("LinearTransform"):
        name = node.get("name", "")
        if not is_virtual_cath_lab_transform_name(name):
            continue
        transforms.append(
            {
                "id": node.get("id"),
                "name": name,
                "parentTransformNodeId": parse_references(node.get("references", "")).get("transform"),
                "matrixTransformToParent": matrix4_from_attribute(
                    node.get("matrixTransformToParent", "")
                ),
            }
        )
    for node in root.iter("Transform"):
        name = node.get("name", "")
        if not is_virtual_cath_lab_transform_name(name):
            continue
        transforms.append(
            {
                "id": node.get("id"),
                "name": name,
                "parentTransformNodeId": parse_references(node.get("references", "")).get("transform"),
                "matrixTransformToParent": None,
            }
        )
    return transforms


def is_virtual_cath_lab_transform_name(name: str) -> bool:
    return (
        name == "PositioningTransform"
        or name == "gantry-to-ras"
        or name.startswith("frontal-")
        or name.startswith("table-")
    )


def matrix4_from_attribute(value: str) -> list[list[float]] | None:
    numbers = parse_number_list(value)
    if not isinstance(numbers, list) or len(numbers) != 16:
        return None
    return [numbers[index : index + 4] for index in range(0, 16, 4)]


def model_summaries(root: ET.Element, scene_dir: Path) -> list[dict[str, Any]]:
    storage_by_id = {
        node.get("id"): node for node in root.iter("ModelStorage") if node.get("id")
    }
    summaries = []
    for node in root.iter("Model"):
        name = node.get("name", "")
        if not is_c_arm_model_name(name):
            continue
        refs = parse_references(node.get("references", ""))
        storage = storage_by_id.get(refs.get("storage"))
        file_name = storage.get("fileName") if storage is not None else None
        file_path = scene_dir / file_name if file_name else None
        summaries.append(
            {
                "id": node.get("id"),
                "name": name,
                "storageFileName": file_name,
                "transformNodeId": refs.get("transform"),
                "sizeBytes": file_path.stat().st_size if file_path and file_path.exists() else None,
            }
        )
    return summaries


def is_c_arm_model_name(name: str) -> bool:
    return name.startswith("frontal-") or name.startswith("table-") or "GenericFluoro" in name


def load_rendering_preset(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    preset = json.loads(path.read_text(encoding="utf-8"))
    volume_properties = preset.get("volumeProperties", [])
    if not volume_properties:
        return None
    prop = volume_properties[0]
    component = prop.get("components", [{}])[0]
    return {
        "sourceFileName": path.name,
        "sha256": sha256(path),
        "effectiveRange": prop.get("effectiveRange"),
        "interpolationType": prop.get("interpolationType"),
        "lighting": component.get("lighting"),
        "scalarOpacity": component.get("scalarOpacity", {}).get("points", []),
        "rgbTransferFunction": component.get("rgbTransferFunction", {}).get("points", []),
    }


def update_case_manifest(manifest_path: Path, scene_manifest: dict[str, Any]) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    case_id = manifest_path.parent.name
    frame = scene_manifest["frames"][0]
    projection = scene_manifest.get("frontalProjection", {})
    parameters = scene_manifest.get("virtualCathLab", {}).get("parameters", {})
    scene_manifest_url = f"/fluoroview/cases/{case_id}/metadata/{METADATA_FILENAME}"

    manifest["assets"] = {
        **manifest.get("assets", {}),
        "virtualCathLabManifest": scene_manifest_url,
        "virtualCathLabSceneManifest": scene_manifest_url,
        "virtualCathLabFrontalImage": frame.get("imageUrl"),
    }
    manifest["virtualCathLab"] = {
        "source": "SlicerHeart Virtual Cath Lab",
        "status": "scene-export",
        "manifestUrl": scene_manifest_url,
        "sceneManifestUrl": scene_manifest_url,
        "frontalImageUrl": frame.get("imageUrl"),
        "frontalDetectorPixels": frame.get("dimensionsIJK", [])[:2],
        "frontalDetectorSizeMm": projection.get("detectorSizeMm") or frame.get("detectorSizeMm"),
        "frontalPixelSpacingMm": frame.get("spacingIJKMm", [])[:2],
        "coordinateSystem": "RAS",
        "sourceImageIncludesModel": True,
        "cArm": {
            "deviceClassId": parameters.get("DeviceClassId"),
            "detectorPixelSizeMm": parameters.get("DetectorPixelSize"),
            "sourceToImageDistanceMm": parameters.get(
                "GenericFluoro_frontalArmSourceToImageDistance"
            ),
            "frontalArmAngleLDeg": parameters.get("GenericFluoro_frontalArmAngleL"),
            "frontalArmAnglePDeg": parameters.get("GenericFluoro_frontalArmAngleP"),
            "frontalArmAngleCDeg": parameters.get("GenericFluoro_frontalArmAngleC"),
            "frontalArmDetectorRotationDeg": parameters.get(
                "GenericFluoro_frontalArmDetectorRotationAngle"
            ),
            "patientSpinDeg": parameters.get("GenericFluoro_patientSpin"),
            "tableShiftLateralMm": parameters.get("GenericFluoro_tableShiftLateral"),
            "tableShiftLongitudinalMm": parameters.get("GenericFluoro_tableShiftLongitudinal"),
            "tableShiftVerticalMm": parameters.get("GenericFluoro_tableShiftVertical"),
            "volumeRenderingPreset": parameters.get("VolumeRenderingPreset"),
        },
        "frontalProjection": projection,
        "renderingPreset": scene_manifest.get("renderingPreset"),
        "note": (
            "SlicerHeart scene export is available as a high-fidelity frontal reference frame "
            "with detector/camera metadata. The current exported frame includes the airway model "
            "rendered into the X-ray, so it is best used as reference/calibration evidence while "
            "TIGRE remains the primary continuous atlas."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    main()
