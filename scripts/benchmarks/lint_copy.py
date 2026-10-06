#!/usr/bin/env python3
"""#633 S4: banned-word lint for benchmark page copy. Stdlib only. Case, hyphen and extra-space tolerant; matches word STEMS so inflections are caught
(outperforming, improvements, beating, validation, winning, trending, reliably, superiority ...). Comparatives ("stronger", "higher than") cannot be linted:
every result sentence on the page is generated from the data by template, and free text is limited to what_it_is / what_it_is_not / limits.
Exemption: ONLY text that is a substring of a signed source file whose sha256 matches ({"signed_source": {"file","sha256","quote"}} checked against --signed-root).
'significant' is allowed only when the same string names the test (McNemar).
Usage: lint_copy.py items.json [--signed-root DIR]   (items: [{"id","text","signed_source"?}]); exits 1 and prints violations."""
import hashlib, json, re, sys
from pathlib import Path

STEMS = ["outperform", "improv", "beat", "valid", "winn", "win", "wins", "winner", "winners", "won", "trend", "reliab", "superior", "gain", "safe", "safer", "safest", "safety", "equivalen", "comparab",
         "accurate", "accurately", "robust", "proven", "certif", "guarantee", "top", "leading", "leader", "leaders", "leads", "best", "better", "worse", "parity", "slightly", "tends", "tend to"]
DIRECTION = ["higher", "lower", "stronger", "weaker", "greater", "ahead", "above", "below"]   # a direction in free text is never allowed; directions come from the generated sentences
PHRASES = DIRECTION + ["state of the art", "sota", "best in class", "on par", "as good as", "matches", "first", "lift"]
SPECIAL = {"#1": re.compile(r"(?<!\w)#\s*1(?!\d)")}
NAMED_TEST = re.compile(r"mcnemar", re.I)
EXACT_ONLY = {"win", "wins", "winner", "winners", "won", "top", "first", "lift", "leading", "leader", "leaders", "leads", "tends"}   # whole word only: "leaderboard(s)" is a noun we need and stays allowed   # whole word only (avoid window, topic, lifting ...)

def norm(t):
    return re.sub(r"\s+", " ", t.lower().replace("-", " ").replace("‑", " ").replace("–", " ").replace("_", " "))

def lint(text):
    n = norm(text)
    hits = []
    for w in STEMS:
        rx = (r"(?<![a-z])" + re.escape(w) + r"(?![a-z])") if w in EXACT_ONLY else (r"(?<![a-z])" + re.escape(w) + r"[a-z]*")
        for m in re.finditer(rx, n):
            hits.append((w, n[max(0, m.start() - 25):m.end() + 25]))
    for w in PHRASES:
        for m in re.finditer(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", n):
            hits.append((w, n[max(0, m.start() - 25):m.end() + 25]))
    for name, rx in SPECIAL.items():
        for m in rx.finditer(n):
            hits.append((name, n[max(0, m.start() - 25):m.end() + 25]))
    if re.search(r"significan", n) and not NAMED_TEST.search(text):
        m = re.search(r"significan", n)
        hits.append(("significant (test not named)", n[max(0, m.start() - 25):m.end() + 25]))
    return hits

NOT_SAY = re.compile(r"not say|do not|don't|never|forbidden|banned|may not", re.I)
MIN_SIGNED_LEN = 60

def signed_units(body):
    """Whole quoted blocks (a line that starts and ends with a double quote, an optional trailing [standing line] tag) from the sections of a signed sentence file that
    are NOT do-not-say sections, plus each whole sentence of those blocks (>= MIN_SIGNED_LEN characters)."""
    units, section_ok = set(), True
    for line in body.split("\n"):
        if line.startswith("#"):
            section_ok = not NOT_SAY.search(line)
            continue
        if not section_ok: continue
        l = re.sub(r"\s*\[standing line\]\s*$", "", line.strip())
        if len(l) > 2 and l[0] == '"' and l[-1] == '"':
            u = l[1:-1]
            units.add(u)
            for sent in re.split(r"(?<=[.;]) (?=[A-Z\"(])", u):
                units.add(sent.strip())
    return {u for u in units if len(u) >= MIN_SIGNED_LEN}

def signed_ok(item, signed_root):
    src = item.get("signed_source")
    if not src or signed_root is None: return False
    p = Path(signed_root) / src["file"]
    if not p.exists(): return False
    data = p.read_bytes()
    if hashlib.sha256(data).hexdigest() != src.get("sha256"): return False
    return item["text"].strip() in signed_units(data.decode("utf-8", "replace"))

def lint_items(items, signed_root=None):
    out = []
    for it in items:
        if signed_ok(it, signed_root): continue
        for w, ctx in lint(it["text"]):
            out.append({"id": it.get("id"), "term": w, "context": ctx})
    return out

if __name__ == "__main__":
    args = sys.argv[1:]
    root = args[args.index("--signed-root") + 1] if "--signed-root" in args else None
    v = lint_items(json.load(open(args[0])), root)
    for x in v: print(json.dumps(x))
    sys.exit(1 if v else 0)
