import { expect, test } from "@playwright/test";

import { SAMPLE_PAPERS, SAMPLE_PREFILL, SAMPLE_PREFILL_TEXT, SAMPLE_TEXT } from "../src/lib/sampleMatter";

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

// Track A's SAMPLE_PREFILL_INVENTED_v2 (71dc7af17823) with R1's rulings (7b307564a4b2): the dates go in WITH their source labels and UNCONFIRMED, one line says the values come from the sample papers, the dates-differ-on-purpose line shows only after a sample is loaded and not inside the note.
const DRAFTING = process.env.DRAFTING_BUILD === "1";
test("Load a sample matter: the checklist dates, the draft paste and (drafting build) the bail facts are filled from the sample, R1's line sits beside each form, the dates line shows only after loading, and no date is sent confirmed", async ({ page }) => {
  const docs: { name: string; text: string }[] = [];
  const b3Bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { const b = JSON.parse(r.request().postData() ?? "{}") as { name: string; text: string }; docs.push(b); r.fulfill({ json: { matter_id: HEX, doc_id: `d${docs.length}`, name: b.name, n_pages: 1, n_spans: 3, n_chars: b.text.length, pages_without_text: [], ingest_done: true, indexed_complete: true } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: docs.map((d, i) => ({ doc_id: `d${i + 1}`, name: d.name, n_pages: 1, n_spans: 3, n_chars: d.text.length, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: docs.length, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/delete", (r) => r.fulfill({ json: { deleted: true } }));
  await page.route("**/api/v1/s138-checklist", (r) => { b3Bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ status: 404, json: { detail: "x" } }); });
  await page.goto("/matter-tools");
  await expect(page.getByTestId("pv-sample-dates-line")).toHaveCount(0);
  await expect(page.getByTestId("pv-prefill-line-b3")).toHaveCount(0);
  await expect(page.getByTestId("pv-b3-cheque")).toHaveValue("");
  await page.getByTestId("pv-sample").click();
  await expect(page.getByTestId("pv-papers").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("pv-sample-dates-line")).toHaveText(SAMPLE_PREFILL_TEXT.datesLine);
  for (const k of ["b3", "a1"]) await expect(page.getByTestId(`pv-prefill-line-${k}`)).toHaveText(SAMPLE_PREFILL_TEXT.line);
  for (const [k, v] of Object.entries(SAMPLE_PREFILL.b3)) await expect(page.getByTestId(`pv-b3-${k}`)).toHaveValue(v.value);
  await expect(page.getByTestId("pv-b3-mode")).toHaveValue("registered_post");
  await expect(page.getByTestId("pv-a1-text")).toHaveValue(SAMPLE_PREFILL.draftPaste);
  await page.getByTestId("pv-b3-run").click();
  await expect.poll(() => b3Bodies.length).toBe(1);
  const sent = b3Bodies[0] as { cheque_date: { value: string; source: string; confirmed: boolean }; notices: { source: string; confirmed: boolean }[]; notice_mode: string };
  expect(sent.cheque_date).toMatchObject({ value: SAMPLE_PREFILL.b3.cheque.value, source: SAMPLE_PREFILL.b3.cheque.source, confirmed: false });
  expect(sent.notices[0]).toMatchObject({ source: SAMPLE_PREFILL.b3.notice.source, confirmed: false });
  expect(sent.notice_mode).toBe("registered_post");
  // editing a prefilled date makes it the visitor's own again: source "typed"
  await page.getByTestId("pv-b3-cheque").fill("15.03.2024");
  await page.getByTestId("pv-b3-run").click();
  await expect.poll(() => b3Bodies.length).toBe(2);
  expect((b3Bodies[1] as { cheque_date: { source: string } }).cheque_date.source).toBe("typed");
  if (DRAFTING) {
    await expect(page.getByTestId("pv-prefill-line-bail")).toHaveText(SAMPLE_PREFILL_TEXT.line);
    await expect(page.getByTestId("bail-fact")).toHaveCount(SAMPLE_PREFILL.facts.length);
    await expect(page.getByTestId("bail-fact").first().locator("textarea")).toHaveValue(SAMPLE_PREFILL.facts[0].text);
    await expect(page.getByTestId("bail-fact").last().getByRole("checkbox", { name: "On the applicant's side" })).not.toBeChecked();
    await expect(page.getByTestId("bail-fact").first().getByRole("checkbox", { name: "On the applicant's side" })).toBeChecked();
  }
  // removing the matter takes the prefill and its lines away
  await page.getByTestId("pv-remove-all").click();
  await expect(page.getByTestId("pv-sample")).toBeVisible();
  await page.getByTestId("pv-start").click(); // an empty matter of the visitor's own
  await expect(page.getByTestId("pv-prefill-line-b3")).toHaveCount(0);
  await expect(page.getByTestId("pv-sample-dates-line")).toHaveCount(0);
  await expect(page.getByTestId("pv-b3-cheque")).toHaveValue("");
  await expect(page.getByTestId("pv-a1-text")).toHaveValue("");
});

// R2 advise on #493: when the store no longer holds the sample matter (a restart), the prefill and its lines go with it.
test("Load a sample matter: when the matter is gone (404 and the list route says so) the prefilled dates, the draft paste and R1's lines are cleared", async ({ page }) => {
  const docs: { name: string; text: string }[] = [];
  let gone = false;
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { const b = JSON.parse(r.request().postData() ?? "{}") as { name: string; text: string }; docs.push(b); r.fulfill({ json: { matter_id: HEX, doc_id: `d${docs.length}`, name: b.name, n_pages: 1, n_spans: 3, n_chars: b.text.length, pages_without_text: [], ingest_done: true, indexed_complete: true } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => (gone ? r.fulfill({ status: 404, json: { detail: "x", error: "matter_not_found" } }) : r.fulfill({ json: { matter_id: HEX, documents: docs.map((d, i) => ({ doc_id: `d${i + 1}`, name: d.name, n_pages: 1, n_spans: 3, n_chars: d.text.length, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: docs.length, pages_not_read: 0, pages_note: "" } })));
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ status: 404, json: { detail: "x", error: "matter_not_found" } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-sample").click();
  await expect(page.getByTestId("pv-prefill-line-b3")).toBeVisible();
  gone = true;
  await page.getByTestId("pv-a3-run").click();
  await expect(page.getByTestId("pv-message")).toContainText("no longer held");
  await expect(page.getByTestId("pv-prefill-line-b3")).toHaveCount(0);
  await expect(page.getByTestId("pv-sample-dates-line")).toHaveCount(0);
  gone = false;
  await page.getByTestId("pv-start").click();
  await expect(page.getByTestId("pv-b3-cheque")).toHaveValue("");
  await expect(page.getByTestId("pv-b3-mode")).toHaveValue("");
  await expect(page.getByTestId("pv-a1-text")).toHaveValue("");
});

// R2 advise on #494: a paper removed after the store lost the matter (refresh() sees the 404) clears the prefill too.
test("Load a sample matter: removing a paper when the store has lost the matter clears the prefill and R1's lines", async ({ page }) => {
  const docs: { name: string; text: string }[] = [];
  let gone = false;
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { const b = JSON.parse(r.request().postData() ?? "{}") as { name: string; text: string }; docs.push(b); r.fulfill({ json: { matter_id: HEX, doc_id: `d${docs.length}`, name: b.name, n_pages: 1, n_spans: 3, n_chars: b.text.length, pages_without_text: [], ingest_done: true, indexed_complete: true } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => (gone ? r.fulfill({ status: 404, json: { detail: "x", error: "matter_not_found" } }) : r.fulfill({ json: { matter_id: HEX, documents: docs.map((d, i) => ({ doc_id: `d${i + 1}`, name: d.name, n_pages: 1, n_spans: 3, n_chars: d.text.length, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: docs.length, pages_not_read: 0, pages_note: "" } })));
  await page.route("**/api/v1/matter-spans/delete", (r) => r.fulfill({ json: { deleted: true } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-sample").click();
  await expect(page.getByTestId("pv-prefill-line-b3")).toBeVisible();
  gone = true;
  await page.getByTestId("pv-papers").getByRole("button").first().click();
  await expect(page.getByTestId("pv-message")).toContainText("no longer held");
  await expect(page.getByTestId("pv-prefill-line-b3")).toHaveCount(0);
  gone = false;
  await page.getByTestId("pv-start").click();
  await expect(page.getByTestId("pv-b3-cheque")).toHaveValue("");
  await expect(page.getByTestId("pv-a1-text")).toHaveValue("");
});
