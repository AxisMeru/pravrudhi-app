import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// The Matter workspace (Lead-2, 15 Oct; R1's strings): /screening has a step bar (Facts, Screen, Memo, Hearing preparation) with states; the nav says "Matter"; every old URL still works.
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const CID = "ipc415_property";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ANSWER = {
  run_id: "r-invented-ws", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] }],
};

async function setup(page: import("@playwright/test").Page) {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => r.fulfill({ json: ANSWER }));
}

test("the step bar: states before facts, with facts, and with a result; the locked steps say why", async ({ page }) => {
  await setup(page);
  await page.goto("/screening");
  await expect(page.getByRole("heading", { name: "Matter workspace", exact: true })).toBeVisible();
  const bar = page.getByTestId("workspace-steps");
  await expect(bar.locator("li")).toHaveCount(4);
  await expect(bar.getByTestId("step-facts")).toContainText("Facts");
  const state = (k: string) => page.getByTestId(`step-state-${k}`);
  await expect(state("facts")).toHaveText("Available");
  await expect(state("screen")).toHaveText("Available");
  await expect(state("memo")).toHaveText("Not yet");
  await expect(page.getByTestId("step-note-memo")).toHaveText("Available after a screening result.");
  await expect(state("hearing")).toHaveText("Not yet");
  await expect(page.getByTestId("step-note-hearing")).toHaveText("Available after a screening result.");
  await expect(page.getByTestId("step-link-memo")).toHaveCount(0); // a step that is not available is not a link
  // facts typed
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await expect(state("facts")).toHaveText("Done");
  // a result
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(state("screen")).toHaveText("Done");
  await expect(state("memo")).toHaveText("Available");
  await expect(page.getByTestId("step-note-memo")).toHaveCount(0);
  await expect(page.getByTestId("step-link-memo")).toHaveAttribute("href", "#step-memo");
  await expect(page.locator("#step-memo")).toBeVisible();
  await expect(page.getByTestId("step-state-hearing")).toHaveText("Available");
  await expect(page.getByTestId("step-link-hearing")).toHaveAttribute("href", "#step-hearing");
  await expect(page.locator("#step-hearing")).toBeVisible();
});

test("every old address still works: /screening, /screening?example=…, and anonymous (no session) visits", async ({ page }) => {
  await setup(page);
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
  for (const url of ["/screening", "/screening?example=madras-public-order-2024", "/screening?example=karnataka-cheating-2025"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Matter workspace", exact: true })).toBeVisible();
    await expect(page.getByTestId("workspace-steps")).toBeVisible();
    await expect(page).toHaveTitle("Matter workspace · Pravrudhi-Nyaya");
  }
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).not.toHaveValue("");
});

test("the nav entry and the command palette say 'Matter' and go to /screening", async ({ page }) => {
  await page.goto("/guide");
  const link = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Matter", exact: true });
  await expect(link).toHaveAttribute("href", "/screening");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Screening", exact: true })).toHaveCount(0);
});

test("/workflows: each Built row links to its step in the workspace; a Building row has no link; the rows keep their structure", async ({ page }) => {
  await page.goto("/workflows");
  const rows = page.getByTestId("workflow-row");
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const badge = (await row.locator("span").last().textContent())?.trim();
    const link = row.getByTestId("workflow-open");
    if (badge === "Built") {
      await expect(link).toHaveCount(1);
      if (/^Intake/.test((await row.locator("div > div").first().textContent()) ?? "")) {
        await expect(link).toHaveAttribute("href", "/intake");
        await expect(link).toHaveText("Open Intake");
      } else {
        await expect(link).toHaveAttribute("href", /^\/screening#step-(screen|memo|hearing)$/);
        await expect(link).toHaveText("Open in Matter workspace");
      }
    } else {
      expect(badge).toBe("Building");
      await expect(link).toHaveCount(0);
    }
    // the gate's structure: the name in the first inner div, the status badge in a span
    await expect(row.locator("div > div").first()).not.toHaveText("");
  }
  const built = rows.filter({ hasText: "Memo preparation" });
  await built.getByTestId("workflow-open").click();
  await expect(page).toHaveURL(/\/screening\/?#step-memo$/);
});

// R1 (15 Oct): the standing line is in view ONCE in each state: once at the top of the page before a result, once above the first block with a result, never twice.
test("the standing line appears exactly once before a result and exactly once with a result", async ({ page }) => {
  await setup(page);
  await page.goto("/screening");
  const line = page.getByText("This is a screening aid, not legal advice. A lawyer decides.", { exact: true });
  await expect(page.getByTestId("workspace-steps")).toBeVisible();
  await expect(line).toHaveCount(1);
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(line).toHaveCount(1);
  // above the first block: it comes before the checklist in the page
  const before = await page.evaluate(() => {
    const l = document.querySelector('[data-testid="screening-result"] [data-testid="standing-line"]');
    const c = document.querySelector('[data-testid="checklist"]');
    return !!l && !!c && (l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(before).toBe(true);
});

// R2 (#224): the /workflows link goes through next/link, which adds the build's base path (a plain anchor would 404 on a base-path build).
test("the /workflows link is a next/link (base-path aware)", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = readFileSync(join(__dirname, "..", "src", "components", "WorkflowRows.tsx"), "utf8");
  expect(src).toContain('import Link from "next/link"');
  expect(src).toMatch(/<Link href=\{workflowLink\(/);
  expect(src).not.toMatch(/<a href=\{/);
});

// R2 (#216 note): the example banner (a court's name, "example only") shows only while the facts are the loaded example, unchanged.
test("the example banner is shown while the facts are the example's, gone once a fact is edited, back if restored", async ({ page }) => {
  await setup(page);
  await page.goto("/screening?example=madras-public-order-2024");
  const f1 = page.getByRole("textbox", { name: "Fact F1", exact: true });
  await expect(f1).not.toHaveValue("");
  const original = await f1.inputValue();
  await expect(page.getByTestId("example-banner")).toBeVisible();
  await f1.fill(`${original} (edited)`);
  await expect(page.getByTestId("example-banner")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("A public court order, example only.");
  await f1.fill(original);
  await expect(page.getByTestId("example-banner")).toBeVisible();
});

// #232: a /workflows link to Memo or Hearing preparation lands on a line that says why there is nothing yet; once there is a result the real section takes the anchor (one element per id).
test("the Memo and Hearing preparation anchors carry a note before a result and give way to the real sections after", async ({ page }) => {
  await setup(page);
  for (const [id, key] of [["step-memo", "locked-memo"], ["step-hearing", "locked-hearing"]] as const) {
    await page.goto(`/screening#${id}`);
    const note = page.getByTestId(key);
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute("id", id);
    await expect(note).toContainText("Available after a screening result.");
  }
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("locked-steps")).toHaveCount(0);
  await expect(page.locator("#step-memo")).toHaveCount(1);
  await expect(page.locator("#step-hearing")).toHaveCount(1);
});

// #248: the /workflows links to Memo and Hearing preparation must leave the locked line IN VIEW. The browser scrolls to the hash before the offence list has loaded; the list then pushes the line down the page.
test("a #step-memo / #step-hearing link ends with the locked line in view, even when the offence list loads late", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.route("**/api/nyaya/registry/contracts", async (r) => { await new Promise((res) => setTimeout(res, 600)); await r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }); });
  for (const [id, key] of [["step-memo", "locked-memo"], ["step-hearing", "locked-hearing"]] as const) {
    await page.goto("/workflows");
    await page.locator(`a[href="/screening#${id}"]`).click();
    await expect(page.getByTestId(key)).toBeVisible();
    await expect(page.getByTestId("offence-list")).toBeVisible();
    await expect.poll(async () => page.getByTestId(key).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }), { message: `${key} is in view`, timeout: 5000 }).toBe(true);
  }
});

// #275 (Track A's rehearsal: the #249 scroll landed 6 px short 4/30 times): content that arrives ABOVE the target after the scroll must not leave it out of view. The test lets the page settle on the locked line, then adds 160 px of
// content above it (as a late identity read or provider line does); the line must be back in view without the visitor doing anything. It fails without the settle-follow.
test("a #step-memo / #step-hearing link keeps the locked line in view when content grows above it after the scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  for (const [id, key] of [["step-memo", "locked-memo"], ["step-hearing", "locked-hearing"]] as const) {
    await page.goto("/workflows");
    await page.locator(`a[href="/screening#${id}"]`).click();
    const inView = () => page.getByTestId(key).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    await expect.poll(inView, { message: `${key} in view first`, timeout: 5000 }).toBe(true);
    await page.evaluate(() => { const d = document.createElement("div"); d.style.height = "160px"; d.setAttribute("data-testid", "late-content"); document.getElementById("step-facts")!.prepend(d); });
    await expect.poll(inView, { message: `${key} back in view after late content`, timeout: 5000 }).toBe(true);
  }
});
