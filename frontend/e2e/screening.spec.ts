import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * The Screening view against RECORDED engine answers (page.route) with invented facts: the checklist, the chips and their reasons, the cited fact
 * in full, the what-to-check line, the summary banner, the memo and audit-trail downloads, and the landing route. No judge is needed.
 */
const REGISTRY = "**/api/nyaya/registry/contracts";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const F2 = "Invented: Meena paid Ravi 500 in cash on the same day and took the toy lorry home.";
const CID = "ipc415_property";
const EL = [
  "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts",
  "the deception fraudulently or dishonestly induces the deceived person",
  "the inducement causes delivery of property to any person, or consent that any person shall retain property",
];
const base = { is_denial: false, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ANSWER = {
  run_id: "r-invented-screen", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", text: F1, sha256: "b".repeat(64) }, { id: "F2", text: F2, sha256: "c".repeat(64) }],
  contracts: [{
    contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [
      { ...base, element: EL[0], status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" },
      { ...base, element: EL[1], status: "not_confirmed", p_established: 0.6, p_established_second: null, fact_id: null, quote_source: null },
      { ...base, element: EL[2], status: "not_established", p_established: 0.1, p_established_second: null, fact_id: null, quote_source: null },
    ],
  }],
};

async function run(page: import("@playwright/test").Page, answer: unknown = ANSWER) {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(`${F1}\n\n${F2}`);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
}

test("the pasted facts become numbered, editable facts F1..Fn", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(`${F1}\n\n${F2}`);
  await page.getByTestId("split-facts").click();
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue(F1);
  await expect(page.getByRole("textbox", { name: "Fact F2", exact: true })).toHaveValue(F2);
  await page.getByRole("textbox", { name: "Fact F2", exact: true }).fill("edited second fact");
  await expect(page.getByRole("textbox", { name: "Fact F2", exact: true })).toHaveValue("edited second fact");
  await expect(page.getByTestId("retention-before")).toBeVisible();
});

test("the checklist: a chip and plain reason per ingredient, the cited fact in full, what to check, and the banner; no row says proved", async ({ page }) => {
  await run(page);
  const rows = page.getByTestId("ingredient-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByTestId("ingredient-chip")).toHaveText("Supported by a fact");
  await expect(rows.nth(1).getByTestId("ingredient-chip")).toHaveText("Needs your review");
  await expect(rows.nth(2).getByTestId("ingredient-chip")).toHaveText("Not supported by these facts");
  await expect(rows.nth(1).getByTestId("ingredient-reason")).toContainText("did not reach the level we require");
  await expect(rows.nth(0).getByTestId("cited-fact-note")).toHaveText("cites your fact F1 in full (the judge names the fact; it does not quote words)");
  await expect(rows.nth(0).getByTestId("cited-fact-text")).toContainText(F1);
  await expect(rows.nth(0).getByTestId("what-to-check")).toContainText("Check what the facts say was said or concealed");
  await expect(page.getByTestId("summary-text")).toHaveText("1 of 3 ingredients have a supporting fact; 1 need your review.");
  const text = await page.getByTestId("checklist").innerText();
  expect(text).not.toMatch(/\bproved\b|\bestablished\b|verbatim|offence is made out/i);
  // "Needs your review" is amber, never the error red
  await expect(rows.nth(1).getByTestId("ingredient-chip")).not.toHaveClass(/red/);
});

test("the all-supported line appears only when every ingredient is supported, both judges answered, the engine says PROOF and Lean passes", async ({ page }) => {
  const good = JSON.parse(JSON.stringify(ANSWER));
  good.contracts[0].outcome = "PROOF";
  good.contracts[0].reason = "all_elements_established";
  good.contracts[0].lean_outcome = "PROOF";
  good.contracts[0].elements = EL.map((e, i) => ({ ...base, element: e, status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: i === 2 ? "F2" : "F1", quote_source: "whole_fact" }));
  await run(page, good);
  await expect(page.getByTestId("summary-text")).toHaveText("All ingredients supported (structure checked)");
  await expect(page.getByTestId("summary-banner")).toContainText("not legal advice");
});

test("a referral shows the signed reason under 'Needs your review', not as an error", async ({ page }) => {
  const ref = JSON.parse(JSON.stringify(ANSWER));
  ref.contracts[0].outcome = "REFER_TO_LAWYER";
  ref.contracts[0].reason = "contract_not_validated";
  await run(page, ref);
  await expect(page.getByTestId("contract-review")).toContainText("not on the validated list");
  await expect(page.getByTestId("contract-review")).not.toHaveClass(/red/);
  await expect(page.getByTestId("summary-text")).not.toHaveText("All ingredients supported (structure checked)");
});

test("the memo and the audit trail download, carrying the checklist, the cited fact, the versions and the disclaimer", async ({ page }) => {
  await run(page);
  const [memoDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download memo (.md)" }).click()]);
  const memo = readFileSync((await memoDl.path()) as string, "utf8");
  expect(memo).toContain("# Screening memo");
  expect(memo).toContain("1 of 3 ingredients have a supporting fact; 1 need your review.");
  expect(memo).toContain("**Supported by a fact**");
  expect(memo).toContain(`F1: ${F1}`);
  expect(memo).toContain("Contract checker pin (sha256)");
  expect(memo).toContain("not legal advice");
  expect(memo).not.toMatch(/verbatim span|highlighted passage/i);
  const [auditDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download audit trail (.json)" }).click()]);
  const audit = JSON.parse(readFileSync((await auditDl.path()) as string, "utf8"));
  expect(audit.request.contractIds).toEqual([CID]);
  expect(audit.response.run_id).toBe("r-invented-screen");
  expect(audit.checker_pin_sha256).toHaveLength(64);
});

test("the Citations panel is below the checklist and the frontier toggle is off and disabled until the engine says it is available", async ({ page }) => {
  await run(page);
  await expect(page.getByTestId("frontier-toggle").getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByTestId("frontier-toggle").getByRole("checkbox")).toBeDisabled();
  const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
  await expect(page.getByRole("heading", { name: /citation/i }).first()).toBeVisible();
  expect(await y("checklist")).toBeLessThan((await page.getByRole("heading", { name: /citation/i }).first().boundingBox())!.y);
});

test("a member who opens / lands on Screening", async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member" } }));
  await page.goto("/");
  await page.waitForURL(/\/screening/);
});
