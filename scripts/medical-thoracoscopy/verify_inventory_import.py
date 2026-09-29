#!/usr/bin/env python3
"""Check the implementation manifest against the planning documents it was imported from.

The planning documents are the owner's and live outside the repository, so this runs where they
are and is not part of the test suite. For each planning layer it checks the file hash and line
count recorded in the manifest, then checks that every imported string appears on the line the
manifest cites.

Usage:
    python3 scripts/medical-thoracoscopy/verify_inventory_import.py \
        --v1 <original plan> --p <first revision> --v2 <revised plan v2>

A layer that is not given is reported as NOT CHECKED. The exit code is non-zero if any layer that
was given fails, or if none was given.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / "docs" / "medical-thoracoscopy" / "implementation-manifest.json"

# Fields whose text was copied from the cited line. Bold markers are dropped on both sides.
TEXT_FIELDS = (
    "id",
    "title",
    "activity",
    "text",
    "statement",
    "learnerCan",
    "teachingAndApplication",
    "originalProposal",
    "requiredImprovement",
    "primary",
    "secondary",
    "prerequisites",
    "storageKey",
)
LIST_FIELDS = ("phases", "items", "rows", "columns", "names", "values")


def plain(text: str) -> str:
    return text.replace("**", "").replace("`", "")


def load_layer(path: Path) -> tuple[list[str], str]:
    data = path.read_bytes()
    lines = data.decode("utf-8").split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    return lines, hashlib.sha256(data).hexdigest()


def cited_text(lines: list[str], source: dict) -> str:
    start = source["line"]
    end = source.get("endLine", start)
    return plain("\n".join(lines[start - 1 : end]))


def strings_of(node: dict) -> list[str]:
    found: list[str] = []
    for field in TEXT_FIELDS:
        value = node.get(field)
        if isinstance(value, str) and not (field == "id" and value.startswith("OD-")):
            found.append(value)
    for field in LIST_FIELDS:
        value = node.get(field)
        if isinstance(value, list) and all(isinstance(entry, str) for entry in value):
            found.extend(value)
    return found


def walk(node, visit) -> None:
    if isinstance(node, dict):
        visit(node)
        for value in node.values():
            walk(value, visit)
    elif isinstance(node, list):
        for value in node:
            walk(value, visit)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--v1", type=Path)
    parser.add_argument("--p", type=Path)
    parser.add_argument("--v2", type=Path)
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    given = {"v1": args.v1, "P": args.p, "v2": args.v2}
    layers: dict[str, list[str]] = {}
    failures: list[str] = []

    for name, path in given.items():
        record = manifest["sources"][name]
        if path is None:
            print(f"{name}: NOT CHECKED (no file given)")
            continue
        if not path.is_file():
            failures.append(f"{name}: file not found: {path}")
            continue
        lines, digest = load_layer(path)
        if digest != record["sha256"]:
            failures.append(f"{name}: hash differs from the manifest ({digest})")
            continue
        if len(lines) != record["lines"]:
            failures.append(f"{name}: {len(lines)} lines, manifest records {record['lines']}")
            continue
        layers[name] = lines
        print(f"{name}: hash and line count match")

    checked = {name: 0 for name in layers}

    def visit(node: dict) -> None:
        source = node.get("source")
        if not isinstance(source, dict) or source.get("layer") not in layers:
            return
        text = cited_text(layers[source["layer"]], source)
        for value in strings_of(node):
            checked[source["layer"]] += 1
            if plain(value) not in text:
                failures.append(
                    f"{source['layer']} line {source['line']}: not found on the cited line: {value!r}"
                )

    walk(manifest, visit)

    for name, count in checked.items():
        print(f"{name}: {count} imported strings compared")
    for failure in failures:
        print(f"FAIL {failure}")
    if not layers and not failures:
        print("Nothing was checked. Give at least one planning document.")
        return 2
    if failures:
        return 1
    print("Every imported string was found on the line it cites.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
