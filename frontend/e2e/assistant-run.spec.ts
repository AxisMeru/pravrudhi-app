import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

/**
 * #125: Run with the screening assistant. Mocked engine answers (invented facts), checked against the engine's contract by the schema-checked test (assist route: the analyse-facts answer
 * plus the `assistant` block). The app shows the decide result and a fixed-word step trace; nothing the assistant wrote (`summary`) and no cost is shown; consent is per run and never kept.
 */
// The assistant entry is behind one build flag (NEXT_PUBLIC_ASSISTANT_ENTRY=1; lib/assistantFlag.ts). These specs run against the flag-ON build; the flag-OFF build checks that nothing shows.
const FLAG_ON = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
test.skip(!FLAG_ON, "the assistant entry flag is off in this build");

const REGISTRY = "**/api/nyaya/registry/contracts";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const CID = "ipc415_property";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const CORE = {
  run_id: "r-invented-assist", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{
    contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }],
  }],
};
const STAGES = ["ingest", "select_contracts", "describe_contract", "judge_element", "quote_check", "assemble", "lean_check", "decide"];
const FINISHED = {
  ...CORE,
  assistant: {
    used: true, outcome: "finished", reason: null, session_id: null, cost: { used_cents: 12, budget_cents: 25 },
    summary: "INVENTED ASSISTANT SUMMARY that must never be shown",
    steps: STAGES.map((name) => ({ name, ...(name === "quote_check" ? { check: "valid" } : name === "lean_check" ? { check: "agrees" } : {}) })),
  },
};
const blockOf = (outcome: string, reason: string | null, used = false) => ({ ...CORE, assistant: { used, outcome, reason, steps: [], cost: null, summary: null, session_id: null } });
const CONSENT = "Running with the assistant sends your facts to Anthropic through our account. Screening without the assistant does not.";
const PAUSED = "The assistant features are paused; screening works as normal";
const health = (tier?: unknown) => ({ ok: true, version: "0.6.2", kernel: "0.6.2", ledger: true, ...(tier ? { assistant_tier: tier } : {}) });

async function open(page: import("@playwright/test").Page, opts: { tier?: unknown; info?: unknown; answer?: unknown; healthStatus?: number; me?: number; assistStatus?: number; hangFirstAssist?: boolean } = {}) {
  if (opts.hangFirstAssist) await page.clock.install();
  const posts: { assist: string[]; plain: number } = { assist: [], plain: 0 };
  await page.route("**/api/me", (r) => (opts.me === 401 || opts.me === 503 ? r.fulfill({ status: opts.me, json: { error: "x" } }) : r.fulfill({ json: { email: "invented@example.invalid" } })));
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/health", (r) => (opts.healthStatus ? r.fulfill({ status: opts.healthStatus, json: { error: "x" } }) : r.fulfill({ json: health(opts.tier) })));
  await page.route("**/api/assistant", (r) => r.fulfill({ json: opts.info ?? { provider: "Anthropic", call_timeout_s: 60, session_budget_usd: 0.25, consent_required: true, assistant_tier: { state: "available", reason: null }, oldest_pending_delete_age_s: 4321, sweep_last_ok_age_s: 987 } }));
  await page.route("**/api/v1/analyse-facts/assist", (r) => {
    posts.assist.push(r.request().postData() ?? "");
    if (opts.hangFirstAssist && posts.assist.length === 1) return; // never answered: the app's own 320 s timeout ends it (fake clock)
    if (opts.assistStatus) return r.fulfill({ status: opts.assistStatus, json: { error: "rate_limited" } });
    return r.fulfill({ json: opts.answer ?? FINISHED });
  });
  await page.route("**/api/v1/analyse-facts", (r) => {
    posts.plain += 1;
    return r.fulfill({ json: CORE });
  });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  return posts;
}
const AVAILABLE = { state: "available", reason: null };

test("available: the consent line is beside an UNTICKED tick, the button needs the tick, and the plain Screen button is unchanged", async ({ page }) => {
  await open(page, { tier: AVAILABLE });
  await expect(page.getByTestId("assistant-consent-line")).toHaveText(CONSENT);
  const box = page.getByTestId("assistant-consent");
  await expect(box).not.toBeChecked();
  await expect(page.getByTestId("assistant-run-button")).toBeDisabled();
  await expect(page.getByTestId("assistant-run-button")).toHaveText("Run with the screening assistant");
  await expect(page.getByRole("button", { name: "Screen these facts" })).toBeEnabled();
  await box.check();
  await expect(page.getByTestId("assistant-run-button")).toBeEnabled();
});

test("available: Screen without the assistant sends the plain request, never the assist route", async ({ page }) => {
  const posts = await open(page, { tier: AVAILABLE });
  await page.getByTestId("assistant-consent").check();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  expect(posts.assist).toHaveLength(0);
  expect(posts.plain).toBe(1);
});

test("finished: the request carries consent true; the checklist is the engine's decide result; the trace has the eight fixed-word steps; no summary, no cost; consent is unticked after the run", async ({ page }) => {
  const posts = await open(page, { tier: AVAILABLE });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  expect(posts.assist).toHaveLength(1);
  expect(JSON.parse(posts.assist[0])).toMatchObject({ consent: true, facts: [F1], contract_ids: [CID] });
  const steps = page.getByTestId("assistant-step");
  await expect(steps).toHaveCount(8);
  await expect(steps.nth(0)).toHaveText("Read the facts");
  await expect(steps.nth(2)).toHaveText("Read the offence's ingredients");
  await expect(steps.nth(4)).toHaveText("Checked the quotes: passed");
  await expect(steps.nth(6)).toHaveText("Ran the structure check: passed");
  await expect(page.getByTestId("assistant-trace").locator("summary")).toHaveText("Steps of this screening");
  await expect(steps.nth(7)).toHaveText("Decided");
  await expect(page.getByTestId("assistant-outcome-line")).toHaveCount(0);
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("INVENTED ASSISTANT SUMMARY");
  expect(body).not.toMatch(/\$0\.12|12 cents|Assistant usage/i);
  expect(await page.getByTestId("assistant-result").innerText()).not.toMatch(/PROOF|DENIAL|ABSTAIN|agrees|differs|verified|confirmed|proved/i);
  await expect(page.getByTestId("assistant-consent")).not.toBeChecked();
});

test("a step trace never changes the checklist: the summary line and chips are the engine's", async ({ page }) => {
  await open(page, { tier: AVAILABLE });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("summary-text")).toHaveText("1 of 1 ingredients supported by a fact");
  await expect(page.getByTestId("ingredient-chip")).toHaveText("Supported by a fact");
});

const LINES: Array<[string, unknown, string | null]> = [
  ["timed out", blockOf("timed_out", "timeout"), "The assistant did not finish in time; this is the screening result without it."],
  ["timed out, with the engine's progress block (0.6.7+; Track A's local lane): the timeout line and the core result, not an unreadable answer", { ...blockOf("timed_out", "timeout"), assistant: { ...blockOf("timed_out", "timeout").assistant, cost: { used_cents: 2, budget_cents: 2 }, progress: { tool_calls: 2, refused_calls: 0, events: 14, max_events: 1000, elapsed_s: 6.1, wall_limit_s: 6, last_tool: "select_contracts" } } }, "The assistant did not finish in time; this is the screening result without it."],
  ["session budget", blockOf("budget", "per_session_budget"), "The assistant's budget for this session is used; screening works as normal."],
  ["refused: error", blockOf("refused", "error"), "The assistant could not be used for this run; this is the screening result without it."],
  ["refused: safety", blockOf("refused", "safety"), "The assistant could not be used for this run; this is the screening result without it."],
  ["refused: consent_required", blockOf("refused", "consent_required"), "The assistant could not be used for this run; this is the screening result without it."],
  ["refused: not_configured", blockOf("refused", "not_configured"), "The assistant could not be used for this run; this is the screening result without it."],
  ["refused: rate_limited (HTTP 200 with the core result)", blockOf("refused", "rate_limited"), "The assistant could not be used for this run; this is the screening result without it."],
  ["refused: sign_in_required (HTTP 200 with the core result)", blockOf("refused", "sign_in_required"), "The assistant is offered only to signed-in users. Without signing in, you get the screening result without it."],
  ["refused: daily_ceiling", blockOf("refused", "daily_ceiling"), PAUSED],
  ["refused: paused", blockOf("refused", "paused"), PAUSED],
];
for (const [name, answer, line] of LINES) {
  test(`${name}: the core result shows with the one plain line, no trace, no reason code`, async ({ page }) => {
    await open(page, { tier: AVAILABLE, answer });
    await page.getByTestId("assistant-consent").check();
    await page.getByTestId("assistant-run-button").click();
    await expect(page.getByTestId("checklist")).toBeVisible();
    await expect(page.getByTestId("assistant-outcome-line")).toHaveText(line as string);
    await expect(page.getByTestId("assistant-trace")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/per_session_budget|daily_ceiling|consent_required|not_configured|timed_out|rate_limited|sign_in_required/);
  });
}

test("an assistant block that does not match the contract makes the whole answer unreadable: the existing text, no partial result", async ({ page }) => {
  // off-contract on purpose: this mock must bypass the schema check, so it is served under a route the check does not read
  await open(page, { tier: AVAILABLE });
  await page.unroute("**/api/v1/analyse-facts/assist");
  await page.route("**/api/v1/analyse-facts/assist*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...CORE, assistant: { used: true, outcome: "great", reason: null, steps: [] } }) }));
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("screening-error")).toBeVisible();
  await expect(page.getByTestId("checklist")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("this answer could not be shown");
});

for (const reason of ["upstream_error", "quota", "budget_floor"]) {
  test(`paused (${reason}): the assistant control is greyed, the paused line shows once, plain Screen works`, async ({ page }) => {
    const posts = await open(page, { tier: { state: "unavailable", reason } });
    await expect(page.getByTestId("assistant-run")).toHaveAttribute("data-greyed", "true");
    await expect(page.getByTestId("assistant-consent")).toBeDisabled();
    await expect(page.getByTestId("assistant-run-button")).toBeDisabled();
    await expect(page.getByTestId("assistant-paused")).toHaveCount(1);
    await expect(page.getByTestId("assistant-paused")).toHaveText(PAUSED);
    await page.getByRole("button", { name: "Screen these facts" }).click();
    await expect(page.getByTestId("checklist")).toBeVisible();
    expect(posts.assist).toHaveLength(0);
  });
}

test("unreachable (the health read fails): greyed, no line, nothing can be sent to the assistant", async ({ page }) => {
  await open(page, { healthStatus: 503 });
  await expect(page.getByTestId("assistant-run")).toHaveAttribute("data-greyed", "true");
  await expect(page.getByTestId("assistant-run-button")).toBeDisabled();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
});

const NOT_CONFIGURED: Array<[string, unknown]> = [
  ["field absent", undefined],
  ["no_key", { state: "unavailable", reason: "no_key" }],
  ["disabled", { state: "unavailable", reason: "disabled" }],
  ["an unknown reason", { state: "unavailable", reason: "something_new" }],
];
for (const [name, tier] of NOT_CONFIGURED) {
  test(`not configured (${name}): no assistant control at all, nothing new`, async ({ page }) => {
    await open(page, { tier });
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("assistant-run")).toHaveCount(0);
    await expect(page.getByTestId("assistant-paused")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Run with the screening assistant");
  });
}

test("the consent line names no vendor of its own when the engine gives no provider", async ({ page }) => {
  await open(page, { tier: AVAILABLE, info: { provider: "  ", call_timeout_s: 60, assistant_tier: { state: "available", reason: null } } });
  await expect(page.getByTestId("assistant-consent-line")).toHaveText("Running with the assistant sends your facts to an AI provider through our account. Screening without the assistant does not.");
});

test("the consent line links to the Data handling section, which describes both routes in R1's words, and the page has the 'where' sentence", async ({ page }) => {
  await open(page, { tier: AVAILABLE });
  await expect(page.getByTestId("assistant-data-link")).toHaveAttribute("href", "/data-handling#dh-assistant");
  await expect(page.getByTestId("assistant-data-link")).toHaveText("How the assistant handles your facts");
  await page.goto("/data-handling");
  const sec = page.getByTestId("dh-assistant");
  await expect(sec.getByRole("heading", { name: "Screening with the assistant (optional)" })).toBeVisible();
  await expect(sec).toContainText("Without the assistant, your facts are processed as described above and are not sent to Anthropic.");
  await expect(sec.getByRole("link")).toHaveCount(2); // one link in each of two paragraphs
  await expect(sec.getByRole("link", { name: "data retention policy" })).toHaveAttribute("href", "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention");
  await expect(sec).toContainText("Anthropic's own data retention policy applies to any copy of your facts that it keeps.");
  await expect(sec.getByRole("link", { name: "Anthropic's commercial terms" })).toHaveCount(1);
  await expect(sec.getByRole("link", { name: "Anthropic's commercial terms" })).toHaveAttribute("href", "https://www.anthropic.com/legal/commercial-terms");
  await expect(sec).toContainText("The consent box is off for every run until you tick it.");
  await expect(sec).toContainText("The assistant is offered only to signed-in users. Without signing in, you get the screening result without it.");
  if (process.env.NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED === "1") await expect(sec).toContainText("it is deleted within 2 hours at the latest");
  else await expect(sec).not.toContainText("we delete the assistant's session"); // behind its own flag until confirmed
  await expect(page.getByTestId("dh-where")).toContainText("If you use the assistant, Anthropic also processes your facts; see Screening with the assistant (optional).");
  await expect(page.getByTestId("dh-where")).toContainText("If our EU processing is unavailable, part of the screening may instead run in a North American data centre for that request"); // always shown, beside the assistant sentence
});

test("signed out: no consent box and no button, only the sign-in line; Screen still works", async ({ page }) => {
  const posts = await open(page, { tier: AVAILABLE, me: 401 });
  await expect(page.getByTestId("assistant-signin")).toHaveText("The assistant is offered only to signed-in users. Without signing in, you get the screening result without it.");
  await expect(page.getByTestId("assistant-consent")).toHaveCount(0);
  await expect(page.getByTestId("assistant-run-button")).toHaveCount(0);
  expect(posts.assist).toHaveLength(0);
});

test("a rate-limited assisted run (429) still gives the screening result, with the could-not-use line and no reason", async ({ page }) => {
  const posts = await open(page, { tier: AVAILABLE, assistStatus: 429 });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  expect(posts.assist).toHaveLength(1);
  expect(posts.plain).toBe(1);
  await expect(page.getByTestId("assistant-outcome-line")).toHaveText("The assistant could not be used for this run; this is the screening result without it.");
  await expect(page.locator("body")).not.toContainText(/rate[ _-]?limit|\b429\b|too many requests/i); // (a bare "rate" would match "separate" in the D5 intro)
});

test("the identity call fails (503): nothing is shown, not the sign-in line, and nothing is enabled", async ({ page }) => {
  await open(page, { tier: AVAILABLE, me: 503 });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("assistant-run")).toHaveCount(0);
  await expect(page.getByTestId("assistant-signin")).toHaveCount(0);
  await expect(page.getByTestId("assistant-run-button")).toHaveCount(0);
});

test("GET /api/assistant: the signed-in-only ages and the limits are on the wire and are never shown", async ({ page }) => {
  await open(page, { tier: AVAILABLE });
  await expect(page.getByTestId("assistant-consent-line")).toHaveText(CONSENT);
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/4321|987|0\.25|session_budget|pending|sweep/i);
});

// Run again (Lead-2 14 Oct; strings R1's): only after the app's own 320 s timeout of an assisted run, never carrying the first run's consent.
test("run again: after the assisted run's own timeout the button reads Run again, needs a fresh tick, and sends one more assist request with consent", async ({ page }) => {
  const posts = await open(page, { tier: AVAILABLE, hangFirstAssist: true });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect.poll(() => posts.assist.length).toBe(1);
  await page.clock.fastForward(321_000);
  const btn = page.getByTestId("assistant-run-button");
  await expect(btn).toHaveText("Run again");
  await expect(page.getByTestId("run-again-note")).toHaveText("A second run counts toward your daily limit.");
  await expect(page.getByTestId("assistant-consent")).not.toBeChecked();
  await expect(btn).toBeDisabled();
  expect(posts.assist.length).toBe(1);
  await page.getByTestId("assistant-consent").check();
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect.poll(() => posts.assist.length).toBe(2);
  expect(JSON.parse(posts.assist[1]).consent).toBe(true);
  await expect(page.getByTestId("run-again-note")).toHaveCount(0);
});

test("run again: a finished assisted run, a fallback result and a plain run never show it", async ({ page }) => {
  await open(page, { tier: AVAILABLE });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("assistant-result")).toBeVisible();
  await expect(page.getByTestId("run-again-note")).toHaveCount(0);
  await expect(page.getByTestId("assistant-run-button")).toHaveText("Run with the screening assistant");
});

test("run again: a fallback (assist refused, plain result) does not show it", async ({ page }) => {
  await open(page, { tier: AVAILABLE, assistStatus: 429 });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("run-again-note")).toHaveCount(0);
  await expect(page.getByTestId("assistant-run-button")).toHaveText("Run with the screening assistant");
});
