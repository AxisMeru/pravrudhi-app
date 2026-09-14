# ADR-0003 (REQUEST) — What `/models` should mean for a BYOK product user

Status: **proposed, awaiting cli-lead's agreement before building**
Date: 2026-09-14     Requested by: cli-lead, following the BYOK settings audit (`assistant/web/byok-provider-key-feedback`, merged `3673b63`)

## The situation

`/models` today (`frontend/src/app/models/page.tsx`) shows exactly one thing: models the self-improvement
loop's own gate has **promoted**. Its own subtitle states this plainly — "What the loop promoted, what it was
derived from, and what an external scorer measured before and after" — and its empty state reads "Nothing has
been promoted yet... [Start a night] to produce one." `lib/models.ts` joins `/api/models` against
`/api/candidates` and `/api/external`, all three Studio/RSI artifact-history concepts (a *promotion* is a
candidate that survived a gate; a *night* is the loop's own unit of work).

A BYOK product-edition user has no self-improvement loop, no candidates, no nights, and nothing to promote.
For that user this page is not thin — it is answering a question they never asked, and its one call to action
(`/start`, "Start a night") points at a concept the product edition's own ADR-0049 split explicitly does not
have. It will read "Nothing has been promoted yet" forever, on every install, for every user, which is exactly
the shape of defect this repo's ADR-0001/S7 work has already found and fixed twice this week (Studio surfaces
surviving unnoticed past the product/Studio split).

## What a BYOK user actually needs, and what can honestly answer it today

cli-lead's framing, and the right one: a user with their own provider keys wants to know, per provider they've
configured — **is my key valid, is the provider reachable right now, and which one is actually serving me.**
Checked against what this engine can currently answer, not assumed:

1. **"Is my key valid" and "is it configured"** — fully answerable today. `/api/providers` (already used by
   `/settings`) returns `{id, title, configured, key_prefix}`; `PUT /providers/{id}/key` already validates
   against the real provider and returns `{validated, reason}` (the response the settings-page fix just made
   honest). No new backend work.

2. **"Is the provider reachable right now"** — answerable today via a route the product frontend does not
   currently call at all: `GET /api/panel/vendors` (`server.py`), which returns, per vendor, `{id, interface,
   model, provider, credential_env, reachable, detail, note}` — `reachable`/`detail` resolved live against
   *the caller's own stored keys* (`vendor.reachable_in(project)`), not the engine's. This was built for Track
   A's vendor-comparison panel (ADR-0001), but the route is already user-facing and already does exactly the
   live check this page needs; it has simply never been wired into the product frontend.

3. **"Which one is actually serving me for a given call"** — **not answerable by anything in this engine
   today, checked directly rather than assumed.** `ChatResponse` (`/api/chat`) carries `{thread_id, reply,
   citations, tool_calls, refusals}` — no model or provider field. `RunRequest.model` names what a run *asks
   for* (a benchmark target), not what executed; `RunEvent`'s own vocabulary (`paired`, `promoted`, `pruned`,
   `incumbent`, `candidate_score`) is the improvement loop's measurement language, not a record of which
   provider answered a chat turn or an objective step. There is no per-call model/provider attribution
   anywhere in the wire format. Building this would mean adding a field to chat/run responses on the backend,
   which is real work with its own scope and its own decision (what counts as "the" model when a step fans out
   across several) — not something a product-frontend-only change can produce, and not something this ADR
   proposes to fake with a plausible-looking static label.

## Decision (proposed)

Replace `/models`'s promotion-history view with a **providers view** built entirely from (1) and (2) above —
real, live, already-served data, no new backend work:

- One row per entry in `/api/providers`: title, configured/not, and — if configured — `/api/panel/vendors`'s
  live `reachable`/`detail` for whatever vendor(s) key off that provider's credential.
- A configured-but-unreachable row shows the real `detail` string (a probe failure, an expired key, a rate
  limit), not a generic "not working."
- An unconfigured row's call to action is `/settings`, not `/start` — the actual place a key gets added.
- The empty state (no providers configured at all) says exactly that, and points at `/settings` — never
  "nothing has been promoted yet," which is not merely unhelpful for this user, it names a concept they have
  no way to produce.

**Explicitly deferred, not silently dropped:** "which model served this specific call." Flagged here as a
real, separate gap with a real, separate cost (backend response-shape changes to chat/runs), so it is decided
on its own rather than smuggled in as a UI label with nothing behind it. If this is wanted, it is its own ADR.

## What this is not

Not a redesign of `/runs` or `/objectives`, which have the same "is this vocabulary Studio's or the user's"
question worth asking on its own terms later — this note is scoped to `/models` only, per the task as given.

## Related

- [ADR-0001 — This repository exists under Pravrudhi ADR-0049](./ADR-0001-this-repository-exists-under-pravrudhi-adr-0049.md)
- `assistant/web/byok-provider-key-feedback` (`3673b63`) — the settings-page fix this ADR's item (1) builds on
