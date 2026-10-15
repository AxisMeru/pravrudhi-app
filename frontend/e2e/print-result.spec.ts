import { expect, test } from "./support/engineTest";
import contractElements from "../src/lib/fixtures/contractElements.json";
import { sha } from "./support/sha";

// #204 (R1, explorer result review): printing a result (Print / save as PDF) used to give ONE page: the app shell is a viewport-height scroll container, so everything below the first
// screen was cut, and the printout carried the facts form, the offence list and the floating Shortcuts button. In print media the whole result flows over as many pages as it needs.
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const IDS = ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc415_property", "ipc415_damaging_act"];
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const els = contractElements.contracts as unknown as Record<string, string[] | { elements?: string[] }>;
const elementsOf = (id: string): string[] => {
  const c = els[id];
  const list = Array.isArray(c) ? c : (c?.elements ?? []);
  return list.map((x) => (typeof x === "string" ? x : (x as { text: string }).text));
};
const ANSWER = {
  run_id: "r-invented-print", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: IDS.map((id) => ({
    contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: elementsOf(id).map((element) => ({ ...base, element, status: "not_established", p_established: 0.2, p_established_second: 0.2, fact_id: null, quote_source: null })),
  })),
};

test("print media: the whole result prints (more than one page), the form and the Shortcuts button do not", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "page.pdf is Chromium only");
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: IDS, entries: IDS.map((id) => ({ id, validated: true })) } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: ANSWER }));
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/screening?example=madras-public-order-2024");
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist").first()).toBeVisible();
  await expect(page.getByTestId("checklist")).toHaveCount(5);
  await page.emulateMedia({ media: "print" });
  // nothing that is a control or a form is printed
  await expect(page.getByRole("region", { name: "Facts" })).toBeHidden();
  await expect(page.getByTestId("memo-actions")).toBeHidden();
  await expect(page.getByRole("button", { name: /shortcuts/i })).toBeHidden();
  await expect(page.getByTestId("example-entry")).toHaveCount(0);
  // the shell no longer clips: the document is as tall as its content and main does not scroll
  const m = await page.evaluate(() => {
    const main = document.getElementById("main")!;
    const last = Array.from(document.querySelectorAll('[data-testid="checklist"]')).pop()!;
    return { overflow: getComputedStyle(main).overflowY, docH: document.documentElement.scrollHeight, lastBottom: last.getBoundingClientRect().bottom + window.scrollY, vh: window.innerHeight };
  });
  expect(m.overflow).toBe("visible");
  expect(m.docH).toBeGreaterThan(m.vh * 2);
  expect(m.lastBottom).toBeLessThanOrEqual(m.docH + 1);
  // and a real print rendering is more than one page
  const pdf = await page.pdf({ format: "A4" });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
  expect(pages).toBeGreaterThan(1);
});
