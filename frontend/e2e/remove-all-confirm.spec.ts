import { expect, test } from "@playwright/test";

// UX polish #1 (R1 WEB_UX_POLISH_R1_ANSWERS fe5051df8a55): "Remove all the papers and the matter" asks first. The first press only shows R1's question with Yes, remove all and Cancel; nothing is deleted until Yes;
// Cancel keeps the matter and its papers; the confirm button is not the default focus.
const HEX = "0123456789abcdef0123456789abcdef";
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("Remove all asks first: Cancel keeps everything, Yes removes (one delete call), the confirm is not focused", async ({ page }) => {
  const deletes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [{ doc_id: "d1", name: "paper one", n_pages: 1, n_spans: 1, n_chars: 5, ingest_done: true, pages_without_text: [], indexed_complete: true }], pages_total: 1, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/delete", (r) => { deletes.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: { deleted: true } }); });
  await page.goto("/matter-tools");
  await page.route("**/api/v1/matter-spans/documents", (r) => r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "paper one", n_pages: 1, n_spans: 1, n_chars: 5, pages_without_text: [], ingest_done: true, indexed_complete: true } }));
  await page.getByTestId("pv-start").click();
  await page.getByTestId("pv-text").fill("An invented paper.");
  await page.getByTestId("pv-add").click();
  await expect(page.getByTestId("pv-papers")).toBeVisible();
  await expect(page.getByTestId("pv-remove-all-confirm")).toHaveCount(0);
  // UX polish #5: the destructive button is the LAST thing in the matter block, after the notes, away from them
  const order = await page.evaluate(() => { const note = document.querySelector('[data-testid="pv-matter-note"]')!, btn = document.querySelector('[data-testid="pv-remove-all"]')!, list = document.querySelector('[data-testid="pv-papers"]')!; return { afterList: !!(list.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING), afterNote: !!(note.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
  expect(order).toEqual({ afterList: true, afterNote: true });
  await page.getByTestId("pv-remove-all").click();
  const box = page.getByTestId("pv-remove-all-confirm");
  await expect(box).toBeVisible();
  await expect(box).toContainText("Remove all the papers and the matter? They are removed from this service's store. This cannot be undone.");
  await expect(page.getByTestId("pv-remove-all-yes")).toHaveText("Yes, remove all");
  await expect(page.getByTestId("pv-remove-all-cancel")).toHaveText("Cancel");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "the confirm button is not the default focus").not.toBe("pv-remove-all-yes");
  expect(deletes, "the first press deletes nothing").toEqual([]);
  await page.getByTestId("pv-remove-all-cancel").click();
  await expect(box).toHaveCount(0);
  await expect(page.getByTestId("pv-papers")).toBeVisible();
  expect(deletes).toEqual([]);
  await page.getByTestId("pv-remove-all").click();
  await page.getByTestId("pv-remove-all-yes").click();
  await expect.poll(() => deletes.length).toBe(1);
  expect(deletes[0]).toEqual({ matter_id: HEX });
  await expect(page.getByTestId("pv-start")).toBeVisible();
  await expect(page.getByTestId("pv-remove-all-confirm")).toHaveCount(0);
});
