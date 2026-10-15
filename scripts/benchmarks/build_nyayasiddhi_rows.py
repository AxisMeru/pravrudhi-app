#!/usr/bin/env python3
"""app#344: build the /benchmarks results data file from SIGNED NyayaSiddhi result rows (append-only JSONL, result_row schema; validated upstream with validate_674.py).
Usage: build_nyayasiddhi_rows.py --rows results.jsonl --kinds entry_kinds.json --manifests manifests/ [--sensitivity ROW_ID=error_sensitivity.json ...] --out frontend/src/data/nyayasiddhi/rows.json
Checks, and exits 1 with every violation: each line is a JSON object with the result_row keys; status/split/unit in the closed vocabularies; every metric carries k, n and an exact 95% Clopper-Pearson
interval that this script RECOMPUTES (bench_tables.cp_interval, 5 decimals) and must equal; a row carries BOTH measures (false_proof, coverage); an organiser entry has an entry kind in the kinds file
(row_id -> "product" | "reference_arm"), set by hand by the organisers and never inferred from a name; an outside entry has none. Nothing is edited or added except entry_kind and, for a row with --sensitivity, its error_sensitivity block (how each figure changes when errors are counted the other way); that file's n_error must equal the row's, and for every "measure|group" its n and k_as_not_proof must equal the row's own n and k (the rows count errors as not-proof). The source file's sha256 is recorded.
Stdlib only."""
import argparse, hashlib, json, re, sys
from pathlib import Path
from bench_tables import cp_interval

REQUIRED = ["row_id", "status", "benchmark_version", "split", "unit", "system_name", "system_version", "manifest_sha256", "scorer_sha", "run_date", "metrics", "supersedes", "superseded_by", "error_mapping", "n_error"]
STATUS = {"self-reported", "re-scored", "reproduced", "third-party verified"}
SPLIT = {"obj1_dev", "obj1b_minus_cruelty"}
UNIT = {"whole_item", "element"}
KINDS = {"product", "reference_arm"}
MEASURES = {"false_proof", "coverage"}
# the manifest stack values the page has words for (anything else fails the build, and the page would not show the row)
ALLOWED_STACKS = {"dev stack (local)", "Anthropic API (organiser-run reference arm; not the dev stack, not the production stack)"}

def check_row(r, kinds, line_no):
    errs = []
    where = line_no if isinstance(line_no, str) else f"line {line_no}"
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

def check_sensitivity(r, sens, line_label):
    errs = []
    if sens.get('n_error') != r['n_error']: errs.append(f"{line_label}: sensitivity n_error {sens.get('n_error')!r} != row n_error {r['n_error']!r}")
    if r.get('error_mapping') != 'error_counted_as_not_proof': errs.append(f"{line_label}: the row's error_mapping must be error_counted_as_not_proof for a sensitivity block")
    by = {(m['name'], m.get('group', 'ALL')): m for m in r['metrics']}
    for key, v in sens.get('metrics', {}).items():
        name, _, group = key.partition('|')
        m = by.get((name, group))
        if m is None: errs.append(f"{line_label}: sensitivity key {key!r} has no metric in the row"); continue
        if v.get('n') != m['n'] or v.get('k_as_not_proof') != m['k']: errs.append(f"{line_label}: {key}: sensitivity n/k_as_not_proof {v.get('n')}/{v.get('k_as_not_proof')} != row {m['n']}/{m['k']}")
        if not isinstance(v.get('k_as_proof'), int) or not isinstance(v.get('agree'), bool): errs.append(f"{line_label}: {key}: k_as_proof/agree")
        elif v['agree'] != (v['k_as_proof'] == v['k_as_not_proof']): errs.append(f"{line_label}: {key}: agree {v['agree']!r} is not recomputed from k_as_proof {v['k_as_proof']} and k_as_not_proof {v['k_as_not_proof']}")
    return errs

def stack_of(row, manifests):
    """The row's manifest stack: the manifest is the file in the manifests dir whose sha256 equals the row's manifest_sha256; its stack must be one the page words."""
    for path in manifests:
        raw = Path(path).read_bytes()
        if hashlib.sha256(raw).hexdigest() == row['manifest_sha256']:
            stack = json.loads(raw).get('stack')
            if stack in ALLOWED_STACKS: return stack, None
            return None, f"{row['row_id']}: manifest stack {stack!r} is not one the page has words for {sorted(ALLOWED_STACKS)}"
    return None, f"{row['row_id']}: no manifest in the manifests dir has sha256 {row['manifest_sha256'][:12]}"

# R1's "About this run" lines (15 Oct): copied VERBATIM from the signed manifest's notes by exact match; NUM stands for a count. A missing or altered sentence fails the build. Never printed: hashes, paths, spend, run directories.
SMOKE = "The prompt's output-format line was changed after a smoke test on five invented items; no real item was used for that test."
PREFACE = "In NUM of NUM replies, the model wrote explanatory text before its answer object; the first answer object was counted as its answer. Counted after the run, from the call log."
TRAINED = "trained_on_public_items is false because we did not train or tune this model; what its vendor trained it on is not known to us."
ABOUT_ALL = [SMOKE, PREFACE, TRAINED]
ABOUT_BY_SYSTEM = {
    "nyayasiddhi-ref-S-direct": ["This arm was run again after a first 20-item run was stopped because a reply used up its output limit before giving an answer; the output limit was raised from 400 to 1000 tokens; no verdict from the stopped run was read or used.", "No seed: the API offers none."],
    "nyayasiddhi-ref-S-harness": ["Element by element against ONE pinned contract per family", "Not a copy of the product's contract selection; never read beside the product row as the same task.", "the check shows that the cited sentence exists, not that it supports the element", "No seed: the API offers none."],
    "nyayasiddhi-open-O2": ["In NUM of NUM replies, the model wrote a complete answer object and then kept writing until it reached its output limit; the first answer object was counted as its answer.", "Not served (context rule: prompt tokens counted by the served model's own tokenizer + max_tokens 400 must fit the served max-model-len 4096; never truncated): NUM of NUM scored items", "Deviation from the registration: no vLLM seed was set (the registration named seed 682); decoding used temperature 0."],
}
ABOUT_IF_ERRORS = {"nyayasiddhi-open-O2": "n_error = rows with error true (NUM: 1 not served for context, 1 an unparsable reply"}  # cut before the item id; used when the row has errors

def _pat(sentence): return re.compile(re.escape(sentence).replace("NUM", r"\d+"))

def about_run(row, manifests):
    """The row's About-this-run lines from its manifest's notes (exact match, each exactly once, in R1's order), or (None, error)."""
    for path in manifests:
        raw = Path(path).read_bytes()
        if hashlib.sha256(raw).hexdigest() != row['manifest_sha256']: continue
        m = json.loads(raw); notes = m.get('notes'); system = m.get('system_name')
        if system not in ABOUT_BY_SYSTEM: return None, f"{row['row_id']}: reference arm with system_name {system!r}: no About-this-run list for it"
        if not isinstance(notes, str): return None, f"{row['row_id']}: manifest has no notes"
        want = ABOUT_ALL[:2] + ABOUT_BY_SYSTEM[system] + ([ABOUT_IF_ERRORS[system]] if row.get("n_error", 0) > 0 and system in ABOUT_IF_ERRORS else [])
        lines, errs = [], []
        for sentence in want:
            hits = _pat(sentence).findall(notes)
            if len(hits) != 1: errs.append(f"{row['row_id']}: required notes sentence found {len(hits)} times (needs exactly 1): {sentence[:70]!r}")
            else: lines.append(hits[0])
        ov = m.get('overlap_check')
        if not isinstance(ov, str) or not ov.strip(): errs.append(f"{row['row_id']}: manifest overlap_check missing")
        if len(_pat(TRAINED).findall(notes)) != 1: errs.append(f"{row['row_id']}: trained_on_public_items sentence not found exactly once")
        if errs: return None, "; ".join(errs)
        # order: smoke, preface, trained + overlap, then the arm's own lines (the seed line last)
        head = lines[:2] + [TRAINED, ov]
        return head + lines[2:], None
    return None, f"{row['row_id']}: no manifest in the manifests dir has sha256 {row['manifest_sha256'][:12]}"

def build(rows_path, kinds_path, sens_paths=None, manifests_dir=None):
    rows_paths = [rows_path] if isinstance(rows_path, (str, Path)) else list(rows_path)
    mdirs = [] if not manifests_dir else ([manifests_dir] if isinstance(manifests_dir, (str, Path)) else list(manifests_dir))
    manifests = sorted(str(p) for d in mdirs for p in Path(d).iterdir() if p.is_file())
    sens_all = {rid: json.loads(Path(p).read_text()) for rid, p in (sens_paths or {}).items()}
    sens_sha = {rid: hashlib.sha256(Path(p).read_bytes()).hexdigest() for rid, p in (sens_paths or {}).items()}
    kinds = json.loads(Path(kinds_path).read_text())
    rows, errs, shas = [], [], {}
    for rp in rows_paths:
      raw = Path(rp).read_bytes()
      shas[f"{Path(rp).parent.name}/{Path(rp).name}"] = hashlib.sha256(raw).hexdigest()
      for i, line in enumerate(raw.decode().splitlines(), 1):
        label = f"{Path(rp).parent.name}/{Path(rp).name} line {i}"
        if not line.strip(): continue
        try: r = json.loads(line)
        except ValueError as e: errs.append(f"{label}: not JSON ({e})"); continue
        e = check_row(r, kinds, label)
        errs += e
        if not e:
            stack, serr = stack_of(r, manifests)
            if serr: errs.append(f"{label} ({serr})"); continue
            r = dict(r, stack=stack)
            if r.get("organiser_entry") is True: r = dict(r, entry_kind=kinds[r["row_id"]])
            if r.get("entry_kind") == "reference_arm":
                about, aerr = about_run(r, manifests)
                if aerr: errs.append(f"{label} ({aerr})"); continue
                r = dict(r, about_run=about)
            if r.get("n_error", 0) > 0 and r["row_id"] not in sens_all:
                errs.append(f"{label} ({r['row_id']}): n_error {r['n_error']} > 0 needs an error-sensitivity file (--sensitivity ROW_ID=file); the page must not print a bare count")
                continue
            if r["row_id"] in sens_all:
                es = check_sensitivity(r, sens_all[r["row_id"]], f"{label} ({r['row_id']})")
                errs += es
                if not es: r = dict(r, error_sensitivity=sens_all[r["row_id"]]["metrics"])
            rows.append(r)
    ids = [r["row_id"] for r in rows]
    if len(set(ids)) != len(ids): errs.append("duplicate row_id")
    for rid in set(sens_all) - set(ids): errs.append(f"sensitivity for a row that is not in the file: {rid}")
    unknown = set(kinds) - set(ids)
    if unknown: errs.append(f"entry kinds for rows that are not in the file: {sorted(unknown)}")
    src = {"rows_file_sha256": next(iter(shas.values()))} if len(shas) == 1 else {"rows_files_sha256": shas}
    return {"source": {**src, "rows": len(rows), "error_sensitivity_sha256": sens_sha, "benchmark": "NyayaSiddhi, HF AxisMeru/nyayasiddhi"}, "rows": rows}, errs

def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument("--rows", action="append", required=True, help="a signed rows JSONL; repeat for several files (their rows are kept in the order given)"); ap.add_argument("--kinds", required=True); ap.add_argument("--manifests", action="append", required=True, help="dir of the signed manifests (repeatable) (each row's manifest_sha256 must match one file); its stack is carried into the row"); ap.add_argument("--sensitivity", action="append", default=[], help="ROW_ID=error_sensitivity.json"); ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    data, errs = build(a.rows, a.kinds, dict(x.split('=', 1) for x in a.sensitivity), a.manifests)
    for e in errs: print("[FAIL]", e)
    if errs: return 1
    Path(a.out).write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")
    print(f"[OK] {len(data['rows'])} rows from {len(a.rows)} file(s): " + ", ".join(f"{k} {v[:12]}" for k, v in (data['source'].get('rows_files_sha256') or {Path(a.rows[0]).parent.name + '/' + Path(a.rows[0]).name: data['source']['rows_file_sha256']}).items()))
    return 0

if __name__ == "__main__":
    sys.exit(main())
