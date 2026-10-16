import type { Page } from "@playwright/test";

// True on a build with NEXT_PUBLIC_LAYOUT_MATTER_B=1 (layout B sets html[data-layout="matter-b"]); the pre-layout specs use it to assert the layout-B equivalent instead of the live one.
export async function isLayoutB(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.getAttribute("data-layout") === "matter-b");
}

// Layout B keeps the Reference group closed; open it before looking for one of its links (a no-op on the live layout).
export async function openReference(page: Page): Promise<void> {
  const group = page.getByTestId("mb-group-reference");
  if ((await group.count()) > 0 && !(await group.evaluate((el) => (el as HTMLDetailsElement).open))) await group.locator("summary").click();
}
