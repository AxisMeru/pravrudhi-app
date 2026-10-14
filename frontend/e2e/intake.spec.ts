import { expect, test } from "./support/engineTest";

// Intake (#414/#430) against a recorded engine answer with INVENTED text: paste, facts come back, choose up to 8, send to Screening. Runs only in the intake-flag build
// (NEXT_PUBLIC_INTAKE=1, INTAKE_BUILD=1); the normal build sends this route back to Workflows.
test.skip(process.env.INTAKE_BUILD !== "1", "needs the NEXT_PUBLIC_INTAKE=1 build");

const FACTS = Array.from({ length: 10 }, (_, i) => ({ id: `F${i + 1}`, text: `Invented fact number ${i + 1}: the buyer paid a sum for goods that were never delivered.`, status: "span" }));
const ANSWER = {
  run_id: "nyaya-intake-invented00",
  client_data: true,
  bundle: {
    clean_status: "cleaned",
    facts: FACTS,
    not_citable: [{ status: "duplicate", reason: "same text as an earlier fact" }],
    citations: [{ text: "Invented v. Sample (2000) 1 SCC 1", verifier_status: "NOT_IN_INDEX", fact_ids: ["F1"] }],
  },
};

test("intake returns facts; the choice is capped at 8; the chosen facts reach Screening", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: ANSWER }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await expect(page.getByTestId("intake-caveats").locator("li").first()).toContainText("Intake leaves out the heading of a court order.");
  await page.getByLabel("Paste the text").fill(FACTS.map((f) => f.text).join("\n\n"));
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("fact-selector")).toBeVisible();
  await expect(page.getByTestId("selector-limit-line")).toHaveText("Intake found 10 facts. Screening takes up to 8 at a time: choose the ones that matter.");
  await expect(page.getByTestId("selector-counter")).toHaveText("8 of 8 chosen");
  // the ninth tick is refused, with R1's words; unticking one makes room
  await page.getByTestId("pick-8").check({ force: true }).catch(() => {});
  await expect(page.getByTestId("selector-over-limit")).toHaveText("Choose up to 8, or screen in more than one round.");
  await expect(page.getByTestId("pick-8")).not.toBeChecked();
  await page.getByTestId("pick-0").uncheck();
  await expect(page.getByTestId("selector-counter")).toHaveText("7 of 8 chosen");
  await expect(page.getByTestId("citation-line")).toHaveText("Not found in our index: this does not show whether the citation is real");
  await expect(page.getByTestId("intake-limit")).toHaveText("Intake only joins broken lines, removes repeated page headers and tidies spacing; it never changes a number.");
  await page.getByTestId("selector-screen").click();
  await expect(page).toHaveURL(/\/screening\/?$/);
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue(FACTS[1].text);
  await expect(page.getByRole("textbox", { name: "Fact F7", exact: true })).toHaveValue(FACTS[7].text);
});

test("an empty choice is not screened and says so", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: ANSWER }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented text.\n\nMore invented text.");
  await page.getByTestId("intake-run").click();
  for (let i = 0; i < 8; i++) await page.getByTestId(`pick-${i}`).uncheck();
  await page.getByTestId("selector-screen").click();
  await expect(page.getByTestId("selector-empty")).toHaveText("Choose at least one fact to screen.");
});
