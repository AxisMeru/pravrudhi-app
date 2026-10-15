import { expect, test } from "./support/engineTest";

// #263 (operator's signed-in citations-ON test, 15 Oct): pasting into the Case citations box did not work. These tests paste with the REAL clipboard (Ctrl/Cmd+V), not fill(), into every box
// that takes citations: the panel's textarea (several lines, one citation each) and the single-citation form on /citations. Runs only in the citations-ON build (CITATION_EXISTENCE_BUILD=1).
test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1", "needs the citations-ON build");

const LINES = ["(2099) 1 SCC 1", "(2099) 2 SCC 2", "Invented v. Sample (2099) 3 SCC 3", "(2099) 4 SCC 4", "(2099) 5 SCC 5"];
const answer = { run_id: "r-invented-paste", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented", facts: [], contracts: [] };

async function paste(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, text: string) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
}

test("the citations panel: a five-line paste lands in the box, one citation per line", async ({ page, context }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: { ...answer, facts: [{ id: "F1", sha256: "b".repeat(64) }], contracts: [{ contract_id: "ipc415_property", outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, elements: [] }] } }));
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill("Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.");
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const box = page.getByTestId("citations-panel").getByRole("textbox");
  await expect(box).toBeVisible();
  await box.click();
  await paste(page, context, LINES.join("\n"));
  await expect(box).toHaveValue(LINES.join("\n"));
  await expect(page.getByRole("button", { name: "Check citations" })).toBeEnabled();
});

test("the citation check page: a pasted citation lands in the box", async ({ page, context }) => {
  await page.goto("/citations");
  const box = page.getByRole("textbox");
  await box.click();
  await paste(page, context, LINES[2]);
  await expect(box).toHaveValue(LINES[2]);
});

// #263 (Interim lead's decision): /citations takes a pasted LIST like the panel: a 5-line box (same component and limit text), the line count shown, nothing cut without being said.
test("/citations: a five-line paste is five rows when checked; the limit is said before typing; six lines say how many will be checked", async ({ page, context }) => {
  const asked: string[] = [];
  await page.route("**/api/v1/verify-citations", (r) => { asked.push(String(r.request().postDataJSON().citation)); return r.fulfill({ json: { result: "NOT_IN_INDEX", note: "n", status: "not_in_index", label: "not in index", verified: false, preview: true } }); });
  await page.goto("/citations");
  const box = page.getByRole("textbox");
  await expect(page.getByTestId("citations-panel")).toContainText("One citation per line, at most 5 at a time.");
  await expect(box).toHaveAttribute("rows", "5");
  await expect(page.getByTestId("citations-panel-count")).toHaveCount(0);
  await box.click();
  await paste(page, context, LINES.join("\n"));
  await expect(box).toHaveValue(LINES.join("\n"));
  await expect(page.getByTestId("citations-panel-count")).toHaveText("5 of 5 lines.");
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citations-panel-row")).toHaveCount(5);
  await expect.poll(() => asked.length).toBe(5); // the checks run one after the other
  expect(asked).toEqual(LINES);
  await box.fill([...LINES, "(2099) 6 SCC 6"].join("\n"));
  await expect(page.getByTestId("citations-panel-count")).toHaveText("6 lines entered; the first 5 will be checked.");
  await page.getByRole("button", { name: "Check citations" }).click();
  await expect(page.getByTestId("citations-panel-skipped")).toHaveText("Only the first 5 lines were checked. Check the rest in a second try.");
});
