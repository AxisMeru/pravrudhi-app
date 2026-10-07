#!/usr/bin/env python3
"""#633 S4: accuracy tables and paired comparison for multiple-choice style benchmark runs (BhashaBench-Legal, LegalBench subsets).
Stdlib only. Input: JSONL per arm, one line per item: {"qid", "group" (e.g. language or subject, optional), "gold", "pred"}. pred may be null or
"INVALID"; both count as WRONG and are reported separately. Output: JSON with accuracy, exact 95% Clopper-Pearson interval, per-group rows,
invalid rate, and for two arms the paired exact two-sided McNemar test on the items both arms answered (discordant counts reported).
NO direction is stated by this script; the table builder labels p >= 0.05 as "no separation".
Pairing refuses arms on different item sets unless --allow-different-items is given (then only the intersection is paired and the difference is reported).
Multiplicity: the paired tests of one call, or of several earlier result files (--holm-from), form ONE named family when --holm-family NAME is given;
Holm-adjusted p values are then reported beside the raw ones. Without a named family the p values are labelled descriptive.
Usage: bench_tables.py --arm NAME=path.jsonl [--arm NAME2=path2.jsonl] --out out.json [--md out.md] [--alpha 0.05] [--holm-family NAME] [--holm-from a.json b.json] [--allow-different-items]"""
import argparse, json, math, sys
from collections import defaultdict
from pathlib import Path

def _pmf(i, n, p):
    if p <= 0.0: return 1.0 if i == 0 else 0.0
    if p >= 1.0: return 1.0 if i == n else 0.0
    return math.exp(math.lgamma(n + 1) - math.lgamma(i + 1) - math.lgamma(n - i + 1) + i * math.log(p) + (n - i) * math.log1p(-p))

def cp_interval(k, n, alpha=0.05):
    if n == 0: return (None, None)
    lo = 0.0
    if k > 0:
        l, h = 0.0, 1.0
        for _ in range(100):
            m = (l + h) / 2
            if sum(_pmf(i, n, m) for i in range(k, n + 1)) < alpha / 2: l = m
            else: h = m
        lo = h
    hi = 1.0
    if k < n:
        l, h = 0.0, 1.0
        for _ in range(100):
            m = (l + h) / 2
            if sum(_pmf(i, n, m) for i in range(0, k + 1)) > alpha / 2: l = m
            else: h = m
        hi = l
    return (round(lo, 5), round(hi, 5))

def mcnemar_exact(b, c):
    """Two-sided exact McNemar p from discordant counts b (A right, B wrong) and c (A wrong, B right)."""
    n = b + c
    if n == 0: return 1.0
    k = min(b, c)
    p = 2 * sum(math.comb(n, i) for i in range(0, k + 1)) / 2**n
    return min(1.0, p)

def holm_adjust(pvals):
    """Holm step-down adjusted p values, returned in the input order."""
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    adj = [None] * m
    run = 0.0
    for rank, i in enumerate(order):
        run = max(run, min(1.0, (m - rank) * pvals[i]))
        adj[i] = run
    return adj

def load(path):
    rows = {}
    for line in Path(path).read_text().splitlines():
        if not line.strip(): continue
        r = json.loads(line)
        if r["qid"] in rows: raise SystemExit(f"duplicate qid {r['qid']} in {path}")
        rows[r["qid"]] = r
    return rows

def correct(r):
    return r.get("pred") not in (None, "INVALID") and r["pred"] == r["gold"]

def summarise(rows, alpha):
    groups = defaultdict(list)
    for r in rows.values():
        groups["ALL"].append(r)
        if r.get("group") is not None: groups[str(r["group"])].append(r)
    out = {}
    for g, rs in sorted(groups.items()):
        k = sum(correct(r) for r in rs); n = len(rs)
        inv = sum(1 for r in rs if r.get("pred") in (None, "INVALID"))
        out[g] = {"n": n, "correct": k, "accuracy": k / n if n else None, "ci95": cp_interval(k, n, alpha), "invalid": inv, "invalid_rate": inv / n if n else None}
    return out

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", action="append", required=True, help="NAME=path.jsonl")
    ap.add_argument("--out", required=True); ap.add_argument("--md"); ap.add_argument("--alpha", type=float, default=0.05)
    ap.add_argument("--holm-family", default=None, help="name of the multiplicity family the paired tests belong to")
    ap.add_argument("--holm-from", nargs="*", default=[], help="earlier result JSONs whose paired tests join the family")
    ap.add_argument("--allow-different-items", action="store_true")
    a = ap.parse_args(argv)
    arms = {}
    for spec in a.arm:
        name, path = spec.split("=", 1); arms[name] = load(path)
    res = {"alpha": a.alpha, "arms": {n: summarise(r, a.alpha) for n, r in arms.items()}, "paired": {}}
    names = list(arms)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            A, B = arms[names[i]], arms[names[j]]
            if set(A) != set(B) and not a.allow_different_items:
                raise SystemExit(f"arms {names[i]} and {names[j]} are on different item sets ({len(set(A) ^ set(B))} items in only one); refusing to pair (use --allow-different-items only for a labelled intersection comparison)")
            ids = sorted(set(A) & set(B))
            gold_mismatch = [q for q in ids if A[q]["gold"] != B[q]["gold"]]
            if gold_mismatch: raise SystemExit(f"gold differs between arms on {len(gold_mismatch)} items")
            b = sum(1 for q in ids if correct(A[q]) and not correct(B[q])); c = sum(1 for q in ids if not correct(A[q]) and correct(B[q]))
            p = mcnemar_exact(b, c)
            res["paired"][f"{names[i]} vs {names[j]}"] = {"n_common": len(ids), "only_first_correct": b, "only_second_correct": c, "mcnemar_exact_two_sided_p": p,
                                                          "label": "no separation" if p >= a.alpha else "separated",
                                                          "label_note": "A direction is stated only from the discordant counts when the label is 'separated'; 'no separation' states no direction.",
                                                          "items_in_only_one_arm": len(set(A) ^ set(B))}
    if a.holm_family:
        entries = [(f"this call: {k}", v["mcnemar_exact_two_sided_p"], v) for k, v in res["paired"].items()]
        for path in a.holm_from:
            for k, v in json.loads(Path(path).read_text())["paired"].items():
                entries.append((f"{path}: {k}", v["mcnemar_exact_two_sided_p"], None))
        adj = holm_adjust([e[1] for e in entries])
        res["holm_family"] = {"name": a.holm_family, "alpha": a.alpha, "tests": [{"test": e[0], "p": e[1], "holm_adjusted_p": adj[n], "rejects_at_alpha": adj[n] < a.alpha} for n, e in enumerate(entries)]}
        for n, e in enumerate(entries):
            if e[2] is not None:
                e[2]["holm_adjusted_p"] = adj[n]; e[2]["family"] = a.holm_family
                # with a named family the label follows the Holm-adjusted p, never the raw p
                e[2]["label"] = "no separation" if adj[n] >= a.alpha else "separated"
    else:
        for v in res["paired"].values(): v["family"] = "none: descriptive, unadjusted"
    Path(a.out).write_text(json.dumps(res, indent=1, sort_keys=True))
    if a.md:
        lines = ["| Arm | Group | n | Correct | Accuracy | 95% CI | Invalid |", "|---|---|---|---|---|---|---|"]
        for n, g in res["arms"].items():
            for gk, v in g.items():
                lines.append(f"| {n} | {gk} | {v['n']} | {v['correct']} | {v['accuracy']:.4f} | {v['ci95'][0]:.4f} to {v['ci95'][1]:.4f} | {v['invalid']} |")
        Path(a.md).write_text("\n".join(lines) + "\n")
    print(json.dumps({"arms": list(res["arms"]), "paired": {k: v["mcnemar_exact_two_sided_p"] for k, v in res["paired"].items()}}))

if __name__ == "__main__":
    sys.exit(main())
