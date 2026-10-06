# Partner demo runbook (and how to run the scripted E2E)

One page. Invented facts only; no evaluation items, host paths or private data. Objective and metrics: pravrudhi-app#18.

## Before anything runs in production
- **A production run needs Lead-2's written go, and BOTH the nightly-surface fix (pravrudhi-app#59) and the live-project guard (pravrudhi-app#61) must be merged first.** Without #59 the sign-in step of the live specs waits for a route the engine closes to a member; without #61 nothing stops the live project from being reached by accident.
- The live projects refuse to load unless `LIVE_E2E_GO=1` is set whenever the e2e account is in the environment, and the scripted E2E (`frontend/e2e/demo-live.spec.ts`) is also skipped unless `DEMO_LIVE_GO=1`. Set both only for the window the go covers, and only with the e2e (member) account in the environment (`E2E_EMAIL`, `E2E_PASSWORD`; never printed, never an admin account).
- Run exactly: `cd frontend && LIVE_E2E_GO=1 DEMO_LIVE_GO=1 npx playwright test demo-live.spec.ts --project=live-chromium`. **Never** `-- demo-live.spec.ts` (the `--` drops the file filter and runs the whole live project against production).
- The recorded fixtures and the assertions are unit-tested without any engine: `npm test` (`src/lib/demo/liveCheck.spec.ts`).

## Pre-flight (two minutes)
1. The status route answers and the judges are not reporting unavailable: `GET /api/v1/status` (`judge.state` is `ready` or `warming`, never `unavailable`).
2. Inside the service window (London time). Outside it the spec skips itself and says why; a demo outside it is not possible.
3. The registry lists the contracts the script uses (`bns69`, `bns85`, `bns316_misappropriation`).

## The script (what the spec does, and what you do by hand)
For each of three fixtures, in a plain and in a near-statutory wording, three runs in one window (`DEMO_LIVE_REPEATS`, default 3):
1. `proof-path` (bns69, validated): facts of a promise to marry made with no intention of keeping it.
2. `abstain-path` (bns85, validated): facts that show none of the required conditions.
3. `refer-path` (bns316_misappropriation, not validated): a referral, not a proof or denial.
Each run: sign in, open Matters, tick the contract, paste the facts, Analyse, wait for the result. The spec checks the real response: a card per contract, element rows, every established element's quote word for word in the submitted facts, citations, 64-hex hashes, the retention notice, the outcome against the recorded expectation (binding only after 3 recorded runs), what the page shows against the response, and the downloaded memo. By hand, for a partner: load the example from "How it works", read the safety record last.

## What to say when
- **REFER:** "The tool refers anything it is not sure of, or has not validated, to a lawyer instead of guessing; the reason is shown." On a provision that is not on the validated list it never gives a proof or denial; it gives a referral instead. Never describe a REFER as a failure.
- **ABSTAIN:** the engine did not reach a verdict; nothing is a finding.
- **The service is offline or the judges are warming:** say so; do not retry in a loop. A first run after idle can take about three minutes (the page shows a counter).
- **Never say:** anything compared with another product, coverage or time-saved figures, "verified", "hallucination-free", legal correctness, anything about cheque-dishonour proofs. The only figures are on the Safety record page, with their label.

## Known limits
- Cold start: about three minutes on the first run after idle.
- Rate limit: 6 calls per minute per IP, 2 running at once; the spec's three runs are serial.
- Which contracts are validated is read live from the registry; the page marks the others "not validated, verify". No count is quoted.
- **Wording sensitivity:** a judge's reading can change between a plain and a near-statutory wording of the same facts. That is why every fixture runs in both and the outcomes are recorded for each; a difference between wordings is a finding to report, not a flake to retry. The recorded expectation is per fixture and wording only after the 3 recorded runs.
- Results from these fixtures are pipeline-measured on invented facts: they are not evidence about real matters and are not quoted anywhere outside the issue.
