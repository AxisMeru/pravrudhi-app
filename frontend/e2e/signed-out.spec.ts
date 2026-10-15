import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// 12 Oct: a page load that saw GET /api/me answer 401 still sent the facts, and the engine served them as an anonymous demo call. Nothing is sent while the engine says signed out;
// the anonymous demo starts only from the user's own button.
const REGISTRY = "**/api/nyaya/registry/contracts";
const CID = "ipc415_property";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ANSWER = {
  run_id: "r-invented-auth", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{
    contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }],
  }],
};

async function setup(page: import("@playwright/test").Page, meStatus: number) {
  const posts: string[] = [];
  let meCalls = 0;
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/me", (r) => { meCalls += 1; return r.fulfill({ status: meStatus, json: meStatus === 200 ? { edition: "Pravrudhi", tagline: "t", access: "member", authenticated: true } : { error: "unauthenticated" } }); });
  await page.route("**/api/v1/analyse-facts**", (r) => { posts.push(r.request().url()); return r.fulfill({ json: ANSWER }); });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  return { posts, me: () => meCalls };
}

test("signed out (/api/me 401): Screening sends nothing, says so, and offers sign-in or the anonymous demo", async ({ page }) => {
  const s = await setup(page, 401);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const notice = page.getByTestId("not-signed-in");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText("You are not signed in, so nothing has been sent.");
  await expect(notice).toContainText("what you submit is kept for up to 7 days");
  await expect(page.getByTestId("not-signed-in-signin")).toHaveAttribute("href", "/signin");
  expect(s.posts, "no analyse-facts request while signed out").toEqual([]);
  expect(s.me(), "the session was looked at more than once, a bounded number of times").toBeGreaterThan(1);
  expect(s.me()).toBeLessThanOrEqual(12);
});

test("signed out: only the user's own button starts the anonymous demo", async ({ page }) => {
  const s = await setup(page, 401);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
  expect(s.posts).toEqual([]);
  await page.getByTestId("not-signed-in-anonymous").click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  expect(s.posts).toHaveLength(1);
});

test("signed in (/api/me 200): the facts are sent at once, with no notice", async ({ page }) => {
  const s = await setup(page, 200);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
  expect(s.posts).toHaveLength(1);
  await expect(page.getByTestId("not-signed-in")).toHaveCount(0);
});

test("signed out (/api/me 401): the Matters page also sends nothing and offers the same choice", async ({ page }) => {
  const posts: string[] = [];
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["bns69"], entries: [{ id: "bns69", validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
  await page.route("**/api/v1/analyse-facts**", (r) => { posts.push(r.request().url()); return r.fulfill({ status: 500, json: {} }); });
  await page.goto("/matters");
  const group = page.getByRole("group", { name: "Contracts to check against" });
  await group.locator("label").filter({ hasText: "BNS 69" }).first().click({ force: true });
  await page.getByLabel("Facts (one per line)").fill(F1);
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
  expect(posts).toEqual([]);
  await expect(page.getByTestId("not-signed-in-anonymous")).toBeVisible();
});

test("/api/me answering 503: nothing is sent, the page says it could not check, and there is no anonymous button", async ({ page }) => {
  const s = await setup(page, 503);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("screening-error")).toContainText("We could not check your sign-in, so nothing was sent.", { timeout: 15_000 });
  await expect(page.getByTestId("not-signed-in-anonymous")).toHaveCount(0);
  expect(s.posts).toEqual([]);
});

// R1, 14 Oct (P2): while the page re-checks sign-in the button reads exactly "Checking whether you are signed in…", disabled, with NO Cancel (nothing is in flight);
// "Screening…" and Cancel appear only once a request really is.
const CHECKING = "Checking whether you are signed in…";

test("signed out: during the re-check the button says it is checking, is disabled, has no Cancel and never says Screening", async ({ page }) => {
  const s = await setup(page, 401);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  const checking = page.getByRole("button", { name: CHECKING, exact: true });
  await expect(checking).toBeVisible();
  await expect(checking).toBeDisabled();
  await expect(page.getByTestId("screening-cancel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Screening…" })).toHaveCount(0);
  await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
  expect(s.posts, "nothing is sent").toEqual([]);
  await expect(page.getByRole("button", { name: "Screen these facts" })).toBeEnabled();
  await expect(page.getByRole("button", { name: CHECKING })).toHaveCount(0);
});

test("signed in: once the request is really in flight the button reads Screening… and Cancel appears", async ({ page }) => {
  await page.route(REGISTRY, (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/me", (r) => r.fulfill({ json: { edition: "Pravrudhi", tagline: "t", access: "member", authenticated: true } }));
  let release: () => void = () => {};
  const held = new Promise<void>((res) => { release = res; });
  await page.route("**/api/v1/analyse-facts**", async (r) => { await held; await r.fulfill({ json: ANSWER }); });
  await page.goto("/screening");
  await page.getByLabel("Paste the FIR, complaint or narrative").fill(F1);
  await page.getByTestId("split-facts").click();
  await page.getByText("Cheating", { exact: false }).first().click();
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByRole("button", { name: "Screening…" })).toBeVisible();
  await expect(page.getByTestId("screening-cancel")).toBeVisible();
  await expect(page.getByRole("button", { name: CHECKING })).toHaveCount(0);
  release();
  await expect(page.getByTestId("checklist")).toBeVisible();
});

test("the anonymous demo skips the check: its request is in flight at once (Screening…, no checking label)", async ({ page }) => {
  const s = await setup(page, 401);
  await page.getByRole("button", { name: "Screen these facts" }).click();
  await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("not-signed-in-anonymous").click();
  await expect(page.getByRole("button", { name: CHECKING })).toHaveCount(0);
  await expect(page.getByTestId("checklist")).toBeVisible();
  expect(s.posts).toHaveLength(1);
});
