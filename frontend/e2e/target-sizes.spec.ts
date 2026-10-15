import { expect, test } from "./support/engineTest";

// #294 (#138): standalone controls on these pages are at least 24 px high and wide (WCAG 2.2 target size minimum). Inline links inside running text are exempt, as in the standard; visually hidden inputs
// (sr-only) are not targets (their label is). Measured in the browser at a desktop and a phone width.
const PAGES = ["/matters", "/data-handling", "/guide", "/demo", "/signin", "/screening", "/workflows", "/settings", "/safety", "/benchmarks", "/how-it-was-built", "/citations", "/technical-film"];
for (const width of [1280, 390]) {
  test(`standalone controls are at least 24 px at ${width} px on the main pages`, async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [{ id: "ipc415_property", validated: true }] } }));
    await page.setViewportSize({ width, height: 900 });
    const offenders: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const found = await page.evaluate(() => {
        const out: string[] = [];
        for (const e of document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]")) {
          const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none" || e.closest("[aria-hidden=true]")) continue;
          if (r.width >= 24 && r.height >= 24) continue;
          if (r.width <= 2 && r.height <= 2) continue; // visually hidden (the skip link until focused, sr-only inputs)
          if (e.tagName === "A") { const par = e.parentElement; if (par && (par.textContent ?? "").trim().length > (e.textContent ?? "").trim().length + 3 && getComputedStyle(par).display !== "flex") continue; } // inline in running text
          out.push(`${e.tagName.toLowerCase()} "${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out;
      });
      for (const f of found) offenders.push(`${path}: ${f}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
}
