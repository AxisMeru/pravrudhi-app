# Partner demo runbook (one page)

Claim tier: written from the code and the engine contract; not yet rehearsed live. Fixture outcomes are recorded only after live runs (see "Recording").

## Pre-flight (5 minutes before)
1. `GET /api/v1/status`: confirm `service_window.open_now` is true and `judge.state` is `ready`. If the judge is `warming`, wait for it; the first request can take up to about 2.5 minutes.
2. Open `/matters`; the contract list must load. If it does not, stop and say the engine is not reachable.
3. Use only the invented fact sets in `frontend/e2e/fixtures/demo-fact-sets.ts`. Never paste a real client matter into a demo.

## Script
1. PROOF path: submit the plain-wording fixture, then the formal-wording one. Show the element rows, the quote under each established element, the run id and score hash, then "Download memo (.md)".
2. ABSTAIN path: submit the thin fixture. Point out that no verdict is given and nothing is stated as a finding.
3. REFER path: submit the ambiguous fixture. Point out the stated reason and that a lawyer decides.

## What to say
- REFER or ABSTAIN is the product working as designed: when the facts do not support a verdict, it says so rather than guessing.
- Offline outside service hours: the banner states the next opening time and nothing is sent. Offer to rerun in the window.
- "Warming up": the models start on demand; this is a cold start, not a failure.
- The memo is an analysis aid, not legal advice. The Lean check is a structural check, not verification of the facts or of the law.

## Known limits
- Cold start of up to about 2.5 minutes on the first request after idle.
- The contract list is not limited to validated contracts. A contract the judge has not been validated on returns REFER_TO_LAWYER with the reason `contract_not_validated` instead of a verdict. Do not promise a verdict on any contract outside the validated set, and say that REFER is the engine declining, not a finding.
- Rate limit 6 requests/min/IP, 2 concurrent. Do not run fixtures in parallel.
- Wording sensitivity: the same facts in plain and in near-statutory wording can produce different outcomes. Each fixture exists in both wordings; if they diverge on the day, say so and show both. Do not pick the better one silently.
- Citation checking covers only citations in the loaded index; "not found" means no evidence either way, not that a citation is fake.

## Recording (acceptance criterion 2)
Run each fixture at least 3 times in one service window; for each, record run id, outcome and date on the issue as pipeline-measured with n stated. Then set `contractId` and `expectedOutcome` in the fixture file. The live spec (`e2e/demo-live.spec.ts`) skips unrecorded fixtures and skips outside the service window, saying why.
