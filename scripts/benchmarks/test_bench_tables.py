import json, math, tempfile, unittest
from pathlib import Path
import bench_tables as T

def wr(d, name, rows):
    p = Path(d) / name; p.write_text("\n".join(json.dumps(r) for r in rows)); return str(p)

class Tests(unittest.TestCase):
    def test_cp_known_values(self):
        lo, hi = T.cp_interval(0, 100); self.assertEqual(lo, 0.0); self.assertAlmostEqual(hi, 1 - 0.025 ** (1 / 100), places=4)
        lo, hi = T.cp_interval(50, 100); self.assertAlmostEqual(lo, 0.3983, places=3); self.assertAlmostEqual(hi, 0.6017, places=3)
        self.assertEqual(T.cp_interval(0, 0), (None, None))
    def test_mcnemar_exact(self):
        self.assertAlmostEqual(T.mcnemar_exact(3, 11), 0.0574, places=3)   # the M4 H shape (14 discordant, 3 vs 11)
        self.assertEqual(T.mcnemar_exact(0, 0), 1.0)
        self.assertEqual(T.mcnemar_exact(5, 5), 1.0)
    def test_tables_and_pairing(self):
        with tempfile.TemporaryDirectory() as d:
            gold = ["A", "B", "C", "D"] * 5
            a = [{"qid": f"q{i}", "group": "EN" if i < 10 else "HI", "gold": g, "pred": g} for i, g in enumerate(gold)]            # all right
            b = [{"qid": f"q{i}", "group": "EN" if i < 10 else "HI", "gold": g, "pred": g if i % 2 == 0 else "INVALID" if i == 1 else "Z"} for i, g in enumerate(gold)]
            out = Path(d) / "o.json"
            T.main(["--arm", f"ours={wr(d,'a.jsonl',a)}", "--arm", f"base={wr(d,'b.jsonl',b)}", "--out", str(out), "--md", str(Path(d) / "o.md")])
            r = json.loads(out.read_text())
            self.assertEqual(r["arms"]["ours"]["ALL"]["correct"], 20)
            self.assertEqual(r["arms"]["base"]["ALL"]["correct"], 10)
            self.assertEqual(r["arms"]["base"]["ALL"]["invalid"], 1)
            self.assertEqual(r["arms"]["base"]["EN"]["n"], 10)
            p = r["paired"]["ours vs base"]
            self.assertEqual((p["only_first_correct"], p["only_second_correct"], p["n_common"]), (10, 0, 20))
            self.assertLess(p["mcnemar_exact_two_sided_p"], 0.01)
            self.assertIn("| ours | ALL |", (Path(d) / "o.md").read_text())
    def test_gold_mismatch_refuses(self):
        with tempfile.TemporaryDirectory() as d:
            a = [{"qid": "q1", "gold": "A", "pred": "A"}]; b = [{"qid": "q1", "gold": "B", "pred": "B"}]
            with self.assertRaises(SystemExit): T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o.json")])
    def test_duplicate_refuses(self):
        with tempfile.TemporaryDirectory() as d:
            a = [{"qid": "q1", "gold": "A", "pred": "A"}, {"qid": "q1", "gold": "A", "pred": "A"}]
            with self.assertRaises(SystemExit): T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--out", str(Path(d) / "o.json")])
    def test_different_item_sets_refused_by_default(self):
        with tempfile.TemporaryDirectory() as d:
            a = [{"qid": "q1", "gold": "A", "pred": "A"}, {"qid": "q2", "gold": "A", "pred": "A"}]
            b = [{"qid": "q1", "gold": "A", "pred": "A"}]
            with self.assertRaises(SystemExit): T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o.json")])
            T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o2.json"), "--allow-different-items"])
            p = json.loads((Path(d) / "o2.json").read_text())["paired"]["x vs y"]
            self.assertEqual((p["n_common"], p["items_in_only_one_arm"]), (1, 1))
    def test_label_is_plain_and_note_separate(self):
        with tempfile.TemporaryDirectory() as d:
            a = [{"qid": f"q{i}", "gold": "A", "pred": "A"} for i in range(20)]
            b = [{"qid": f"q{i}", "gold": "A", "pred": "B"} for i in range(20)]
            T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o.json")])
            p = json.loads((Path(d) / "o.json").read_text())["paired"]["x vs y"]
            self.assertEqual(p["label"], "separated"); self.assertIn("discordant counts", p["label_note"]); self.assertEqual(p["family"], "none: descriptive, unadjusted")
    def test_holm(self):
        adj = T.holm_adjust([0.01, 0.04, 0.03])
        self.assertAlmostEqual(adj[0], 0.03); self.assertAlmostEqual(adj[2], 0.06); self.assertAlmostEqual(adj[1], 0.06)  # Holm: 3x.01, then max(.03, 2x.03), then max(.06, 1x.04)
    def test_holm_family_across_files(self):
        with tempfile.TemporaryDirectory() as d:
            a = [{"qid": f"q{i}", "gold": "A", "pred": "A"} for i in range(20)]
            b = [{"qid": f"q{i}", "gold": "A", "pred": "A" if i % 4 == 0 else "B"} for i in range(20)]
            T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o1.json")])
            T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o2.json"), "--holm-family", "bbl-judges", "--holm-from", str(Path(d) / "o1.json")])
            r = json.loads((Path(d) / "o2.json").read_text())
            self.assertEqual(len(r["holm_family"]["tests"]), 2)
            self.assertAlmostEqual(r["holm_family"]["tests"][0]["holm_adjusted_p"], min(1.0, 2 * r["holm_family"]["tests"][0]["p"]))
            self.assertEqual(r["paired"]["x vs y"]["family"], "bbl-judges")
    def test_label_follows_holm_adjusted_p(self):
        with tempfile.TemporaryDirectory() as d:
            # 3-test family: raw p about 0.03 in each is NOT separated after Holm
            def mk(n_only_a, n_only_b, tag):
                a = [{"qid": f"q{i}", "gold": "A", "pred": "A"} for i in range(n_only_a + n_only_b)]
                b = [{"qid": f"q{i}", "gold": "A", "pred": "A" if i >= n_only_a else "B"} for i in range(n_only_a + n_only_b)]
                # first arm right on all; second arm right only on the last n_only_b ... gives discordant n_only_a vs 0
                return wr(d, f"{tag}a.jsonl", a), wr(d, f"{tag}b.jsonl", b)
            a1, b1 = mk(7, 0, "x1"); a2, b2 = mk(7, 0, "x2"); a3, b3 = mk(7, 0, "x3")
            for k, (a, b) in enumerate([(a1, b1), (a2, b2)], 1):
                T.main(["--arm", f"x={a}", "--arm", f"y={b}", "--out", str(Path(d) / f"o{k}.json")])
            T.main(["--arm", f"x={a3}", "--arm", f"y={b3}", "--out", str(Path(d) / "o3.json"), "--holm-family", "fam", "--holm-from", str(Path(d) / "o1.json"), str(Path(d) / "o2.json")])
            r = json.loads((Path(d) / "o3.json").read_text())["paired"]["x vs y"]
            self.assertLess(r["mcnemar_exact_two_sided_p"], 0.05)          # raw p 0.0156
            self.assertGreaterEqual(r["holm_adjusted_p"], 0.0468)
            self.assertEqual(r["label"], "separated" if r["holm_adjusted_p"] < 0.05 else "no separation")
    def test_no_label_when_not_significant(self):
        with tempfile.TemporaryDirectory() as d:
            a = [{"qid": f"q{i}", "gold": "A", "pred": "A" if i < 5 else "B"} for i in range(10)]
            b = [{"qid": f"q{i}", "gold": "A", "pred": "A" if 2 <= i < 7 else "B"} for i in range(10)]
            T.main(["--arm", f"x={wr(d,'a.jsonl',a)}", "--arm", f"y={wr(d,'b.jsonl',b)}", "--out", str(Path(d) / "o.json")])
            self.assertEqual(json.loads((Path(d) / "o.json").read_text())["paired"]["x vs y"]["label"], "no separation")

if __name__ == "__main__":
    unittest.main()
