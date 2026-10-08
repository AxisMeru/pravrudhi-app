import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/** The data-handling notice before facts are entered, the corrected file note and the next-step link (design-partner audit gaps 1 and 4). */
const ENGINE = JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "fixtures", "engineRetentionNotice.json"), "utf8")) as { text: string };
const REGISTRY = "**/api/nyaya/registry/contracts";
const FACT = "Ravi lent the toy lorry to Meena on a Monday in the invented town of Quillpoort.";

test("the retention notice is on the page before anything is typed, word for word as the engine states it", async ({ page }) => {
  await page.goto("/matters");
  await expect(page.getByTestId("retention-before")).toHaveText(ENGINE.text);
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
        run_id: "r-invented-2", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", facts: [{ id: "f1", text: FACT, sha256: "b".repeat(64) }],
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
  await page.goto("/citations");
  await expect(page.getByTestId("citation-retention")).toHaveText(
    "The citation check does not save the citation or the quote you enter.",
  );
});
