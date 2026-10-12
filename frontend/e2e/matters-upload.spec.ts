import { expect, test } from "./support/engineTest";

import { buildDocx, buildPdf } from "../src/lib/docFixtures";
import { MAX_FACTS, MAX_FACT_CHARS, MAX_FILE_BYTES, NO_TEXT_MESSAGE } from "../src/lib/factsInput";

/**
 * Loading facts from a file on /matters (#17), driven through the real file input with invented files built here. Local and
 * deterministic: no judge is needed, because every case ends before an analysis or never reaches one. Messages are the ones the page
 * already shows; none is new.
 */
const MARKER_1 = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";
const MARKER_2 = "Meena kept the toy lorry and said she would not return it to anyone.";

const input = (page: import("@playwright/test").Page) => page.getByTestId("facts-file");
const facts = (page: import("@playwright/test").Page) => page.locator("#matters-facts");

test.beforeEach(async ({ page }) => {
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();
});

function toBuffer(ab: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(ab));
}

test("a .txt file fills the facts box with editable text, one fact per line", async ({ page }) => {
  await input(page).setInputFiles({ name: "facts.txt", mimeType: "text/plain", buffer: Buffer.from(`${MARKER_1}\n${MARKER_2}\n`) });
  await expect(facts(page)).toHaveValue(`${MARKER_1}\n${MARKER_2}`);
  await facts(page).fill(`${MARKER_1}\nedited by the user`); // editable
  await expect(facts(page)).toHaveValue(`${MARKER_1}\nedited by the user`);
});

test("a .pdf with a text layer fills the facts box", async ({ page }) => {
  await input(page).setInputFiles({ name: "facts.pdf", mimeType: "application/pdf", buffer: toBuffer(buildPdf(["Ravi lent the toy lorry to Meena."])) });
  await expect(facts(page)).toHaveValue(/Ravi lent the toy lorry to Meena\./, { timeout: 20_000 });
});

test("a .docx fills the facts box", async ({ page }) => {
  const docx = buildDocx(["Ravi lent the toy lorry to Meena.", "Meena kept it."]);
  await input(page).setInputFiles({
    name: "facts.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: toBuffer(docx),
  });
  await expect(facts(page)).toHaveValue(/Ravi lent the toy lorry to Meena\.[\s\S]*Meena kept it\./, { timeout: 20_000 });
});

test("a PDF with no text layer shows the no-text message and leaves the facts box alone", async ({ page }) => {
  await facts(page).fill("a fact typed first");
  await input(page).setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: toBuffer(buildPdf([""])) });
  await expect(page.getByTestId("matters-error")).toHaveText(NO_TEXT_MESSAGE, { timeout: 20_000 });
  await expect(facts(page)).toHaveValue("a fact typed first");
});

test("a file over the size cap is refused with its size and the limit", async ({ page }) => {
  await input(page).setInputFiles({ name: "big.txt", mimeType: "text/plain", buffer: Buffer.alloc(MAX_FILE_BYTES + 1, "a") });
  await expect(page.getByTestId("matters-error")).toHaveText(`File is ${Math.ceil((MAX_FILE_BYTES + 1) / 1024)} KB; the limit is ${MAX_FILE_BYTES / 1024} KB.`);
  await expect(facts(page)).toHaveValue("");
});

test("an unsupported file type is refused", async ({ page }) => {
  await input(page).setInputFiles({ name: "facts.png", mimeType: "image/png", buffer: Buffer.from("x") });
  await expect(page.getByTestId("matters-error")).toHaveText("Only .txt, .pdf and .docx files are accepted.");
});

test("more than the fact limit blocks Analyse with the limit message and sends nothing", async ({ page }) => {
  const n = MAX_FACTS + 1;
  const body = Array.from({ length: n }, (_, i) => `Invented fact number ${i + 1} about the toy lorry.`).join("\n");
  await input(page).setInputFiles({ name: "many.txt", mimeType: "text/plain", buffer: Buffer.from(body) });
  await expect(facts(page)).toHaveValue(body);
  let analyseCalls = 0;
  await page.route("**/api/v1/analyse-facts**", (r) => {
    analyseCalls += 1;
    return r.abort();
  });
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("matters-error")).toHaveText(`You have ${n} facts; the limit is ${MAX_FACTS}. Merge or remove some.`);
  expect(analyseCalls).toBe(0);
});

test("an over-length fact blocks Analyse, names its line and the limit, and sends nothing", async ({ page }) => {
  const long = "x".repeat(MAX_FACT_CHARS + 1);
  await input(page).setInputFiles({ name: "long.txt", mimeType: "text/plain", buffer: Buffer.from(`${MARKER_1}\n${long}`) });
  let analyseCalls = 0;
  await page.route("**/api/v1/analyse-facts**", (r) => {
    analyseCalls += 1;
    return r.abort();
  });
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("matters-error")).toHaveText(`Fact 2 is ${MAX_FACT_CHARS + 1} characters; the limit is ${MAX_FACT_CHARS}. Shorten or split it.`);
  expect(analyseCalls).toBe(0);
});

type Seen = { url: string; method: string; type: string; body: string };
const NAMES = ["net-facts.txt", "net-facts.pdf", "net-facts.docx"];
const leakedRequests = (seen: Seen[]) =>
  seen.filter((r) => /multipart/i.test(r.type) || r.body.includes("Quillpoort") || NAMES.some((n) => r.url.includes(n) || r.body.includes(n)));

function capture(page: import("@playwright/test").Page): Seen[] {
  const seen: Seen[] = [];
  page.on("request", (req) => seen.push({ url: req.url(), method: req.method(), type: req.headers()["content-type"] ?? "", body: req.postData() ?? "" }));
  return seen;
}

test("planted: the capture does catch a request that carries the file's text, its name or a multipart body", async ({ page }) => {
  const seen = capture(page);
  await page.route("**/planted-upload**", (r) => r.fulfill({ status: 204 }));
  await page.evaluate(async () => {
    await fetch("/planted-upload", { method: "POST", body: "Ravi lent the toy lorry in Quillpoort" });
    await fetch("/planted-upload?f=net-facts.pdf", { method: "POST" });
    const fd = new FormData();
    fd.append("file", new Blob(["abc"]), "other.bin");
    await fetch("/planted-upload", { method: "POST", body: fd });
  });
  expect(leakedRequests(seen)).toHaveLength(3);
});

test("the file is never uploaded: no request carries its name, its bytes or a multipart body, whatever its type", async ({ page }) => {
  const seen = capture(page);
  const cases = [
    { name: NAMES[0], mimeType: "text/plain", buffer: Buffer.from(`${MARKER_1}\n`) },
    { name: NAMES[1], mimeType: "application/pdf", buffer: toBuffer(buildPdf(["Ravi lent a toy lorry in Quillpoort"])) },
    { name: NAMES[2], mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: toBuffer(buildDocx([MARKER_1])) },
  ];
  for (const c of cases) {
    await input(page).setInputFiles(c);
    await expect(facts(page)).toHaveValue(/Quillpoort/, { timeout: 20_000 });
    await facts(page).fill("");
  }
  await page.waitForLoadState("networkidle");
  expect(leakedRequests(seen), "a request carried the file").toEqual([]);
  expect(seen.length, "the page made requests at all, so the capture is live").toBeGreaterThan(0);
});
