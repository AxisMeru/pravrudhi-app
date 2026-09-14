# ADR-0004 (REQUEST) — Two open model-visibility gaps, filed and not built

Status: **filed, unbuilt — both items need their own decision before any code**
Date: 2026-09-14     Requested by: cli-lead, deferred out of ADR-0003's `/models` build

## Why this exists

ADR-0003 replaced `/models`'s Studio/RSI promotion-history view with a real, honest providers list (configured
or not, per provider, `/settings` as the CTA). Two things a BYOK user would still reasonably want are not in
that build, on purpose — each is real work with its own shape and its own cost, and building either as a
plausible-looking label with nothing behind it would be exactly the dishonest-surface failure CHARTER §6
forbids. Filed here so both stay on record as open decisions rather than being lost or quietly re-attempted as
a UI-only fix.

## Item 1 — a genuine on-demand "is my key working right now" check

`/api/panel/vendors`'s `reachable` field, for every BYOK provider, only checks whether a key is present (see
ADR-0003's Correction) — not whether the provider actually accepts it right now. The only place a real check
happens is `/settings`'s save-time `credentials.validate()`, a one-shot probe not persisted anywhere.

**Rejected shape:** calling `validate()` automatically on every `/models` (or `/settings`) page load. This is
a `POST` with a re-store side effect (per `set_provider_key`'s own "store.put runs unconditionally"), so it
would make an outbound network call to the provider — and spend the user's own request quota — every single
time the page is visited. Surprising, heavy, and not something a page load should silently cost a user.

**What this needs instead:** a read-only, user-initiated probe — a button, not automatic — and ideally a `GET`
route that checks the stored key without re-storing it, distinct from `set_provider_key`'s combined
save-and-validate. Whether that is a new endpoint or a `validate`-only mode of the existing one is the backend
decision this item is filed for; the frontend change (a per-provider "Check now" button, a spinner, and a
result line reusing the same honest-`reason`-text discipline `/settings`'s fix already established) is small
once that exists.

## Item 2 — which model/provider actually served a specific call

No response in this engine's wire format carries per-call model or provider attribution. Checked directly,
not assumed: `ChatResponse` (`/api/chat`) is `{thread_id, reply, citations, tool_calls, refusals}` — no model
field. `RunRequest.model` names what a run *asks for* (a benchmark target), not what executed. `RunEvent`'s
own vocabulary (`paired`, `promoted`, `pruned`, `incumbent`, `candidate_score`) is the improvement loop's
measurement language, not an execution record.

**What this needs:** a backend decision about what "the model that served this call" even means before any
field gets added — a chat turn may involve one model; an objective step may fan out across several proposers
and routes in a single beat (see `heartbeat.py`'s own multi-dispatch batches). Whichever shape is chosen
(a single `model`/`provider` field on `ChatResponse`; a list on a batch-shaped response; something else) is
real backend work with its own scope, not a product-frontend change.

## Not decided by this ADR

Which of the two, if either, gets built next, and in what shape. This ADR only makes sure both stay a named,
findable request rather than a UI guess someone reaches for later under the impression it is quick.

## Related

- [ADR-0003 — What `/models` should mean for a BYOK product user](./ADR-0003-request-what-models-means-for-a-byok-user.md)
