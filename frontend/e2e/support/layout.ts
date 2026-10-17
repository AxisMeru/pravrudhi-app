import { expect, type Page } from "@playwright/test";

import { MB } from "../../src/lib/screening/matterB";

// True on a build with NEXT_PUBLIC_LAYOUT_MATTER_B=1 (layout B sets html[data-layout="matter-b"]); the pre-layout specs use it to assert the layout-B equivalent instead of the live one.
export async function isLayoutB(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.getAttribute("data-layout") === "matter-b");
}

// Layout B keeps the Reference group closed: open it (a no-op on the live layout) and prove it is open, not just clicked.
export async function openReference(page: Page): Promise<void> {
  const group = page.getByTestId("mb-group-reference");
  if ((await group.count()) === 0) return;
  if (!(await group.evaluate((el) => (el as HTMLDetailsElement).open))) await group.locator("summary").click();
  await expect.poll(() => group.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
}

// Layout B on /screening with a result: no step bar (by design); the breadcrumb ends in "Result" and the nav's Result anchor is the current location; the other anchors replace the step links.
export async function expectResultViewNav(page: Page, built: { hearing: boolean; citations: boolean }): Promise<void> {
  await expect(page.getByTestId("workspace-steps"), "the step bar is not mounted in the result view").toHaveCount(0);
  const crumb = (await page.getByTestId("breadcrumb").innerText()).replace(/\s+/g, " ").trim();
  expect(crumb).toBe(`${MB.screeningLabel} \u203a ${MB.resultLabel}`);
  const group = page.getByTestId("mb-screening-group");
  await expect(group.getByRole("link", { name: MB.factsLabel, exact: true })).toHaveAttribute("href", "#step-facts");
  await expect(group.getByRole("link", { name: MB.resultLabel, exact: true })).toHaveAttribute("aria-current", "location");
  if (built.hearing) await expect(group.getByRole("link", { name: "Hearing preparation", exact: true })).toHaveAttribute("href", "#step-hearing");
  if (built.citations) await expect(group.getByRole("link", { name: "Case citations", exact: true })).toHaveAttribute("href", "#step-citations");
}

// Layout B off /screening: the group is exactly one item, "This screening", the link to the page; no "Matter" and no "Facts" link.
export async function expectOffPageScreeningItem(page: Page): Promise<void> {
  const nav = page.getByRole("navigation", { name: "Primary" });
  const group = nav.getByTestId("mb-screening-group");
  await expect(group.getByRole("link")).toHaveCount(1);
  await expect(group.getByRole("link", { name: MB.screeningLabel, exact: true })).toHaveAttribute("href", /\/screening\/?$/);
  await expect(nav.getByRole("link", { name: "Matter", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: MB.factsLabel, exact: true })).toHaveCount(0);
}

// The page's own name: "This screening" on layout B (R1, 17 Oct: no "matter" label where no matter store exists), "Matter workspace" on the live layout.
export async function screeningTitle(page: Page): Promise<string> {
  return (await isLayoutB(page)) ? MB.screeningLabel : "Matter workspace";
}
