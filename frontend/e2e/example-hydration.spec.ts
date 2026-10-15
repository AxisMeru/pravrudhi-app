import { expect, test } from "./support/engineTest";
import { EXAMPLES } from "../src/lib/demo/example";

// #241 (Track A's bisect): /screening?example=<id> threw React error #418 (a hydration text mismatch): the first client render read the URL, the static page had not. The page works either way,
// so nothing user-visible showed it; this pins that loading an example link raises no page error and no React error in the console, and still ends with the example's facts in the boxes.
for (const e of EXAMPLES) {
  test(`example link ${e.id}: no page error, no React hydration error, the example is loaded`, async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    page.on("console", (m) => { if (m.type() === "error" && /hydrat|#418|#423|#425|Minified React error/i.test(m.text())) problems.push(`console: ${m.text()}`); });
    await page.goto(`/screening?example=${e.id}`);
    await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).not.toHaveValue("");
    await expect(page.getByTestId("fact-list-pending")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}
