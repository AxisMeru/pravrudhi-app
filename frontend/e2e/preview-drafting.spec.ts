import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The bail-drafting and synopsis cards against Track C's sample answers (real engine code, fake model answer): src/lib/fixtures/preview/*.json.
test.skip(process.env.DRAFTING_BUILD !== "1", "needs the build with the drafting-cards flag (NEXT_PUBLIC_DRAFTING_CARDS=1)");
const HEX = "0123456789abcdef0123456789abcdef";
// With the declaration flag ON (DECLARATION_BUILD=1) a draft needs the lawyer's answer first; the helper makes it and the expected bodies carry it.
const ON = process.env.DECLARATION_BUILD === "1";
const DECL = ON ? { sensitive_declaration: "none" } : {};
async function answer(page: import("@playwright/test").Page, id: "bail" | "synopsis") { if (ON) await page.getByTestId(`${id}-declaration-none`).check(); }
const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "preview", `${n}.json`), "utf8")) as unknown;

async function fillBail(page: import("@playwright/test").Page) {
  await page.getByTestId("bail-forum").selectOption("trial_court");
  await page.getByTestId("bail-offence").fill("2024-08-01");
  await page.getByTestId("bail-fir").fill("2024-08-02");
  await page.getByTestId("pv-bail").getByRole("textbox", { name: "Fact 1" }).fill("The applicant has no antecedents.");
}

// A signed-in user sees the cards as before: the signed-out check (/api/me) answers a user in every spec here except the signed-out one.
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("bail: nothing is sent until consent, both dates, a court and a fact are given; the draft shows its label, framing and the unconfirmed line; more notes fold", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/bail-draft", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: fx("bail_response_drafted") }); });
  await page.goto("/matter-tools");
  const run = page.getByTestId("bail-run");
  await expect(run).toBeDisabled();
  await expect(page.getByTestId("bail-tick-warning")).toContainText("Tick only facts that are on the applicant's side.");
  await fillBail(page);
  await expect(run).toBeDisabled();
  await page.getByTestId("bail-consent").check();
  await answer(page, "bail");
  await page.getByTestId("pv-bail").getByLabel("On the applicant's side").check();
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.getByTestId("bail-result")).toBeVisible();
  expect(bodies[0]).toEqual({ ...DECL, consent: true, kind: "bail", forum: "trial_court", offence_date: "2024-08-01", fir_date: "2024-08-02", facts: [{ text: "The applicant has no antecedents.", side: "applicant" }] });
  await expect(page.getByTestId("draft-label")).toContainText("Preview:");
  await expect(page.getByTestId("bail-framing")).toContainText("Section 480");
  await expect(page.getByTestId("bail-unconfirmed")).toContainText("a lawyer has not yet confirmed");
  await expect(page.getByTestId("bail-text")).toContainText("BAIL APPLICATION");
  await expect(page.getByTestId("pv-bail").getByRole("heading", { name: "Notes for the lawyer" })).toBeVisible(); // the mocked draft text also contains the words, so match the heading by role
});

test("bail referred: a straddle shows both framings and no draft text; a sensitive section shows the engine's sentence only", async ({ page }) => {
  let n = 0;
  await page.route("**/api/v1/bail-draft", (r) => r.fulfill({ json: fx(n++ === 0 ? "bail_response_referred_straddle" : "bail_response_referred_sensitive") }));
  await page.goto("/matter-tools");
  await fillBail(page);
  await page.getByTestId("bail-consent").check();
  await answer(page, "bail");
  await page.getByTestId("bail-run").click();
  await expect(page.getByTestId("bail-referral")).toContainText("both sides of 1 July 2024");
  await expect(page.getByTestId("bail-framing")).toContainText("Section 437");
  await expect(page.getByTestId("bail-framing")).toContainText("Section 480");
  await expect(page.getByTestId("bail-text")).toHaveCount(0);
  await answer(page, "bail"); // asked afresh for every draft
  await page.getByTestId("bail-run").click();
  await expect(page.getByTestId("bail-referral")).toContainText("this draft tool does not handle");
  await expect(page.getByTestId("bail-text")).toHaveCount(0);
});

test("bail: a 404 (flag off) reads R1's 'not available here' line", async ({ page }) => {
  await page.route("**/api/v1/bail-draft", (r) => r.fulfill({ status: 404, json: { detail: "x" } }));
  await page.goto("/matter-tools");
  await fillBail(page);
  await page.getByTestId("bail-consent").check();
  await answer(page, "bail");
  await page.getByTestId("bail-run").click();
  await expect(page.getByTestId("bail-message")).toHaveText("This workflow is not available here.");
});

test("synopsis: table only keeps the paper's dates and both readings; unticking a row sends the kept row ids", async ({ page }) => {
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "FIR", n_pages: 1, n_spans: 3, n_chars: 90, pages_without_text: [], ingest_done: true } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [{ doc_id: "d1", name: "FIR", n_pages: 1, n_spans: 3, n_chars: 90, ingest_done: true, pages_without_text: [], incomplete: false }], pages_total: 1, pages_not_read: 0, pages_note: "All pages were read." } }));
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/synopsis-dates", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: fx("synopsis_response_table_only") }); });
  await page.goto("/matter-tools");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("pv-name").fill("FIR");
  await page.getByTestId("pv-text").fill("The FIR was registered.");
  await page.getByTestId("pv-add").click();
  await expect(page.getByTestId("synopsis-run")).toBeDisabled();
  await expect(page.getByTestId("synopsis-tick-warning")).toContainText("Tick only the facts and dates you want in the synopsis.");
  await page.getByTestId("synopsis-consent").check();
  await answer(page, "synopsis");
  await page.getByTestId("synopsis-run").click();
  await expect(page.getByTestId("synopsis-result")).toBeVisible();
  expect(bodies[0]).toEqual({ ...DECL, consent: true, matter_id: HEX, facts: [] });
  await expect(page.getByTestId("draft-label")).toContainText("Preview:");
  const rows = page.getByTestId("dates-row");
  await expect(rows.first()).toContainText("18 July 2021");
  await expect(page.getByTestId("dates-readings").first()).toContainText("2024-06-12 / 2024-12-06");
  await expect(page.getByTestId("synopsis-text")).toContainText("No synopsis could be drafted");
  await rows.first().getByRole("checkbox").uncheck();
  await answer(page, "synopsis"); // the answer is asked afresh for every draft
  await page.getByTestId("synopsis-update").click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].include_row_ids).toEqual([2, 3]);
});
