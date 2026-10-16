import { readFileSync } from "node:fs";

import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";
import { isLayoutB } from "./support/layout";

/**
 * The Screening view against RECORDED engine answers (page.route) with invented facts: the checklist, the chips and their reasons, the cited fact
 * in full, the what-to-check line, the summary banner, the memo and run-record downloads, and the landing route. No judge is needed.
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
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ANSWER = {
  run_id: "r-invented-screen", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }, { id: "F2", sha256: sha(F2) }],
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
  const all = page.getByTestId("ingredient-row");
  await expect(all).toHaveCount(3);
  // layout B groups the rows by chip (review, supported, no fact), so a row is found by its chip there and by its place in the answer on the live layout
  const b = await isLayoutB(page);
  const CHIPS = ["Supported by a fact", "Needs your review", "No fact cited"];
  if (b) {
    // grouped rows lose nothing: all three ingredients exactly once, in statute order within each group, and the group headings' counts add up to the total
    const texts = await all.getByTestId("ingredient-text").allInnerTexts();
    expect([...texts].sort(), "each ingredient appears exactly once").toEqual([...EL].sort());
    let total = 0;
    for (const chip of CHIPS) {
      const group = all.filter({ has: page.getByTestId("ingredient-chip").filter({ hasText: chip }) });
      const n = await group.count();
      total += n;
      const order = (await group.getByTestId("ingredient-text").allInnerTexts()).map((t) => EL.indexOf(t));
      expect(order, `${chip}: statute order inside the group`).toEqual([...order].sort((x, y) => x - y));
      await expect(page.getByText(new RegExp(`^${chip} \\(${n}\\)$`)), `${chip}: the group heading carries its count`).toHaveCount(1);
    }
    expect(total, "the group counts add up to the contract's elements").toBe(EL.length);
  }
  const rows = { nth: (i: number) => (b ? all.filter({ has: page.getByTestId("ingredient-chip").filter({ hasText: CHIPS[i] }) }) : all.nth(i)) };
  await expect(rows.nth(0).getByTestId("ingredient-chip")).toHaveText("Supported by a fact");
  await expect(rows.nth(1).getByTestId("ingredient-chip")).toHaveText("Needs your review");
  await expect(rows.nth(2).getByTestId("ingredient-chip")).toHaveText("No fact cited");
  await expect(rows.nth(1).getByTestId("ingredient-reason")).toContainText("did not reach the level we require");
  await expect(rows.nth(0).getByTestId("cited-fact-note")).toHaveText("cites your fact F1 in full (the screening names the fact; it does not quote words)");
  await expect(rows.nth(0).getByTestId("cited-fact-text")).toContainText(F1);
  await expect(rows.nth(0).getByTestId("what-to-check")).toContainText("Check what the facts say was said or concealed");
  await expect(page.getByTestId("summary-text")).toHaveText("1 of 3 ingredients supported by a fact · 1 to look for · 1 for your review");
  await expect(page.getByTestId("checklist").getByTestId("ipc-disclosure")).toHaveText("Checked against the IPC text (s.415); the BNS counterpart is not validated.");
  // R1 (15 Oct): the standing line appears ONCE per result, above the first block, not under each block's banner sentence
  await expect(page.getByTestId("summary-banner")).toHaveText("1 of 3 ingredients supported by a fact · 1 to look for · 1 for your review");
  await expect(page.getByTestId("standing-line")).toHaveCount(1);
  await expect(page.getByTestId("summary-banner").getByText("A lawyer decides.")).toHaveCount(0);
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
  await expect(page.getByTestId("structure-note")).toHaveText("A Lean check confirmed the right ingredients were addressed; it does not read your facts.");
  await expect(page.getByTestId("standing-line")).toContainText("not legal advice"); // once per result, above the first block (R1, 15 Oct), not inside the banner
});

test("a referral shows the signed reason under 'Needs your review', not as an error", async ({ page }) => {
  const ref = JSON.parse(JSON.stringify(ANSWER));
  ref.contracts[0].outcome = "REFER_TO_LAWYER";
  ref.contracts[0].reason = "contract_not_validated";
  await run(page, ref);
  await expect(page.getByTestId("contract-review")).toContainText("not on our validated list");
  await expect(page.getByTestId("contract-review")).not.toHaveClass(/red/);
  await expect(page.getByTestId("contract-review-code")).toHaveCount(0); // a known reason shows only its sentence (R1, 14 Oct)
  await expect(page.getByTestId("summary-text")).not.toHaveText("All ingredients supported (structure checked)");
  await expect(page.getByTestId("structure-note")).toHaveCount(0);
});

test("the Word memo downloads and carries the same text as the .md memo (#830 DOCX)", async ({ page }) => {
  await run(page);
  await page.getByTestId("memo-menu-button").click();
  const [mdDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Markdown (.md)", exact: true }).click()]);
  const md = readFileSync((await mdDl.path()) as string, "utf8");
  await page.getByTestId("memo-menu-button").click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("memo-docx").click()]);
  expect(dl.suggestedFilename()).toBe("screening-memo-r-invented-screen.docx");
  const buf = readFileSync((await dl.path()) as string);
  expect(buf.subarray(0, 2).toString("latin1")).toBe("PK"); // a zip
  const { value } = await (await import("mammoth")).extractRawText({ buffer: buf });
  const lines = value.split("\n").filter((l: string) => l.trim());
  // every visible line of the .md memo (markup removed) is in the Word memo, in order
  const plain = md.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^#{1,3} /, "").replace(/^> /, "").replace(/^ {2}- /, "").replace(/^- /, "").replace(/\*\*/g, ""));
  const noStamp = (l: string) => l.replace(/Generated: .*/, "Generated: <time>"); // each download stamps its own generation time
  expect(lines.map(noStamp)).toEqual(plain.map(noStamp));
  expect(value).toContain(F1);
  expect(value).toContain("not legal advice");
});

test("the memo and the run record download, carrying the checklist, the cited fact, the versions and the disclaimer", async ({ page }) => {
  await run(page);
  await page.getByTestId("memo-menu-button").click();
  const [memoDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Markdown (.md)", exact: true }).click()]);
  const memo = readFileSync((await memoDl.path()) as string, "utf8");
  expect(memo).toContain("# Screening memo");
  expect(memo).toContain("1 of 3 ingredients supported by a fact · 1 to look for · 1 for your review");
  expect(memo).toContain("**Supported by a fact**");
  expect(memo).toContain(`F1: ${F1}`);
  expect(memo).toContain("Contract checker pin (sha256)");
  expect(memo).toContain("not legal advice");
  expect(memo).not.toMatch(/verbatim span|highlighted passage/i);
  const [auditDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download run record (.json)" }).click()]);
  const audit = JSON.parse(readFileSync((await auditDl.path()) as string, "utf8"));
  expect(audit.request.contractIds).toEqual([CID]);
  expect(audit.response.run_id).toBe("r-invented-screen");
  expect(audit.checker_pin_sha256).toHaveLength(64);
});

test("the Citations panel is below the checklist and nothing about the frontier reader is shown while it is unavailable (#128 D6)", async ({ page }) => {
  await run(page);
  await expect(page.getByTestId("frontier-toggle")).toHaveCount(0);
  await expect(page.getByTestId("frontier-limit")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/frontier/i);
  // The panel is rendered only on a build with both citation flags (#190); on any other build there is no Citations heading at all.
  if (process.env.CITATION_NAV_BUILD === "1" && process.env.CITATION_EXISTENCE_BUILD === "1") {
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
    await expect(page.getByRole("heading", { name: "Case citations", exact: true })).toBeVisible();
    expect(await y("checklist")).toBeLessThan((await page.getByRole("heading", { name: "Case citations", exact: true }).boundingBox())!.y);
  } else {
    await expect(page.getByRole("heading", { name: "Case citations", exact: true })).toHaveCount(0); // the panel heading (Hearing preparation has its own "Citations to check")
  }
});

test("a member who opens / lands on Screening", async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member" } }));
  await page.goto("/");
  await page.waitForURL(/\/screening/);
});

test("the demo link loads the public-order example as numbered facts, R1's label and the order's citation, with its offences selected", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc415_property", "ipc415_damaging_act"], entries: [] } }));
  await page.goto("/screening?example=madras-public-order-2024");
  await expect(page.getByTestId("example-banner")).toContainText("A public court order, example only. These are the allegations as the court recited them, not findings, and not a view on the case. A crime number and a date have been replaced by placeholders. The output of this demo is illustrative, not evidence, and no measure is quoted from it.");
  await expect(page.getByTestId("example-citation")).toHaveText("Madras High Court, order of 12 June 2024");
  await expect(page.getByTestId("example-banner")).not.toContainText(/13624|Crl|invented/);
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue(/Cr\.No\.\[redacted\] of 2023/);
  await expect(page.getByRole("textbox", { name: "Fact F3", exact: true })).toBeVisible();
  await expect(page.getByTestId("offence-list").locator("input:checked")).toHaveCount(2);
  await expect(page.getByTestId("example-not-found")).toHaveCount(0);
});

test("the Karnataka cheating example loads with R1's own label, the order's neutral citation and its screening line, and selects the cheating offence", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["ipc415_property", "ipc415_damaging_act", "ipc405_misappropriation"], entries: [] } }));
  await page.goto("/screening?example=karnataka-cheating-2025");
  await expect(page.getByTestId("example-banner")).toContainText("These are the prosecution's allegations as the court recited them, not findings by us and not a view on the case. The court's decision is not shown here.");
  await expect(page.getByTestId("example-citation")).toHaveText("High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773");
  await expect(page.getByTestId("example-screening-line")).toHaveText("Screened here for the ingredients of cheating (BNS 318 · IPC 415).");
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue(/gold coins/);
  await expect(page.getByTestId("example-banner")).not.toContainText(/invented/i);
});

test("an example id this app does not have shows 'not available' and a link to the example; no example is loaded by default", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/screening");
  await expect(page.getByTestId("example-banner")).toHaveCount(0); // a demo with real names is never the default
  await page.goto("/screening?example=a-retired-example");
  await expect(page.getByTestId("example-not-found")).toContainText("That example is not available.");
  await expect(page.getByTestId("example-banner")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue("");
  await page.getByRole("link", { name: "Try the example instead" }).click();
  await expect(page.getByTestId("example-citation")).toHaveText("Madras High Court, order of 12 June 2024");
});

// #99: the contracts the registry lists but has not validated are offered too, with the line that the engine refers on them, and their rows carry a What-to-check prompt.
test("the not-validated offences are offered with the referral line, and a supported ni138 row carries its What-to-check prompt", async ({ page }) => {
  const NI = "ni138";
  const NI_EL = "cheque drawn for discharge of legally enforceable debt or other liability";
  const NI_FACT = "Invented: Meena gave Ravi a cheque for 500 for the toy lorry; the bank returned it unpaid.";
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID, NI, "bns316_misappropriation"], entries: [{ id: CID, validated: true }, { id: NI, validated: false }, { id: "bns316_misappropriation", validated: false }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: {
    run_id: "r-invented-ni", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
    facts: [{ id: "F1", sha256: sha(NI_FACT) }],
    contracts: [{
      contract_id: NI, outcome: "REFER_TO_LAWYER", reason: "contract_not_validated", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
      elements: [{ ...base, element: NI_EL, status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }],
    }],
  } }));
  await page.goto("/screening");
  const list = page.getByTestId("offence-list");
  await expect(list).toContainText("Dishonour of a cheque");
  // #128 D7: one row per offence: no second "Criminal breach of trust (BNS s.316)" row, and one not-validated note
  await expect(list).not.toContainText("Criminal breach of trust (BNS s.316)");
  await expect(page.getByTestId("not-validated-note")).toHaveCount(1);
  await expect(page.getByTestId("not-validated-note").first()).toHaveText("Not on the validated list: for this offence the screening does not give a result; a lawyer decides.");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(NI_FACT);
  await page.getByTestId("split-facts").click();
  await list.locator("label").filter({ hasText: "Dishonour of a cheque" }).click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const row = page.getByTestId("ingredient-row").first();
  await expect(row.getByTestId("ingredient-chip")).toHaveText("Supported by a fact");
  await expect(row.getByTestId("what-to-check")).toContainText("Check what debt or liability the cheque was given for");
});

test("while a first run warms up, the page says so without a timing figure, counts the time and offers Cancel", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  let release: () => void = () => {};
  const held = new Promise<void>((res) => { release = res; });
  await page.route("**/api/v1/analyse-facts**", async (r) => { await held; await r.fulfill({ json: ANSWER }); });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(`${F1}\n\n${F2}`);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const note = page.getByText(/^Warming up the screening and Lean checker/);
  await expect(note).toContainText("a first run after idle can take a few minutes while the models start.");
  await expect(note).not.toContainText(/\b(145|177|180)\b|9\.9 ?s|about 3 minutes|100 seconds/);
  await expect(page.getByTestId("running-elapsed")).toHaveText(/^Waiting for \d\d:\d\d$/);
  await expect(page.getByTestId("screening-cancel")).toBeVisible();
  release();
  await expect(page.getByTestId("checklist")).toBeVisible();
});
