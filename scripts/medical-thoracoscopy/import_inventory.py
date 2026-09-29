#!/usr/bin/env python3
"""Import the Medical Thoracoscopy inventory from the owner's planning documents.

The planning documents live outside the repository. This script reads the three layers, copies
the inventory items into `docs/medical-thoracoscopy/implementation-manifest.json`, and refuses
to write anything whose text is not found on the line it cites. Line numbers are those of the
documents whose hashes the manifest records; a changed document fails the checks at the end.

Items that no planning layer defines are authored here and marked with their status: the
chapter assignment, the learner wording of the second control, and the unresolved cells of the
performance table.

Usage:
    python3 scripts/medical-thoracoscopy/import_inventory.py \
        --v1 <original plan> --p <first revision> --v2 <revised plan v2>

Run `npx prettier --write` on the output afterwards. `verify_inventory_import.py` repeats the
comparison without rewriting the file.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
parser.add_argument("--v1", required=True)
parser.add_argument("--p", required=True)
parser.add_argument("--v2", required=True)
parser.add_argument(
    "--out",
    default=str(REPO / "docs" / "medical-thoracoscopy" / "implementation-manifest.json"),
)
args = parser.parse_args()

V1 = args.v1
V2 = args.v2
PP = args.p
OUT = args.out


def load(path):
    data = open(path, "rb").read()
    lines = data.decode("utf-8").split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    return lines, hashlib.sha256(data).hexdigest()


v1, v1h = load(V1)
v2, v2h = load(V2)
P, Ph = load(PP)
LAYERS = {"v1": v1, "P": P, "v2": v2}


def at(layer, n):
    return LAYERS[layer][n - 1]


def src(layer, line, end=None):
    d = {"layer": layer, "line": line}
    if end:
        d["endLine"] = end
    return d


def cells(row):
    return [c.strip() for c in row.strip().strip("|").split("|")]


def bullet(layer, n):
    text = at(layer, n).strip()
    assert text.startswith("- "), (layer, n, text)
    return text[2:]


sections = []
for n in range(90, 109):
    c = cells(at("v1", n))
    sections.append(
        {
            "number": int(c[0]),
            "id": c[1].strip("`"),
            "title": c[2],
            "activity": c[3],
            "minutesEstimate": int(c[4]),
            "source": src("v1", n),
        }
    )
assert [s["number"] for s in sections] == list(range(1, 20))

practice = []
for n in range(114, 121):
    c = cells(at("v1", n))
    practice.append(
        {
            "id": c[0],
            "title": c[1],
            "pairsWithLearn": [int(x) for x in c[2].split(",")],
            "source": src("v1", n),
        }
    )

cases = []
for n in range(126, 130):
    c = cells(at("v1", n))
    cases.append({"id": c[0], "title": c[1], "source": src("v1", n)})

control_statement = re.search(r'"(You change four things: .*?)"', at("v1", 55)).group(1)
control_items = [
    x.strip() for x in control_statement.split(":", 1)[1].rstrip(".").split(";")
]
assert len(control_items) == 4

spine = [
    x.strip()
    for x in re.search(r"timeline (.*?) is the pathway outline", at("v1", 52))
    .group(1)
    .split("→")
]
assert len(spine) == 8

grammar_columns = [
    x.strip()
    for x in re.search(r"— (what you see .*?)\.$", at("v1", 58).strip()).group(1).split("→")
]
grammar_rows = [
    x.strip() for x in at("v1", 59).strip()[len("- Rows:") :].rstrip(".").split(";")
]
assert len(grammar_columns) == 4 and len(grammar_rows) == 7

chapters = [
    x.strip()
    for x in re.search(r"five visible chapters: \*\*(.*?)\*\*", at("P", 31))
    .group(1)
    .rstrip(".")
    .split(";")
]
assert len(chapters) == 5

outcomes = []
for n in range(39, 45):
    c = cells(at("P", n))
    outcomes.append({"learnerCan": c[0], "teachingAndApplication": c[1], "source": src("P", n)})

corrections = []
for n in range(19, 26):
    c = cells(at("P", n))
    corrections.append(
        {"originalProposal": c[0], "requiredImprovement": c[1], "source": src("P", n)}
    )

owner_decisions = []
for i in range(1, 7):
    text = at("v1", 17 + i).strip()
    assert text.startswith(f"{i}. ")
    owner_decisions.append(
        {
            "id": f"OD-0{i}",
            "decidedOn": "2026-09-23",
            "text": text[3:].replace("**", ""),
            "source": src("v1", 17 + i),
        }
    )

V2_ON_FAILURE = "A failed gate triggers repair and a revised forecast, not silent scope reduction."
V2_RULE = at("v2", 37).strip().lstrip(">").strip()

manifest = {
    "manifest": "medical-thoracoscopy-implementation-manifest",
    "version": 1,
    "preparedOn": "2026-09-28",
    "preparedBy": "AI authoring assistant (Claude) at the owner's request",
    "statement": (
        "Imported inventory for the Medical Thoracoscopy module. Every item was copied from the "
        "owner's planning documents, which are kept outside the repository, and carries the "
        "layer and line it came from. Nothing was reconstructed or invented. Nothing in this "
        "file is clinical approval, a manufacturer fact-check or a rights permission. Section "
        "minutes are authoring estimates and have not been piloted."
    ),
    "sources": {
        "v1": {
            "title": "Medical Thoracoscopy (sponsored by Richard Wolf) — Build Plan",
            "date": "2026-09-23",
            "lines": len(v1),
            "sha256": v1h,
            "keptAt": "Interventional-Pulm-Local-Data/medical_thoracoscopy/plans/",
            "role": "Original plan. Supplies the inventory, the module tree and the asset pipeline.",
        },
        "P": {
            "title": "Medical Thoracoscopy — Revised Build Plan",
            "date": "2026-09-23",
            "lines": len(P),
            "sha256": Ph,
            "keptAt": "Interventional-Pulm-Local-Data/medical_thoracoscopy/plans/",
            "recovery": (
                "Recovered from a session log. Its two wrapper lines were removed, which makes "
                "the line numbers match the ones v2 cites."
            ),
            "role": (
                "First revision. Supplies the five chapter names, the outcome alignment and the "
                "corrected assumptions. v2 cites it as [P]."
            ),
        },
        "v2": {
            "title": "Medical Thoracoscopy — Revised Build Plan v2",
            "date": "2026-09-23",
            "lines": len(v2),
            "sha256": v2h,
            "keptAt": "Interventional-Pulm-Local-Data/medical_thoracoscopy/",
            "role": "Contract overlay. Governs wherever it differs from v1 (owner decision OD-07).",
        },
    },
    "statusVocabulary": {
        "values": [
            "retained decision",
            "proposed change",
            "unresolved input",
            "review pending",
            "accepted with attributable approval",
        ],
        "source": src("v2", 29),
    },
    "ownerDecisions": {
        "imported": owner_decisions,
        "note": "OD-07 to OD-10 were made on 2026-09-27 and are recorded in owner-decisions.md.",
    },
    "learner": {
        "primary": bullet("v1", 49)[len("Primary: ") :],
        "secondary": bullet("v1", 50)[len("Secondary: ") :],
        "prerequisites": bullet("v1", 51)[len("Prerequisites (linked, not re-taught): ") :],
        "source": src("v1", 48, 51),
    },
    "spine": {"phases": spine, "source": src("v1", 52)},
    "controls": {
        "statement": control_statement,
        "items": control_items,
        "source": src("v1", 55),
        "learnerWording": {
            "status": "proposed change",
            "reason": 'The second item trips the learner-copy gate on the word "points".',
            "proposal": "where the scope looks (pivot, depth, roll)",
            "note": "The imported statement above is unchanged.",
        },
    },
    "grammar": {
        "name": "Reading the pleura",
        "columns": grammar_columns,
        "rows": grammar_rows,
        "label": "authored construct",
        "source": src("v1", 58, 59),
    },
    "chapters": {
        "names": chapters,
        "source": src("P", 31),
        "assignment": {
            "status": "proposed change",
            "decidedBy": None,
            "decidedOn": None,
            "note": (
                "No planning layer assigns sections to chapters. v2 asks that none be inferred "
                "until the inventory is imported. This proposal was made after the import and "
                "awaits the owner."
            ),
            "source": src("v2", 45),
            "proposal": [
                {"chapter": "Decide", "sections": [1, 2]},
                {"chapter": "Equipment and anatomy", "sections": [3, 4, 5, 6]},
                {"chapter": "Access and orientation", "sections": [7, 8, 9, 10]},
                {"chapter": "Survey and intervention", "sections": [11, 12, 13, 14, 15, 16]},
                {"chapter": "Finish and complications", "sections": [17, 18, 19]},
            ],
        },
    },
    "learnSections": sections,
    "learnMinutesEstimateTotal": sum(s["minutesEstimate"] for s in sections),
    "practiceScenarios": practice,
    "integratedCases": cases,
    "outcomeAlignment": {"target": "knows how", "rows": outcomes, "source": src("P", 37, 46)},
    "correctedAssumptions": corrections,
    "teachingAdditions": [
        {
            "name": "opening whole-procedure demonstration",
            "text": bullet("P", 50),
            "source": src("P", 50),
            "status": "retained decision",
            "definedBeyondThisSentence": False,
        },
        {
            "name": "procedural decision guide",
            "text": bullet("P", 51),
            "source": src("P", 51),
            "status": "retained decision",
            "definedBeyondThisSentence": False,
        },
        {
            "name": "step, hazard, early sign, first response table",
            "text": bullet("P", 52),
            "source": src("P", 52),
            "status": "retained decision",
            "definedBeyondThisSentence": False,
        },
    ],
    "modelBoundaries": [{"text": bullet("v1", n), "source": src("v1", n)} for n in range(62, 68)],
    "harmfulReflexes": {
        "items": [{"text": bullet("v1", n), "source": src("v1", n)} for n in range(134, 139)],
        "source": src("v1", 133, 138),
        "governingRule": {
            "text": V2_RULE,
            "source": src("v2", 37),
            "status": "proposed change",
            "note": (
                "Replaces the v1 rule that these actions must never look beneficial. "
                'Unsupported consequences are "not modeled".'
            ),
        },
    },
    "budgets": {
        "source": src("v1", 213, 215),
        "items": [
            {"name": "pleural-space scene payload", "limit": 8, "unit": "MB"},
            {"name": "anatomy GLB", "limit": 3, "unit": "MB"},
            {"name": "device GLB", "limit": 2.5, "unit": "MB"},
            {"name": "device GLB triangles", "limit": 50000, "unit": "triangles"},
            {"name": "texture edge", "limit": 1024, "unit": "px"},
            {"name": "rendered triangles, high quality", "limit": 250000, "unit": "triangles"},
            {"name": "rendered triangles, low quality", "limit": 120000, "unit": "triangles"},
            {"name": "draw calls", "limit": 150, "unit": "calls"},
            {"name": "collision proxy triangles", "limit": 12000, "unit": "triangles"},
            {"name": "coverage update", "limit": 4, "unit": "ms"},
        ],
    },
    "prototypeGate": {
        "v1Criteria": [{"text": bullet("v1", n), "source": src("v1", n)} for n in range(289, 295)],
        "v1OnFailure": {
            "text": bullet("v1", 295).replace("**", ""),
            "source": src("v1", 295),
            "status": "superseded by v2",
        },
        "v2OnFailure": {
            "text": V2_ON_FAILURE,
            "source": src("v2", 11),
            "status": "retained decision",
        },
        "v2Additions": {
            "text": cells(at("v2", 191))[1],
            "source": src("v2", 191),
        },
    },
    "performanceTargets": {
        "source": src("v1", 289, 290),
        "note": (
            "v1 names hardware and, for one target, quality. It names no browser, viewport, "
            "network profile or cache state. Those cells are unresolved inputs, not defaults."
        ),
        "rows": [
            {
                "target": "median frame rate at least 45 fps",
                "hardware": "M1 or Iris Xe laptop",
                "quality": "UNRESOLVED",
                "browser": "UNRESOLVED",
                "viewport": "UNRESOLVED",
                "network": "not applicable",
                "cache": "not applicable",
                "result": "NOT TESTED",
            },
            {
                "target": "frame rate at least 30 fps",
                "hardware": "A14 iPad",
                "quality": "low",
                "browser": "UNRESOLVED",
                "viewport": "UNRESOLVED",
                "network": "not applicable",
                "cache": "not applicable",
                "result": "NOT TESTED",
            },
            {
                "target": "interactive within 4 s",
                "hardware": "UNRESOLVED",
                "quality": "UNRESOLVED",
                "browser": "UNRESOLVED",
                "viewport": "UNRESOLVED",
                "network": "fast; profile UNRESOLVED",
                "cache": "UNRESOLVED",
                "result": "NOT TESTED",
            },
            {
                "target": "interactive within 8 s",
                "hardware": "UNRESOLVED",
                "quality": "UNRESOLVED",
                "browser": "UNRESOLVED",
                "viewport": "UNRESOLVED",
                "network": "throttled 4G; profile UNRESOLVED",
                "cache": "UNRESOLVED",
                "result": "NOT TESTED",
            },
        ],
    },
    "routes": {
        "base": "/medical-thoracoscopy",
        "source": src("v1", 22),
        "learnerLabels": {"assess": "Cases", "source": src("v2", 66)},
        "legacy": {
            "base": "/pleural-procedures/pleuroscopy",
            "mappings": [
                {"from": "/assessment", "to": "/assess"},
                {"from": "/references", "to": "/reference"},
            ],
            "source": src("v2", 235),
            "status": "retained decision",
            "note": "Redirects wait for a reviewed destination.",
        },
    },
    "progress": {
        "storageKey": "ip-medical-thoracoscopy-self-paced-v1",
        "source": src("v1", 158),
        "neverTouch": [{"key": "ip-pleural-module-progress-v1", "source": src("v1", 177)}],
    },
}


def check(layer, line, text):
    assert text in at(layer, line).replace("**", ""), (layer, line, text, at(layer, line))


for s in sections:
    check("v1", s["source"]["line"], s["id"])
    check("v1", s["source"]["line"], s["title"])
    check("v1", s["source"]["line"], s["activity"])
for p in practice:
    check("v1", p["source"]["line"], p["title"])
for c in cases:
    check("v1", c["source"]["line"], c["title"])
for b in manifest["modelBoundaries"] + manifest["harmfulReflexes"]["items"]:
    check("v1", b["source"]["line"], b["text"])
for b in manifest["prototypeGate"]["v1Criteria"]:
    check("v1", b["source"]["line"], b["text"])
for d in owner_decisions:
    check("v1", d["source"]["line"], d["text"])
check("v1", 55, control_statement)
for item in control_items:
    check("v1", 55, item)
for phase in spine:
    check("v1", 52, phase)
for row in grammar_rows:
    check("v1", 59, row)
for name in chapters:
    check("P", 31, name)
for o in outcomes:
    check("P", o["source"]["line"], o["learnerCan"])
    check("P", o["source"]["line"], o["teachingAndApplication"])
for c in corrections:
    check("P", c["source"]["line"], c["originalProposal"])
for t in manifest["teachingAdditions"]:
    check("P", t["source"]["line"], t["text"].replace("**", ""))
check("v1", 158, "ip-medical-thoracoscopy-self-paced-v1")
check("v1", 177, "ip-pleural-module-progress-v1")
check("v2", 11, V2_ON_FAILURE)
check("v2", 37, V2_RULE)
check("v2", 66, "Cases")
check("v2", 235, "/assessment")
check("v2", 191, manifest["prototypeGate"]["v2Additions"]["text"].replace("**", ""))
for value in manifest["statusVocabulary"]["values"]:
    check("v2", 29, value)
check("v1", 214, "≤ 8 MB")
check("v1", 214, "≤ 3 MB")
check("v1", 214, "≤ 2.5 MB")
check("v1", 214, "≤ 50k triangles")
check("v1", 214, "≤ 1024²")
check("v1", 215, "≤ 250k rendered triangles")
check("v1", 215, "≤ 120k at low")
check("v1", 215, "≤ 150 draw calls")
check("v1", 215, "≤ 12k triangles")
check("v1", 215, "≤ 4 ms")
assert manifest["learnMinutesEstimateTotal"] == 154
check("P", 33, "154 minutes")

with open(OUT, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
print("written", OUT, os.path.getsize(OUT), "bytes; every imported string found on its cited line")
