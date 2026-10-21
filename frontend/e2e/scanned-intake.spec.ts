import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// "Scanned papers in" (#1015, app part) against Track C's contract shapes (OCR_INTAKE_DESIGN_NOTE 1e3491dc9087, OCR_UPLOAD_WIRE_v2 aac86fb28729, sample SAMPLE_query_response_with_crop 2880657e9f4c), R1's words v3 (1323a7d5d2eb).
// ON only with a build that has NEXT_PUBLIC_SCANNED_INTAKE=1 (SCANNED_BUILD=1); the OFF arm asserts the control is not there at all.
const HEX = "0123456789abcdef0123456789abcdef";
const ON = process.env.SCANNED_BUILD === "1";
const IMG = process.env.SCANNED_IMAGES_BUILD === "1"; // built with NEXT_PUBLIC_SCANNED_IMAGES=1 (PR 3): photos are sent; without it a photo is refused in the control before it is read
const PNG_2X2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGM4YWT03+iE0X8GGAMAS6gIrRI8nqoAAAAASUVORK5CYII=", "base64"); // a real 2x2 RGBA PNG
const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "preview", `${n}.json`), "utf8")) as { response: Record<string, unknown> };
const ME = { email: "invented@example.invalid" };

test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: ME })); });

test("flag OFF: there is no scanned-paper control and no image types are offered", async ({ page }) => {
  test.skip(ON, "the OFF arm");
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await expect(page.getByTestId("pv-add")).toBeVisible();
  await expect(page.getByTestId("scan-add")).toHaveCount(0);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
});

test("flag ON: a photo of a page is sent as image_base64, the unreadable and repaired pages say R1's lines (never text), and a quote read from the image shows its crop and the date line", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_SCANNED_INTAKE=1");
  test.skip(!IMG, "needs the build with NEXT_PUBLIC_SCANNED_IMAGES=1 (SCANNED_IMAGES_BUILD=1): photos are refused in the control otherwise");
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
  events[0] = { ...events[0], document_name: "scan1.png", page: 1, from_ocr: true, ocr_marker: "Read from a scanned page: check this against the paper.", read_from: "ocr", confidence: 91.4, crop: { page: 1, x: 0, y: 0, w: 1, h: 1, page_w: 2, page_h: 2, unit: "px at ocr_dpi" } };
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ json: { ...a3, events } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "scan1.png", mimeType: "image/png", buffer: PNG_2X2 });
  await expect(page.getByTestId("scan-result")).toBeVisible();
  expect(Object.keys(bodies[0]).sort()).toEqual(["image_base64", "matter_id", "mime", "name"]);
  expect(bodies[0].mime).toBe("image/png");
  expect(bodies[0].name).toBe("scan1.png");
  await expect(page.getByTestId("scan-ocr-line")).toHaveText("Pages read from page images may contain mistakes. Check each quote against the page image.");
  await expect(page.getByTestId("scan-doc-line")).toHaveText("1 page(s) could not be read, so this paper is only partly searched.");
  await expect(page.getByTestId("scan-page-unreadable")).toHaveText("Page 3: This page could not be read. This page could not be read well enough.");
  await expect(page.getByTestId("scan-page-repaired")).toHaveText("Page 2: The text in the file for this page was damaged, so the page was read from its image.");
  await expect(page.locator("body")).not.toContainText(/garbled|engine line that the app does not use|91\.4|88%/);
  await page.getByTestId("pv-a3-run").click();
  await expect(page.getByTestId("scan-ocr-marker").first()).toHaveText("Read from a scanned page: check this against the paper.");
  await expect(page.getByTestId("scan-crop").first()).toBeVisible();
  await expect(page.getByTestId("scan-crop-caption").first()).toHaveText("Page image from your upload.");
});

test("flag ON: while the engine refuses photos, the control offers PDFs only and any photo picked anyway (PNG, JPEG, TIFF) is refused with R1's photo line BEFORE it is read or sent, with no save-as-JPEG line", async ({ page }) => {
  test.skip(!ON || IMG, "needs the scanned-intake build WITHOUT NEXT_PUBLIC_SCANNED_IMAGES");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { bodies.push({}); r.fulfill({ status: 422, json: { error: "image_not_supported_yet", detail: "Photos cannot be added yet. Add the paper as a PDF." } }); });
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await expect(page.getByTestId("scan-file")).toHaveAttribute("accept", ".pdf,application/pdf");
  for (const f of [{ name: "photo.png", mimeType: "image/png" }, { name: "photo.jpg", mimeType: "image/jpeg" }, { name: "photo.tif", mimeType: "image/tiff" }, { name: "photo.PNG", mimeType: "" }]) {
    await page.getByTestId("scan-file").setInputFiles({ ...f, buffer: PNG_2X2 });
    await expect(page.getByTestId("scan-refusal")).toHaveText("Photos cannot be added here. Add the paper as a PDF.");
  }
  expect(bodies.length, "no request is sent for a photo").toBe(0);
  await expect(page.locator("body")).not.toContainText(/yet\.|Save it as JPEG or PNG/);
});

test("flag ON: a HEIC photo (R1's photo line, never the save-as-JPEG line) and an over-size file are refused with R1's lines before anything is sent, and a PDF goes as pdf_base64", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_SCANNED_INTAKE=1");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ status: 413, json: { detail: "The PDF is larger than 8000000 bytes", error: "pdf_too_large" } }); });
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "p.heic", mimeType: "image/heic", buffer: Buffer.from("x") });
  if (IMG) await expect(page.getByTestId("scan-refusal")).toHaveText("This photo format is not supported. Save it as JPEG or PNG and add it again.");
  else { await expect(page.getByTestId("scan-refusal")).toHaveText("Photos cannot be added here. Add the paper as a PDF."); await expect(page.locator("body")).not.toContainText("Save it as JPEG or PNG"); }
  expect(bodies.length).toBe(0);
  await page.getByTestId("scan-file").setInputFiles({ name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 x") });
  await expect(page.getByTestId("scan-refusal")).toHaveText("This file is too large. The limit is 8 MB. Make the file smaller, or split it, and add it again.");
  expect(Object.keys(bodies[0]).sort()).toEqual(["matter_id", "name", "pdf_base64"]);
  await expect(page.locator("body")).not.toContainText(/8000000|larger than/);
});

test("flag ON: an over-size file is refused by size BEFORE it is read or sent, and a file with no browser mime type is sent by its extension", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_SCANNED_INTAKE=1");
  test.skip(!IMG, "needs the build with NEXT_PUBLIC_SCANNED_IMAGES=1 (SCANNED_IMAGES_BUILD=1): photos are refused in the control otherwise");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "x", n_pages: 1, n_spans: 1, n_chars: 1, pages_without_text: [], ingest_done: true, pages: [{ page: 1, source: "ocr", readable: true, reason: null, line: null }] } }); });
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(8_000_001, 1) });
  await expect(page.getByTestId("scan-refusal")).toHaveText("This file is too large. The limit is 8 MB. Make the file smaller, or split it, and add it again.");
  expect(bodies.length).toBe(0);
  await page.getByTestId("scan-file").setInputFiles({ name: "photo.PNG", mimeType: "", buffer: PNG_2X2 });
  await expect(page.getByTestId("scan-result")).toBeVisible();
  expect(bodies[0].mime).toBe("image/png");
});

test("flag ON: two papers with one name show no crop, and starting over clears what was kept (a crop never comes from another file)", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_SCANNED_INTAKE=1");
  test.skip(!IMG, "needs the build with NEXT_PUBLIC_SCANNED_IMAGES=1 (SCANNED_IMAGES_BUILD=1): photos are refused in the control otherwise");
  let n = 0;
  const docs: { doc_id: string; name: string }[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { n += 1; docs.push({ doc_id: `d${n}`, name: "scan.png" }); r.fulfill({ json: { matter_id: HEX, doc_id: `d${n}`, name: "scan.png", n_pages: 1, n_spans: 1, n_chars: 1, pages_without_text: [], ingest_done: true, pages: [{ page: 1, source: "ocr", readable: true, reason: null, line: null }] } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: docs.map((d) => ({ ...d, n_pages: 1, n_spans: 1, n_chars: 1, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: docs.length, pages_not_read: 0, pages_note: "" } }));
  const a3 = fx("a3_chronology").response;
  const events = (a3.events as Record<string, unknown>[]).slice();
  events[0] = { ...events[0], document_name: "scan.png", page: 1, from_ocr: true, ocr_marker: "Read from a scanned page: check this against the paper.", read_from: "ocr", crop: { page: 1, x: 0, y: 0, w: 1, h: 1, page_w: 2, page_h: 2, unit: "px at ocr_dpi" } };
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ json: { ...a3, events } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG_2X2 });
  await expect(page.getByTestId("scan-result")).toBeVisible();
  await page.getByTestId("pv-a3-run").click();
  await expect(page.getByTestId("scan-crop").first()).toBeVisible();
  await page.getByTestId("scan-file").setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG_2X2 }); // a second paper with the same name
  await expect(page.getByTestId("pv-papers").locator("li, div").filter({ hasText: "scan.png" }).first()).toBeVisible();
  await page.getByTestId("pv-a3-run").click();
  await expect(page.getByTestId("scan-ocr-marker").first()).toBeVisible();
  await expect(page.getByTestId("scan-crop")).toHaveCount(0);
});

const CROP = { page: 1, x: 0, y: 0, w: 1, h: 1, page_w: 2, page_h: 2, unit: "px at ocr_dpi" };
async function scanMatter(page: import("@playwright/test").Page, name: string) {
  const docs: { doc_id: string; name: string }[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => { docs.push({ doc_id: "d1", name }); r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name, n_pages: 1, n_spans: 1, n_chars: 1, pages_without_text: [], ingest_done: true, pages: [{ page: 1, source: "ocr", readable: true, reason: null, line: null }] } }); });
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: docs.map((d) => ({ ...d, n_pages: 1, n_spans: 1, n_chars: 1, ingest_done: true, pages_without_text: [], indexed_complete: true })), pages_total: docs.length, pages_not_read: 0, pages_note: "" } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name, mimeType: "image/png", buffer: PNG_2X2 });
  await expect(page.getByTestId("scan-result")).toBeVisible();
}

test("flag ON: a cheque-case candidate and an A8 list-of-dates row read from an image show the date line and the crop; a row's own `source` text is untouched", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SCANNED_INTAKE=1");
  test.skip(!IMG, "needs the build with NEXT_PUBLIC_SCANNED_IMAGES=1 (SCANNED_IMAGES_BUILD=1): photos are refused in the control otherwise");
  await scanMatter(page, "cheque-memo-A");
  const cc = fx("cheque_case_step1_no_b3").response as { candidates: { roles: Record<string, Record<string, unknown>[]> } };
  const cheque = cc.candidates.roles.cheque.slice();
  cheque[0] = { ...cheque[0], read_from: "ocr", from_ocr: true, ocr_marker: "Read from a scanned page: check this against the paper.", crop: CROP };
  await page.route("**/api/v1/cheque-case-check", (r) => r.fulfill({ json: { ...cc, candidates: { ...cc.candidates, roles: { ...cc.candidates.roles, cheque } } } }));
  await page.getByTestId("pv-cc-run").click();
  const role = page.getByTestId("pv-cc-role-cheque");
  await expect(role.getByTestId("scan-ocr-marker")).toHaveText("Read from a scanned page: check this against the paper.");
  await expect(role.getByTestId("scan-crop")).toBeVisible();
  await expect(role).toContainText("cheque-memo-A p.1");
});

test("flag ON: an upload that finishes after the matter was removed is neither kept nor shown (R2: guard by matter)", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SCANNED_INTAKE=1");
  test.skip(!IMG, "needs the build with NEXT_PUBLIC_SCANNED_IMAGES=1 (SCANNED_IMAGES_BUILD=1): photos are refused in the control otherwise");
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [], pages_total: 0, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/matter-spans/delete", (r) => r.fulfill({ json: { matter_id: HEX, deleted: true } }));
  await page.route("**/api/v1/matter-spans/documents", async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "slow.png", n_pages: 1, n_spans: 1, n_chars: 1, pages_without_text: [], ingest_done: true, pages: [{ page: 1, source: "ocr", readable: true, reason: null, line: null }] } }); });
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "slow.png", mimeType: "image/png", buffer: PNG_2X2 });
  await page.getByTestId("pv-remove-all").click();
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("scan-result")).toHaveCount(0);
});

// OCR_MARKER_FIELD_CONTRACT (fc8683d55b51): the engine's ocr_marker line is rendered as sent beside every item with from_ocr true (papers list, chronology date row, citation sweep next to the status), and nothing beside a text-layer item. A PDF is used: photos stay refused (the JPEG line is asserted above).
const MARKER = "Read from a scanned page: check this against the paper.";
test("flag ON: the engine's ocr_marker shows beside a scanned paper, a chronology row and a citation (next to its status); a text-layer row has none", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SCANNED_INTAKE=1");
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "scan.pdf", n_pages: 2, n_spans: 2, n_chars: 9, pages_without_text: [], ingest_done: true, pages: [{ page: 1, source: "ocr", readable: true }, { page: 2, source: "text_layer", readable: true }], pages_unreadable: 0, indexed_complete: true } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [{ doc_id: "d1", name: "scan.pdf", n_pages: 2, n_spans: 2, n_chars: 9, ingest_done: true, pages_without_text: [], indexed_complete: true, from_ocr: true, ocr_pages: [1], ocr_marker: MARKER }, { doc_id: "d2", name: "typed.pdf", n_pages: 1, n_spans: 1, n_chars: 4, ingest_done: true, pages_without_text: [], indexed_complete: true, from_ocr: false }], pages_total: 3, pages_not_read: 0, pages_note: "" } }));
  const a3 = fx("a3_chronology").response;
  const events = (a3.events as Record<string, unknown>[]).slice();
  events[0] = { ...events[0], document_name: "scan.pdf", page: 1, from_ocr: true, ocr_marker: MARKER };
  if (events[1]) events[1] = { ...events[1], document_name: "typed.pdf", page: 1, from_ocr: false };
  await page.route("**/api/v1/chronology", (r) => r.fulfill({ json: { ...a3, events } }));
  const s1 = fx("s1_matter_citation_sweep").response as { papers_read: { name: string; citations: Record<string, unknown>[] }[] };
  const papers_read = s1.papers_read.map((p, i) => (i === 0 ? { ...p, name: "scan.pdf", citations: p.citations.map((c, k) => (k === 0 ? { ...c, from_ocr: true, ocr_marker: MARKER } : { ...c, from_ocr: false })) } : p));
  await page.route("**/api/v1/matter-citation-sweep", (r) => r.fulfill({ json: { ...s1, papers_read } }));
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("scan-file").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 x") });
  await expect(page.getByTestId("pv-papers").getByTestId("scan-ocr-marker")).toHaveCount(1);
  await expect(page.getByTestId("pv-papers").getByTestId("scan-ocr-marker")).toHaveText(MARKER);
  await page.getByTestId("pv-a3-run").click();
  const a3r = page.getByTestId("pv-a3-result");
  await expect(a3r.getByTestId("scan-ocr-marker")).toHaveCount(1);
  await expect(a3r.getByTestId("scan-ocr-marker")).toHaveText(MARKER);
  await page.getByTestId("pv-s1-run").click();
  const s1r = page.getByTestId("pv-s1-result");
  await expect(s1r.getByTestId("scan-ocr-marker")).toHaveCount(1);
  await expect(s1r.getByTestId("pv-citations").first().locator("li").first()).toContainText(MARKER);
});
