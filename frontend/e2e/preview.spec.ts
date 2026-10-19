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
  await expect(page.getByTestId("preview-line")).toContainText("Check each result against your papers");
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

// The other preview workflows against Track A's sample responses (real engine functions, invented text): src/lib/fixtures/preview/*.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
const sample = (n: string) => (JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "preview", `${n}.json`), "utf8")) as { response: unknown }).response;

async function withMatter(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
}

test("A3 chronology: an ambiguous date lists both readings, the paper's words show, and custody days never appear", async ({ page }) => {
  await withMatter(page);
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ json: sample("a3_chronology") }));
  await page.getByTestId("pv-a3-run").click();
  const amb = page.getByTestId("pv-a3-ambiguous");
  await expect(amb.getByTestId("pv-a3-readings").locator("li")).toHaveText(["2024-06-12", "2024-12-06"]);
  await expect(amb).toContainText("The accused was arrested on 12.06.2024");
  await expect(page.getByTestId("pv-a3")).not.toContainText(/cannot say yet|custody days/i);
});

test("A5 review agenda: the section's own words, the not-added list and the not-assessed lines; nothing says an ingredient is met", async ({ page }) => {
  await withMatter(page);
  await page.route("**/api/v1/review-agenda", (r) => r.fulfill({ json: sample("a5_review_agenda") }));
  await page.getByTestId("pv-a5-run").click();
  await expect(page.getByTestId("pv-a5-ingredients").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("pv-a5-result")).toContainText("Whether the papers show any ingredient.");
  await expect(page.getByTestId("pv-a5-result")).not.toContainText(/\bmet\b/i);
});

test("S1 sweep and A1 draft check list each citation with the app's own status words", async ({ page }) => {
  await withMatter(page);
  await page.route("**/api/v1/matter-citation-sweep", (r) => r.fulfill({ json: sample("s1_matter_citation_sweep") }));
  await page.route("**/api/v1/draft-citation-check", (r) => r.fulfill({ json: sample("a1_draft_citation_check") }));
  await page.getByTestId("pv-s1-run").click();
  await expect(page.getByTestId("pv-s1-result").getByTestId("pv-citations").first()).toContainText("(2014) 8 SCC 273");
  await expect(page.getByTestId("pv-s1-result")).toContainText("Found in our index");
  await page.getByTestId("pv-a1-text").fill("See (2014) 8 SCC 273 and (2099) 99 SCC 999.");
  await page.getByTestId("pv-a1-run").click();
  await expect(page.getByTestId("pv-a1-result")).toContainText("Not found in our index");
});

test("B3 checklist: the first run sends unconfirmed dates; Confirm resends the date with confirmed_as equal to the engine's own reading", async ({ page }) => {
  await withMatter(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/s138-checklist", (r) => { const b = JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>; bodies.push(b); const chequeConfirmed = (b.cheque_date as { confirmed?: boolean } | undefined)?.confirmed === true; r.fulfill({ json: sample(chequeConfirmed ? "b3_s138_checklist_computed" : "b3_s138_checklist_refer") }); });
  await page.getByTestId("pv-b3-cheque").fill("01.02.2013");
  await page.getByTestId("pv-b3-notice").fill("20.02.2013");
  await page.getByTestId("pv-b3-run").click();
  await expect(page.getByTestId("pv-b3-steps").locator(":scope > li")).toHaveCount(4);
  expect(bodies[0].cheque_date).toEqual({ value: "01.02.2013", source: "typed", confirmed: false });
  await page.getByTestId("pv-b3-confirm").first().click();
  await expect(page.getByTestId("pv-b3-counts").first()).toContainText("2013-05-01");
  expect(bodies[1].cheque_date).toEqual({ value: "01.02.2013", source: "typed", confirmed: true, confirmed_as: "2013-02-01" });
});

test("when the engine no longer holds the matter (a restart), the page says so and offers to start again", async ({ page }) => {
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ status: 404, json: { detail: "x", error: "matter_not_found" } }));
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ status: 404, json: { detail: "x", error: "matter_not_found" } }));
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("pv-a3-run").click();
  await expect(page.getByTestId("pv-message")).toContainText("no longer held");
  await expect(page.getByTestId("pv-start")).toBeVisible();
});

test("hearing pack: the papers' own dates in order, both readings of an ambiguous date, citations as an existence check with their note; the typed hearing date is sent only when it is a valid year-month-day", async ({ page }) => {
  await withMatter(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-hearing-pack", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: sample("matter_hearing_pack_with_sweep") }); });
  await page.getByTestId("pv-hp-date").fill("3 November");
  await page.getByTestId("pv-hp-run").click();
  await expect(page.getByTestId("pv-hp-result")).toBeVisible();
  expect(bodies[0]).toEqual({ matter_id: HEX });
  await page.getByTestId("pv-hp-date").fill("2026-11-03");
  await page.getByTestId("pv-hp-run").click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual({ matter_id: HEX, hearing_date: "2026-11-03" });
  await expect(page.getByTestId("pv-hp-next").getByTestId("pv-hp-readings").locator("li")).toHaveText(["2026-09-05", "2026-05-09"]);
  await expect(page.getByTestId("pv-hp-citations")).toContainText("Not found in our index");
  await expect(page.getByTestId("pv-hp-note")).toBeVisible();
});
