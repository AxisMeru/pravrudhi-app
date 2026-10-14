import { readFileSync } from "node:fs";

import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// #169 (Lead-2, R1): the downloaded memo carries "Steps of this screening" for a finished assisted run (as the screen does), and nothing for a plain run. The assisted arm needs the build
// with NEXT_PUBLIC_ASSISTANT_ENTRY=1; the plain arm runs on both builds.
const ON = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
const REGISTRY = "**/api/nyaya/registry/contracts";
const CID = "ipc415_property";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, binding_leg: null, quote_source: "whole_fact" };
const CORE = {
  run_id: "r-invented-memo-steps", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1" }] }],
};
const STEPS = ["ingest", "select_contracts", "describe_contract", "judge_element", "assemble", "lean_check", "decide"];
const FINISHED = {
  ...CORE,
  assistant: { used: true, outcome: "finished", reason: null, session_id: null, cost: null, summary: null, steps: STEPS.map((name) => ({ name, ...(name === "lean_check" ? { check: "agrees" } : {}) })) },
  appendix: { appendix_version: 1, steps: STEPS.map((name) => ({ name, calls: 1, ...(name === "lean_check" ? { check: "agrees" } : {}) })), per_contract: [{ contract_id: CID, elements_judged: 3, quotes_checked: 0, quotes_valid: 0, lean_agrees: true }], refused_calls: 0 },
};

async function open(page: import("@playwright/test").Page, assisted: boolean, answer: unknown) {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member", authenticated: true } }));
  if (assisted) {
    await page.route("**/api/health", (r) => r.fulfill({ json: { ok: true, version: "0.6.8", kernel: "0.6.8", ledger: true, assistant_tier: { state: "available", reason: null } } }));
    await page.route("**/api/assistant", (r) => r.fulfill({ json: { provider: "Anthropic", call_timeout_s: 60, session_budget_usd: 0.25, consent_required: true, assistant_tier: { state: "available", reason: null } } }));
    await page.route("**/api/v1/analyse-facts/assist", (r) => r.fulfill({ json: answer }));
  }
  await page.route("**/api/v1/analyse-facts", (r) => r.fulfill({ json: answer }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
}
async function memo(page: import("@playwright/test").Page): Promise<string> {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Markdown (.md)", exact: true }).click()]);
  return readFileSync((await dl.path()) as string, "utf8");
}

test("assisted finished run: the downloaded memo has the steps section, the signed labels and no counts; the screen shows the same steps", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_ASSISTANT_ENTRY=1");
  await open(page, true, FINISHED);
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await page.getByTestId("assistant-trace").locator("summary").click();
  await expect(page.getByTestId("assistant-step")).toHaveText(["Read the facts", "Chose the offences", "Read the offence's ingredients", "Read each ingredient", "Assembled the table", "Ran the structure check: passed", "Decided"]);
  const md = await memo(page);
  const at = md.split("\n").indexOf("## Steps of this screening");
  expect(at).toBeGreaterThan(0);
  expect(md.split("\n").slice(at, at + 10).join("\n")).toBe(["## Steps of this screening", "", "- Read the facts", "- Chose the offences", "- Read the offence's ingredients", "- Read each ingredient", "- Assembled the table", "- Ran the structure check: passed", "- Decided", ""].join("\n"));
  expect(md).not.toMatch(/calls|elements_judged|refused|appendix_version|per_contract/);
});

test("plain run: the downloaded memo has no steps section and no mention", async ({ page }) => {
  await open(page, false, CORE);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  const md = await memo(page);
  expect(md).not.toMatch(/Steps of this screening|Read the facts|Ran the structure check/);
});

test("an assisted answer with a malformed appendix still shows the result; the memo has no steps section and no error", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_ASSISTANT_ENTRY=1");
  await open(page, true, { ...FINISHED, appendix: { appendix_version: 9, steps: "junk" } });
  await page.getByTestId("assistant-consent").check();
  await page.getByTestId("assistant-run-button").click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  const md = await memo(page);
  expect(md).not.toMatch(/Steps of this screening/);
});
