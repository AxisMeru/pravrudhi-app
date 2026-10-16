import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";

import { expect, test as base } from "./support/engineTest";

import type { AnalyseFactsWire } from "../src/lib/api";
import { MB } from "../src/lib/screening/matterB";
import { knownElements } from "../src/lib/screening/model";

/**
 * Layout B "matter-b" (#144, spec v3 bb1b62b1c51a). Two arms: the flag-OFF arm (default build) proves nothing of the layout is present; the flag-ON arm (build with NEXT_PUBLIC_LAYOUT_MATTER_B=1, run with MATTER_B_BUILD=1)
 * proves the result-first page, the grouped sidebar and the phone dock at 1280 and 390 px. The analysis is a recorded INVENTED answer (no engine, no judge), built the same way as the screening-live rehearsal.
 */
const ON = process.env.MATTER_B_BUILD === "1";
const TEXT = "Invented: a petitioner is said to have taken an advance of money for a promised sale of land and then to have failed to complete it, and to have threatened the complainant when he asked.";
const CONTRACTS = ["ipc415_property", "ipc415_damaging_act"];

function answer(): AnalyseFactsWire {
  const facts = [{ id: "F1", sha256: createHash("sha256").update(TEXT).digest("hex") }];
  const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null, quote_source: "whole_fact", p_established_second: 0.8 };
  const contracts = CONTRACTS.map((id) => {
    const known = knownElements(id)!;
    return {
      contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
      citations: [{ act: "IPC", section: "415", corpus_id: "x", in_corpus: true, title: "t" }],
      elements: known.elements.map((element, i) => ({ ...base, element, status: i === 0 ? "established" : i === 1 ? "not_confirmed" : "not_established", p_established: 0.5, fact_id: i === 0 ? "F1" : null })),
    };
  });
  return { run_id: "invented-matter-b", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented", facts, contracts } as unknown as AnalyseFactsWire;
}

async function arrange(page: Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: CONTRACTS, entries: [] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: answer() }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member" } }));
  await page.goto("/screening");
}
async function screen(page: Page) {
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(TEXT);
  await page.getByTestId("split-facts").click();
  await page.getByTestId("offence-list").locator("label").filter({ hasText: "Cheating" }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await page.getByTestId("screening-result").waitFor({ timeout: 20000 });
}

base.describe("flag OFF (the live layout)", () => {
  base.skip(ON, "flag-on build");
  base("no data-layout attribute, no layout-B markup, today's nav groups and the facts section after a result", async ({ page }) => {
    await arrange(page);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-layout"))).toBe(false);
    await screen(page);
    for (const id of ["mb-skip", "mb-announce", "mb-body", "mb-dock", "mb-screening-group", "mb-group-general", "breadcrumb", "mb-edit-facts", "mb-new-screening"]) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByTestId("nav-group-work")).toHaveCount(1);
    await expect(page.locator("#step-facts")).toBeVisible();
    await expect(page.getByTestId("workspace-steps")).toBeVisible();
    await expect(page.getByTestId("fact-filter").getByRole("heading", { name: "The facts" })).toBeVisible();
  });
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  base.describe(`flag ON at ${viewport.width} px`, () => {
    base.skip(!ON, "needs the build with NEXT_PUBLIC_LAYOUT_MATTER_B=1");
    base.use({ viewport });
    const phone = viewport.width < 768;

    base("intake first; after the screening the result view replaces it; Edit facts returns, focus and a status say where", async ({ page }) => {
      await arrange(page);
      expect(await page.evaluate(() => document.documentElement.getAttribute("data-layout"))).toBe("matter-b");
      await expect(page.getByTestId("mb-skip")).toHaveText(MB.skipToForm);
      await expect(page.getByTestId("breadcrumb")).toContainText(`${MB.breadcrumbRoot}›${MB.screeningLabel}›${MB.factsLabel}`.replace(/›/g, "›"));
      await screen(page);
      await expect(page.locator("#step-facts")).toBeHidden();
      await expect(page.getByTestId("workspace-steps")).toHaveCount(0);
      await expect(page.getByTestId("mb-skip")).toHaveText(MB.skipToResult);
      await expect(page.getByTestId("breadcrumb")).toContainText(MB.resultLabel);
      await expect(page.getByTestId("mb-announce")).toHaveText(MB.resultLabel);
      await expect(page.locator("#page-title")).toBeFocused();
      // text and a second view: the page never scrolls sideways
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
      // Edit facts returns to the intake with the facts still in the boxes
      await (phone ? page.getByTestId("mb-dock-more-button").click() : Promise.resolve());
      await (phone ? page.getByRole("button", { name: MB.editFacts }) : page.getByTestId("mb-edit-facts")).click();
      await expect(page.locator("#step-facts")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue(TEXT);
      await expect(page.getByTestId("mb-announce")).toHaveText(MB.factsLabel);
      await expect(page.locator("#page-title")).toBeFocused();
    });

    base("result view: groups headed by the chip words with live counts, chip first, one primary memo action, the rail after the rows", async ({ page }) => {
      await arrange(page);
      await screen(page);
      const first = page.getByTestId("checklist").first();
      await expect(first.getByTestId("mb-group-supported").getByRole("heading", { name: MB.groupSupported(1) })).toBeVisible();
      await expect(first.getByTestId("mb-group-review").getByRole("heading", { name: MB.groupReview(1) })).toBeVisible();
      await expect(first.getByTestId("mb-group-not_supported").getByRole("heading", { name: MB.groupNoFact(1) })).toBeVisible();
      await expect(page.getByText(/\(0\)/)).toHaveCount(0);
      // the chip leads each row
      const order = await first.getByTestId("ingredient-row").first().evaluate((li) => { const c = li.querySelector('[data-testid="ingredient-chip"]')!, t = li.querySelector('[data-testid="ingredient-text"]')!; return !!(c.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING); });
      expect(order).toBe(true);
      // DOM order = reading order: every checklist row comes before the facts rail
      const railAfter = await page.evaluate(() => { const rail = document.querySelector('[data-testid="fact-filter"]')!, row = document.querySelector('[data-testid="ingredient-row"]')!; return !!(row.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING); });
      expect(railAfter).toBe(true);
      await expect(page.getByTestId("fact-filter").getByRole("heading", { name: MB.yourFacts })).toBeVisible();
      await expect(page.getByTestId("fact-cited-F1")).toHaveText(MB.citedBy(2));
      // selecting a fact: aria-pressed, and the rows that cite it get a 2 px outline
      await page.getByTestId("fact-filter-F1").click();
      await expect(page.getByTestId("fact-filter-F1")).toHaveAttribute("aria-pressed", "true");
      const row = page.locator('[data-testid="ingredient-row"][data-chip="supported"]:visible').first();
      const outline = await row.evaluate((el) => `${getComputedStyle(el).outlineWidth} ${getComputedStyle(el).outlineStyle}`);
      expect(outline).toBe("2px solid");
      // ONE primary memo action: the in-page row on desktop, the dock on a phone (never both visible)
      const primary = phone ? page.getByTestId("dock-memo-menu-button") : page.getByTestId("memo-menu-button");
      await expect(primary).toBeVisible();
      await expect(phone ? page.getByTestId("memo-actions") : page.getByTestId("mb-dock")).toBeHidden();
      expect(await primary.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
      // the standing line stays in view on the result view
      await expect(page.getByTestId("standing-line")).toBeVisible();
    });

    base("New screening asks first (R1's three strings), Keep leaves the page as it was, Clear empties it; with nothing entered there is no question", async ({ page }) => {
      await arrange(page);
      await page.getByTestId("mb-new-screening").count(); // not on the intake view: the button lives with the result actions
      await screen(page);
      const open = async () => { if (phone) { const more = page.getByTestId("mb-dock-more-button"); if ((await more.getAttribute("aria-expanded")) !== "true") await more.click(); await page.getByRole("button", { name: MB.newScreening }).last().click(); } else await page.getByTestId("mb-new-screening").click(); };
      await open();
      const dlg = page.getByRole("alertdialog");
      await expect(dlg).toContainText(MB.newTitle);
      await expect(dlg).toContainText(MB.newBody);
      await expect(page.getByTestId("mb-confirm-keep")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dlg).toHaveCount(0);
      await expect(page.getByTestId("screening-result")).toBeVisible();
      await open();
      await page.getByTestId("mb-confirm-clear").click();
      await expect(page.getByTestId("screening-result")).toHaveCount(0);
      await expect(page.getByLabel("Paste the FIR, complaint or narrative")).toHaveValue("");
      await expect(page.locator("#page-title")).toBeFocused();
    });

    base("the summary line is the result's headline: serif and large (follow-up 1)", async ({ page }) => {
      await arrange(page);
      await screen(page);
      const f = await page.getByTestId("summary-text").first().evaluate((el) => ({ family: getComputedStyle(el).fontFamily, px: parseFloat(getComputedStyle(el).fontSize) }));
      expect(f.px).toBeGreaterThanOrEqual(20);
      expect(f.family.toLowerCase()).toMatch(/iowan|palatino|georgia|serif/);
    });

    if (phone) base("the phone dock never hides content: the last block clears the dock at the end of the page, and a focused last control scrolls above it (follow-up 2)", async ({ page }) => {
      await arrange(page);
      await screen(page);
      await page.evaluate(() => { const m = document.getElementById("main"); if (m) m.scrollTop = m.scrollHeight; window.scrollTo(0, document.documentElement.scrollHeight); });
      await page.waitForTimeout(300);
      const dockTop = (await page.getByTestId("mb-dock").boundingBox())!.y;
      const last = (await page.getByTestId("run-ids").boundingBox())!;
      expect(last.y + last.height, "the last line of the result is above the dock").toBeLessThanOrEqual(dockTop + 1);
      // a keyboard user tabbing to the last control: the browser scrolls it into view above the dock (scroll-padding-bottom)
      const factBtn = page.getByTestId("fact-filter-F1");
      await factBtn.focus();
      await page.waitForTimeout(300);
      const b = (await factBtn.boundingBox())!;
      expect(b.y + b.height, "the focused fact button is not under the dock").toBeLessThanOrEqual(dockTop + 1);
    });

    base("sidebar: 'This screening' block with in-page links, Result only after a result, Reference disclosure, the live paths", async ({ page }) => {
      await arrange(page);
      if (phone) await page.getByRole("button", { name: "Open navigation" }).click();
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav.getByRole("heading", { name: MB.screeningLabel })).toBeVisible();
      await expect(nav.getByRole("link", { name: MB.resultLabel, exact: true })).toHaveCount(0);
      await expect(nav.getByTestId("mb-group-reference")).toBeVisible();
      await expect(nav.getByTestId("mb-group-reference").getByRole("link", { name: "Data handling" })).toBeHidden();
      await nav.getByTestId("mb-group-reference").locator("summary").click();
      await expect(nav.getByTestId("mb-group-reference").getByRole("link", { name: "Data handling" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Citation check" })).toHaveAttribute("href", /\/citations/);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      if (!phone) expect(Math.round((await page.locator("#primary-navigation").boundingBox())!.width)).toBe(208);
      if (phone) await page.keyboard.press("Escape");
      await screen(page);
      if (phone) await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(nav.getByRole("link", { name: MB.resultLabel, exact: true })).toBeVisible();
      await expect(nav.getByTestId("mb-retention")).toHaveText(MB.retention);
      await expect(page.getByText("Recent screenings")).toHaveCount(0);
    });

    if (phone) base("phone drawer is a proper dialog: Tab stays inside, Esc closes and returns focus, the page behind is inert", async ({ page }) => {
      await arrange(page);
      const toggle = page.getByRole("button", { name: "Open navigation" });
      await toggle.click();
      await expect(page.locator("#primary-navigation")).toHaveAttribute("role", "dialog");
      await expect(page.locator("#main")).toHaveAttribute("inert", "");
      const seen: string[] = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        seen.push(await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}:${(a.getAttribute("aria-label") ?? a.textContent ?? "").trim().slice(0, 18)}` : "none"; }));
        const where = await page.evaluate(() => { const a = document.activeElement; return { inside: !!a && (!!a.closest("#primary-navigation") || a.getAttribute("aria-label") === "Close navigation"), what: a ? `${a.tagName} ${(a.getAttribute("aria-label") ?? a.textContent ?? "").trim().slice(0, 40)} ${a.id}` : "none" }; });
        expect(where.inside, `Tab stop ${i + 1} stays in the drawer (${where.what}) ORDER ${seen.join(" > ")}`).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
    });
  });
}
