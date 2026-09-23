#!/usr/bin/env python3
"""Read Steve's bounded workbook losslessly. No database or network access."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

EXPECTED_SHA = "f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279"
MODULE_IDS = [
    "core-srh-orientation", "non-diagnostic-adequacy", "normal-lung-airway",
    "cancer", "inflammation-infection-granuloma", "advanced-cases",
]
TITLES = [
    "CORE SRH ORIENTATION", "NON-DIAGNOSTIC & ADEQUACY", "NORMAL LUNG & AIRWAY",
    "CANCER", "INFLAMMATION & INFECTION & GRANULOMA", "ADVANCED CASES",
]
COUNTS = [20, 5, 8, 14, 6, 6]
SEQUENCE_HEADERS = [
    "Overall Order", "Module", "Order in Module", "Full Case Name",
    "Curriculum Role", "Teaching Objective / Why Here", "Full Learner-Facing Text",
    "Internal Note · Not Learner-Facing",
]
TEXT_HEADERS = ["Overall Order", "Module", "Full Case Name", "Full Learner-Facing Text"]
SOURCE_HOLDS = {
    "case-430-series-2": "Core membership decision required",
    "case-357-series-2": "Retention decision required",
    "case-436-series-1": "Retention decision required",
}
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_xlsx(path):
    """Cell values only; refuse formulas, external references and oversized ZIPs."""
    with zipfile.ZipFile(path) as archive:
        require(sum(i.file_size for i in archive.infolist()) < 50_000_000, "Workbook exceeds bound")
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in si.findall(".//s:t", NS)) for si in root]
        relroot = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationships = {r.attrib["Id"]: r.attrib["Target"] for r in relroot}
        require(not any(r.get("TargetMode") == "External" for r in relroot), "External workbook reference")
        root = ET.fromstring(archive.read("xl/workbook.xml"))
        result = {}
        for sheet in root.findall("s:sheets/s:sheet", NS):
            rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = relationships[rid]
            filename = target.lstrip("/") if target.startswith("/") else "xl/" + target
            xml = ET.fromstring(archive.read(filename))
            rows = []
            for row in xml.findall("s:sheetData/s:row", NS):
                cells = {}
                for cell in row:
                    require(cell.find("s:f", NS) is None, "Formula cell requires manual source review")
                    letters = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                    column = 0
                    for letter in letters:
                        column = column * 26 + ord(letter) - 64
                    kind = cell.get("t")
                    value = cell.find("s:v", NS)
                    if kind == "inlineStr":
                        val = "".join(t.text or "" for t in cell.findall(".//s:t", NS))
                    elif kind == "s":
                        val = shared[int(value.text)]
                    elif value is None:
                        val = None
                    elif kind == "str":
                        val = value.text or ""
                    else:
                        require(kind not in ("e", "b"), "Unsupported source cell type")
                        val = int(value.text) if re.fullmatch(r"-?\d+", value.text) else float(value.text)
                    cells[column] = val
                row_number = int(row.attrib["r"])
                require(row_number <= 1000 and max(cells, default=0) <= 20, "Source bounds exceeded")
                while len(rows) < row_number:
                    rows.append([])
                rows[row_number - 1] = [cells.get(i) for i in range(1, max(cells, default=0) + 1)]
            result[sheet.attrib["name"]] = rows
        return result


def inspect_workbook(path, expected_sha=EXPECTED_SHA):
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    require(digest == expected_sha, "Source SHA-256 mismatch; inspect the changed workbook separately")
    sheets = read_xlsx(path)
    require(set(sheets) == {"Module Overview", "Curriculum Sequence", "Learner-Facing Text"}, "Unexpected sheets")
    sequence = sheets["Curriculum Sequence"]
    learner = sheets["Learner-Facing Text"]
    require(sequence[0] == SEQUENCE_HEADERS and learner[0] == TEXT_HEADERS, "Unexpected source columns")
    require(len(sequence) == 60 and len(learner) == 60, "Expected 59 source rows in both sheets")
    overview = sheets["Module Overview"]
    require(overview[0] == ["Module", "Module Name", "Purpose", "Case Count", "Curriculum Cases", "Priority"], "Unexpected module columns")
    require(len(overview) == 9 and overview[8][:2] == ["Total cases", 59], "Overview total mismatch")
    modules = []
    start = 1
    for index, (identity, title, count) in enumerate(zip(MODULE_IDS, TITLES, COUNTS), 1):
        row = overview[index]
        require(row[0] == index and row[1] == title and row[3] == count and row[4] == f"{start}-{start+count-1}", "Module plan mismatch")
        require(row[5] == ("Core" if index == 1 else "Advanced" if index == 6 else "Deep dive"), "Module priority mismatch")
        modules.append({"id": identity, "title": title, "purpose": row[2], "displayOrder": index,
                        "recommendedStart": index == 1, "level": row[5], "plannedCount": count})
        start += count
    records = []
    keys = set()
    numbers = set()
    for index, row in enumerate(sequence[1:], 1):
        require(not any(v is not None for v in row[8:]), "Unmapped source column")
        row = (row + [None] * 8)[:8]
        values = dict(zip(SEQUENCE_HEADERS, row))
        require(row[0] == index, "Nonconsecutive overall ordering")
        require([row[0], row[1], row[3], row[6]] == learner[index], "Duplicate-sheet disagreement")
        match = re.fullmatch(r"Case (\d+) · Series (\d+) · .+", row[3])
        require(match, "Unrecognized case-series label")
        number, series = match.groups()
        key = f"case-{int(number)}-series-{int(series)}"
        require(key not in keys, "Duplicate case-series identity")
        keys.add(key)
        numbers.add(int(number))
        module = next((m for m in modules if row[1] == f'MODULE {m["displayOrder"]} — {m["title"]}'), None)
        require(module is not None, "Unknown module label")
        records.append({"workbookSha256": digest, "sourceSheet": "Curriculum Sequence", "sourceRow": index+1,
                        "sourceValues": values, "identity": {"caseNumberAsWritten": number,
                        "seriesNumberAsWritten": series, "key": key}, "moduleId": module["id"],
                        "membershipHold": SOURCE_HOLDS.get(key)})
    for module in modules:
        positions = [r["sourceValues"]["Order in Module"] for r in records if r["moduleId"] == module["id"]]
        require(positions == list(range(1, module["plannedCount"]+1)), "Module membership order/count mismatch")
    require(len(numbers) == 55, "Distinct case-number discrepancy")
    summary = {"entries": len(keys), "distinctCaseNumbers": len(numbers), "moduleCounts": COUNTS,
               "duplicateSheetAgreement": True, "consecutiveOverallOrder": True,
               "commonPitfallNarratives": sum("\nCommon pitfall\n" in r["sourceValues"]["Full Learner-Facing Text"] for r in records),
               "membershipDecisions": sum(bool(r["membershipHold"]) for r in records), "targetMappingsVerified": 0}
    return {"format": "socrates-workbook-inspection-v1", "sha256": digest, "modules": modules,
            "records": records, "summary": summary}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, required=True, help="New PRIVATE JSON path outside the repository")
    parser.add_argument("--expected-sha256", default=EXPECTED_SHA)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    destination = args.output.resolve()
    require(not destination.is_relative_to(repo) and not any((p / ".git").exists() for p in destination.parents) and "public" not in destination.parts, "Private staging must stay outside checkouts and public assets")
    package = inspect_workbook(args.workbook, args.expected_sha256)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with os.fdopen(os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as output:
        json.dump(package, output, ensure_ascii=False, indent=2)
    # Never print narratives, source labels, private notes, or packages.
    print(json.dumps(package["summary"]))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        raise SystemExit(str(error))
