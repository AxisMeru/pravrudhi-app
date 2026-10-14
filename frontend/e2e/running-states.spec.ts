import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// P7 (R1, 14 Oct): the running view says only what the app knows while the request is open. Leave-and-return is version B because the Screening page keeps its state in the page itself:
// the second test proves that premise in the same tab (version A would be false).
const ON = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
const REGISTRY = "**/api/nyaya/registry/contracts";
const CID = "ipc415_property";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, binding_leg: null, quote_source: "whole_fact" };
const ANSWER = {
  run_id: "r-invented-run", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1" }] }],
};

async function openHeld(page: import("@playwright/test").Page) {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member", authenticated: true } }));
  let release: () => void = () => {};
  const held = new Promise<void>((res) => { release = res; });
  await page.route("**/api/v1/analyse-facts**", async (r) => { await held; await r.fulfill({ json: ANSWER }); });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  return release;
}

test("running view (plain run): the status line, 'Waiting for mm:ss', the leave line and Cancel; no step names, no assistant line", async ({ page }) => {
  const release = await openHeld(page);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("running-status")).toHaveText("Screening in progress. This page is waiting for the result.");
  await expect(page.getByTestId("running-elapsed")).toHaveText(/^Waiting for \d\d:\d\d$/);
  await expect(page.getByTestId("running-leave")).toHaveText("Keep this page open until the screening finishes. If you leave it, you will not see the result.");
  await expect(page.getByTestId("screening-cancel")).toBeVisible();
  await expect(page.getByTestId("running-assisted")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Read the facts|Chose the offences|Ran the structure check|Steps of this screening/);
  release();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("running-status")).toHaveCount(0);
});

test("leave and return in the same tab: the running screening is NOT shown on return (so the page says 'keep this page open', never 'keeps running')", async ({ page }) => {
  const release = await openHeld(page);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("running-status")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
  // a client-side navigation inside the app, then back
  await page.getByRole("link", { name: "Workflows" }).first().click();
  await expect(page).toHaveURL(/\/workflows\/?$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/screening\/?$/);
  await expect(page.getByTestId("running-status")).toHaveCount(0);
  await expect(page.getByTestId("checklist")).toHaveCount(0);
  await expect(page.getByLabel("Paste the FIR, complaint or narrative")).toHaveValue("");
  release();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("checklist")).toHaveCount(0);
});

test("running view (assistant run): one more line", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_ASSISTANT_ENTRY=1");
  await page.route("**/api/health", (r) => r.fulfill({ json: { ok: true, version: "0.6.8", kernel: "0.6.8", ledger: true, assistant_tier: { state: "available", reason: null } } }));
  await page.route("**/api/assistant", (r) => r.fulfill({ json: { provider: "Anthropic", call_timeout_s: 60, session_budget_usd: 0.25, consent_required: true, assistant_tier: { state: "available", reason: null } } }));
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member", authenticated: true } }));
  let release: () => void = () => {};
  const held = new Promise<void>((res) => { release = res; });
  await page.route("**/api/v1/analyse-facts/assist", async (r) => { await held; await r.fulfill({ json: { ...ANSWER, assistant: { used: true, outcome: "finished", reason: null, session_id: null, cost: null, summary: null, steps: [] } } }); });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("running-assisted")).toHaveText("The assistant is working through the steps; they are shown on this page when it finishes.");
  await expect(page.getByTestId("running-status")).toBeVisible();
  release();
  await expect(page.getByTestId("checklist")).toBeVisible();
});
