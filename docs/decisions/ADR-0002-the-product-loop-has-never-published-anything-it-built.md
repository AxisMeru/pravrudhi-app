# ADR-0002 — The product loop has never published anything it built

Status: **accepted (agent-for-operator, 2026-09-13, cli-lead's decision under the standing delegation)**
Date: 2026-09-13     Requested by: cli-web, found while tracing why the product loop's convergence (11
accepted dispatches / 1 met criterion in 24h) never showed up anywhere a user or CI could see it

## The defect

The product loop runs against `/home/ss/pravrudhi-product-loop`, a clone of `AxisMeru/pravrudhi-app` on
branch `loop/product`. When a criterion is met in build mode, `integrate.integrate_build_criterion` commits
the change onto that branch in that tree — verified working correctly: the one criterion met in the last 24h
is a real commit (`fdf02a7`), with `origin/main` fully contained in its history, so integration itself has no
defect.

But nothing after that commit ever leaves the disk. `git ls-remote --heads origin loop/product` against
`AxisMeru/pravrudhi-app` returns nothing — the branch has never been pushed. `git branch -r --contains
fdf02a7` is empty — the commit is unreachable from any remote ref. There is no push step anywhere in the
loop's own pipeline; `_sync_loop_branch` (`src/pravrudhi/application/heartbeat.py`, ADR-0053 §3) fetches and
rebases a `loop/*` root onto `origin/main` before each beat, but nothing pulls in the other direction.

**What this means for the record, stated plainly rather than fixed quietly:** `AxisMeru/pravrudhi-app`'s
`main` branch is what Vercel deploys and what every desktop release (`v0.1.5` through `v0.1.8`, all cut
2026-09-12/13) is tagged from. None of those releases contain a single line of code the product loop has
ever written. "The product self-builds" has been false since the loop started, and no amount of measured
convergence inside the loop's own tree would have changed that — the gap is entirely downstream of the last
commit.

## Decision

**Two distinct acts, not one.**

1. **The loop pushes its `loop/*` branch to `origin` after every successful integration.** This is safe (it
   creates or fast-forwards a non-canonical branch, never touching `main`), non-canonical, and auditable — it
   is what makes the loop's work visible to anyone outside the machine it runs on. This is a code change to
   the shared engine (`src/pravrudhi/application/heartbeat.py`, `AxisMeru/pravrudhi`), since the same gap
   applies to every `loop/*` root generically, not just this one.
2. **Promotion to `main` stays a separate, human-adjacent act through the inbox.** CHARTER §6 is explicit:
   "promotion to canonical (merging adapters into a base checkpoint, merging to `main`, signing an interp
   claim) is a human act via the inbox," and precedence puts the charter above this decision — so this ADR
   does not touch that boundary. ADR-0040 already delegates that act to `agent-for-operator` under
   `/inbox/sign` when `check_gate` is clean and every non-signoff closure layer passes; evidence the caller
   cannot supply still counts as unmet, exactly as ADR-0040 states. This ADR does not wire an auto-merge to
   `main` — that would collapse the two acts back into one and remove the auditability the push exists to
   provide.

**Ordering matters and is the one rule worth stating explicitly:** the push happens *after* integration and
*after* the pre-dispatch rebase has already succeeded for that beat (never independently of it), so a loop
that is currently blocked (mid-rebase-conflict, or with a dirty tree) does not silently publish a stale or
partial branch while its heartbeat still looks healthy — that is the same class of failure as `_sync_loop_branch`
already guards against on the pull side, and a push-side loop reporting green while publishing nothing would be
worse, not better, than the branch simply not existing on `origin` at all.

## Consequences

- `v0.1.5` through `v0.1.8` of `pravrudhi-app` are confirmed to contain no product-loop-built code; anyone
  auditing those releases against a convergence report should not expect to find a correspondence.
- Once implemented, `origin/loop/product` (and any other `loop/*` root's remote branch) becomes the honest
  record of what the loop has actually built, independent of whether or when it is promoted.
- A push failure (no network, remote rejected, auth) must not break the beat — it is recorded and the next
  beat's rebase-then-push tries again, the same swallow-and-continue discipline `_sync_loop_branch` and
  `notifications.emit` already use elsewhere in this file.
- This does not change who may promote `loop/product` into `main`: that is still ADR-0040's `/inbox/sign`
  path, gated the same way it already is for every other kind of promotion.

## Related

- [ADR-0053 — The loops own their roots](https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0053-the-loops-own-their-roots.md) (`_sync_loop_branch`, the pull-side counterpart to this ADR's push)
- [ADR-0040 — Gate sign-off and T2 promotion are delegated](https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0040-gate-signoff-is-delegated.md) (the promotion act this ADR deliberately leaves untouched)
- [ADR-0001 — This repository exists under Pravrudhi ADR-0049](./ADR-0001-this-repository-exists-under-pravrudhi-adr-0049.md)
