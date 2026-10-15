import { readFileSync } from "node:fs";

// The schema-checked test: the mock answer must match the engine's pinned response schema.
import { expect, test } from "./support/engineTest";

import { sha } from "./support/sha";

// #214 (a): the Matters memo is the screening memo (#210's builder): R1's disclaimer, no internal token (no engine reason code, no REFER_TO_LAWYER, no raw contract id), headings through memoBlockHeading.
// /matters stays: the engine diagnostic console is still reachable and renders after #200.
const KNOWN = "ipc415_property";
const OUTSIDE = "bns316_misappropriation"; // in the engine's registry, not in the app's OFFENCES table
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";
const el = { is_denial: false, screening_signal: null, citation_note: null, claimed: false, start: null, end: null, attempts: 1, occurrences: 0, offsets_source: null, error: null, quote: null, quote_check: null, quote_source: null, fact_id: null, p_established_second: null, binding_leg: "primary" };
const contract = (id: string, outcome: string, reason: string) => ({
  contract_id: id, outcome, reason, assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
  elements: [{ ...el, element: "an invented ingredient", status: "not_established", p_established: 0.1 }],
});
const answer = {
  run_id: "r-invented-matters-memo", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  standard: { applied: "x", in_judge_prompt: false, proceeding_posture: null, requested: "x", source: "s" },
  facts: [{ id: "F1", sha256: sha(FACT) }],
  contracts: [contract(KNOWN, "REFER_TO_LAWYER", "uncertain_second_judge"), contract(OUTSIDE, "ABSTAIN", "judge_error")],
};

test("/matters still renders, and its memo is the screening memo: R1's disclaimer, no internal token, no raw contract id as a heading", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [KNOWN, OUTSIDE], entries: [{ id: KNOWN, validated: true }, { id: OUTSIDE, validated: false }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer }));
  await page.goto("/matters");
  await expect(page.locator("main").getByRole("heading", { name: "Offence rules", exact: true })).toBeVisible();
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText(KNOWN).click();
  await page.getByText(OUTSIDE).click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download memo (.md)" }).click()]);
  expect(dl.suggestedFilename()).toBe("analysis-memo-r-invented-matters-memo.md");
  const md = readFileSync((await dl.path())!, "utf8");
  expect(md).toMatch(/^> This memo is a screening aid, not legal advice\. A lawyer decides\./m); // R1's disclaimer (the screening memo's)
  expect(md).not.toMatch(/Engine reason code|REFER_TO_LAWYER|uncertain_second_judge|judge_error|\(reason: /);
  expect(md, "a raw contract id reached the memo").not.toMatch(new RegExp(`${KNOWN}|${OUTSIDE}`));
  expect(md.split("\n").filter((l) => l === "## Offence").length, "the contract the app does not know is headed by the neutral 'Offence'").toBe(1);
  expect(md).toContain("## Cheating"); // the known offence by its label (memoBlockHeading)
});
