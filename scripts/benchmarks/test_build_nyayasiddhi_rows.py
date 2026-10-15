import hashlib, json, tempfile, unittest
from pathlib import Path
import build_nyayasiddhi_rows as B
from bench_tables import cp_interval

DEV = "dev stack (local)"
API = "Anthropic API (organiser-run reference arm; not the dev stack, not the production stack)"
def manifest(stack): return json.dumps({"system_name": "invented", "stack": stack}).encode()
MSHA = hashlib.sha256(manifest(DEV)).hexdigest()

def metric(name, group, k, n):
    lo, hi = cp_interval(k, n); return {"name": name, "group": group, "k": k, "n": n, "interval_method": "clopper-pearson-exact", "interval_level": 0.95, "ci_low": lo, "ci_high": hi}
def row(**kw):
    r = {"row_id": "invented-1", "status": "self-reported", "benchmark_version": "v0.2", "split": "obj1_dev", "unit": "whole_item", "system_name": "invented", "system_version": "1", "manifest_sha256": MSHA, "scorer_sha": "b" * 40,
         "run_date": "2026-10-01", "organiser_entry": True, "metrics": [metric("false_proof", "ALL", 2, 40), metric("coverage", "ALL", 30, 40)], "supersedes": None, "superseded_by": None, "error_mapping": "none", "n_error": 0}
    r.update(kw); return r
def run(rows, kinds, sens=None, stack=DEV, with_manifest=True):
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "r.jsonl").write_text("\n".join(json.dumps(r) for r in rows)); (Path(d) / "k.json").write_text(json.dumps(kinds))
        md = Path(d) / "manifests"; md.mkdir()
        if with_manifest: (md / "m.json").write_bytes(manifest(stack))
        sp = {}
        for rid, doc in (sens or {}).items():
            (Path(d) / f"{rid}.json").write_text(json.dumps(doc)); sp[rid] = str(Path(d) / f"{rid}.json")
        return B.build(str(Path(d) / "r.jsonl"), str(Path(d) / "k.json"), sp, str(md))

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
    def test_a_row_with_errors_and_no_sensitivity_fails_closed(self):
        r = row(n_error=3, error_mapping="error_counted_as_not_proof")
        self.assertTrue(any("needs an error-sensitivity file" in e for e in run([r], {"invented-1": "product"})[1]))
        self.assertEqual(run([row(n_error=0)], {"invented-1": "product"})[1], [])
    def test_agree_is_recomputed_not_trusted(self):
        r = row(n_error=1, error_mapping="error_counted_as_not_proof")
        lie = {"n_error": 1, "metrics": {"false_proof|ALL": {"k_as_proof": 2, "k_as_not_proof": 2, "n": 40, "agree": False}}}  # equal counts must read agree true
        lie2 = {"n_error": 1, "metrics": {"false_proof|ALL": {"k_as_proof": 3, "k_as_not_proof": 2, "n": 40, "agree": True}}}  # different counts must read agree false
        for bad in (lie, lie2): self.assertTrue(any("not recomputed" in e for e in run([r], {"invented-1": "product"}, {"invented-1": bad})[1]))
    def test_the_manifest_stack_is_carried_into_the_row(self):
        data, errs = run([row()], {"invented-1": "product"})
        self.assertEqual(errs, []); self.assertEqual(data["rows"][0]["stack"], DEV)
        api = hashlib.sha256(manifest(API)).hexdigest()
        data, errs = run([row(manifest_sha256=api)], {"invented-1": "product"}, stack=API)
        self.assertEqual(errs, []); self.assertEqual(data["rows"][0]["stack"], API)
    def test_an_unknown_stack_or_a_missing_manifest_fails_closed(self):
        other = "some other stack"; sha = hashlib.sha256(manifest(other)).hexdigest()
        self.assertTrue(any("not one the page has words for" in e for e in run([row(manifest_sha256=sha)], {"invented-1": "product"}, stack=other)[1]))
        self.assertTrue(any("no manifest" in e for e in run([row()], {"invented-1": "product"}, with_manifest=False)[1]))
    def test_several_rows_files_are_built_in_the_order_given_with_each_sha_recorded(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "x").mkdir(); (Path(d) / "y").mkdir()
            a, b = Path(d) / "x" / "results.jsonl", Path(d) / "y" / "results.jsonl"  # same file name, different folders
            a.write_text(json.dumps(row(row_id="first")) + "\n"); b.write_text(json.dumps(row(row_id="second")) + "\n")
            k = Path(d) / "k.json"; k.write_text(json.dumps({"first": "product", "second": "reference_arm"}))
            md = Path(d) / "m"; md.mkdir(); (md / "m.json").write_bytes(manifest(DEV))
            data, errs = B.build([str(a), str(b)], str(k), None, [str(md)])
            self.assertEqual(errs, []); self.assertEqual([r["row_id"] for r in data["rows"]], ["first", "second"])
            self.assertEqual(set(data["source"]["rows_files_sha256"]), {"x/results.jsonl", "y/results.jsonl"})
            b.write_text(json.dumps(row(row_id="first")) + "\n")
            self.assertTrue(any("duplicate" in e for e in B.build([str(a), str(b)], str(k), None, [str(md)])[1]))
if __name__ == "__main__":
    unittest.main()
