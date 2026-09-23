import hashlib
from pathlib import Path
import tempfile
import unittest
from xml.sax.saxutils import escape
import zipfile

from inspect_workbook import inspect_workbook, COUNTS, TITLES, SEQUENCE_HEADERS, TEXT_HEADERS


def synthetic_workbook(filename, mutate=None):
    overview = [["Module", "Module Name", "Purpose", "Case Count", "Curriculum Cases", "Priority"]]
    sequence = [SEQUENCE_HEADERS]
    learner = [TEXT_HEADERS]
    overall = 1
    for index, (title, count) in enumerate(zip(TITLES, COUNTS), 1):
        overview.append([index, title, "Synthetic purpose", count, f"{overall}-{overall+count-1}",
                         "Core" if index == 1 else "Advanced" if index == 6 else "Deep dive"])
        for position in range(1, count+1):
            number, series = (overall, 1) if overall <= 55 else (overall-55, 2)
            label = f"Case {number:03} · Series {series} · Synthetic"
            narrative = "What to notice\nSynthetic text.\n\nCommon pitfall\nExact text." if overall <= 8 else "Synthetic text."
            row = [overall, f"MODULE {index} — {title}", position, label, "Synthetic role",
                   "Synthetic objective", narrative, None]
            sequence.append(row)
            learner.append([overall, row[1], label, narrative])
            overall += 1
    overview += [[], ["Total cases", 59]]
    sheets = [overview, sequence, learner]
    if mutate:
        mutate(sheets)
    with zipfile.ZipFile(filename, "w") as archive:
        archive.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
                         "".join(f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>' for i, name in enumerate(["Module Overview", "Curriculum Sequence", "Learner-Facing Text"], 1)) +
                         "</sheets></workbook>")
        archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                         "".join(f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml"/>' for i in range(1, 4)) + "</Relationships>")
        for index, rows in enumerate(sheets, 1):
            xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
            for r, row in enumerate(rows, 1):
                xml += f'<row r="{r}">'
                for c, value in enumerate(row):
                    if value is None:
                        continue
                    ref = f"{chr(c+65)}{r}"
                    xml += f'<c r="{ref}"><v>{value}</v></c>' if isinstance(value, int) else f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(value)}</t></is></c>'
                xml += "</row>"
            archive.writestr(f"xl/worksheets/sheet{index}.xml", xml+"</sheetData></worksheet>")
    return hashlib.sha256(Path(filename).read_bytes()).hexdigest()


class WorkbookInspectionTests(unittest.TestCase):
    def run_source(self, mutate=None):
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / "synthetic.xlsx"
            digest = synthetic_workbook(filename, mutate)
            return inspect_workbook(filename, digest)

    def test_lossless_inventory_and_blank_notes(self):
        result = self.run_source()
        self.assertEqual(result["summary"]["entries"], 59)
        self.assertEqual(result["summary"]["distinctCaseNumbers"], 55)
        self.assertEqual(result["summary"]["moduleCounts"], [20, 5, 8, 14, 6, 6])
        self.assertEqual(result["summary"]["commonPitfallNarratives"], 8)
        self.assertEqual(result["records"][0]["sourceValues"]["Full Case Name"], "Case 001 · Series 1 · Synthetic")
        self.assertIsNone(result["records"][0]["sourceValues"]["Internal Note · Not Learner-Facing"])

    def test_duplicate_sheet_disagreement(self):
        def mutate(sheets):
            sheets[2][6][3] += " Dropped or rewritten paragraph."
        with self.assertRaisesRegex(ValueError, "Duplicate-sheet"):
            self.run_source(mutate)

    def test_overall_order_is_not_identity(self):
        def mutate(sheets):
            sheets[1][6][0] = 41
        with self.assertRaisesRegex(ValueError, "Nonconsecutive"):
            self.run_source(mutate)

    def test_different_series_remain_distinct(self):
        rows = self.run_source()["records"]
        self.assertEqual(rows[0]["identity"]["key"], "case-1-series-1")
        self.assertEqual(rows[55]["identity"]["key"], "case-1-series-2")

    def test_unknown_columns_cannot_disappear(self):
        def mutate(sheets):
            sheets[1][1].append("Unmapped private value")
        with self.assertRaisesRegex(ValueError, "Unmapped source column"):
            self.run_source(mutate)

    def test_source_digest_is_required(self):
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / "synthetic.xlsx"
            synthetic_workbook(filename)
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                inspect_workbook(filename)


if __name__ == "__main__":
    unittest.main()
