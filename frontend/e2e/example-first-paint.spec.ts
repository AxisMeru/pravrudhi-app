import { expect, test } from "./support/engineTest";

// An example link (?example=<id>) never shows an empty Fact F1 box that fills a moment later: the example text is the first thing in the box.
test("an example link: Fact F1 is never empty, from the first time the box exists", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __f1: string[] };
    w.__f1 = [];
    const look = () => {
      const t = document.querySelector('textarea[aria-label="Fact F1"]') as HTMLTextAreaElement | null;
      if (t) w.__f1.push(t.value);
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    document.addEventListener("DOMContentLoaded", look);
  });
  await page.goto("/screening?example=madras-public-order-2024");
  const box = page.getByRole("textbox", { name: "Fact F1", exact: true });
  await expect(box).not.toHaveValue("");
  await expect(page.getByTestId("fact-list-pending")).toHaveCount(0);
  const seen = await page.evaluate(() => (window as unknown as { __f1: string[] }).__f1);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((v) => v.length > 0)).toBe(true);
});

test("no example link: one empty box, ready to type in", async ({ page }) => {
  await page.goto("/screening");
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue("");
  await expect(page.getByTestId("fact-list-pending")).toHaveCount(0);
});
