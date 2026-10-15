import { expect, test } from "./support/engineTest";

// P5 slice 2 (#144), R1's words (15 Oct): the first-run panel, the headings and the drop zone of the Matter workspace.
const CONTRACTS = { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] };
test.beforeEach(async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: CONTRACTS }));
});

test("first visit: the panel shows R1's heading, line, three ordered texts, two buttons and the data link; the section headings and the drop zone are there", async ({ page }) => {
  await page.goto("/screening");
  const panel = page.getByTestId("start-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Start a screening" })).toBeVisible();
  await expect(panel).toContainText("See which ingredients of an offence your facts support, which they do not, and what to check before you rely on it.");
  await expect(panel.getByTestId("start-panel-steps").locator("li")).toHaveText(["Paste or upload the facts", "Pick the offence", "Read the checklist and export the memo"]);
  await expect(panel).not.toContainText(/Step\s*[123]/);
  await expect(panel.getByRole("button", { name: "Try an example from a public court order" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Paste your own facts" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "What is kept and what is sent (Data handling)" })).toHaveAttribute("href", /\/data-handling\/?$/);
  await expect(panel.getByRole("button", { name: "Close this panel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The facts" })).toBeVisible();
  await expect(page.getByText("The offence", { exact: true })).toBeVisible();
  const zone = page.getByTestId("facts-dropzone");
  await expect(zone).toContainText("Drop a file here, or paste the text into the box.");
  await expect(zone).toContainText(".txt, .pdf or .docx");
  expect(await zone.getByTestId("facts-file").getAttribute("accept"), "the type line says only what the input takes").toBe(".txt,.pdf,.docx");
});

test("Paste your own facts focuses the paste box; Try an example moves to the example links", async ({ page }) => {
  await page.goto("/screening");
  await page.getByRole("button", { name: "Paste your own facts" }).click();
  await expect(page.locator("#screening-paste")).toBeFocused();
  await page.getByRole("button", { name: "Try an example from a public court order" }).click();
  await expect(page.getByTestId("example-entry").getByRole("link").first()).toBeFocused();
});

test("closing the panel closes it for this visit and stores nothing in the browser; typing facts also hides it", async ({ page }) => {
  await page.goto("/screening");
  await page.getByRole("button", { name: "Close this panel" }).click();
  await expect(page.getByTestId("start-panel")).toHaveCount(0);
  await expect(page.getByTestId("standing-line")).toBeVisible();
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => /panel|start/i.test(k)))).toEqual([]);
  await page.reload();
  await expect(page.getByTestId("start-panel")).toBeVisible();
  await page.locator("#screening-paste").fill("Invented: Ravi sold a toy lorry to Meena.");
  await expect(page.getByTestId("start-panel")).toHaveCount(0);
});

test("dropping a text file on the drop zone fills the paste box", async ({ page }) => {
  await page.goto("/screening");
  const data = await page.evaluateHandle(() => { const dt = new DataTransfer(); dt.items.add(new File(["Invented: Ravi sold a toy lorry to Meena."], "facts.txt", { type: "text/plain" })); return dt; });
  await page.getByTestId("facts-dropzone").dispatchEvent("drop", { dataTransfer: data });
  await expect(page.locator("#screening-paste")).toHaveValue("Invented: Ravi sold a toy lorry to Meena.");
});
