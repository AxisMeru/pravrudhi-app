import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// #1038 cold start with progress (engine 0.6.31 contract), mocked routes only. The sync screening is refused with judges_offline; the page then starts a wake (POST /analyse-facts/wake, no facts), polls the user's
// wake status, and when both models are ready (or, partial, with the one-time ticket) sends the screening ITSELF.
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for a sum.";
const CONTRACTS = { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] };
const BASE = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ELEMENT = { ...BASE, element: "an invented ingredient", status: "not_established", p_established: 0.9, fact_id: "F1", quote_source: "whole_fact" };
const RESULT = (reason: string, extra: Record<string, unknown> = {}) => ({
  run_id: "r-invented-wake", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: "ipc415_property", outcome: "REFER_TO_LAWYER", reason, elements: [ELEMENT], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null }],
  ...extra,
});
const w = (state: string, first: string, second: string, reason: string | null = null, extra: Record<string, unknown> = {}) => ({
  wake: { state, reason, deadline_s: 330, poll_after_s: 2, models: [{ role: "first", state: first, progress: null }, { role: "second", state: second, progress: null }] },
  ...extra,
});
const TICKET = { ticket: { value: "tkt-invented-123", mode: "partial", expires_in_s: 600 } };

interface Mock { start: { status: number; json: unknown }; polls: Array<{ status?: number; json?: unknown }>; result?: unknown }
async function setup(page: import("@playwright/test").Page, m: Mock) {
  const seen = { wakeStarts: 0, statusPolls: 0, screenings: [] as Array<{ ticket: string | undefined; body: string }> };
  let ready = false;
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
  await page.route("**/api/v1/analyse-facts/wake/status", (r) => {
    const p = m.polls[Math.min(seen.statusPolls++, m.polls.length - 1)];
    const j = p.json as { wake?: { state?: string } } | undefined;
    if (j?.wake?.state === "ready") ready = true;
    return r.fulfill({ status: p.status ?? 200, json: p.json ?? {} });
  });
  await page.route("**/api/v1/analyse-facts/wake", (r) => { seen.wakeStarts++; return r.fulfill(m.start); });
  await page.route("**/api/v1/analyse-facts", (r) => {
    const ticket = r.request().headers()["x-wake-ticket"];
    seen.screenings.push({ ticket, body: r.request().postData() ?? "" });
    if (!ready && !ticket) return r.fulfill({ status: 503, json: { error: "judges_offline" } });
    // second_judge_ran (engine 0.6.31) is not in the pinned engine schema yet, so a result that carries it is sent as a raw body: the schema guard checks `json` answers only, and a field the engine WILL send must not fail the mock.
    const result = m.result ?? RESULT("uncertain");
    return "second_judge_ran" in (result as object) ? r.fulfill({ contentType: "application/json", body: JSON.stringify(result) }) : r.fulfill({ json: result });
  });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  return seen;
}
const STARTED = { status: 202, json: w("waking", "waiting", "waiting") };

test("wake: rows and R1's lines show while the models start, then the page sends the screening itself; no running/scoring words during the wait", async ({ page }) => {
  const seen = await setup(page, { start: STARTED, polls: [{ json: w("waking", "ready", "starting") }, { json: w("waking", "ready", "starting") }, { json: w("ready", "ready", "ready") }] });
  await expect(page.getByTestId("wake-line")).toHaveText("Starting the analysis models. Nothing has been scored yet. This can take a few minutes.");
  await expect(page.getByTestId("wake-row-first")).toHaveText("First model: Waiting to start");
  await expect(page.getByTestId("wake-gloss")).toBeVisible();
  await expect(page.getByTestId("wake-line")).toContainText("The first model is ready. Waiting for the second model.", { timeout: 15_000 });
  await expect(page.getByTestId("wake-row-second")).toHaveText("Second model: Starting");
  expect(await page.getByTestId("running-card").innerText()).not.toMatch(/Screening in progress|Scoring|Analysing|%/);
  await expect(page.getByTestId("running-elapsed")).toBeVisible();
  await expect(page.getByTestId("wake-progress")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("wake-warning")).toHaveCount(0);
  await expect(page.getByText("Run id").or(page.getByText("Needs your review")).first()).toBeVisible();
  expect(seen.wakeStarts).toBe(1);
  expect(seen.screenings).toHaveLength(2);
  expect(seen.screenings[1].ticket, "a full wake sends no ticket").toBeUndefined();
  expect(seen.screenings[1].body, "the screening carries the user's facts (the wake call carried none)").toContain("toy lorry");
});

test("wake: a partial load sends the ticket from the status body as X-Wake-Ticket, shows the neutral warning above the result, and keeps the ticket off the page", async ({ page }) => {
  const seen = await setup(page, { start: STARTED, polls: [{ json: w("partial", "ready", "failed", "second_judge_unavailable", TICKET) }], result: RESULT("second_judge_unavailable", { second_judge_ran: false }) });
  await expect(page.getByTestId("wake-warning")).toHaveText("The second model did not complete its check. The first model's result is shown. Any ingredient the second model did not check goes to a lawyer and is not shown as supported.", { timeout: 20_000 });
  await expect(page.getByTestId("wake-progress")).toHaveCount(0);
  expect(seen.screenings[1].ticket).toBe("tkt-invented-123");
  expect(await page.locator("body").innerText()).not.toContain("tkt-invented-123");
});

test("wake: a failed start shows the total-failure line and the screening is NOT sent", async ({ page }) => {
  const seen = await setup(page, { start: STARTED, polls: [{ json: w("timeout", "starting", "starting", "start_timeout") }] });
  await expect(page.getByTestId("screening-error")).toHaveText("The analysis models did not start. Nothing was scored and no result is shown. This is not a finding about your matter. The models did not start within the time we allow. You can try again in a few minutes.", { timeout: 20_000 });
  await expect(page.getByTestId("wake-progress")).toHaveCount(0);
  expect(seen.screenings).toHaveLength(1);
});

test("wake not allowed: today's refusal, exactly, and no wake rows", async ({ page }) => {
  await setup(page, { start: { status: 503, json: { error: "judges_offline", wake: "not_allowed" } }, polls: [] });
  await expect(page.getByTestId("screening-error")).toHaveText("The analysis models are switched off at the moment. Nothing was scored. Try again later.");
  await expect(page.getByTestId("wake-progress")).toHaveCount(0);
});

test("wake: the warning also shows when the finished result says the second judge did not run, even if the wake block reads ready (R2)", async ({ page }) => {
  await setup(page, { start: STARTED, polls: [{ json: w("ready", "ready", "ready") }], result: { ...RESULT("second_judge_unavailable"), second_judge_ran: false } });
  await expect(page.getByTestId("wake-warning")).toBeVisible({ timeout: 20_000 });
});

test("wake: stop following a wake, run again: the open wake is followed (no second POST /wake), and the screening carries the CURRENT facts", async ({ page }) => {
  const seen = await setup(page, { start: STARTED, polls: [{ status: 500, json: { detail: "x" } }, { status: 500, json: { detail: "x" } }, { status: 500, json: { detail: "x" } }, { json: w("ready", "ready", "ready") }] });
  await expect(page.getByTestId("screening-error")).toContainText("We could not check whether the analysis models started", { timeout: 25_000 });
  expect(seen.wakeStarts).toBe(1);
  const box = page.getByLabel("Paste the FIR, complaint or narrative");
  await box.fill(`${F1} Meena paid the sum the next day.`);
  await page.getByTestId("split-facts").click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect.poll(() => seen.screenings.length, { timeout: 25_000 }).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId("wake-progress")).toHaveCount(0, { timeout: 20_000 });
  expect(seen.wakeStarts, "no second wake while the first may be open").toBe(1);
  expect(seen.screenings.at(-1)!.body).toContain("paid the sum the next day");
});
