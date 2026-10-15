import { expect, test } from "./support/engineTest";
import { sha } from "./support/sha";

// #194: the anonymous front door. A signed-out visitor on an example link gets the registry's 401 (auth-required engine) or a 404 (a host with no such route), so no contract list arrives;
// the example's own offences are still offered and selected, Screen asks for sign-in or the anonymous demo (not "Pick at least one offence"), and the demo returns a result.
const CHEATING = "ipc415_property";
const F1 = "Invented: Ravi told Meena the toy lorry was his own and sold it to her for 500.";
const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
const ANSWER = {
  run_id: "r-invented-anon-example", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
  facts: [{ id: "F1", sha256: sha(F1) }],
  contracts: [{ contract_id: CHEATING, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
    elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "established", p_established: 0.9, p_established_second: 0.8, fact_id: "F1", quote_source: "whole_fact" }] }],
};

for (const [name, status, body] of [["401 Missing bearer token", 401, { detail: "Missing bearer token" }], ["404 no such route", 404, { detail: "Not Found" }]] as const) {
  test(`signed out, registry answers ${name}: the example's offences are selected and Screen reaches sign-in/anonymous demo and a result`, async ({ page }) => {
    const posts: string[] = [];
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ status, json: body }));
    await page.route("**/api/nyaya/registry/entries", (r) => r.fulfill({ status, json: body }));
    await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
    await page.route("**/api/v1/analyse-facts**", (r) => { posts.push(r.request().postData() ?? ""); return r.fulfill({ json: ANSWER }); });
    await page.goto("/screening?example=madras-public-order-2024");
    await expect(page.getByTestId("offence-list")).toBeVisible();
    await expect(page.getByTestId("contracts-error")).toHaveCount(0);
    await expect(page.getByRole("checkbox", { checked: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Screen these facts" }).click();
    await expect(page.getByTestId("not-signed-in")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText("Pick at least one offence");
    expect(posts).toEqual([]);
    await page.getByTestId("not-signed-in-anonymous").click();
    await expect(page.getByTestId("checklist").first()).toBeVisible();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain("ipc405_misappropriation");
    expect(posts[0]).toContain("ipc415_property");
  });
}

test("signed out, registry answers 500: the usual error, nothing preselected", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ status: 500, json: { detail: "boom" } }));
  await page.route("**/api/me", (r) => r.fulfill({ status: 401, json: { error: "unauthenticated" } }));
  await page.goto("/screening?example=madras-public-order-2024");
  await expect(page.getByTestId("contracts-error")).toBeVisible();
});
