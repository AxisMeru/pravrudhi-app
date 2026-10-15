import hashlib, json, os, tempfile, unittest
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
            k = Path(d) / "k.json"; k.write_text(json.dumps({"first": "product", "second": "product"}))
            md = Path(d) / "m"; md.mkdir(); (md / "m.json").write_bytes(manifest(DEV))
            data, errs = B.build([str(a), str(b)], str(k), None, [str(md)])
            self.assertEqual(errs, []); self.assertEqual([r["row_id"] for r in data["rows"]], ["first", "second"])
            self.assertEqual(set(data["source"]["rows_files_sha256"]), {"x/results.jsonl", "y/results.jsonl"})
            b.write_text(json.dumps(row(row_id="first")) + "\n")
            self.assertTrue(any("duplicate" in e for e in B.build([str(a), str(b)], str(k), None, [str(md)])[1]))

# --- R1's About-this-run lines (15 Oct): whole sentences copied verbatim from the manifest notes, fail closed -----------------------------------------------
FINAL_DIR = next((d for d in (Path("/home/ss/fusion-project/tmp_scratch/trackA/s7_682_rows/final7"),) if d.is_dir()), None)   # the signed package whose manifests carry the exposure sentences
OPEN_LOCAL = "nyayasiddhi-open-O2"
def notes_for(system, split="obj1_dev", extra=""):
    """A manifest's notes assembled from the builder's own sentences (invented counts), in the manifests' own style, for the fail-closed tests."""
    fill = lambda t: t.replace("NUM", "3").replace("WILD", "x (aaaaaaaaaaaa 1 tokens); each is written {item_id, verdict NOT_PROOF, error true}; error_mapping e; n_error = rows with error true (0)")
    lines = [B.SMOKE, fill(B.PREFACE), B.TRAINED] + ([B.EXPOSURE[split]] if system in B.API_SYSTEMS else []) + [fill(x) for x in B.ABOUT_BY_SYSTEM[system]]
    lines = [x if x != B.NO_SEED else "Backend: Anthropic API lane Job, no seed (No seed: the API offers none.), max_tokens 1000; run directory out_x_v33." for x in lines]
    return ("dev stack (local); filler. One run per arm per split. " + " ".join(lines) + " Build notes: filler. " + extra).strip()
def ref_run(system, notes, overlap="not checked: invented", split="obj1_dev", stack=API):
    m = json.dumps({"system_name": system, "stack": stack, "notes": notes, "overlap_check": overlap}).encode()
    r = row(manifest_sha256=hashlib.sha256(m).hexdigest(), split=split)
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "r.jsonl").write_text(json.dumps(r)); (Path(d) / "k.json").write_text(json.dumps({"invented-1": "reference_arm"}))
        md = Path(d) / "m"; md.mkdir(); (md / "m.json").write_bytes(m)
        return B.build(str(Path(d) / "r.jsonl"), str(Path(d) / "k.json"), {}, str(md))

class AboutRun(unittest.TestCase):
    def test_each_row_type_gets_its_lines_in_order_copied_verbatim(self):
        for system, n_lines in [("nyayasiddhi-ref-S-direct", 7), ("nyayasiddhi-ref-S-harness", 9), ("nyayasiddhi-open-O2", 7)]:
            data, errs = ref_run(system, notes_for(system), stack=API if system in B.API_SYSTEMS else DEV); self.assertEqual(errs, [], system)
            lines = data["rows"][0]["about_run"]; self.assertEqual(len(lines), n_lines, system)
            self.assertEqual(lines[0], B.SMOKE); self.assertTrue(lines[1].startswith("In 3 of 3 replies, the model wrote explanatory text") and lines[1].endswith("Counted after the run, from the call log.")); self.assertEqual(lines[2], B.TRAINED); self.assertEqual(lines[3], "not checked: invented")
            if system in B.API_SYSTEMS: self.assertEqual(lines[4], B.EXPOSURE["obj1_dev"])
            else: self.assertFalse(any("Anthropic API" in l for l in lines), "no exposure line on the open-model rows")
            for l in lines: self.assertTrue(B.balanced(l))
    def test_the_exposure_line_follows_the_split_on_api_rows_only(self):
        for split in B.EXPOSURE:
            data, errs = ref_run("nyayasiddhi-ref-S-direct", notes_for("nyayasiddhi-ref-S-direct", split), split=split); self.assertEqual(errs, []); self.assertEqual(data["rows"][0]["about_run"][4], B.EXPOSURE[split])
        self.assertTrue(ref_run("nyayasiddhi-ref-S-direct", notes_for("nyayasiddhi-ref-S-direct", "obj1_dev"), split="obj1b_minus_cruelty")[1], "the other split's exposure sentence is not accepted")
    def test_the_harness_contract_sentence_is_whole_with_only_the_pinned_fragment_removed(self):
        data, errs = ref_run("nyayasiddhi-ref-S-harness", notes_for("nyayasiddhi-ref-S-harness")); self.assertEqual(errs, [])
        line = [l for l in data["rows"][0]["about_run"] if l.startswith("Element by element")][0]
        self.assertEqual(line, B.HARNESS_CONTRACT.replace(B.CONTRACT_HASH, "")); self.assertNotIn("contract_map", line); self.assertTrue(line.endswith("(item_id, element_index)."))
        self.assertTrue(ref_run("nyayasiddhi-ref-S-harness", notes_for("nyayasiddhi-ref-S-harness").replace("981218e2f961", "000000000000"))[1], "a different fragment fails closed")
    def test_a_row_is_not_run_for_ni138_only_when_the_notes_carry_the_exact_sentence(self):
        sent = "A scored NI138 item is outside the harness's contracts: 96 items written {item_id, verdict NOT_PROOF} without error, not sent (refer_mapping REFER_IS_NOT_PROOF)."
        data, errs = ref_run("nyayasiddhi-ref-S-harness", notes_for("nyayasiddhi-ref-S-harness", extra=sent)); self.assertEqual(errs, []); self.assertEqual(data["rows"][0]["not_run_groups"], ["NI138"])
        data, errs = ref_run("nyayasiddhi-ref-S-harness", notes_for("nyayasiddhi-ref-S-harness")); self.assertNotIn("not_run_groups", data["rows"][0])
        data, errs = ref_run("nyayasiddhi-ref-S-harness", notes_for("nyayasiddhi-ref-S-harness", extra=sent.replace("outside", "inside"))); self.assertNotIn("not_run_groups", data["rows"][0])
    def test_the_sentence_splitter_keeps_brackets_and_quotes_whole(self):
        t = "One (a. B c). Two {x. Y}. Three \"p. Q\". Four. trained_on_public_items is x. Five, from the call log. Counted after the run, from the call log."
        self.assertEqual(B.split_notes("A b. C d (e. F). G."), ["A b.", "C d (e. F).", "G."])
        self.assertEqual(B.split_notes(t)[:4], ["One (a. B c).", "Two {x. Y}.", 'Three "p. Q".', "Four."])
        self.assertEqual(B.split_notes("X y. Counted after the run, from the call log."), ["X y. Counted after the run, from the call log."])
        self.assertFalse(B.balanced("a (b")); self.assertFalse(B.balanced("{a")); self.assertTrue(B.balanced("a (b) {c}"))
    def test_a_missing_changed_or_repeated_required_sentence_fails_closed(self):
        for system in B.ABOUT_BY_SYSTEM:
            stack = API if system in B.API_SYSTEMS else DEV; base = notes_for(system)
            for sentence in [B.SMOKE, B.TRAINED] + ([B.EXPOSURE["obj1_dev"]] if system in B.API_SYSTEMS else []):
                self.assertIn(sentence, base)
                self.assertTrue(ref_run(system, base.replace(sentence, ""), stack=stack)[1], f"{system}: removed {sentence[:40]!r}")
                self.assertTrue(ref_run(system, base.replace(sentence, sentence[:-3] + "xyz."), stack=stack)[1], f"{system}: changed {sentence[:40]!r}")
                self.assertTrue(ref_run(system, base + " " + sentence, stack=stack)[1], f"{system}: twice {sentence[:40]!r}")
    def test_an_unknown_system_a_missing_overlap_check_no_notes_or_unbalanced_text_fails_closed(self):
        self.assertTrue(ref_run("some-other-system", notes_for("nyayasiddhi-ref-S-direct"))[1])
        self.assertTrue(ref_run("nyayasiddhi-ref-S-direct", notes_for("nyayasiddhi-ref-S-direct"), overlap="")[1])
        self.assertTrue(ref_run("nyayasiddhi-ref-S-direct", notes_for("nyayasiddhi-ref-S-direct"), overlap="not checked (unclosed")[1])
        self.assertTrue(ref_run("nyayasiddhi-ref-S-direct", None)[1])
    def test_a_product_row_carries_no_about_run(self):
        data, errs = run([row()], {"invented-1": "product"}); self.assertEqual(errs, []); self.assertNotIn("about_run", data["rows"][0]); self.assertNotIn("not_run_groups", data["rows"][0])
    @unittest.skipUnless(FINAL_DIR is not None, "the signed manifests with the exposure sentences (final7) are not on this machine")
    def test_the_signed_manifests_give_whole_sentences_that_are_substrings_of_their_notes(self):
        for f in sorted((FINAL_DIR / "manifests").glob("*.json")):
            m = json.loads(f.read_text())
            if m.get("system_name") not in B.ABOUT_BY_SYSTEM: continue
            split = m["split"]; sha = hashlib.sha256(f.read_bytes()).hexdigest()
            lines, not_run, err = B.about_run({"row_id": f.stem, "manifest_sha256": sha, "split": split}, [str(f)]); self.assertIsNone(err, f.name)
            for l in lines: self.assertTrue(B.balanced(l), f.name)
            for l in lines[:3] + lines[4:]: self.assertIn(l.replace("(CHEAT ->", "(" + B.CONTRACT_HASH + "CHEAT ->"), m["notes"], f"{f.name}: not verbatim: {l[:60]!r}")
            self.assertEqual(lines[3], m["overlap_check"])

if __name__ == "__main__":
    unittest.main()
