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
  await expect(page.getByTestId("intake-data-line")).toHaveText("The text you paste is read by the engine only; no model reads it on this page. The facts you choose are sent on to Screening, where models read them.");
  await expect(page.getByTestId("intake-caveats").locator("li").first()).toContainText("Intake leaves out the heading of a court order.");
  await page.getByLabel("Paste the text").fill(FACTS.map((f) => f.text).join("\n\n"));
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("fact-selector")).toBeVisible();
  await expect(page.getByTestId("selector-limit-line")).toHaveText("Intake found 10 facts. Screening takes up to 8 at a time: choose the ones that matter.");
  // more than 8 facts: nothing is ticked to start (the user chooses on purpose)
  await expect(page.getByTestId("selector-counter")).toHaveText("0 of 8 chosen");
  for (let i = 0; i < 8; i++) await page.getByTestId(`pick-${i}`).check();
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

// R1 (14 Oct): what intake left out is said under the list whenever n > 0; the numbers line only when a left-out line has a digit; nothing when n = 0.
for (const [name, notCitable, cleaned, expectNote, expectDigits] of [
  ["n = 0: no notice", [], "Invented text.", false, false],
  ["n > 0 without a digit", [{ status: "caption", cleaned_start: 0, cleaned_end: 14 }], "HEADING OF THE INVENTED ORDER and text.", true, false],
  ["a caption with a date only: the count, no digit line", [{ status: "caption", cleaned_start: 0, cleaned_end: 22 }], "HEADING DATED 2000 and invented text.", true, false],
  ["n > 0 with a digit in a repeated line", [{ status: "repeated_line", cleaned_start: 0, cleaned_end: 6 }], "Page 7 and invented text.", true, true],
  ["a span with no status fires the digit line", [{ cleaned_start: 0, cleaned_end: 6 }], "Heading and invented text.", true, true],
] as const) {
  test(`left-out notice: ${name}`, async ({ page }) => {
    await page.route("**/api/v1/intake", (r) => r.fulfill({ json: { ...ANSWER, bundle: { ...ANSWER.bundle, facts: FACTS.slice(0, 2), cleaned, not_citable: notCitable } } }));
    await page.goto("/intake");
    await page.getByLabel("Paste the text").fill("Invented text.\n\nMore invented text.");
    await page.getByTestId("intake-run").click();
    await expect(page.getByTestId("fact-selector")).toBeVisible();
    await expect(page.getByTestId("selector-renumber")).toHaveText("Screening numbers the facts you choose again, from F1.");
    await expect(page.getByTestId("intake-left-out")).toHaveCount(expectNote ? 1 : 0);
    await expect(page.getByTestId("intake-left-out-digits")).toHaveCount(expectDigits ? 1 : 0);
    if (expectNote) await expect(page.getByTestId("intake-left-out")).toContainText("1 passage was left out: the heading, repeated lines or lines with no words.");
  });
}
