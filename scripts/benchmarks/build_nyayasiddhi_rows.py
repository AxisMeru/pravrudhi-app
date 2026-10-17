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

# R1's "About this run" lines (15 Oct): each printed line is a WHOLE sentence of the signed manifest's notes, copied verbatim; NUM stands for a count. A missing, changed or duplicated required sentence fails the build.
# Never printed: spend, run directories (the "No seed" line is the one exact clause taken from inside a longer sentence, as R1 worded it).
# Splitting (R1, 15 Oct): at a full stop followed by a space and a capital letter, outside any (), [], {} and double quote; the notes' own lowercase identifier sentence "trained_on_public_items ..." also starts a sentence, and "Counted after the run, from the call log." stays with the sentence before it (R1's one line).
SMOKE = "The prompt's output-format line was changed after a smoke test on five invented items; no real item was used for that test."
PREFACE = "In NUM of NUM replies, the model wrote explanatory text before its answer object; the first answer object was counted as its answer. Counted after the run, from the call log."
TRAINED = "trained_on_public_items is false because we did not train or tune this model; what its vendor trained it on is not known to us."
NO_SEED = "No seed: the API offers none."
RERUN = "This arm was run again after a first 20-item run was stopped because a reply used up its output limit before giving an answer; the output limit was raised from 400 to 1000 tokens; no verdict from the stopped run was read or used."
NOT_A_COPY = "Not a copy of the product's contract selection; never read beside the product row as the same task."
CONTRACT_HASH = "contract_map.json 981218e2f961: "   # the one pinned removal from the S-harness contract sentence (R1)
HARNESS_CONTRACT = "Element by element against ONE pinned contract per family (" + CONTRACT_HASH + "CHEAT -> ipc415_damaging_act, TRUST -> ipc405_use_or_disposal; closed five-IPC candidate set); element replies are {decision, fact_id} with no element_id, and the runner joins each reply to its request by its own record (item_id, element_index)."
HARNESS_CHECK = "ESTABLISHED counts only with an integer fact_id from 1 to the item's sentence count (sentence_split.py 76c145ace3a7); otherwise NOT_ESTABLISHED, no repair, no second call; NOT_ESTABLISHED without a fact_id key is an ERROR; the check shows that the cited sentence exists, not that it supports the element."
OPEN_RUNON = "In NUM of NUM replies, the model wrote a complete answer object and then kept writing until it reached its output limit; the first answer object was counted as its answer."
OPEN_NOT_SERVED = "Not served (context rule: prompt tokens counted by the served model's own tokenizer + max_tokens 400 must fit the served max-model-len 4096; never truncated): NUM of NUM scored itemsWILDn_error = rows with error true (WILD)."
O1_STRAY = "In NUM of NUM replies, the model added a stray line after its answer object and then stopped; the first answer object was counted as its answer."   # required exactly when the notes mention a stray line (the obj1_dev run)
O1_HOURS = "Hours bound that applied to this arm: 2.5 hours per split; the 60 percent run-on stop rule did not fire (NUM of NUM and NUM of NUM replies ran on)."
OPEN_SEED = "Deviation from the registration: no vLLM seed was set (the registration named seed 682); decoding used temperature 0."
EXPOSURE = {"obj1_dev": "In this study, the allegation text of this split was sent to the Anthropic API, beginning with the stopped 20-item run; the registration records that it had not been sent to the API before.", "obj1b_minus_cruelty": "In this run, the allegation text of this split was sent to the Anthropic API again; it had been sent before, in an earlier study."}  # #355: API rows only
NOT_RUN_SENTENCE = "A scored NI138 item is outside the harness's contracts"   # #353: a row whose notes carry it was not given dishonoured-cheque items
ABOUT_ALL = [SMOKE, PREFACE]
ABOUT_BY_SYSTEM = {   # after the common lines, the trained line and overlap_check, and (API rows) the exposure line
    "nyayasiddhi-ref-S-direct": [RERUN, NO_SEED],
    "nyayasiddhi-ref-S-harness": [HARNESS_CONTRACT, NOT_A_COPY, HARNESS_CHECK, NO_SEED],
    "nyayasiddhi-open-O2": [OPEN_RUNON, OPEN_NOT_SERVED, OPEN_SEED],
    "nyayasiddhi-open-O1": [OPEN_RUNON, O1_STRAY, OPEN_NOT_SERVED, OPEN_SEED, O1_HOURS],
}
API_SYSTEMS = {"nyayasiddhi-ref-S-direct", "nyayasiddhi-ref-S-harness"}

def _pat(sentence):
    return re.compile(re.escape(sentence).replace("NUM", r"\d+").replace("WILD", r".+?"), re.S)

def split_notes(notes):
    """The notes' whole sentences (see the splitting rule above)."""
    out, depth, quote, start, i = [], 0, False, 0, 0
    while i < len(notes):
        c = notes[i]
        if c == '"': quote = not quote
        elif c in "([{": depth += 1
        elif c in ")]}": depth = max(0, depth - 1)
        elif c == "." and depth == 0 and not quote and i + 2 < len(notes) and notes[i + 1] == " " and (notes[i + 2].isupper() or notes.startswith("trained_on_public_items", i + 2)):
            out.append(notes[start:i + 1].strip()); start = i + 2
        elif c == ";" and depth == 0 and not quote and re.match(r" In \d+ of \d+ replies", notes[i + 1:i + 40]):   # the two published O2 manifests read "...not recomputed here; In 0 of 170 replies..." (decision A, 17 Oct: keep the published bytes): split there so the About-run sentence is found whole
            out.append(notes[start:i + 1].strip()); start = i + 2
        i += 1
    tail = notes[start:].strip()
    if tail: out.append(tail)
    merged = []
    for sent in out:
        if sent.startswith("Counted after the run, from the call log.") and merged: merged[-1] += " " + sent
        else: merged.append(sent)
    return merged

def balanced(line):
    return all(line.count(a) == line.count(b) for a, b in ("()", "{}", "[]"))

SERVED_ID = re.compile(r"scored items \((\w{12}) (\d+) tokens\);")
ERR_CLAUSE = re.compile(r"n_error = rows with error true \((\d+)(?:: (.+))?\)\.$", re.S)
MAXLEN = re.compile(r"served max-model-len (\d+);")
SCORED = re.compile(r"\): (\d+) of (\d+) scored items")
def plural(n, one, many): return f"{n} {one if n == 1 else many}"

def not_served_and_errors(sentence):
    """R1's pinned replacement (15 Oct) for the manifest's 'Not served (context rule: ...)' sentence: two plain lines built from the numbers parsed out of it (schema values never printed); None when the pattern or the numbers do not parse (the build then fails)."""
    m, c, e, ln = SCORED.search(sentence), MAXLEN.search(sentence), ERR_CLAUSE.search(sentence), None
    if not (m and c and e): return None
    a, b, L, n = int(m.group(1)), int(m.group(2)), int(c.group(1)), int(e.group(1))
    if a == 0: served = f"Not served: 0 of {b} scored items did not fit the served context length of {L} tokens; nothing was truncated."
    else:
        sid = SERVED_ID.search(sentence)
        if a != 1 or not sid or len(SERVED_ID.findall(sentence)) != 1: return None
        served = f"Not served: {a} of {b} scored items did not fit the served context length of {L} tokens ({sid.group(1)} {sid.group(2)} tokens); an item that is not served is never truncated, and is counted as not supported and marked as an error."
    parts = []
    detail = e.group(2) or ""
    ns = re.search(r"(\d+) not served for context", detail); un = re.search(r"(\d+) an unparsable reply", detail)
    if ns: parts.append(f"{plural(int(ns.group(1)), 'item', 'items')} not served for context")
    if un: parts.append(f"{plural(int(un.group(1)), 'reply', 'replies')} that could not be read as an answer" if int(un.group(1)) == 1 else f"{un.group(1)} replies that could not be read as an answer")
    if (int(ns.group(1)) if ns else 0) + (int(un.group(1)) if un else 0) != n or (n == 0 and detail): return None
    if n > 0 and not parts: return None
    errors = f"Errors: {n}" + (f" ({', '.join(parts)})" if parts else "") + "."
    return [served, errors]

def about_run(row, manifests):
    """The row's About-this-run lines and not-run groups from its manifest's notes: whole sentences copied verbatim, each required one exactly once, in R1's order; (lines, not_run, error)."""
    for path in manifests:
        raw = Path(path).read_bytes()
        if hashlib.sha256(raw).hexdigest() != row['manifest_sha256']: continue
        m = json.loads(raw); notes = m.get('notes'); system = m.get('system_name')
        if system not in ABOUT_BY_SYSTEM: return None, None, f"{row['row_id']}: reference arm with system_name {system!r}: no About-this-run list for it"
        if not isinstance(notes, str): return None, None, f"{row['row_id']}: manifest has no notes"
        sentences = split_notes(notes)
        exposure = []
        if system in API_SYSTEMS:
            if row.get("split") not in EXPOSURE: return None, None, f"{row['row_id']}: split {row.get('split')!r} has no exposure sentence"
            exposure = [EXPOSURE[row["split"]]]
        spec = [x for x in ABOUT_BY_SYSTEM[system] if x != O1_STRAY or "stray line" in notes]   # the stray-line sentence is required exactly when the notes mention a stray line
        want = ABOUT_ALL + [TRAINED] + exposure + spec
        got, errs = {}, []
        for sentence in want:
            if sentence == NO_SEED:
                hits = notes.count(NO_SEED); found = NO_SEED if hits == 1 else None
                if hits != 1: errs.append(f"{row['row_id']}: {NO_SEED!r} found {hits} times (needs exactly 1)")
            else:
                pinned = sentence == HARNESS_CONTRACT
                pat = _pat(sentence.replace(CONTRACT_HASH, "") if pinned else sentence)
                if pinned and notes.count(CONTRACT_HASH) != 1: errs.append(f"{row['row_id']}: the pinned contract_map fragment is not in the notes exactly once"); continue
                hits = [x for x in sentences if pat.fullmatch(x.replace(CONTRACT_HASH, "") if pinned else x)]
                if len(hits) != 1: errs.append(f"{row['row_id']}: required whole sentence found {len(hits)} times (needs exactly 1): {sentence[:70]!r}"); continue
                found = hits[0].replace(CONTRACT_HASH, "") if pinned else hits[0]
            if found is not None and sentence == OPEN_NOT_SERVED:
                pair = not_served_and_errors(found)
                if pair is None: errs.append(f"{row['row_id']}: the Not-served sentence did not parse into numbers (pinned replacement fails closed)"); continue
                got[sentence] = pair; continue
            if found is not None:
                if not balanced(found): errs.append(f"{row['row_id']}: printed line has unbalanced brackets: {found[:70]!r}")
                got[sentence] = found
        ov = m.get('overlap_check')
        if not isinstance(ov, str) or not ov.strip() or not balanced(ov): errs.append(f"{row['row_id']}: manifest overlap_check missing or unbalanced")
        if errs: return None, None, "; ".join(errs)
        arm = [y for x in spec if x != NO_SEED for y in (got[x] if isinstance(got[x], list) else [got[x]])]
        seed = [got[NO_SEED]] if NO_SEED in spec else []
        if system in API_SYSTEMS:
            # R1 (15 Oct): exposure, smoke, the arm's own lines (rerun / contract limits), preamble count, trained flag + overlap_check, then the no-seed line
            ordered = [got[exposure[0]], got[SMOKE]] + arm + [got[PREFACE], got[TRAINED], ov] + seed
        else:
            ordered = [got[SMOKE], got[PREFACE], got[TRAINED], ov] + arm + seed
        not_run = ["NI138"] if NOT_RUN_SENTENCE in notes else []
        return ordered, not_run, None
    return None, None, f"{row['row_id']}: no manifest in the manifests dir has sha256 {row['manifest_sha256'][:12]}"

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
                about, not_run, aerr = about_run(r, manifests)
                if aerr: errs.append(f"{label} ({aerr})"); continue
                r = dict(r, about_run=about, **({"not_run_groups": not_run} if not_run else {}))
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
