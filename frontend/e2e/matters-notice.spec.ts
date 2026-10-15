import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";
import { promiseHits, PROMISE_SAMPLES } from "./support/noTrainingPromise";

/** The data-handling notice before facts are entered, the corrected file note and the next-step link (design-partner audit gaps 1 and 4). */
const RETENTION = "Run records are kept for up to 7 days. They are removed when the next analysis runs, and can disappear earlier. A run record can include the text of facts the screening marked as supported, so do not enter real names or case details unless your firm's setup allows it. More under Data handling.";
const REGISTRY = "**/api/nyaya/registry/contracts";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";

test("the retention notice is on the page before anything is typed: R1's text, closing on a link to Data handling, no training promise", async ({ page }) => {
  await page.goto("/matters");
  await expect(page.getByTestId("retention-before")).toHaveText(RETENTION);
  await expect(page.getByTestId("retention-before").getByRole("link", { name: "Data handling" })).toHaveAttribute("href", "/data-handling");
  expect(promiseHits(await page.locator("body").innerText())).toEqual([]);
  await expect(page.locator("body")).not.toContainText(/kept up to 7 days for audit/i);
});

test("the engine's own retention_notice is not shown under a result", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-3", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: [{ id: "f1", sha256: sha(FACT) }],
        retention_notice: `ENGINE-NOTICE-MARKER ${PROMISE_SAMPLES[0]}`,
        contracts: [{ contract_id: "bns69", outcome: "ABSTAIN", reason: "missing_element", elements: [], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ENGINE-NOTICE-MARKER");
  expect(promiseHits(await page.locator("body").innerText())).toEqual([]);
});

test("the file note says the file itself is not uploaded and that the text read from it is sent on Analyse", async ({ page }) => {
  await page.goto("/matters");
  await expect(page.getByText("The file itself is not uploaded; the text read from it")).toBeVisible();
  await expect(page.getByText("is sent to the engine when you press Analyse")).toBeVisible();
});

async function analyse(page: import("@playwright/test").Page) {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) =>
    r.fulfill({
      json: {
        run_id: "r-invented-2", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: [{ id: "f1", sha256: sha(FACT) }],
        contracts: [{ contract_id: "bns69", outcome: "ABSTAIN", reason: "missing_element", elements: [], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null }],
      },
    }),
  );
  await page.goto("/matters");
  await page.getByLabel("Facts (one per line)").fill(FACT);
  await page.getByText("bns69").click();
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("memo-actions")).toBeVisible();
}

test("no next-step link to the citation check while the build keeps it hidden", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD === "1", "the nav-on build is covered below");
  await analyse(page);
  await expect(page.getByTestId("citation-next-step")).toHaveCount(0);
});

test("with the nav flag on, the result links to the citation check", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", "needs a build with NEXT_PUBLIC_CITATION_NAV=1");
  await analyse(page);
  await expect(page.getByTestId("citation-next-step").getByRole("link", { name: "To check a citation, use Citation check." })).toHaveAttribute("href", /\/citations/);
});

test("the citation check says what is and is not stored, before anything is entered", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", "the check's own page (with its retention line) is shown only on a build that serves it; the gated page is a notice");
  await page.goto("/citations");
  await expect(page.getByTestId("citation-retention")).toHaveText(
    "The citation check does not save the citation or the quote you enter.",
  );
});
