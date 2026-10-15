#!/usr/bin/env python3
"""app#344: build the /benchmarks results data file from SIGNED NyayaSiddhi result rows (append-only JSONL, result_row schema; validated upstream with validate_674.py).
Usage: build_nyayasiddhi_rows.py --rows results.jsonl --kinds entry_kinds.json --out frontend/src/data/nyayasiddhi/rows.json
Checks, and exits 1 with every violation: each line is a JSON object with the result_row keys; status/split/unit in the closed vocabularies; every metric carries k, n and an exact 95% Clopper-Pearson
interval that this script RECOMPUTES (bench_tables.cp_interval, 5 decimals) and must equal; a row carries BOTH measures (false_proof, coverage); an organiser entry has an entry kind in the kinds file
(row_id -> "product" | "reference_arm"), set by hand by the organisers and never inferred from a name; an outside entry has none. Nothing is edited or added except entry_kind; the source file's sha256 is recorded.
Stdlib only."""
import argparse, hashlib, json, sys
from pathlib import Path
from bench_tables import cp_interval

REQUIRED = ["row_id", "status", "benchmark_version", "split", "unit", "system_name", "system_version", "manifest_sha256", "scorer_sha", "run_date", "metrics", "supersedes", "superseded_by", "error_mapping", "n_error"]
STATUS = {"self-reported", "re-scored", "reproduced", "third-party verified"}
SPLIT = {"obj1_dev", "obj1b_minus_cruelty"}
UNIT = {"whole_item", "element"}
KINDS = {"product", "reference_arm"}
MEASURES = {"false_proof", "coverage"}

def check_row(r, kinds, line_no):
    errs = []
    where = f"line {line_no}"
    if not isinstance(r, dict): return [f"{where}: not a JSON object"]
    for k in REQUIRED:
        if k not in r: errs.append(f"{where}: missing {k}")
    if errs: return errs
    where = f"{where} ({r['row_id']})"
    if r["status"] not in STATUS: errs.append(f"{where}: status {r['status']!r}")
    if r["split"] not in SPLIT: errs.append(f"{where}: split {r['split']!r}")
    if r["unit"] not in UNIT: errs.append(f"{where}: unit {r['unit']!r}")
    seen = set()
    for m in r["metrics"]:
        if m.get("name") not in MEASURES: errs.append(f"{where}: metric name {m.get('name')!r}"); continue
        seen.add(m["name"])
        k, n = m.get("k"), m.get("n")
        if not (isinstance(k, int) and isinstance(n, int) and 0 <= k <= n): errs.append(f"{where}: {m['name']} {m.get('group')}: k={k!r} n={n!r}"); continue
        lo, hi = cp_interval(k, n)
        if m.get("interval_method") != "clopper-pearson-exact" or m.get("interval_level") != 0.95: errs.append(f"{where}: {m['name']} {m.get('group')}: interval method/level")
        if (m.get("ci_low"), m.get("ci_high")) != (lo, hi): errs.append(f"{where}: {m['name']} {m.get('group')}: interval {m.get('ci_low')}..{m.get('ci_high')} != exact {lo}..{hi} for {k} of {n}")
    if seen != MEASURES: errs.append(f"{where}: a row carries BOTH measures, has {sorted(seen)}")
    if r.get("organiser_entry") is True:
        if kinds.get(r["row_id"]) not in KINDS: errs.append(f"{where}: an organiser entry needs an entry kind in the kinds file ({sorted(KINDS)})")
    elif r["row_id"] in kinds: errs.append(f"{where}: an outside entry carries no entry kind")
    return errs

def build(rows_path, kinds_path):
    raw = Path(rows_path).read_bytes()
    kinds = json.loads(Path(kinds_path).read_text())
    rows, errs = [], []
    for i, line in enumerate(raw.decode().splitlines(), 1):
        if not line.strip(): continue
        try: r = json.loads(line)
        except ValueError as e: errs.append(f"line {i}: not JSON ({e})"); continue
        e = check_row(r, kinds, i)
        errs += e
        if not e:
            if r.get("organiser_entry") is True: r = dict(r, entry_kind=kinds[r["row_id"]])
            rows.append(r)
    ids = [r["row_id"] for r in rows]
    if len(set(ids)) != len(ids): errs.append("duplicate row_id")
    unknown = set(kinds) - set(ids)
    if unknown: errs.append(f"entry kinds for rows that are not in the file: {sorted(unknown)}")
    return {"source": {"rows_file_sha256": hashlib.sha256(raw).hexdigest(), "rows": len(rows), "benchmark": "NyayaSiddhi, HF AxisMeru/nyayasiddhi"}, "rows": rows}, errs

def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument("--rows", required=True); ap.add_argument("--kinds", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    data, errs = build(a.rows, a.kinds)
    for e in errs: print("[FAIL]", e)
    if errs: return 1
    Path(a.out).write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")
    print(f"[OK] {len(data['rows'])} rows, source sha256 {data['source']['rows_file_sha256'][:12]}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
