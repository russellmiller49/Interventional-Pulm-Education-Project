#!/usr/bin/env python3
"""Build the Scope Anatomy photo-atlas assets from a CVAT image export."""

from __future__ import annotations

import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = Path("/Users/russellmiller/Desktop/bronhoscope/bronchoscope annotations")
ANNOTATIONS_ZIP = SRC_DIR / "bronchoscope.zip"
PUBLIC_DIR = ROOT / "public" / "intro-bronchoscopy" / "scope-anatomy"
MANIFEST = PUBLIC_DIR / "scope-photo-atlas.json"

IMAGE_TITLES = {
    "bronch3.png": {
        "id": "full-scope",
        "title": "Full flexible bronchoscope",
        "alt": "Full flexible bronchoscope with control section, universal cord, and insertion tube.",
        "summary": "Orient to the major parts before thinking about handling or accessory setup.",
    },
    "biopsy valve 1.png": {
        "id": "suction-valve-setup",
        "title": "Suction valve setup",
        "alt": "Suction valve being placed into the bronchoscope suction valve port.",
        "summary": "The suction valve must seat in the port before controlled suction is available.",
    },
    "biopsy port 2.png": {
        "id": "biopsy-adapter-setup",
        "title": "Biopsy valve adapter setup",
        "alt": "Biopsy valve adapter being placed at the bronchoscope working-channel port.",
        "summary": "The biopsy valve adapter seals the working-channel entry while instruments pass.",
    },
}

ORDER = ["bronch3.png", "biopsy valve 1.png", "biopsy port 2.png"]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def parse_points(value: str) -> list[list[float]]:
    return [
        [round(float(x), 2), round(float(y), 2)]
        for x, y in (pair.split(",") for pair in value.split(";"))
    ]


def centroid(points: list[list[float]]) -> dict[str, float]:
    return {
        "x": round(sum(point[0] for point in points) / len(points), 2),
        "y": round(sum(point[1] for point in points) / len(points), 2),
    }


def main() -> int:
    if not ANNOTATIONS_ZIP.exists():
        print(f"missing CVAT export: {ANNOTATIONS_ZIP}", file=sys.stderr)
        return 1

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(ANNOTATIONS_ZIP) as archive:
        with archive.open("annotations.xml") as handle:
            root = ET.parse(handle).getroot()

    images_by_name = {image.get("name"): image for image in root.findall("image")}
    out_images = []

    for source_name in ORDER:
        source_path = SRC_DIR / source_name
        source_info = IMAGE_TITLES[source_name]
        if source_name not in images_by_name:
            print(f"missing image annotation: {source_name}", file=sys.stderr)
            return 1
        if not source_path.exists():
            print(f"missing source image: {source_path}", file=sys.stderr)
            return 1

        public_name = f"{source_info['id']}.png"
        shutil.copyfile(source_path, PUBLIC_DIR / public_name)

        image = images_by_name[source_name]
        annotations = []
        for index, polygon in enumerate(image.findall("polygon")):
            label = polygon.get("label") or "Structure"
            points = parse_points(polygon.get("points") or "")
            annotations.append(
                {
                    "id": f"{source_info['id']}-{slugify(label)}-{index + 1}",
                    "label": label,
                    "points": points,
                    "centroid": centroid(points),
                }
            )

        out_images.append(
            {
                "id": source_info["id"],
                "title": source_info["title"],
                "alt": source_info["alt"],
                "summary": source_info["summary"],
                "src": f"/intro-bronchoscopy/scope-anatomy/{public_name}",
                "width": int(image.get("width") or 0),
                "height": int(image.get("height") or 0),
                "annotations": annotations,
            }
        )

    manifest = {
        "meta": {
            "source": str(ANNOTATIONS_ZIP),
            "note": "Real bronchoscope photographs and CVAT polygons for Intro Bronchoscopy scope handling.",
        },
        "images": out_images,
    }
    MANIFEST.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    print(f"images: {len(out_images)}")
    print(f"annotations: {sum(len(image['annotations']) for image in out_images)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
