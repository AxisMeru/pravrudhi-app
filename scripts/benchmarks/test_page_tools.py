import hashlib, json, tempfile, unittest
from pathlib import Path
import lint_copy as L, validate_page_data as V, bench_tables as T

def block(**kw):
    b = {"id": "legalbench", "kind_chip": "Harness vs the same model alone; United States law", "data_chip": "Public benchmark", "review_status": "pending", "outcome": "n/a"}
    b.update(kw); return b
ROW = {"arm": "a", "group": "ALL", "n": 10, "correct": 5, "accuracy": 0.5, "ci95": list(T.cp_interval(5, 10)), "invalid": 0}
PAIR = {"pair": "a vs b", "only_first_correct": 3, "only_second_correct": 4, "p": 1.0, "label": "no separation", "family": "none: descriptive, unadjusted"}
BOUND = {"name": "P1 upper bound", "value": 0.03, "n": 120, "kind": "one_sided_upper", "denominator": "answers with a shown-VERIFIED citation"}
def sentences_for(b):
    import page_templates as P
    out = []
    for tb in b.get("tables", []):
        for row in tb.get("rows", []): out.append({"template_id": "accuracy", "text": P.generate("accuracy", row)})
    for p in b.get("paired", []):
        tid = "paired_no_separation" if p["label"] == "no separation" else "paired_separated"
        f, s = p["pair"].split(" vs ")
        out.append({"template_id": tid, "text": P.generate(tid, dict(p, first=f, second=s))})
    for bd in b.get("bounds", []): out.append({"template_id": "bound", "text": P.generate("bound", bd)})
    return out

def reviewed(root, **kw):
    f = Path(root) / "numbers.json"; f.write_text("{}")
    revs = [{"reviewer": r, "ref": f"https://github.com/x/y/pull/1#pullrequestreview-{i}", "head_sha": "abcdef1", "date": "2026-10-07"} for i, r in enumerate(["R1", "R2"])]
    b = block(review_status="reviewed", outcome="descriptive", reviews=revs, numbers_file="numbers.json", numbers_sha256=hashlib.sha256(b"{}").hexdigest(), **kw)
    if "sentences" not in kw:
        try: b["sentences"] = sentences_for(b)
        except KeyError: b["sentences"] = []
    return b

class Lint(unittest.TestCase):
    def test_stems_and_inflections(self):
        for bad in ["Our model beats the base", "beating the base", "This is state-of-the-art", "a Safer harness", "Best in class", "on par with", "It is #1", "significantly higher",
                    "Validated on real items", "validation of the harness", "outperforming rivals", "improvements seen", "winning arm", "trending up", "reliably", "superiority", "as  good  as",
                    "gains", "robustly", "guaranteed"]:
            self.assertTrue(L.lint(bad), bad)
        for ok in ["Accuracy with an exact 95% interval", "No separation (exact McNemar, p = 1.0)", "The difference is significant under an exact McNemar test", "Model legal knowledge (multiple choice)",
                   "Invalid answers are counted as wrong", "A window of items", "only A right: 3, only B right: 11"]:
            self.assertFalse(L.lint(ok), ok)
    def test_signed_exemption_needs_the_file(self):
        with tempfile.TemporaryDirectory() as d:
            txt = "The 0 of 290 is therefore not a safety result for the production configuration."
            (Path(d) / "signed.md").write_text("## A'\n\"" + txt + "\" [standing line]\n")
            sha = hashlib.sha256((Path(d) / "signed.md").read_bytes()).hexdigest()
            ok = {"id": "s", "text": txt, "signed_source": {"file": "signed.md", "sha256": sha, "quote": txt}}
            self.assertEqual(L.lint_items([ok], d), [])
            bad = {"id": "x", "text": "We outperform everyone, safer and better", "signed_source": {"file": "signed.md", "sha256": sha}}
            self.assertTrue(L.lint_items([bad], d))
            wrong_sha = dict(ok, signed_source={"file": "signed.md", "sha256": "0" * 64, "quote": txt})
            self.assertTrue(L.lint_items([wrong_sha], d))
            self.assertTrue(L.lint_items([{"id": "n", "text": txt}], d))   # no signed_source: linted

class SignedUnits(unittest.TestCase):
    def test_do_not_say_and_whole_sentence_only(self):
        with tempfile.TemporaryDirectory() as d:
            good = "On the 290 court-rejected items, the two setups differed on 31 items: no separation."
            body = "# Sentences\n\n## H\n\"" + good + "\" [standing line]\n\n## May NOT say\n\"beats\"; \"safer\"; \"the harness reduces false proofs and is better than everything\"\n\"We outperform everyone, safer and better than all the rest of them here\"\n"
            (Path(d) / "s.md").write_text(body)
            sha = hashlib.sha256((Path(d) / "s.md").read_bytes()).hexdigest()
            mk = lambda text: {"id": "x", "text": text, "signed_source": {"file": "s.md", "sha256": sha}}
            self.assertEqual(L.lint_items([mk(good)], d), [])                                    # whole quoted block, in a quotable section
            self.assertTrue(L.lint_items([mk("beats")], d))                                      # a fragment of the do-not-say line
            self.assertTrue(L.lint_items([mk("the harness reduces false proofs and is better than everything")], d))   # under a do-not-say heading
            self.assertTrue(L.lint_items([mk("We outperform everyone, safer and better than all the rest of them here")], d))
            self.assertTrue(L.lint_items([mk(good[:-1] + " and safer")], d))                      # an edited sentence is not the signed one
    def test_wins_flagged(self):
        for w in ["wins", "winner", "winners"]: self.assertTrue(L.lint(f"our arm {w}"), w)

class Validate(unittest.TestCase):
    def v(self, b, d): return V.validate({"blocks": [b]}, d)
    def test_pending_with_tables_fails(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(any("pending block carries numbers" in e for e in self.v(block(tables=[{"title": "t", "rows": [ROW]}]), d)))
    def test_pending_without_numbers_ok(self):
        with tempfile.TemporaryDirectory() as d: self.assertEqual(self.v(block(), d), [])
    def test_reviewed_good_block_passes(self):
        with tempfile.TemporaryDirectory() as d:
            b = reviewed(d, tables=[{"title": "t", "rows": [ROW]}], bounds=[BOUND], paired=[PAIR])
            self.assertEqual(self.v(b, d), [])
    def test_needs_both_reviewers_and_real_numbers_hash(self):
        with tempfile.TemporaryDirectory() as d:
            b = reviewed(d); b["reviews"] = b["reviews"][:1]
            self.assertTrue(any("both R1 and R2" in e for e in self.v(b, d)))
            b2 = reviewed(d); b2["numbers_sha256"] = "0" * 64
            self.assertTrue(any("does not match the recomputed hash" in e for e in self.v(b2, d)))
    def test_row_missing_n_or_bogus_ci_fails(self):
        with tempfile.TemporaryDirectory() as d:
            row = dict(ROW); del row["n"]
            self.assertTrue(any("missing n" in e for e in self.v(reviewed(d, tables=[{"title": "t", "rows": [row]}]), d)))
            bogus = dict(ROW, ci95=[0.0, 0.1])
            self.assertTrue(any("does not match the exact interval" in e for e in self.v(reviewed(d, tables=[{"title": "t", "rows": [bogus]}]), d)))
    def test_label_must_match_p(self):
        with tempfile.TemporaryDirectory() as d:
            p = dict(PAIR, p=0.03)
            self.assertTrue(any("disagrees with p" in e for e in self.v(reviewed(d, paired=[p]), d)))
            fam = dict(PAIR, p=0.03, holm_adjusted_p=0.09, label="separated", family="bbl-judges")
            self.assertTrue(any("disagrees with p" in e for e in self.v(reviewed(d, paired=[fam]), d)))
            fam_ok = dict(fam, label="no separation")
            self.assertEqual(self.v(reviewed(d, paired=[fam_ok]), d), [])
    def test_bbl_rows_need_protocol(self):
        with tempfile.TemporaryDirectory() as d:
            b = reviewed(d, id="bbl", kind_chip="Model legal knowledge (MCQ), not the harness", tables=[{"title": "t", "rows": [ROW]}])
            self.assertTrue(any("needs protocol" in e for e in self.v(b, d)))
            b["tables"][0]["rows"][0] = dict(ROW, protocol="log_likelihood")
            self.assertEqual(self.v(b, d), [])
    def test_leaderboard_and_vocabulary(self):
        with tempfile.TemporaryDirectory() as d:
            lb = {"name": "BBL", "url": "https://example.com/board", "rank": 3}
            errs = self.v(reviewed(d, leaderboard=lb), d)
            self.assertTrue(any("Space's own page" in e for e in errs)); self.assertTrue(any("as_of" in e for e in errs))
            self.assertTrue(any("kind_chip" in e for e in V.validate({"blocks": [block(kind_chip="Best harness ever", review_status="maybe")]}, d)))
    def test_every_string_is_linted(self):
        with tempfile.TemporaryDirectory() as d:
            for key in ("what_it_is", "what_it_is_not", "limits"):
                errs = self.v(block(**{key: "We outperform and beat the best"}), d)
                self.assertTrue(any("banned term" in e for e in errs), key)
            errs = self.v(reviewed(d, tables=[{"title": "The best table", "rows": [ROW]}]), d)
            self.assertTrue(any("banned term" in e for e in errs))
    def test_comparative_in_result_sentence_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            b = reviewed(d, paired=[PAIR])
            b["sentences"][0]["text"] = "Ours is stronger than the base (exact McNemar p = 1)."
            errs = self.v(b, d)
            self.assertTrue(any("not produced by its template" in e for e in errs)); self.assertTrue(any("missing generated result sentence" in e for e in errs))
            b2 = reviewed(d, paired=[PAIR]); b2["sentences"] = []
            self.assertTrue(any("missing generated result sentence" in e for e in self.v(b2, d)))
    def test_banned_text_cannot_hide_under_a_skipped_key(self):
        with tempfile.TemporaryDirectory() as d:
            b = reviewed(d, tables=[{"title": "t", "rows": [ROW]}])
            b["reviews"][0]["reviewer"] = "we beat everyone"
            self.assertTrue(any("bad format" in e for e in self.v(b, d)))
            b2 = reviewed(d, tables=[{"title": "t", "rows": [ROW]}]); b2["run"] = {"model_ids": ["we beat everyone"], "date": "2026-10-07"}
            self.assertTrue(any("bad format" in e for e in self.v(b2, d)))
            b3 = block(copy=[{"id": "x", "text": "ok", "signed_source": {"file": "we beat everyone", "sha256": "0" * 64}}])
            self.assertTrue(any("bad format" in e for e in self.v(b3, d)))
    def test_inconclusive_shows_numbers(self):
        with tempfile.TemporaryDirectory() as d:
            b = reviewed(d, bounds=[dict(BOUND, name="bound at the n reached", n=5)]); b["outcome"] = "inconclusive"
            self.assertEqual(self.v(b, d), [])

if __name__ == "__main__":
    unittest.main()
