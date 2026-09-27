#!/usr/bin/env bash
# Vercel ignoreCommand (referenced from vercel.json as `bash scripts/vercel-ignore-build.sh`,
# invoked with cwd = the project's Root Directory, frontend/). Exit 0 = skip the build, exit 1 (or
# anything else non-zero) = build. Kept as a real script rather than inline in vercel.json because
# Vercel's ignoreCommand field has a 256-character limit and the ancestor-check version of this
# logic is over 330 characters inline (#12's original mistake, caught by R1).
set -u

[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0

[ -z "$VERCEL_GIT_PREVIOUS_SHA" ] && exit 1

# A PREVIOUS_SHA that isn't really COMMIT_SHA's prior deployment (stale record, rebase, a wrong
# match) can have a byte-identical frontend/ tree to COMMIT_SHA and fool a plain `git diff --quiet`
# into skipping a real change. Never trust the diff below unless PREVIOUS_SHA is an actual ancestor.
git merge-base --is-ancestor "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" 2>/dev/null || exit 1

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- . 2>/dev/null
ec=$?
[ "$ec" -gt 1 ] && exit 1 || exit "$ec"
