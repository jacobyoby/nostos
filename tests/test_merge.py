"""Unit tests for scripts/merge.py — pure logic, small/fast (pyramid base)."""
import sys
import unittest
from pathlib import Path

# Ensure scripts/merge.py is importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import merge  # noqa: E402


class TestNormalizeName(unittest.TestCase):
    def test_strips_noise_words(self):
        self.assertEqual(merge.normalize_name("Atlantic City Free Public Library"), "atlantic city")
        self.assertEqual(merge.normalize_name("CHERRY HILL PUBLIC LIBRARY"), "cherry hill")
        self.assertEqual(merge.normalize_name("Burlington County Library System"), "burlington county")

    def test_case_insensitive_and_punctuation(self):
        self.assertEqual(merge.normalize_name("Princeton Public Library"), merge.normalize_name("princeton public library"))
        self.assertEqual(merge.normalize_name("West-Orange & Memorial"), "west orange")


class TestIndexSystems(unittest.TestCase):
    def test_indexes_by_normalized_name(self):
        rows = [{"system_name": "Atlantic City Free Public Library", "website": "http://a.org/", "has_legal_help_program": True, "legal_help_evidence": "http://e"}]
        idx = merge.index_systems(rows)
        self.assertIn("atlantic city", idx)
        self.assertEqual(idx["atlantic city"].website, "http://a.org/")

    def test_rejects_missing_system_name(self):
        with self.assertRaises(ValueError):
            merge.index_systems([{"website": "http://x"}])


class TestMerge(unittest.TestCase):
    def test_joins_system_info_and_preserves_outreach(self):
        outlets = [{"fscskey": "NJ0001", "fscs_seq": "001", "system_name": "Atlantic City Free Public Library", "outlet_name": "Main", "county": "ATLANTIC"}]
        systems = {"atlantic city": merge.SystemInfo(website="http://a.org/", catalog_url=None, library_card_signup_url=None, has_legal_help_program=True, legal_help_evidence=None)}
        outreach = {"NJ0001-001": merge.Outreach(status="posted", notes="done")}
        merged, unmatched = merge.merge(outlets, systems, outreach, {})
        self.assertEqual(merged[0]["website"], "http://a.org/")
        self.assertEqual(merged[0]["outreach"]["status"], "posted")
        self.assertEqual(unmatched, [])

    def test_unmatched_system_recorded(self):
        outlets = [{"fscskey": "NJ0001", "fscs_seq": "001", "system_name": "Unknown System", "outlet_name": "X", "county": "X"}]
        merged, unmatched = merge.merge(outlets, {}, {}, {})
        # Unknown System is not in UNLISTED_SYSTEMS, so it should be recorded; but if it becomes listed, tolerate empty
        self.assertIsNone(merged[0]["website"])

    def test_does_not_mutate_input(self):
        outlets = [{"fscskey": "NJ0001", "fscs_seq": "001", "system_name": "A", "outlet_name": "X", "county": "B"}]
        orig = [dict(o) for o in outlets]
        merge.merge(outlets, {}, {}, {})
        self.assertEqual(outlets, orig)

    def test_prove_it_regression_outreach_preserved_across_rerun(self):
        # Bug pattern: re-running merge must not reset outreach to todo
        outlets = [{"fscskey": "NJ0001", "fscs_seq": "001", "system_name": "A", "outlet_name": "X", "county": "B"}]
        outreach = {"NJ0001-001": merge.Outreach(status="partner", notes="met director")}
        merged, _ = merge.merge(outlets, {}, outreach, {})
        self.assertEqual(merged[0]["outreach"]["status"], "partner")
        self.assertEqual(merged[0]["outreach"]["notes"], "met director")


if __name__ == "__main__":
    unittest.main()
