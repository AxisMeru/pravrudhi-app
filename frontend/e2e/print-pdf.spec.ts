import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";
import { EXAMPLES } from "../src/lib/demo/example";
import contractElements from "../src/lib/fixtures/contractElements.json";
import { blockTitle } from "../src/lib/screening/offences";
import { CAVEATS } from "../src/lib/surfaceCopy";

/**
 * Print / "PDF" of a result (explorer, 15 Oct: local-lane review R1, "the printout ends at the first screen"). A real Madras example, five contracts, an invented engine answer
 * (page.route; no judge). Under print media the whole result must flow onto the paper: every block title is visible and not clipped by a scroll container, the form, the
 * consent line, the run buttons and the Shortcuts button are not printed, and the PDF has more than one page.
 */
const EXAMPLE = EXAMPLES[0];
const IDS = ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc415_property", "ipc415_damaging_act"];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const cleaned = EXAMPLE.facts.map((f) => f.replace(/\s*\n\s*/g, " ").trim());
const ANSWER = {
  run_id: "r-invented-print", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: cleaned.map((f) => ({ id: `F${cleaned.indexOf(f) + 1}`, sha256: sha(f) })),
  contracts: IDS.map((id) => ({
    contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: (contractElements.contracts as Record<string, { elements: string[] }>)[id].elements.map((element, i) => ({ ...base, element, status: i === 0 ? "established" : "not_established", p_established: i === 0 ? 0.9 : 0.1, p_established_second: i === 0 ? 0.8 : null, fact_id: i === 0 ? "F1" : null, quote_source: i === 0 ? "whole_fact" : null })),
  })),
};

test("print: every block of a five-contract result is on the paper, with the facts screened and the caveat strip; the form, consent, run buttons and Shortcuts are not", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "page.pdf is Chromium only");
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: IDS, entries: IDS.map((id) => ({ id, validated: true })) } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: ANSWER }));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/screening?example=${EXAMPLE.id}`);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toHaveCount(IDS.length);

  await page.emulateMedia({ media: "print" });
  // not printed
  await expect(page.getByLabel("Facts", { exact: true }).first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Screen these facts" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Run with the screening assistant" })).toBeHidden();
  await expect(page.getByRole("button", { name: /Shortcuts/ })).toBeHidden();
  await expect(page.getByTestId("memo-actions")).toBeHidden();
  // printed: the facts the result was run on, then every block
  await expect(page.getByTestId("print-facts")).toBeVisible();
  // the limits travel with the paper: "How to read this analysis" (including the validated-list / validation paragraph) is printed, the navigation is not
  await expect(page.getByTestId("caveat-strip")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  for (const id of IDS) await expect(page.getByRole("heading", { name: blockTitle(id), exact: true })).toBeVisible();

  // nothing is clipped: no ancestor that scrolls or hides overflow ends above the bottom of any block title
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="checklist"] h2')].filter((h) => {
      const r = h.getBoundingClientRect();
      for (let e = h.parentElement; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowY) && r.bottom > e.getBoundingClientRect().bottom + 1) return true;
      }
      return false;
    }).map((h) => h.textContent),
  );
  expect(clipped, "block titles cut off by a scroll container in print media").toEqual([]);

  // the PDF itself: more than one page (the old printout was exactly one), and, where pdftotext exists, every title is in it
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages, "the PDF has a single page: the result is cut at the first screen").toBeGreaterThan(1);
  const file = join(tmpdir(), `print-${process.pid}.pdf`);
  writeFileSync(file, pdf);
  let text: string | null = null;
  try { text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }); } catch { text = null; }
  if (text !== null) {
    const flat = text.replace(/\s+/g, " ");
    for (const id of IDS) expect(flat, `the PDF lacks the title of ${id}`).toContain(blockTitle(id).replace(/\s+/g, " "));
    for (const c of CAVEATS) expect(flat, `the PDF lacks the caveat "${c.text.slice(0, 40)}..."`).toContain(c.text.replace(/\s+/g, " "));
    expect(flat, "the PDF lacks the validation paragraph").toMatch(/validated/);
    for (const f of cleaned) expect(flat, "the PDF lacks a submitted fact").toContain(f.slice(0, 60));
  }
});
