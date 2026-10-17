import { expect, test } from "@playwright/test";

// The preview-workflow page against recorded engine answers (shapes from Track C's and Track A's contract files). Plain Playwright: these routes are not in the engine's OpenAPI.
const HEX = "0123456789abcdef0123456789abcdef";
const AGENDA = { run_id: "r1", matter_id: HEX, standing_line: "Standing line from the engine.", heading: "What the Court said", stem: "The Court's words.", caution: { label: "Caution", quote: "A quoted caution.", our_line: "Our line." }, categories: ["Category one"], papers: { heading: "Papers", caption: "Listed, not read.", documents: [{ doc_id: "d1", name: "FIR" }] }, not_assessed: ["Not assessed: whether grounds exist."] };

test("start a matter, add a paper, run the quashing agenda: the engine's sentences show in order under the Preview label", async ({ page }) => {
  const docs: { doc_id: string; name: string }[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { docs.push({ doc_id: "d1", name: "FIR" }); r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "FIR", n_pages: 1, n_spans: 3, n_chars: 90, pages_without_text: [], indexed_complete: true } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: docs.map((d) => ({ ...d, n_pages: 1, n_spans: 3, n_chars: 90, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: 1, pages_not_read: 0, pages_note: "All pages were read." } }));
  await page.route("**/api/v1/quashing-agenda", (r) => r.fulfill({ json: AGENDA }));
  await page.goto("/preview");
  await expect(page.getByTestId("preview-line")).toContainText("Preview.");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("pv-name").fill("FIR");
  await page.getByTestId("pv-text").fill("The accused is said to have taken the lorry.");
  await page.getByTestId("pv-add").click();
  await expect(page.getByTestId("pv-papers")).toContainText("FIR");
  await expect(page.getByTestId("pv-pages-note")).toHaveText("All pages were read.");
  await page.getByTestId("pv-s3-run").click();
  const result = page.getByTestId("pv-s3-result");
  await expect(result).toContainText("Standing line from the engine.");
  await expect(result).toContainText("A quoted caution.");
  await expect(result).toContainText("Not assessed: whether grounds exist.");
  const keys = await result.locator("[data-testid^='pv-s3-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(keys).toEqual(["pv-s3-standing_line", "pv-s3-heading", "pv-s3-stem", "pv-s3-caution", "pv-s3-categories", "pv-s3-papers", "pv-s3-not_assessed"]);
});

test("a 404 reads R1's 'not available here' line and a 409 no_papers reads the no-papers line", async ({ page }) => {
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  let n = 0;
  await page.route("**/api/v1/quashing-agenda", (r) => (n++ === 0 ? r.fulfill({ status: 404, json: { detail: "x", error: "not_found" } }) : r.fulfill({ status: 409, json: { detail: "No papers added yet.", error: "no_papers" } })));
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("pv-s3-run").click();
  await expect(page.getByTestId("pv-message")).toHaveText("This workflow is not available here.");
  await page.getByTestId("pv-s3-run").click();
  await expect(page.getByTestId("pv-message")).toHaveText("There are no papers to read. Add papers first.");
});
