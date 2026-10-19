import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The Section lookup card (#1016) against Track B's five mocks from the real module (B1_CONTRACT_DOC dbfc240c6448). ON only on a build with NEXT_PUBLIC_SECTION_LOOKUP=1 (SECTION_BUILD=1); OFF: the card is absent.
const ON = process.env.SECTION_BUILD === "1";
const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "preview", `section_lookup_${n}.json`), "utf8")) as Record<string, unknown>;
test.beforeEach(async ({ page }) => { await page.route("**/api/me", (r) => r.fulfill({ json: { email: "invented@example.invalid" } })); });

test("flag OFF: there is no Section look-up card", async ({ page }) => {
  test.skip(ON, "the OFF arm");
  await page.goto("/preview");
  await expect(page.getByTestId("pv-sl")).toHaveCount(0);
});

async function ask(page: import("@playwright/test").Page, code: "IPC" | "CrPC", section: string, answer: unknown, status = 200) {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/v1/section-lookup", (r) => { sent.push(JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>); return typeof answer === "string" ? r.fulfill({ status, contentType: "text/html", body: answer }) : r.fulfill({ status, json: answer as object }); });
  await page.goto("/preview");
  await page.getByTestId(code === "IPC" ? "pv-sl-ipc" : "pv-sl-crpc").check();
  await page.getByTestId("pv-sl-section").fill(section);
  await page.getByTestId("pv-sl-run").click();
  return sent;
}

test("flag ON: IPC 302 one_to_one shows the engine's line, the old body (its three source lines) beside the one new body, the source line above and the lawyer line last, in that order", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SECTION_LOOKUP=1");
  const sent = await ask(page, "IPC", " 302 ", fx("ipc302_one_to_one"));
  expect(sent[0]).toEqual({ code: "IPC", section: "302" });
  const r = page.getByTestId("pv-sl-result");
  await expect(r).toHaveAttribute("data-state", "one_to_one");
  await expect(page.getByTestId("pv-sl-line")).toHaveText("The table matches this section to one section: Section 103.");
  await expect(page.getByTestId("pv-sl-old-heading")).toHaveText("Section 302 · Punishment for murder");
  await expect(page.getByTestId("pv-sl-old-line")).toHaveCount(3);
  await expect(page.getByTestId("pv-sl-new-0-heading")).toHaveText("Section 103 · Punishment for murder.");
  await expect(page.getByTestId("pv-sl-new-0-line")).toHaveText("BNS and BNSS text is from India Code (Legislative Department, Ministry of Law and Justice).");
  const order = await page.locator("[data-testid='pv-sl-source'], [data-testid='pv-sl-line'], [data-testid='pv-sl-old'], [data-testid='pv-sl-new-0'], [data-testid='pv-sl-lawyer']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["pv-sl-source", "pv-sl-line", "pv-sl-old", "pv-sl-new-0", "pv-sl-lawyer"]);
  await expect(page.getByTestId("pv-sl-lawyer")).toHaveText("Check the official texts before you rely on this. A lawyer decides.");
  await expect(page.getByTestId("pv-sl")).not.toContainText(/equivalent|replaces|same as|converted|updated law|in force/i);
});

test("flag ON: IPC 420 check_both shows both texts with the engine's check-both line and nothing that says match", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SECTION_LOOKUP=1");
  await ask(page, "IPC", "420", fx("ipc420_check_both"));
  await expect(page.getByTestId("pv-sl-result")).toHaveAttribute("data-state", "check_both");
  await expect(page.getByTestId("pv-sl-line")).toContainText("Check both official texts");
  await expect(page.getByTestId("pv-sl-old")).toBeVisible();
  await expect(page.getByTestId("pv-sl-new-0")).toBeVisible();
  await expect(page.getByTestId("pv-sl")).not.toContainText(/correspond(s|ing)? to|matches this section/i);
});

test("flag ON: IPC 124A no_match shows the old body only; IPC 999 not_in_table shows the line only; CrPC 154 shows the not-held line where the body would be", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SECTION_LOOKUP=1");
  await ask(page, "IPC", "124A", fx("ipc124a_no_match"));
  await expect(page.getByTestId("pv-sl-result")).toHaveAttribute("data-state", "no_match");
  await expect(page.getByTestId("pv-sl-old")).toBeVisible();
  await expect(page.getByTestId("pv-sl-new-0")).toHaveCount(0);
  await page.unroute("**/api/v1/section-lookup");
  await page.route("**/api/v1/section-lookup", (r) => r.fulfill({ json: fx("ipc999_not_in_table") }));
  await page.getByTestId("pv-sl-section").fill("999");
  await page.getByTestId("pv-sl-run").click();
  await expect(page.getByTestId("pv-sl-result")).toHaveAttribute("data-state", "not_in_table");
  await expect(page.getByTestId("pv-sl-old")).toHaveCount(0);
  await page.unroute("**/api/v1/section-lookup");
  await page.route("**/api/v1/section-lookup", (r) => r.fulfill({ json: fx("crpc154_not_held") }));
  await page.getByTestId("pv-sl-crpc").check();
  await page.getByTestId("pv-sl-section").fill("154");
  await page.getByTestId("pv-sl-run").click();
  await expect(page.getByTestId("pv-sl-old-line")).toHaveText("The text of this section is not held. Check the official text.");
  await expect(page.getByTestId("pv-sl-old-text")).toHaveCount(0);
});

test("flag ON: a bad section number is not sent; a 422 reads 'Check the section number.'; an HTML (non-JSON) answer and a 503 read 'not available here'; a 429 retries once then says to wait", async ({ page }) => {
  test.skip(!ON, "needs NEXT_PUBLIC_SECTION_LOOKUP=1");
  let n = 0;
  await page.route("**/api/v1/section-lookup", (r) => { n += 1; return r.fulfill({ status: 200, contentType: "text/html", body: "<html>app page</html>" }); });
  await page.goto("/preview");
  const run = page.getByTestId("pv-sl-run");
  await page.getByTestId("pv-sl-section").fill("12 4");
  await expect(run).toBeDisabled();
  expect(n).toBe(0);
  await page.getByTestId("pv-sl-section").fill("302");
  await run.click();
  await expect(page.getByTestId("pv-sl-message")).toHaveText("The section look-up is not available here.");
  await page.unroute("**/api/v1/section-lookup");
  await page.route("**/api/v1/section-lookup", (r) => r.fulfill({ status: 422, json: { error: "bad_request" } }));
  await run.click();
  await expect(page.getByTestId("pv-sl-message")).toHaveText("Check the section number.");
  await page.unroute("**/api/v1/section-lookup");
  await page.route("**/api/v1/section-lookup", (r) => r.fulfill({ status: 503, json: { detail: "The section look-up is not available just now.", error: "lookup_unavailable" } }));
  await run.click();
  await expect(page.getByTestId("pv-sl-message")).toHaveText("The section look-up is not available here.");
  await page.unroute("**/api/v1/section-lookup");
  let hits = 0;
  await page.route("**/api/v1/section-lookup", (r) => { hits += 1; return r.fulfill({ status: 429, json: { detail: "rate limited" } }); });
  await run.click();
  await expect(page.getByTestId("pv-sl-message")).toHaveText("Wait a moment and try again.", { timeout: 10000 });
  expect(hits).toBe(2);
});
