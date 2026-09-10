"""Structural tests only: these do not assess medical wording or clinical safety."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "index_transcripts.py"
SPEC = importlib.util.spec_from_file_location("index_transcripts", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class TranscriptIndexerTests(unittest.TestCase):
    def test_timestamp_styles(self):
        self.assertEqual(MODULE.parse_timestamp("**1:02:03**"), ("1:02:03", 3723))
        self.assertEqual(MODULE.parse_timestamp("0:07"), ("0:07", 7))

    def test_invalid_or_inline_times(self):
        self.assertIsNone(MODULE.parse_timestamp("1:67"))
        self.assertIsNone(MODULE.parse_timestamp("at 0:10 we discuss a topic"))
        self.assertIsNone(MODULE.parse_timestamp("1:66:01"))

    def test_reset_creates_candidate(self):
        lines = ["**0:00**", "intro", "**25:00**", "ending", "", "**0:02**", "next"]
        self.assertEqual(MODULE.episode_starts(lines), [1, 6])

    def test_heading_moves_with_new_episode(self):
        lines = ["0:00", "intro", "45:00", "ending", "", "**Next topic**", "", "0:10", "start"]
        self.assertEqual(MODULE.episode_starts(lines), [1, 6])

    def test_small_reset_is_not_new_episode(self):
        lines = ["0:00", "text", "1:20", "text", "0:20", "text"]
        self.assertEqual(MODULE.episode_starts(lines), [1])

    def test_window_keeps_raw_words_and_original_lines(self):
        lines = ["0:07", "7 seconds", "tital volume is quoted here", "", "0:11", "final text"]
        output = MODULE.compact_window(lines, 1, 6)
        self.assertIn("L3 [0:07] tital volume", output)
        self.assertNotIn("tidal volume", output)
        self.assertNotIn("7 seconds", output)
        self.assertIn("L6 [0:11] final text", output)

    def test_source_catalog_has_no_review_claim(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "source.md"
            path.write_text("0:00\nhello\n20:00\nend\n0:02\nnext\n")
            data, _ = MODULE.source_catalog("CC", path)
            self.assertEqual(len(data["episodes"]), 2)
            self.assertEqual(data["episodes"][0]["language_review_status"], "not_reviewed")
            self.assertEqual(len(data["sha256"]), 64)

    def test_reject_duplicate_labels(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "source.md"
            path.write_text("text")
            with self.assertRaises(ValueError):
                MODULE.parse_sources([f"CC={path}", f"cc={path}"])

    def test_reject_unsafe_label(self):
        with self.assertRaises(ValueError):
            MODULE.parse_sources(["../bad=/tmp/source.md"])

    def test_empty_file(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "empty.md"
            path.write_text("\n\n")
            with self.assertRaises(ValueError):
                MODULE.source_catalog("CC", path)

    def test_cli_catalog_only_preserves_source(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "source.md"
            raw = "0:00\nprivate reference text\n20:00\nend\n".encode()
            path.write_bytes(raw)
            out = Path(temp) / "out"
            self.assertEqual(MODULE.main(["--source", f"CC={path}", "--out", str(out)]), 0)
            catalog = json.loads((out / "catalog.json").read_text())
            self.assertFalse(catalog["source_text_included"])
            self.assertNotIn("private reference text", (out / "catalog.json").read_text())
            self.assertEqual(path.read_bytes(), raw)
            self.assertFalse((out / "windows").exists())

    def test_cli_private_windows(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "source.md"
            path.write_text("0:00\nraw spelling\n")
            out = Path(temp) / "out"
            MODULE.main(["--source", f"IP={path}", "--out", str(out), "--write-windows"])
            self.assertIn("raw spelling", (out / "windows" / "IP-01.md").read_text())

    def test_nonempty_output_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "source.md"
            path.write_text("0:00\nsource\n")
            out = Path(temp) / "out"
            out.mkdir()
            keep = out / "keep.txt"
            keep.write_text("keep this")
            with self.assertRaises(SystemExit):
                MODULE.main(["--source", f"CC={path}", "--out", str(out)])
            self.assertEqual(keep.read_text(), "keep this")


if __name__ == "__main__":
    unittest.main()
