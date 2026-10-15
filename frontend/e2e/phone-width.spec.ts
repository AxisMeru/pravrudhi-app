import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// #244 (explorer gap review, P3): at 400 px a result scrolled sideways by 77 px (the 64-character score sha did not wrap), and several tap targets were 16-20 px high. The page now wraps the sha and
// every link and checkbox named in the review is at least 24 x 24 px (the app's minimum; 44 px on phones where the control is a link row).
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const CID = "ipc415_property";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ANSWER = {
  run_id: "r-invented-phone", judge: "invented", score_sha256: "a1b2c3d4".repeat(8), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] }],
};
const MIN = 24;

test.use({ viewport: { width: 400, height: 800 } });

test("400 px: the result does not scroll sideways (the sha wraps), and the step links, offence checkbox and workflow links are at least 24 px", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: ANSWER }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  const box = async (loc: import("@playwright/test").Locator) => { const b = await loc.boundingBox(); expect(b, "the control has a box").not.toBeNull(); return b!; };
  for (const key of ["facts", "screen"]) { const b = await box(page.getByTestId(`step-link-${key}`)); expect(b.height, `step link ${key}`).toBeGreaterThanOrEqual(MIN); }
  const cb = await box(page.getByRole("checkbox").first());
  expect(cb.width).toBeGreaterThanOrEqual(MIN); expect(cb.height).toBeGreaterThanOrEqual(MIN);
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("run-ids")).toContainText(ANSWER.score_sha256);
  const over = await page.evaluate(() => {
    const m = document.querySelector("main")!;
    return { main: m.scrollWidth - m.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth };
  });
  expect(over, "no horizontal scroll inside main or on the page").toEqual({ main: 0, doc: 0 });

  await page.goto("/workflows");
  const links = page.getByTestId("workflow-open");
  const n = await links.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) expect((await box(links.nth(i))).height, `workflow link ${i}`).toBeGreaterThanOrEqual(MIN);
});
