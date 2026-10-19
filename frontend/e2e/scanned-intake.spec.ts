import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// "Scanned papers in" (#1015, app part) against Track C's contract shapes (OCR_INTAKE_DESIGN_NOTE 1e3491dc9087, OCR_UPLOAD_WIRE_v2 aac86fb28729, sample SAMPLE_query_response_with_crop 2880657e9f4c), R1's words v3 (1323a7d5d2eb).
// ON only with a build that has NEXT_PUBLIC_SCANNED_INTAKE=1 (SCANNED_BUILD=1); the OFF arm asserts the control is not there at all.
const HEX = "0123456789abcdef0123456789abcdef";
const ON = process.env.SCANNED_BUILD === "1";
const PNG_2X2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGM4YWT03+iE0X8GGAMAS6gIrRI8nqoAAAAASUVORK5CYII=", "base64"); // a real 2x2 RGBA PNG
const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "preview", `${n}.json`), "utf8")) as { response: Record<string, unknown> };
const ME = { email: "invented@example.invalid" };

test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: ME })); });

test("flag OFF: there is no scanned-paper control and no image types are offered", async ({ page }) => {
  test.skip(ON, "the OFF arm");
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
  await expect(page.getByTestId("pv-add")).toBeVisible();
  await expect(page.getByTestId("scan-add")).toHaveCount(0);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
});

test("flag ON: a photo of a page is sent as image_base64, the unreadable and repaired pages say R1's lines (never text), and a quote read from the image shows its crop and the date line", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_SCANNED_INTAKE=1");
  const bodies: Record<string, unknown>[] = [];
  const docs: { doc_id: string; name: string }[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => {
    bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>);
    docs.push({ doc_id: "d1", name: "scan1.png" });
    r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "scan1.png", n_pages: 3, n_spans: 5, n_chars: 90, pages_without_text: [], ingest_done: true, indexed_complete: false, pages_unreadable: 1,
      ocr_line: "engine line that the app does not use", pages: [
        { page: 1, source: "ocr", confidence: 91.4, readable: true, reason: null, line: null },
        { page: 2, source: "ocr", confidence: 88, readable: true, reason: null, line: null, repaired: true },
        { page: 3, source: "unreadable", confidence: 52.3, readable: false, reason: "low_confidence", line: "This page could not be read." }] } });
  });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: docs.map((d) => ({ ...d, n_pages: 3, n_spans: 5, n_chars: 90, ingest_done: true, pages_without_text: [], indexed_complete: false })), pages_total: 3, pages_not_read: 0, pages_note: "" } }));
  const a3 = fx("a3_chronology").response;
  const events = (a3.events as Record<string, unknown>[]).slice();
  events[0] = { ...events[0], document_name: "scan1.png", page: 1, from_ocr: true, source: "ocr", confidence: 91.4, crop: { page: 1, x: 0, y: 0, w: 1, h: 1, page_w: 2, page_h: 2, unit: "px at ocr_dpi" } };
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ json: { ...a3, events } }));
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "scan1.png", mimeType: "image/png", buffer: PNG_2X2 });
  await expect(page.getByTestId("scan-result")).toBeVisible();
  expect(Object.keys(bodies[0]).sort()).toEqual(["image_base64", "matter_id", "mime", "name"]);
  expect(bodies[0].mime).toBe("image/png");
  expect(bodies[0].name).toBe("scan1.png");
  await expect(page.getByTestId("scan-ocr-line")).toHaveText("Pages read from page images may contain mistakes. Check each quote against the page image.");
  await expect(page.getByTestId("scan-doc-line")).toHaveText("1 page(s) could not be read, so this paper is only partly searched.");
  await expect(page.getByTestId("scan-page-unreadable")).toHaveText("Page 3: This page could not be read. This page could not be read well enough.");
  await expect(page.getByTestId("scan-page-repaired")).toHaveText("Page 2: The text in the file for this page was damaged or missing, so the page was read from its image.");
  await expect(page.locator("body")).not.toContainText(/garbled|engine line that the app does not use|91\.4|88%/);
  await page.getByTestId("pv-a3-run").click();
  await expect(page.getByTestId("scan-date-line").first()).toHaveText("Read from a page image: check this date against the page image.");
  await expect(page.getByTestId("scan-crop").first()).toBeVisible();
  await expect(page.getByTestId("scan-crop-caption").first()).toHaveText("Page image from your upload.");
});

test("flag ON: a HEIC file and an over-size file are refused with R1's lines before anything is sent, and a PDF goes as pdf_base64", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_SCANNED_INTAKE=1");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ status: 413, json: { detail: "The PDF is larger than 8000000 bytes", error: "pdf_too_large" } }); });
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "p.heic", mimeType: "image/heic", buffer: Buffer.from("x") });
  await expect(page.getByTestId("scan-refusal")).toHaveText("This photo format is not supported. Save it as JPEG or PNG and add it again.");
  expect(bodies.length).toBe(0);
  await page.getByTestId("scan-file").setInputFiles({ name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 x") });
  await expect(page.getByTestId("scan-refusal")).toHaveText("This file is too large. The limit is 8 MB. Make the file smaller, or split it, and add it again.");
  expect(Object.keys(bodies[0]).sort()).toEqual(["matter_id", "name", "pdf_base64"]);
  await expect(page.locator("body")).not.toContainText(/8000000|larger than/);
});
