import { expect, test } from "./support/engineTest";
import { promiseHits } from "./support/noTrainingPromise";

// Pravrudhi-Nyaya: the name and line, the grouped navigation (paths unchanged), the data-handling page, /workflows and the skip link. R1's exact text is pinned in the unit specs.
const LINE_START = "Element-by-element screening under Indian law, starting with criminal matters. For each offence it covers under the BNS and the IPC";

test("the name and the line: the title, the sidebar name, and the line on the Screening page", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  await expect(page).toHaveTitle("Matter workspace · Pravrudhi-Nyaya"); // R1, 15 Oct (D4): every page has its own title
  await expect(page.locator("aside").getByText("Pravrudhi-Nyaya", { exact: true })).toBeVisible();
  await expect(page.getByTestId("product-line")).toContainText(LINE_START);
  await expect(page.getByTestId("product-line")).not.toContainText(/proof|proved|established|verbatim/i);
});

test("the grouped navigation: Work, Reference and Account, labels changed and paths kept; none of Studio's pages", async ({ page }) => {
  await page.goto("/guide");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const g of ["work", "reference", "account"]) await expect(nav.getByTestId(`nav-group-${g}`)).toBeVisible();
  await expect(nav.getByTestId("nav-group-studio")).toHaveCount(0);
  const hrefs: Record<string, string> = { Screening: "/screening", Workflows: "/workflows", "Data handling": "/data-handling", Settings: "/settings", "Safety record": "/safety", "How it works": "/demo", "User guide": "/guide" };
  for (const [name, href] of Object.entries(hrefs)) await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", new RegExp(`${href}/?$`));
  await expect(nav.getByRole("link", { name: "User guide", exact: true })).toHaveAttribute("aria-current", "page");
  for (const studio of ["Objectives", "Progress", "Memory", "Catalogue", "Chat", "Runs", "Models", "Install"]) await expect(nav.getByRole("link", { name: studio, exact: true })).toHaveCount(0);
});

test("/data-handling: the sections are R1's text, with the three browser-storage items and no region for the smaller model", async ({ page }) => {
  await page.goto("/data-handling");
  const body = page.getByTestId("data-handling");
  await expect(page.getByRole("heading", { name: "Data handling", exact: true, level: 1 })).toBeVisible();
  await expect(body.getByTestId("dh-kept")).toContainText("Run records are kept for up to 7 days.");
  await expect(body.getByTestId("dh-where")).toContainText("for some parts the region is not fixed");
  await expect(body.getByTestId("dh-where")).toContainText("If our EU processing is unavailable, part of the screening may instead run in a North American data centre for that request, and your facts are sent there. Retention is as described above; the hosting provider may keep its own logs.");
  await expect(body.getByTestId("dh-browser")).toContainText("your sign-in session, your recent pages in the command palette and your theme choice");
  expect(promiseHits(await body.innerText())).toEqual([]);
  await expect(body).not.toContainText(/no fact text is kept/i);
  await expect(body).not.toContainText(/frontier/i); // #128 D6: the section is not shown while the reader is unavailable
});

test("/workflows: five rows with a status word each, no start button, and the closing line", async ({ page }) => {
  await page.goto("/workflows");
  await expect(page.getByTestId("workflow-row")).toHaveCount(4);
  // R1, 14 Oct: Screening orchestration reads "Built" only in a build that offers the assistant (NEXT_PUBLIC_ASSISTANT_ENTRY=1); Intake only in a build with NEXT_PUBLIC_INTAKE=1 (INTAKE_BUILD=1 here).
  const assistantOn = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
  const intakeOn = process.env.INTAKE_BUILD === "1";
  await expect(page.getByTestId("workflow-status")).toHaveText([assistantOn ? "Built" : "Building", intakeOn ? "Built" : "Building", "Built", "Building"]);
  if (assistantOn) await expect(page.getByTestId("workflow-row").first()).not.toContainText("Not yet offered");
  await expect(page.getByTestId("workflows").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("workflows-closing")).toHaveText("A workflow runs only when you start it, and only on the matter you give it.");
});

test("the skip link is the first tab stop and moves focus to the main region", async ({ page }) => {
  await page.goto("/workflows");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});
