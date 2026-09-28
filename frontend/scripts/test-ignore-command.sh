#!/usr/bin/env bash
# Exercises the real vercel-ignore-build.sh (what vercel.json's ignoreCommand actually runs)
# against a real temp git repo, not a mock of git itself -- the bug this fixes is specifically
# about what git merge-base/git diff report for a given (PREVIOUS_SHA, COMMIT_SHA) pair, so a
# fake git would test nothing.
#
# Run: bash frontend/scripts/test-ignore-command.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IGNORE_SCRIPT="$SCRIPT_DIR/vercel-ignore-build.sh"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
cd "$TMPDIR"
git init -q
git config user.email "test@test.local"
git config user.name "test"

mkdir -p frontend/src other
echo "a" > frontend/src/f.ts
echo "x" > other/g.py
git add -A
git commit -qm "base"
BASE=$(git rev-parse HEAD)

echo "b" > frontend/src/f.ts
git add -A
git commit -qm "frontend change"
FRONTEND_CHANGE=$(git rev-parse HEAD)

git checkout -q "$BASE"
git checkout -q -b other-branch
echo "y" > other/g.py
git add -A
git commit -qm "non-frontend change"
NON_FRONTEND_CHANGE=$(git rev-parse HEAD)

# An orphan commit whose frontend/ tree is byte-identical to FRONTEND_CHANGE's, but with NO
# common history with it at all -- models a PREVIOUS_SHA that Vercel hands the ignoreCommand
# which isn't really an ancestor of COMMIT_SHA (stale record, rebase, wrong deployment matched).
# `git diff --quiet` between it and FRONTEND_CHANGE sees zero difference in frontend/ even
# though COMMIT_SHA's actual history relative to it is unknown/unrelated.
git checkout -q --orphan orphan-same-content
git rm -rq --cached . >/dev/null
mkdir -p frontend/src other
echo "b" > frontend/src/f.ts
echo "x" > other/g.py
git add -A
git commit -qm "orphan, identical frontend tree"
ORPHAN_SAME_CONTENT=$(git rev-parse HEAD)

git checkout -q main 2>/dev/null || git checkout -q master

run_ignore_cmd() {
  local ref="$1" prev="$2" curr="$3" cwd="$4"
  (
    cd "$cwd"
    VERCEL_GIT_COMMIT_REF="$ref" VERCEL_GIT_PREVIOUS_SHA="$prev" VERCEL_GIT_COMMIT_SHA="$curr" \
      bash "$IGNORE_SCRIPT"
  )
  echo $?
}

pass=0
fail=0
check() {
  local desc="$1" expect="$2" actual="$3"
  if [ "$expect" = "$actual" ]; then
    echo "ok   - $desc"
    pass=$((pass+1))
  else
    echo "FAIL - $desc (expected exit $expect, got $actual)"
    fail=$((fail+1))
  fi
}

# 1. Non-main ref always skips (exit 0), regardless of diff.
ec=$(run_ignore_cmd "some-branch" "$BASE" "$FRONTEND_CHANGE" "$TMPDIR/frontend")
check "non-main ref skips" 0 "$ec"

# 2. Empty PREVIOUS_SHA always builds (exit 1) -- first deploy / unknown history.
ec=$(run_ignore_cmd "main" "" "$FRONTEND_CHANGE" "$TMPDIR/frontend")
check "empty PREVIOUS_SHA builds" 1 "$ec"

# 3. PREVIOUS_SHA is a real ancestor, diff touches frontend/ -> build.
ec=$(run_ignore_cmd "main" "$BASE" "$FRONTEND_CHANGE" "$TMPDIR/frontend")
check "ancestor + frontend diff builds" 1 "$ec"

# 4. PREVIOUS_SHA is a real ancestor, diff does NOT touch frontend/ -> skip.
ec=$(run_ignore_cmd "main" "$BASE" "$NON_FRONTEND_CHANGE" "$TMPDIR/frontend")
check "ancestor + non-frontend diff skips" 0 "$ec"

# 5. THE BUG THIS FIXES: PREVIOUS_SHA is NOT an ancestor of COMMIT_SHA but happens to have an
#    identical frontend/ tree (see ORPHAN_SAME_CONTENT above). The OLD script fed this straight to
#    `git diff --quiet`, which reports "no difference" and SKIPS the build -- even though
#    PREVIOUS_SHA is not really COMMIT_SHA's prior deployment at all. The fixed script's
#    merge-base ancestor check must reject this PREVIOUS_SHA and build instead.
old_script_would_diff_quiet=$(cd "$TMPDIR/frontend" && git diff --quiet "$ORPHAN_SAME_CONTENT" "$FRONTEND_CHANGE" -- . ; echo $?)
check "sanity: orphan really is diff-quiet against FRONTEND_CHANGE (old script's blind spot)" 0 "$old_script_would_diff_quiet"

ec=$(run_ignore_cmd "main" "$ORPHAN_SAME_CONTENT" "$FRONTEND_CHANGE" "$TMPDIR/frontend")
check "non-ancestor PREVIOUS_SHA builds despite quiet diff (fail-safe)" 1 "$ec"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
