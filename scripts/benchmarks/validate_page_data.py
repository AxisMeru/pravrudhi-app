#!/usr/bin/env python3
"""#633 S4: validator for benchmark_results.json (contract v3). Stdlib only. Exits 1 and prints every violation.
Checks: closed vocabularies; a pending block carries no numbers; a reviewed block carries reviews from BOTH R1 and R2 (distinct, each with GitHub review URL, head sha, date),
a numbers_file whose sha256 is recomputed and must equal numbers_sha256; every table row has n, ci95 (recomputed exact Clopper-Pearson from correct and n) and, for the bbl
block, a protocol; every bound has n; every paired test has p, label and family, and the label must agree with the Holm-adjusted p (or the raw p when no family);
a leaderboard entry needs the Space's own URL and a date and a reviewed block; EVERY string value in a block (except ids, urls, shas, dates, review refs) passes lint_copy,
unless it is a substring of a signed source file whose sha256 matches (signed_source).
Usage: validate_page_data.py benchmark_results.json [--root DIR]   (DIR holds numbers_file and signed source files; default: the JSON's directory)"""
import hashlib, json, sys
from pathlib import Path
import re
import lint_copy
import page_templates
from bench_tables import cp_interval

KINDS = {"Model legal knowledge (MCQ), not the harness", "Citation checker, our own pre-registered study", "Own study, design not yet registered",
         "Harness vs the same model alone; United States law", "Sealed Indian court test, reviewed result"}
DATA = {"Real court-derived", "Public benchmark", "Model-generated questions", "Constructed"}
REVIEW = {"reviewed", "pending"}
OUTCOME = {"bar_met", "bar_not_met", "inconclusive", "descriptive", "n/a"}   # chips: Registered bar met / Registered bar not met / Inconclusive / Descriptive
BLOCKS = {"bbl", "citation", "legalbench", "sealed_court"}
PROTOCOLS = {"log_likelihood", "generative_json"}
# Fields that are not linted as prose have their FORMAT validated instead (a banned phrase cannot hide under such a key).
FORMATS = {
    "id": re.compile(r"^[A-Za-z0-9_.:-]{1,64}$"),
    "ref": re.compile(r"^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/\d+#pullrequestreview-\d+$"),
    "url": re.compile(r"^https://[A-Za-z0-9./_#?=&%-]+$"),
    "head_sha": re.compile(r"^[0-9a-f]{7,40}$"),
    "numbers_sha256": re.compile(r"^[0-9a-f]{64}$"), "scorer_sha256": re.compile(r"^[0-9a-f]{64}$"), "sha256": re.compile(r"^[0-9a-f]{64}$"),
    "date": re.compile(r"^\d{4}-\d{2}-\d{2}(T[0-9:.Z+-]+)?$"), "as_of": re.compile(r"^\d{4}-\d{2}-\d{2}(T[0-9:.Z+-]+)?$"),
    "numbers_file": re.compile(r"^[A-Za-z0-9_./-]+$"), "file": re.compile(r"^[A-Za-z0-9_./-]+$"),
    "dataset_revision": re.compile(r"^[A-Za-z0-9_.:/@-]+$"), "revision": re.compile(r"^[A-Za-z0-9_.:/@-]+$"),
    "reviewer": re.compile(r"^R[12]$"),
}
LIST_FORMATS = {"revisions": FORMATS["revision"], "model_ids": re.compile(r"^[A-Za-z0-9_.:/@-]+$")}
SKIP_KEYS = set(FORMATS) | set(LIST_FORMATS) | {"signed_source"}

def format_errors(o, path=""):
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "signed_source" and isinstance(v, dict):
                for kk in ("file", "sha256"):
                    if v.get(kk) is None or not FORMATS[kk].match(str(v[kk])): out.append(f"{path}/{k}/{kk}: bad format")
                continue
            if k in FORMATS and isinstance(v, str):
                if not FORMATS[k].match(v): out.append(f"{path}/{k}: bad format {v[:30]!r}")
            elif k in LIST_FORMATS and isinstance(v, list):
                for x in v:
                    if not isinstance(x, str) or not LIST_FORMATS[k].match(x): out.append(f"{path}/{k}: bad format {str(x)[:30]!r}")
            else:
                out.extend(format_errors(v, f"{path}/{k}"))
    elif isinstance(o, list):
        for i, v in enumerate(o): out.extend(format_errors(v, f"{path}[{i}]"))
    return out

def strings(o, key=None):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in SKIP_KEYS: continue
            yield from strings(v, k)
    elif isinstance(o, list):
        for v in o: yield from strings(o_item := v, key)
    elif isinstance(o, str):
        yield key, o

def validate(doc, root="."):
    errs = []
    for b in doc.get("blocks", []):
        bid = b.get("id")
        def e(msg): errs.append(f"{bid}: {msg}")
        if bid not in BLOCKS: e("unknown block id")
        if b.get("kind_chip") not in KINDS: e(f"kind_chip not in the fixed vocabulary: {b.get('kind_chip')!r}")
        if b.get("data_chip") not in DATA: e(f"data_chip not in the fixed vocabulary: {b.get('data_chip')!r}")
        rs, oc = b.get("review_status"), b.get("outcome")
        if rs not in REVIEW: e(f"review_status must be one of {sorted(REVIEW)}")
        if oc not in OUTCOME: e(f"outcome must be one of {sorted(OUTCOME)}")
        numbers = [k for k in ("tables", "paired", "bounds", "categories") if b.get(k)]
        if rs == "pending":
            if numbers: e(f"pending block carries numbers: {numbers}")
            if oc not in (None, "n/a"): e("a pending block has no outcome yet (use 'n/a')")
        if rs == "reviewed":
            revs = b.get("reviews") or []
            names = {r.get("reviewer") for r in revs}
            if not {"R1", "R2"} <= names: e(f"reviewed block needs reviews from both R1 and R2 (has {sorted(n for n in names if n)})")
            for r in revs:
                for k in ("reviewer", "ref", "head_sha", "date"):
                    if not r.get(k): e(f"review missing {k}")
            nf, nh = b.get("numbers_file"), b.get("numbers_sha256")
            if not nf or not nh: e("reviewed block needs numbers_file and numbers_sha256")
            elif not (Path(root) / nf).exists(): e(f"numbers_file {nf} not found under {root}")
            elif hashlib.sha256((Path(root) / nf).read_bytes()).hexdigest() != nh: e("numbers_sha256 does not match the recomputed hash of numbers_file")
            if oc == "n/a": e("a reviewed block needs an outcome (bar_met, bar_not_met, inconclusive or descriptive)")
            for t in b.get("tables", []):
                for row in t.get("rows", []):
                    tag = f"table '{t.get('title')}' row {row.get('arm')}/{row.get('group')}"
                    for k in ("n", "ci95", "correct"):
                        if row.get(k) is None: e(f"{tag} missing {k}")
                    if row.get("n") is not None and row.get("correct") is not None and row.get("ci95"):
                        lo, hi = cp_interval(row["correct"], row["n"])
                        if lo is None or abs(lo - row["ci95"][0]) > 2e-4 or abs(hi - row["ci95"][1]) > 2e-4:
                            e(f"{tag}: ci95 {row['ci95']} does not match the exact interval ({lo}, {hi}) for {row['correct']}/{row['n']}")
                    if bid == "bbl" and row.get("protocol") not in PROTOCOLS: e(f"{tag} needs protocol in {sorted(PROTOCOLS)}")
            for p in b.get("paired", []):
                for k in ("p", "label", "family"):
                    if p.get(k) is None: e(f"paired '{p.get('pair')}' missing {k}")
                if p.get("p") is not None and p.get("label") is not None:
                    eff = p.get("holm_adjusted_p") if (p.get("family") and not str(p["family"]).startswith("none")) and p.get("holm_adjusted_p") is not None else p["p"]
                    want = "no separation" if eff >= 0.05 else "separated"
                    if p["label"] != want: e(f"paired '{p.get('pair')}': label {p['label']!r} disagrees with p {eff} (expected {want!r})")
            for bd in b.get("bounds", []):
                for k in ("name", "value", "n", "kind"):
                    if bd.get(k) is None: e(f"bound '{bd.get('name')}' missing {k}")
        lb = b.get("leaderboard")
        if lb:
            if not str(lb.get("url", "")).startswith("https://huggingface.co/spaces/"): e("leaderboard url must be the Space's own page (https://huggingface.co/spaces/...)")
            if not lb.get("as_of"): e("leaderboard entry needs as_of")
            if rs != "reviewed": e("a leaderboard entry on a block that is not reviewed")
        # every string value is linted; signed text is exempt only through signed_source
        items = []
        for fe in format_errors(b, f"{bid}"): e(fe)
        for k, v in strings({kk: vv for kk, vv in b.items() if kk not in ("copy", "sentences")}): items.append({"id": k, "text": v})
        for c in b.get("copy", []): items.append({"id": c.get("id"), "text": c.get("text", ""), "signed_source": c.get("signed_source")})
        # result sentences must be generated from the data by template and carry their template id
        if rs == "reviewed":
            gen = {}
            def add(tid, data, what):
                try: gen[page_templates.generate(tid, data)] = tid
                except (KeyError, TypeError, ValueError) as ex: e(f"cannot generate the {what} sentence from the data (missing or bad field: {ex})")
            for t in b.get("tables", []):
                for row in t.get("rows", []): add("accuracy", row, "accuracy")
            for p in b.get("paired", []):
                tid = "paired_no_separation" if p.get("label") == "no separation" else "paired_separated"
                first, second = (p.get("pair", " vs ").split(" vs ") + ["", ""])[:2]
                add(tid, dict(p, first=first, second=second), "paired")
            for bd in b.get("bounds", []): add("bound", bd, "bound")
            have = {s.get("text"): s.get("template_id") for s in b.get("sentences", [])}
            for text, tid in gen.items():
                if text not in have: e(f"missing generated result sentence: {text[:80]!r}")
                elif have[text] != tid: e(f"sentence has template id {have[text]!r}, expected {tid!r}")
            for text in have:
                if text not in gen: e(f"result sentence not produced by its template from the data: {text[:80]!r}")
        for it in lint_copy.lint_items(items, root):
            e(f"banned term {it['term']!r} in {it['id']!r}: ...{it['context']}...")
    return errs

if __name__ == "__main__":
    args = sys.argv[1:]
    root = args[args.index("--root") + 1] if "--root" in args else str(Path(args[0]).parent)
    errs = validate(json.load(open(args[0])), root)
    for x in errs: print(x)
    sys.exit(1 if errs else 0)
