# ADR-0005 (REQUEST) — Plain language for the run progress view

Status: **proposed, awaiting cli-lead's agreement before building**
Date: 2026-09-14     Requested by: cli-lead, following a survey of the remaining product pages

## The situation

`/runs`, the run card list, and the run view reached from `/objectives/detail` render raw self-improvement-
loop vocabulary directly to a BYOK user watching their own run, with no explanation: "Night 3", "Candidate X
proposed", "X promoted — this is the new incumbent", "Proposer generated 8 candidates, 3 accepted". This is
mechanically reachable and common, not a dead Studio artifact: there is no form anywhere in this frontend to
manually configure a `proposer`/`policy`/`budget_gpu_h` run (checked directly — grepped `frontend/src/app`,
`lib/start.ts`, `lib/objective.ts`), so a BYOK user's own stated objective is what creates these runs via
`/start`, using the same propose/evaluate/promote search the terms describe. The mechanism is real and
intentional for this product; the words describing it were never translated for someone who did not build the
system that produces them.

## Two decisions this note settles before any code

**1. Rename in place, not a tooltip/glossary layer.** A tooltip needs the user to already suspect they don't
understand a term and hover to find out; plain language works for a first-time user with no extra step. The
strings are translated directly.

**2. Edition scope — checked directly, this is the load-bearing question.** `RunHeader.tsx`, `Timeline.tsx`,
`CandidatePanel.tsx` and `runs/page.tsx` are byte-identical between this repo (`AxisMeru/pravrudhi-app`) and
Studio's own copy (`AxisMeru/pravrudhi`'s `app/frontend`) — confirmed with `diff`, zero output. But they are
**not a shared, live-linked component**: two independent git repositories, two independent builds, two
independent deploys. Editing this repo's copy cannot reach Studio's copy or its users. Separately checked
whether *this* repo's build itself branches behavior by edition at runtime (it can report either edition name
via `/api/me`, per `lib/edition.ts`'s own comment about an operator signing in to see the product's feel) —
grepped these four files specifically for `edition`/`Edition`: zero hits. None of them read the edition at
all today, in either repo's copy. So there is no existing edition-branching to preserve or break here, and
this repository's own architecture (ADR-0001: "its own minimal, product-only interface") means it never needs
to render Studio's vocabulary. **Conclusion: a direct, unconditional rename in this repo's copies only. Studio's
own copy, in Studio's own repo, is untouched by this change and keeps its native vocabulary** — that repo's
users are the builders this vocabulary was written for, and stripping it there would make Studio worse.

## The mapping

Illustrative wording from cli-lead, finalized against every actual string found (`RunHeader.tsx`,
`Timeline.tsx`, `CandidatePanel.tsx`, `runs/page.tsx`):

| Jargon | Plain language | Why not the obvious alternative |
|---|---|---|
| "Night N" | "Pass N" | Not "Run N": the page's own outer unit is already called a run (`RunHandle`/`RunCard`); a night *is* one run (`RunHandle.night` is one number per run, not a sub-collection), so "Run N" inside a page about "a run" would read as two different things sharing one name. |
| "candidate" (as a word in prose) | "attempt" / "option" | `event.candidate`/`row.candidate` as an *identifier string* (a monospace id/ref) is left untouched — only the English word describing the concept changes. |
| "promoted" | "adopted" | |
| "incumbent" (noun, and the score-bar tick's `title="incumbent"`) | "current best" | |
| "Proposer generated N candidates, M accepted." | "Explored N options, kept M." | Drops "proposer" entirely rather than translating it — it names an internal role, not something the user did or needs to know exists. |
| "N candidates selected" (round event) | "N options kept" | |
| "— boundary: {decision}." | "— decision: {decision}." | "Boundary" is unexplained jargon even to a first-time Studio user; simplified rather than translated to a synonym that would still confuse. |
| "Candidates" (panel header) | "Attempts" | |
| "No candidate has been evaluated yet." | "No attempt has been evaluated yet." | |

**Left alone, out of scope for this ADR:** "GPU-hours"/"GPU-h budget" — a real, separate question (whether
GPU-hours is even the right cost unit for a BYOK user calling metered cloud APIs rather than spending local
compute) that cli-lead did not ask for and that deserves its own note rather than a drive-by rename here.
"Round N" is left as ordinary English. Opaque candidate-id strings (monospace, e.g. a git ref or model
variant name) are data, not vocabulary, and are not touched.

## Coverage gap this exists to close

`product.spec.ts`'s 13-page loop asserts only the page heading and the diagnostics extension's "no failed
request / no console error" checks — no test anywhere touches run-view body content, and none of the jargon
above renders until a run has real events, which the current suite never produces. This is why a defect of
this shape survived past every other pass on this repo this week. The build for this ADR adds an e2e test
that actually drives a run to real events and asserts the plain-language strings appear and none of the old
jargon does — closing that specific gap, not just fixing the four files.

## Related

- [ADR-0001 — This repository exists under Pravrudhi ADR-0049](./ADR-0001-this-repository-exists-under-pravrudhi-adr-0049.md)
- [ADR-0003](./ADR-0003-request-what-models-means-for-a-byok-user.md) / [ADR-0004](./ADR-0004-request-two-open-model-visibility-gaps.md) — the same audit pass that found this
