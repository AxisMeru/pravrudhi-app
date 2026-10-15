import json, tempfile, unittest
from pathlib import Path
import build_nyayasiddhi_rows as B
from bench_tables import cp_interval

def metric(name, group, k, n):
    lo, hi = cp_interval(k, n); return {"name": name, "group": group, "k": k, "n": n, "interval_method": "clopper-pearson-exact", "interval_level": 0.95, "ci_low": lo, "ci_high": hi}
def row(**kw):
    r = {"row_id": "invented-1", "status": "self-reported", "benchmark_version": "v0.2", "split": "obj1_dev", "unit": "whole_item", "system_name": "invented", "system_version": "1", "manifest_sha256": "a" * 64, "scorer_sha": "b" * 40,
         "run_date": "2026-10-01", "organiser_entry": True, "metrics": [metric("false_proof", "ALL", 2, 40), metric("coverage", "ALL", 30, 40)], "supersedes": None, "superseded_by": None, "error_mapping": "none", "n_error": 0}
    r.update(kw); return r
def run(rows, kinds, sens=None):
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "r.jsonl").write_text("\n".join(json.dumps(r) for r in rows)); (Path(d) / "k.json").write_text(json.dumps(kinds))
        sp = {}
        for rid, doc in (sens or {}).items():
            (Path(d) / f"{rid}.json").write_text(json.dumps(doc)); sp[rid] = str(Path(d) / f"{rid}.json")
        return B.build(str(Path(d) / "r.jsonl"), str(Path(d) / "k.json"), sp)

class T(unittest.TestCase):
    def test_a_good_organiser_row_gets_its_kind_and_the_source_sha(self):
        data, errs = run([row()], {"invented-1": "product"})
        self.assertEqual(errs, []); self.assertEqual(data["rows"][0]["entry_kind"], "product"); self.assertEqual(len(data["source"]["rows_file_sha256"]), 64)
    def test_an_organiser_row_without_a_kind_fails(self):
        self.assertTrue(any("entry kind" in e for e in run([row()], {})[1]))
        self.assertTrue(any("entry kind" in e for e in run([row()], {"invented-1": "frontier"})[1]))
    def test_an_outside_entry_carries_no_kind(self):
        self.assertEqual(run([row(organiser_entry=False)], {})[1], [])
        self.assertTrue(any("no entry kind" in e for e in run([row(organiser_entry=False)], {"invented-1": "product"})[1]))
    def test_a_wrong_interval_fails(self):
        r = row(); r["metrics"][1]["ci_low"] = 0.1
        self.assertTrue(any("!= exact" in e for e in run([r], {"invented-1": "product"})[1]))
    def test_both_measures_and_vocabularies_are_required(self):
        self.assertTrue(any("BOTH measures" in e for e in run([row(metrics=[metric("coverage", "ALL", 3, 4)])], {"invented-1": "product"})[1]))
        for bad in (row(status="verified"), row(split="hidden"), row(unit="item")): self.assertTrue(run([bad], {"invented-1": "product"})[1])
    def test_kinds_for_unknown_rows_and_duplicate_ids_fail(self):
        self.assertTrue(any("not in the file" in e for e in run([row()], {"invented-1": "product", "ghost": "product"})[1]))
        self.assertTrue(any("duplicate" in e for e in run([row(), row()], {"invented-1": "product"})[1]))
    def test_error_sensitivity_is_attached_only_when_it_matches_the_row(self):
        r = row(n_error=1, error_mapping="error_counted_as_not_proof")
        good = {"n_error": 1, "metrics": {"false_proof|ALL": {"k_as_proof": 1, "k_as_not_proof": 2, "n": 40, "agree": False}}}
        data, errs = run([r], {"invented-1": "product"}, {"invented-1": good})
        self.assertEqual(errs, []); self.assertEqual(data["rows"][0]["error_sensitivity"]["false_proof|ALL"]["k_as_proof"], 1)
        for bad in ({"n_error": 2, "metrics": good["metrics"]}, {"n_error": 1, "metrics": {"false_proof|ALL": dict(good["metrics"]["false_proof|ALL"], k_as_not_proof=3)}}, {"n_error": 1, "metrics": {"false_proof|NI138": good["metrics"]["false_proof|ALL"]}}):
            self.assertTrue(run([r], {"invented-1": "product"}, {"invented-1": bad})[1])
        self.assertTrue(any("not in the file" in e for e in run([r], {"invented-1": "product"}, {"ghost": good})[1]))
if __name__ == "__main__":
    unittest.main()
