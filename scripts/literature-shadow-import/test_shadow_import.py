from __future__ import annotations

import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("shadow_import.py")
SPEC = importlib.util.spec_from_file_location("shadow_import", MODULE_PATH)
assert SPEC and SPEC.loader
shadow_import = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(shadow_import)


class ShadowImportTests(unittest.TestCase):
    def test_prepare_ml_normalizes_litscreen_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "scored.csv"
            with source.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=[
                        "PMID",
                        "Title",
                        "Journal",
                        "Publication Year",
                        "ml_prob_include",
                        "ml_decision",
                        "ml_zone",
                        "ml_pred_category",
                        "ml_pred_category_prob",
                        "ml_category_top3",
                    ],
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "PMID": "123",
                        "Title": "Synthetic article",
                        "Journal": "Synthetic Journal",
                        "Publication Year": "2026",
                        "ml_prob_include": "0.81",
                        "ml_decision": "include",
                        "ml_zone": "auto-include",
                        "ml_pred_category": "procedural",
                        "ml_pred_category_prob": "0.72",
                        "ml_category_top3": "procedural:0.72",
                    }
                )
            config = shadow_import.load_config()
            output = root / "prepared"
            shadow_import.prepare_ml(source, output, config)
            manifest = shadow_import.verify_prepared(output)
            self.assertEqual(manifest["counts"]["classificationCount"], 1)
            receipt = shadow_import.rehearse_prepared(output)
            self.assertEqual(receipt["relationalIntegrity"], "passed")
            self.assertFalse(receipt["remoteApplyAuthorized"])
            with (output / "classifications.csv").open(encoding="utf-8") as handle:
                row = next(csv.DictReader(handle))
            self.assertEqual(row["decision_zone"], "auto_include")
            self.assertEqual(row["predicted_relevance"], "include")

    def test_prepared_manifest_detects_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "scored.csv"
            source.write_text(
                "PMID,Title,ml_prob_include,ml_decision,ml_zone\n"
                "123,Synthetic,0.5,include,review\n",
                encoding="utf-8",
            )
            output = root / "prepared"
            shadow_import.prepare_ml(source, output, shadow_import.load_config())
            with (output / "classifications.csv").open("a", encoding="utf-8") as handle:
                handle.write("tampered\n")
            with self.assertRaises(shadow_import.ShadowImportError):
                shadow_import.verify_prepared(output)

    def test_prepared_manifest_requires_the_complete_file_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "scored.csv"
            source.write_text(
                "PMID,Title,ml_prob_include,ml_decision,ml_zone\n"
                "123,Synthetic,0.5,include,review\n",
                encoding="utf-8",
            )
            output = root / "prepared"
            shadow_import.prepare_ml(source, output, shadow_import.load_config())
            manifest_path = output / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            del manifest["files"]["terms.csv"]
            manifest_path.write_text(
                shadow_import.canonical_json(manifest), encoding="utf-8"
            )

            with self.assertRaises(shadow_import.ShadowImportError):
                shadow_import.verify_prepared(output)


if __name__ == "__main__":
    unittest.main()
