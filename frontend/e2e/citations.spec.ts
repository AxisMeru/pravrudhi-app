import { expect, test } from "./support/engineTest";

// The existence-only build (NEXT_PUBLIC_CITATION_EXISTENCE_ONLY=1) has its own spec: citations-existence.spec.ts.
test.skip(process.env.CITATION_EXISTENCE_BUILD === "1", "the existence-only build is covered in citations-existence.spec.ts");

/**
 * The citation check (#539), against RECORDED engine answers (page.route), not an index: the preview label, the status shown verbatim
 * with the engine's note, the signed wording for each coded refusal, and that the page never says the word "fake".
 */
const NOTES: Record<string, string> = {
  VERIFIED: "The citation resolves to an indexed case and the quote appears in its text.",
  EXISTS_QUOTE_NOT_FOUND: "The citation resolves to an indexed case but the quote was not found in its text.",
  NOT_IN_INDEX: "The case was not found in our index. That does not show whether the citation is real: the index does not hold every judgment.",
  MALFORMED: "Exactly one parseable citation is required.",
  CONFLICT: "The citation maps to conflicting indexed cases; verify by hand.",
};

// #128 D2: with the nav flag OFF (the hosted build) /citations has no form; every spec that uses the form runs only against a NEXT_PUBLIC_CITATION_NAV=1 build (CITATION_NAV_BUILD=1).
const NEEDS_FORM = "needs a build with NEXT_PUBLIC_CITATION_NAV=1 (the form exists only then)";

// #128 D4: NOT_IN_INDEX is shown as "Not found in our index"; every other status as the engine sent it.
const shown = (status: string) => (status === "NOT_IN_INDEX" ? "Not found in our index" : status);

async function run(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/citations");
  await page.getByLabel("Citation (one)").fill("(2099) 1 SCC 1");
  await page.getByLabel("Quote to look for").fill("a quoted passage");
  await page.getByRole("button", { name: "Check" }).click();
}

test("the page carries the preview label and says what the check is not", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", NEEDS_FORM);
  await page.goto("/citations");
  await expect(page.getByTestId("citation-preview-label")).toHaveText("preview: existence check only");
  await expect(page.getByTestId("citation-limits")).toHaveText(
    "The check looks for the case in our index and for the quote in its text, word for word apart from line breaks, quote marks, dashes and spacing. It does not say whether the case supports a point. If the case is not found in our index, that does not show whether the citation is real, because the index does not hold every judgment. This check is not yet served in the hosted deployment.",
  );
  await expect(page.getByText(/\bfake\b/i)).toHaveCount(0);
});

for (const [status, note] of Object.entries(NOTES)) {
  test(`${status} is shown verbatim${note.includes("fake") ? "; the engine note with the word \"fake\" is withheld" : " with the engine's note"}`, async ({ page }) => {
    test.skip(process.env.CITATION_NAV_BUILD !== "1", NEEDS_FORM);
    let body: unknown = null;
    await page.route("**/api/v1/verify-citations", (r) => {
      body = r.request().postDataJSON();
      return r.fulfill({ json: { result: status, note, status: status.toLowerCase(), label: status, verified: status === "VERIFIED", preview: true } });
    });
    await run(page);
    await expect(page.getByTestId("citation-status")).toHaveText(shown(status));
    if (note.includes("fake")) await expect(page.getByTestId("citation-note")).toHaveCount(0);
    else await expect(page.getByTestId("citation-note")).toHaveText(note);
    await expect(page.getByText(/\bfake\b/i)).toHaveCount(0);
    expect(body).toEqual({ citation: "(2099) 1 SCC 1", quote: "a quoted passage" });
  });
}

test("an engine note carrying the word \"fake\" is withheld, the status still shown", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", NEEDS_FORM);
  await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ json: { result: "NOT_IN_INDEX", note: "Not a finding that the citation is fake.", status: "not_in_index", label: "not in index", verified: false, preview: true } }));
  await run(page);
  await expect(page.getByTestId("citation-status")).toHaveText("Not found in our index"); // #128 D4: the code token is never on screen
  await expect(page.getByTestId("citation-note")).toHaveCount(0);
});

test("the coded refusals show the signed wording", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", NEEDS_FORM);
  const cases: Array<[string, number, Record<string, string>, string]> = [
    ["verify_timeout", 503, {}, "The citation check did not finish in time, so no result was returned. Try again later."],
    ["verify_at_capacity", 503, { "retry-after": "5" }, "The citation check is busy, so no result was returned. Try again in about 5 seconds."],
    ["citation_index_unavailable", 503, {}, "The citation index is not available, so this citation was not checked."],
  ];
  for (const [code, status, headers, text] of cases) {
    await page.unroute("**/api/v1/verify-citations").catch(() => {});
    await page.route("**/api/v1/verify-citations", (r) => r.fulfill({ status, headers, json: { error: code } }));
    await run(page);
    await expect(page.getByTestId("citation-error")).toHaveText(text);
    await expect(page.getByTestId("citation-result")).toHaveCount(0);
  }
});

test("empty inputs send no request", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", NEEDS_FORM);
  let calls = 0;
  await page.route("**/api/v1/verify-citations", (r) => {
    calls += 1;
    return r.fulfill({ json: { result: "VERIFIED", note: "", status: "verified", label: "verified", verified: true, preview: true } });
  });
  await page.goto("/citations");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("citation-error")).toHaveText("Enter one citation.");
  expect(calls).toBe(0);
});

test("the citation check is not in the nav until the build turns it on, and the page still opens by URL", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD === "1", "the nav-on build is covered in citations-product-status.spec.ts");
  await page.goto("/screening");
  await expect(page.getByRole("link", { name: "Matter", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Citation check" })).toHaveCount(0);
  await page.goto("/citations");
  await expect(page.getByTestId("citation-not-offered")).toBeVisible(); // the gated state (Lead-2, 15 Oct): a notice, not the form
});

test("the product status fields are wired but OFF: an engine that sends them changes nothing on the page in this build", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD !== "1", NEEDS_FORM);
  await page.route("**/api/v1/verify-citations", (r) =>
    r.fulfill({ json: { result: "NOT_IN_INDEX", note: NOTES.NOT_IN_INDEX, status: "not_in_index", label: "not in index", preview: true, verified: false } }),
  );
  await run(page);
  await expect(page.getByTestId("citation-status")).toHaveText("Not found in our index"); // #128 D4: the code token is never on screen
  await expect(page.getByTestId("citation-note")).toHaveText(NOTES.NOT_IN_INDEX);
  await expect(page.getByTestId("citation-product-status")).toHaveCount(0);
});

test("flag off (the hosted build): /citations is a notice and a way back to Screening: no form, no preview label, no 'not yet served'", async ({ page }) => {
  test.skip(process.env.CITATION_NAV_BUILD === "1", "the flag-on build has the form");
  await page.goto("/citations");
  await expect(page.getByTestId("citation-not-offered")).toHaveText("A citation check is not offered in this version of the app.");
  await expect(page.getByTestId("citation-not-offered-link")).toHaveAttribute("href", "/screening");
  await expect(page.getByLabel("Citation (one)")).toHaveCount(0);
  await expect(page.getByLabel("Quote to look for")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check" })).toHaveCount(0);
  await expect(page.getByTestId("citation-preview-label")).toHaveCount(0);
  await expect(page.getByTestId("citation-limits")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/not yet served|index is not available/i);
  await page.getByTestId("citation-not-offered-link").click();
  await expect(page).toHaveURL(/\/screening\/?$/);
});

// #223 (R2, 15 Oct): the signed-out probe belongs to the existence-only page. With that flag off, /citations makes no identity request of its own: the site-wide callers (edition, notifications) hit /api/me on every page, so the pin compares it with a page that has no citation code.
test("with the existence-only flag off, /citations makes no /api/me request beyond the site-wide ones", async ({ page }) => {
  const count = async (path: string) => {
    let n = 0;
    const on = (r: import("@playwright/test").Request) => { if (new URL(r.url()).pathname === "/api/me") n += 1; };
    page.on("request", on);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    page.off("request", on);
    return n;
  };
  const baseline = await count("/data-handling");
  expect(await count("/citations")).toBeLessThanOrEqual(baseline);
});
