import { expect, test } from "@playwright/test";

import { SAMPLE_PAPERS, SAMPLE_TEXT } from "../src/lib/sampleMatter";

// The one-click INVENTED sample matter on /matter-tools (Lead-2 P0, 20 Oct; R1's button and note words). It also stands for the deploy gate's end-to-end run.
const HEX = "0123456789abcdef0123456789abcdef";
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("Load a sample matter: one click starts a matter and adds the four invented papers, which then show in the papers list; the invented note sits beside the button", async ({ page }) => {
  const docs: { name: string; text: string; matter_id: string }[] = [];
  const order: string[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => { order.push("matters"); r.fulfill({ json: { matter_id: HEX } }); });
  await page.route("**/api/v1/matter-spans/documents", (r) => { const b = JSON.parse(r.request().postData() ?? "{}") as { name: string; text: string; matter_id: string }; docs.push(b); order.push("document"); r.fulfill({ json: { matter_id: HEX, doc_id: `d${docs.length}`, name: b.name, n_pages: 1, n_spans: 3, n_chars: b.text.length, pages_without_text: [], indexed_complete: true } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: docs.map((d, i) => ({ doc_id: `d${i + 1}`, name: d.name, n_pages: 1, n_spans: 3, n_chars: d.text.length, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: docs.length, pages_not_read: 0, pages_note: "" } }));
  await page.goto("/matter-tools");
  await expect(page.getByTestId("pv-sample")).toHaveText(SAMPLE_TEXT.button);
  await expect(page.getByTestId("pv-sample-note")).toHaveText(SAMPLE_TEXT.note);
  await page.getByTestId("pv-sample").click();
  await expect(page.getByTestId("pv-papers").locator("li")).toHaveCount(4);
  expect(order).toEqual(["matters", "document", "document", "document", "document"]);
  expect(docs.map((d) => d.name)).toEqual(SAMPLE_PAPERS.map((p) => p.name));
  expect(docs.map((d) => d.text)).toEqual(SAMPLE_PAPERS.map((p) => p.text));
  expect(new Set(docs.map((d) => d.matter_id))).toEqual(new Set([HEX]));
  for (const d of docs) expect(d.text.startsWith("INVENTED SAMPLE PAPER FOR TESTING.")).toBe(true);
  await expect(page.getByTestId("pv-sample")).toHaveCount(0); // the matter is open now: the start buttons and the sample note give way to the papers
});

test("Load a sample matter: a refusal on a paper stops there and says R1's line; nothing else is faked", async ({ page }) => {
  let n = 0;
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { n++; if (n === 1) return r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "x", n_pages: 1, n_spans: 1, n_chars: 1, pages_without_text: [], indexed_complete: true } }); r.fulfill({ status: 503, json: { error: "store_unavailable", detail: "x" } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [{ doc_id: "d1", name: "FIR (invented sample)", n_pages: 1, n_spans: 1, n_chars: 1, ingest_done: true, pages_without_text: [], indexed_complete: true }], pages_total: 1, pages_not_read: 0, pages_note: "" } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-sample").click();
  await expect(page.getByTestId("pv-message")).toBeVisible();
  expect(n, "stops at the first refusal").toBe(2);
  await expect(page.getByTestId("pv-papers").locator("li")).toHaveCount(1);
});
