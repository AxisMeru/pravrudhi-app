#!/usr/bin/env python3
"""Regenerate src/lib/fixtures/reasonCodesTable.json from the signed table, docs/api/reason-codes.md in the pravrudhi engine
repo (read from a checkout path or `git show <ref>:docs/api/reason-codes.md`). Usage: gen-reason-table.py <engine-checkout> [ref]."""
import json, re, subprocess, sys

repo, ref = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "origin/main")
md = subprocess.check_output(["git", "-C", repo, "show", f"{ref}:docs/api/reason-codes.md"], text=True)
sha = subprocess.check_output(["git", "-C", repo, "rev-parse", "--short=8", ref], text=True).strip()
TWO = " (deployments that use two judges only)"


def table(heading: str) -> dict[str, str]:
    sec = md.split(heading, 1)[1].split("\n## ", 1)[0]
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^\| `([a-z0-9_]+)` \| (.*) \|$", sec, re.M)}


reasons = {}
for k, v in table("## Contract `reason`").items():
    two = v.endswith(TWO)
    reasons[k] = {"text": v[: -len(TWO)] if two else v, "twoJudgesOnly": two}
out = {
    "source": f"pravrudhi docs/api/reason-codes.md at {sha} ({ref}), copied verbatim; the 'deployments that use two judges only' parenthesis is held apart as twoJudgesOnly",
    "reasons": reasons,
    "quote_check": table("## Element `quote_check`"),
}
json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
print()
