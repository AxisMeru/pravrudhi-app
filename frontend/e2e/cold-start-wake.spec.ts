import { expect, test } from "./support/engineTest";

// #1038 cold start with progress, mocked routes only. The sync route refuses with judges_offline; the page then asks for a wake job (session only) and polls it.
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for a sum.";
const CONTRACTS = { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] };
const ELEMENT = { element: "an invented ingredient", is_denial: false, status: "not_established", claimed: true, p_established: 0.9, fact_id: "F1", quote_source: "whole_fact", quote: null };
const RESULT = (reason: string) => ({
  run_id: "r-invented-wake", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented",
  facts: [{ id: "F1", sha256: "b".repeat(64) }],
  contracts: [{ contract_id: "ipc415_property", outcome: "REFER_TO_LAWYER", reason, elements: [ELEMENT], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: false }],
});
const w = (state: string, first: string, second: string, reason: string | null = null) => ({ state, reason, models: [{ role: "first", state: first, progress: null }, { role: "second", state: second, progress: null }] });

async function setup(page: import("@playwright/test").Page, opts: { start: { status: number; json: unknown }; polls: Array<{ status: string; wake: unknown; result?: unknown }> }) {
  let n = 0;
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
  await page.route("**/api/v1/analyse-facts/jobs/**", (r) => r.fulfill({ json: opts.polls[Math.min(n++, opts.polls.length - 1)] }));
  await page.route("**/api/v1/analyse-facts/jobs", (r) => r.fulfill(opts.start));
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ status: 503, json: { error: "judges_offline" } }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
}
const STARTED = { status: 202, json: { job_id: "j1", status: "pending", wake: w("waking", "waiting", "waiting") } };

test("wake: rows and R1's lines show while the models start, then the result; no running/scoring words during the wait", async ({ page }) => {
  await setup(page, { start: STARTED, polls: [{ status: "pending", wake: w("waking", "ready", "starting") }, { status: "pending", wake: w("waking", "ready", "starting") }, { status: "done", wake: w("ready", "ready", "ready"), result: RESULT("uncertain") }] });
  await expect(page.getByTestId("wake-line")).toHaveText("Starting the analysis models. Nothing has been scored yet. This can take a few minutes.");
  await expect(page.getByTestId("wake-row-first")).toHaveText("First model: Waiting to start");
  await expect(page.getByTestId("wake-gloss")).toBeVisible();
  await expect(page.getByTestId("wake-line")).toContainText("The first model is ready. Waiting for the second model.", { timeout: 15_000 });
  await expect(page.getByTestId("wake-row-second")).toHaveText("Second model: Starting");
  const wait = await page.getByTestId("running-card").innerText();
  expect(wait).not.toMatch(/Screening in progress|Scoring|Analysing|%/);
  await expect(page.getByTestId("running-elapsed")).toBeVisible();
  await expect(page.getByTestId("wake-progress")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("wake-warning")).toHaveCount(0);
  await expect(page.getByText("Run id").or(page.getByText("Needs your review")).first()).toBeVisible();
});

test("wake: a partial load shows the warning above the result; nothing is shown as supported", async ({ page }) => {
  await setup(page, { start: STARTED, polls: [{ status: "done", wake: w("partial", "ready", "failed", "second_judge_unavailable"), result: RESULT("second_judge_unavailable") }] });
  await expect(page.getByTestId("wake-warning")).toHaveText("The second model did not start. The first model's result is shown, but no ingredient is shown as supported: each ingredient the first model supported goes to a lawyer, because the second model did not check it.", { timeout: 20_000 });
  await expect(page.getByTestId("wake-progress")).toHaveCount(0);
});

test("wake: a failed start shows the total-failure line and no result", async ({ page }) => {
  await setup(page, { start: STARTED, polls: [{ status: "failed", wake: w("timeout", "starting", "starting", "start_timeout") }] });
  await expect(page.getByTestId("screening-error")).toHaveText("The analysis models did not start. Nothing was scored and no result is shown. This is not a finding about your matter. The models did not start within the time we allow. You can try again in a few minutes.", { timeout: 20_000 });
  await expect(page.getByTestId("wake-progress")).toHaveCount(0);
});

test("wake not allowed: today's refusal, exactly, and no wake rows", async ({ page }) => {
  await setup(page, { start: { status: 503, json: { error: "judges_offline", wake: "not_allowed" } }, polls: [] });
  await expect(page.getByTestId("screening-error")).toHaveText("The analysis models are switched off at the moment. Nothing was scored. Try again later.");
  await expect(page.getByTestId("wake-progress")).toHaveCount(0);
});

test("wake: the warning also shows when the finished result says the second judge did not run, even if the wake block reads ready (R2)", async ({ page }) => {
  await setup(page, { start: STARTED, polls: [{ status: "done", wake: w("ready", "ready", "ready"), result: { ...RESULT("second_judge_unavailable"), second_judge_ran: false } }] });
  await expect(page.getByTestId("wake-warning")).toBeVisible({ timeout: 20_000 });
});

test("wake: a second screening while the first start may still be open resumes that job and starts no second wake (R2)", async ({ page }) => {
  let starts = 0;
  let polls = 0;
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
  await page.route("**/api/v1/analyse-facts/jobs/**", (r) => (++polls <= 3 ? r.fulfill({ status: 500, json: { detail: "x" } }) : r.fulfill({ json: { status: "done", wake: w("ready", "ready", "ready"), result: RESULT("uncertain") } })));
  await page.route("**/api/v1/analyse-facts/jobs", (r) => { starts++; return r.fulfill(STARTED); });
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ status: 503, json: { error: "judges_offline" } }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("screening-error")).toContainText("We could not check whether the analysis models started", { timeout: 20_000 });
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("screening-error")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("wake-progress")).toHaveCount(0, { timeout: 20_000 });
  expect(starts).toBe(1);
});
