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

// #241 (R2): the example's facts are in the box before the FIRST paint, not a frame later: every animation frame, from the first one, is recorded, and none may show the visible Fact F1 textbox empty on an example link.
test("example link: no animation frame shows an empty, visible Fact F1 box", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: Array<{ visible: boolean; value: string }> };
    w.__frames = [];
    const frame = () => {
      const t = document.querySelector('textarea[aria-label="Fact F1"]') as HTMLTextAreaElement | null;
      if (t) w.__frames.push({ visible: !t.closest("[hidden]"), value: t.value });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.goto(`/screening?example=${EXAMPLES[0].id}`);
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).not.toHaveValue("");
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => (window as unknown as { __frames: Array<{ visible: boolean; value: string }> }).__frames);
  expect(frames.length, "frames were recorded").toBeGreaterThan(0);
  expect(frames.filter((f) => f.visible && f.value === ""), "frames that showed an empty visible Fact F1 box").toEqual([]);
});

// The frame recording above cannot tell a synchronous layout-effect update from a microtask-deferred one in headless Chromium (both pass: measured), so the cause is pinned in the source too: the example layout effect sets its state synchronously.
test("the example layout effect sets its state synchronously (a deferred update can paint an empty box first)", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = readFileSync(join(__dirname, "..", "src", "app", "screening", "page.tsx"), "utf8");
  const start = src.indexOf("useLayoutEffect(() => {");
  expect(start, "the example layout effect exists").toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf("}, []);", start));
  expect(body).toContain("setFacts([...found.facts])");
  expect(body).not.toMatch(/Promise\.resolve|setTimeout|queueMicrotask/);
});
