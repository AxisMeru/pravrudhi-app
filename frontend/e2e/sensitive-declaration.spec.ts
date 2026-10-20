import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The mandatory sensitive-case declaration on the bail and synopsis cards (pravrudhi#558, R1 A4_DECLARATION_V4 e21f8c55df95). Only on a build with NEXT_PUBLIC_SENSITIVE_DECLARATION=1 (DECLARATION_BUILD=1).
test.skip(process.env.DRAFTING_BUILD !== "1", "the cards the declaration sits on exist only on the drafting-cards build");
const HEX = "0123456789abcdef0123456789abcdef";
const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "preview", `${n}.json`), "utf8")) as unknown;
const ON = process.env.DECLARATION_BUILD === "1";
const LEGEND = "Does this matter involve a person under 18, a sexual offence or trafficking?";
const MISSING = "Say whether this matter involves a person under 18, a sexual offence or trafficking before a draft can be made.";

test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

async function fillBail(page: import("@playwright/test").Page) {
  await page.getByTestId("bail-forum").selectOption("trial_court");
  await page.getByTestId("bail-offence").fill("2024-08-01");
  await page.getByTestId("bail-fir").fill("2024-08-02");
  await page.getByTestId("pv-bail").getByRole("textbox", { name: "Fact 1" }).fill("The applicant has no antecedents.");
  await page.getByTestId("bail-consent").check();
  await page.getByTestId("pv-bail").getByLabel("On the applicant's side").check();
}

test("flag ON: the question has no default, the button stays disabled and R1's say-whether line shows until an answer is chosen; the answer is sent exactly as chosen and is cleared after every draft", async ({ page }) => {
  test.skip(!ON, "needs the build with the declaration flag");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/bail-draft", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: fx("bail_response_drafted") }); });
  await page.goto("/preview");
  const run = page.getByTestId("bail-run");
  await expect(page.getByTestId("bail-declaration")).toContainText(LEGEND);
  await expect(page.getByTestId("bail-declaration-none")).not.toBeChecked();
  await expect(page.getByTestId("bail-declaration-sensitive")).not.toBeChecked();
  await fillBail(page);
  await expect(run).toBeDisabled();
  await expect(page.getByTestId("bail-declaration-missing")).toHaveText(MISSING);
  await page.getByTestId("bail-declaration-none").check();
  await expect(page.getByTestId("bail-declaration-missing")).toHaveCount(0);
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.getByTestId("bail-result")).toBeVisible();
  expect(bodies[0].sensitive_declaration).toBe("none");
  await expect(page.getByTestId("bail-declaration-none")).not.toBeChecked();
  await expect(run).toBeDisabled();
});

test("flag ON: choosing 'Yes' sends sensitive and shows the engine's referral, never a draft", async ({ page }) => {
  test.skip(!ON, "needs the build with the declaration flag");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/bail-draft", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: fx("bail_response_referred_sensitive") }); });
  await page.goto("/preview");
  await fillBail(page);
  await page.getByTestId("bail-declaration-sensitive").check();
  await page.getByTestId("bail-run").click();
  await expect(page.getByTestId("bail-referral")).toBeVisible();
  expect(bodies[0].sensitive_declaration).toBe("sensitive");
});

test("flag ON: the engine's coded refusal (422 sensitive_declaration_required) reads R1's line, never the engine's text", async ({ page }) => {
  test.skip(!ON, "needs the build with the declaration flag");
  await page.route("**/api/v1/bail-draft", (r) => r.fulfill({ status: 422, json: { error: "sensitive_declaration_required", detail: "ENGINE TEXT SHOULD NOT SHOW" } }));
  await page.goto("/preview");
  await fillBail(page);
  await page.getByTestId("bail-declaration-none").check();
  await page.getByTestId("bail-run").click();
  await expect(page.getByTestId("bail-message")).toHaveText(MISSING);
  await expect(page.locator("body")).not.toContainText("ENGINE TEXT SHOULD NOT SHOW");
});

test("flag ON: the synopsis card asks the same question and sends the answer", async ({ page }) => {
  test.skip(!ON, "needs the build with the declaration flag");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/matter-spans/matters", (r) => r.fulfill({ json: { matter_id: HEX } }));
  await page.route("**/api/v1/matter-spans/documents", (r) => r.fulfill({ json: { matter_id: HEX, doc_id: "d1", name: "FIR", n_pages: 1, n_spans: 3, n_chars: 90, pages_without_text: [], ingest_done: true } }));
  await page.route("**/api/v1/matter-spans/list", (r) => r.fulfill({ json: { matter_id: HEX, documents: [{ doc_id: "d1", name: "FIR", n_pages: 1, n_spans: 3, n_chars: 90, ingest_done: true, pages_without_text: [], indexed_complete: true }], pages_total: 1, pages_not_read: 0, pages_note: "" } }));
  await page.route("**/api/v1/synopsis-dates", (r) => { bodies.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); r.fulfill({ json: fx("synopsis_response_table_only") }); });
  await page.goto("/preview");
  await page.getByTestId("pv-start").click();
  await page.getByTestId("pv-name").fill("FIR");
  await page.getByTestId("pv-text").fill("The FIR was registered.");
  await page.getByTestId("pv-add").click();
  await page.getByTestId("synopsis-consent").check();
  const run = page.getByTestId("synopsis-run");
  await expect(run).toBeDisabled();
  await page.getByTestId("synopsis-declaration-none").check();
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.getByTestId("synopsis-result")).toBeVisible();
  expect(bodies[0].sensitive_declaration).toBe("none");
});

test("flag ON: a fresh load, a second draft in the same session and a page reload all show no answer chosen and the button disabled", async ({ page }) => {
  test.skip(!ON, "needs the build with the declaration flag");
  await page.route("**/api/v1/bail-draft", (r) => r.fulfill({ json: fx("bail_response_drafted") }));
  const none = page.getByTestId("bail-declaration-none"), yes = page.getByTestId("bail-declaration-sensitive"), run = page.getByTestId("bail-run");
  await page.goto("/preview");
  await expect(none).not.toBeChecked(); await expect(yes).not.toBeChecked(); await expect(run).toBeDisabled();
  await fillBail(page);
  await none.check();
  await run.click();
  await expect(page.getByTestId("bail-result")).toBeVisible();
  await expect(none).not.toBeChecked(); await expect(yes).not.toBeChecked(); await expect(run).toBeDisabled(); // second draft in the same session
  await none.check();
  await page.reload();
  await expect(none).not.toBeChecked(); await expect(yes).not.toBeChecked(); // no remembered value after a reload
  await expect(run).toBeDisabled();
  expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter((k) => /declar|sensitive/i.test(k)))).toEqual([]);
});
