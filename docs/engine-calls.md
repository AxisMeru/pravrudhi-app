# Engine and Edge Function calls

What the app sends, what it expects back, and how each failure reaches the person. The engine's own API reference is in the engine repository (`AxisMeru/pravrudhi`); this page is the app's side of the contract. Code: `frontend/src/lib/api.ts`, `serviceStatus.ts`, `wake/`, `adminAccess/`.

All engine calls go through `engineFetch`: it attaches `Authorization: Bearer <the signed-in user's token>` (hosted engine) and, after a 401, renews the session once and retries. The engine origin is `NEXT_PUBLIC_API_BASE`, or the page's own origin when the engine serves the page.

## Calls

| Call | Used by | Notes |
|---|---|---|
| `GET /api/me` | every page | `access` is `admin`, `member` or `none`; `edition` names the product or Studio edition. A 401 means signed out; 404 or 405 means an engine with no identity endpoint (a local engine). |
| `GET /api/v1/status` | Home, screening | Service window and, when the cold start is enabled, whether the two models are `parked`, `warming` or `ready`. Failing to read it never blocks a page. |
| `GET /api/nyaya/registry/contracts` | screening | The contract ids the engine serves, and which are on the validated list. Only served ids are offered. |
| `POST /api/v1/analyse-facts` | screening | Body `{facts, contract_ids, narrative}`. 1 to 8 facts of at most 4000 characters; 1 to 5 contract ids. The client times out at 320 s. |
| `POST /api/v1/analyse-facts/assist` | screening (assistant) | The optional assistant run; one consent per run; never retried on a 5xx. |
| `POST /api/v1/analyse-facts/wake`, `GET .../wake/status` | screening | The cold start; see below. |
| `POST /api/v1/intake` | intake | Pasted text only, signed-in only; a plain deterministic route. |
| `POST /api/v1/verify-citations` | citation check | Checks that a citation exists. |
| `POST /functions/v1/admin-invite` (Supabase Edge Function) | `/admin/access` | Body `{"action":"invite"\|"resend","email":"..."}`, with the admin's own bearer token and the project's publishable key. Answers `{"ok":true}` or `{"ok":false,"code":"..."}`. The address is never logged. |

Matter, paper and workflow calls are `POST`s to `/api/v1<path>` made through `src/lib/previewApi.ts`; any status is handed back so the caller can map 409, 422 and 503 to its own line.

## Cold start (wake)

1. `POST /api/v1/analyse-facts` answers `503 {"error":"judges_offline"}` when the models are off.
2. The page asks for a start: `POST .../wake` (no body). `202` means accepted; `503` with `wake: not_allowed` or any other answer leaves the ordinary refusal on the page.
3. `GET .../wake/status` is polled every 2 to 10 s (the engine's `poll_after_s`, default 5). States: `waking`, `ready`, `partial`, `failed`, `timeout`; per model (`first`, `second`): `waiting`, `starting`, `ready`, `failed`. A ticket (`mode` full or partial, valid about 600 s) comes with `ready` or `partial`.
4. The page stops waiting at 600 s or the engine's `deadline_s` plus 30 s, whichever is smaller; three failed polls in a row also stop it.
5. On `ready` or `partial` the **page** sends the screening itself with `x-wake-ticket: <ticket>`.
6. If that screening is refused because the models are not serving yet (`503 agent_unavailable`, or `503 judge_unavailable` with `reason: judges_warming`), it is sent again, same body and ticket, up to 5 times. Waits: 45 s, or the engine's `retry_after_s` for `judges_warming` kept between 5 and 120 s; at most 540 s in all. Only those two answers retry, and a retry never starts another wake.

The engine caps starts and wakes per person and per label, and applies a cooldown after a failed wake; the page shows the engine's refusal as it is.

## How a failed screening is shown

`classifyAnalyseError` (`serviceStatus.ts`) maps each failure to one fixed, reviewed line. The words are in `signedStrings.ts`, `runningCopy.ts` and `serviceStatus.ts`; they are pinned in specs and are not repeated here, so this table cannot go stale.

| Failure | Kind |
|---|---|
| The page's own timeout (320 s) | `timeout` |
| User pressed Cancel | `cancelled` |
| 401 | `signed_out` |
| 429 | `rate_limited` |
| 503 `outside_service_window` | `outside_window` |
| 503 `judges_offline` | `judges_offline` (or the wake, when it is allowed) |
| 503 `judge_unavailable` with `judges_warming` | `judges_warming` (the seconds to wait are shown when the engine gives them) |
| 503 `judge_unavailable` | `judge_unavailable` |
| 503 `agent_at_capacity` | `agent_at_capacity` |
| 503 `agent_unavailable` | `agent_unavailable` |
| 503 `service_config_missing` | `service_config_missing` |
| 422 | the request itself was refused (facts or offences not acceptable); one plain line, no status code |
| Any other status | a generic line with the status number |
| No answer at all | `network` |
| Not signed in, or sign-in could not be checked | `not_signed_in`, `sign_in_unverified` |
| An answer that is off the contract | `invalid_answer` |

Rules that apply to every row: the line says whether anything was scored (never "nothing changed" when that may be false); engine messages are never shown, only the fixed lines; no credential or fact text is logged.

## admin-invite codes

The page maps each `code` to one fixed message: `unauthorized`, `forbidden`, `invalid_request`, `invalid_email`, `too_large`, `rate_limited`, `invite_rate_limited`, `already_registered`, `invite_redirect_not_allowed`, `upstream_unavailable`, `audit_unavailable`, `not_configured`, `method_not_allowed`, plus `no_answer` (the page's own timeout: the invitation may or may not have been sent, and the message says so). The invited person joins as a member; an administrator is never made from the page.
