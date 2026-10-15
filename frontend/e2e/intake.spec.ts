import { expect, test } from "./support/engineTest";

// Intake (#414/#430) against a recorded engine answer with INVENTED text: paste, facts come back, choose up to 8, send to Screening. Runs only in the intake-flag build
// (NEXT_PUBLIC_INTAKE=1, INTAKE_BUILD=1); the normal build sends this route back to Workflows.
test.skip(process.env.INTAKE_BUILD !== "1", "needs the NEXT_PUBLIC_INTAKE=1 build");

const FACTS = Array.from({ length: 10 }, (_, i) => ({ id: `F${i + 1}`, text: `Invented fact number ${i + 1}: the buyer paid a sum for goods that were never delivered.`, status: "span" }));
const ANSWER = {
  run_id: "nyaya-intake-invented00",
  client_data: true,
  bundle: {
    clean_status: "cleaned",
    facts: FACTS,
    not_citable: [{ status: "duplicate", reason: "same text as an earlier fact" }],
    citations: [{ text: "Invented v. Sample (2000) 1 SCC 1", verifier_status: "NOT_IN_INDEX", fact_ids: ["F1"] }],
  },
};

test("intake returns facts; the choice is capped at 8; the chosen facts reach Screening", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: ANSWER }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await expect(page.getByTestId("intake-data-line")).toHaveText("The text you paste is read by the engine only; no model reads it on this page. The facts you choose are sent on to Screening, where models read them.");
  await expect(page.getByTestId("intake-caveats").locator("li").first()).toContainText("Intake leaves out the heading of a court order.");
  await page.getByLabel("Paste the text").fill(FACTS.map((f) => f.text).join("\n\n"));
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("fact-selector")).toBeVisible();
  await expect(page.getByTestId("selector-limit-line")).toHaveText("Intake found 10 facts. Screening takes up to 8 at a time: choose the ones that matter.");
  // more than 8 facts: nothing is ticked to start (the user chooses on purpose)
  await expect(page.getByTestId("selector-counter")).toHaveText("0 of 8 chosen");
  for (let i = 0; i < 8; i++) await page.getByTestId(`pick-${i}`).check();
  await expect(page.getByTestId("selector-counter")).toHaveText("8 of 8 chosen");
  // the ninth tick is refused, with R1's words; unticking one makes room
  await page.getByTestId("pick-8").check({ force: true }).catch(() => {});
  await expect(page.getByTestId("selector-over-limit")).toHaveText("Choose up to 8, or screen in more than one round.");
  await expect(page.getByTestId("pick-8")).not.toBeChecked();
  await page.getByTestId("pick-0").uncheck();
  await expect(page.getByTestId("selector-counter")).toHaveText("7 of 8 chosen");
  await expect(page.getByTestId("citation-line")).toHaveText("Not found in our index: this does not show whether the citation is real");
  await expect(page.getByTestId("intake-limit")).toHaveText("Intake only joins broken lines, removes repeated page headers and tidies spacing; it never changes a number.");
  await page.getByTestId("selector-screen").click();
  await expect(page).toHaveURL(/\/screening\/?$/);
  await expect(page.getByRole("textbox", { name: "Fact F1", exact: true })).toHaveValue(FACTS[1].text);
  await expect(page.getByRole("textbox", { name: "Fact F7", exact: true })).toHaveValue(FACTS[7].text);
});

test("an empty choice is not screened and says so", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: ANSWER }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented text.\n\nMore invented text.");
  await page.getByTestId("intake-run").click();
  for (let i = 0; i < 8; i++) await page.getByTestId(`pick-${i}`).uncheck();
  await page.getByTestId("selector-screen").click();
  await expect(page.getByTestId("selector-empty")).toHaveText("Choose at least one fact to screen.");
});

// R1 (14 Oct): what intake left out is said under the list whenever n > 0; the numbers line only when a left-out line has a digit; nothing when n = 0.
for (const [name, notCitable, cleaned, expectNote, expectDigits] of [
  ["n = 0: no notice", [], "Invented text.", false, false],
  ["n > 0 without a digit", [{ status: "caption", cleaned_start: 0, cleaned_end: 14 }], "HEADING OF THE INVENTED ORDER and text.", true, false],
  ["a caption with a date only: the count, no digit line", [{ status: "caption", cleaned_start: 0, cleaned_end: 22 }], "HEADING DATED 2000 and invented text.", true, false],
  ["n > 0 with a digit in a repeated line", [{ status: "repeated_line", cleaned_start: 0, cleaned_end: 6 }], "Page 7 and invented text.", true, true],
  ["a span with no status fires the digit line", [{ cleaned_start: 0, cleaned_end: 6 }], "Heading and invented text.", true, true],
] as const) {
  test(`left-out notice: ${name}`, async ({ page }) => {
    await page.route("**/api/v1/intake", (r) => r.fulfill({ json: { ...ANSWER, bundle: { ...ANSWER.bundle, facts: FACTS.slice(0, 2), cleaned, not_citable: notCitable } } }));
    await page.goto("/intake");
    await page.getByLabel("Paste the text").fill("Invented text.\n\nMore invented text.");
    await page.getByTestId("intake-run").click();
    await expect(page.getByTestId("fact-selector")).toBeVisible();
    await expect(page.getByTestId("selector-renumber")).toHaveText("Screening numbers the facts you choose again, from F1.");
    await expect(page.getByTestId("intake-left-out")).toHaveCount(expectNote ? 1 : 0);
    await expect(page.getByTestId("intake-left-out-digits")).toHaveCount(expectDigits ? 1 : 0);
    if (expectNote) await expect(page.getByTestId("intake-left-out")).toContainText("1 passage was left out: the heading, repeated lines or lines with no words.");
  });
}


// R2 (#227): the citations Intake found are listed in Hearing preparation ("Found in the text you pasted") only while the screened facts are the facts Intake handed over.
test("Hearing preparation lists Intake's citations only while the facts are the handed-over ones", async ({ page }) => {
  const CID = "ipc415_property";
  const base = { is_denial: false, screening_signal: null, citation_note: null, claimed: true, start: null, end: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote: null, quote_check: null };
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: ANSWER }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [CID], entries: [{ id: CID, validated: true }] } }));
  await page.route("**/api/v1/analyse-facts**", (r) => {
    const sent = (r.request().postDataJSON() as { facts: Array<string | { text?: string }> }).facts.map((f) => (typeof f === "string" ? f : (f.text ?? "")));
    return r.fulfill({ json: {
      run_id: "r-invented-intake-hp", judge: "invented", score_sha256: "a".repeat(64), provenance: "invented", retention_notice: "invented retention notice",
      facts: sent.map((t, i) => ({ id: `F${i + 1}`, sha256: String(i + 1).repeat(64).slice(0, 64) })),
      contracts: [{ contract_id: CID, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null,
        elements: [{ ...base, element: "deceives another person, whether by affirmative misrepresentation or by dishonest concealment of facts", status: "not_established", p_established: 0.2, p_established_second: 0.2, fact_id: null, quote_source: null }] }],
    } });
  });
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill(FACTS.map((f) => f.text).join("\n\n"));
  await page.getByTestId("intake-run").click();
  for (let i = 0; i < 2; i++) await page.getByTestId(`pick-${i}`).check();
  await page.getByTestId("selector-screen").click();
  await expect(page).toHaveURL(/\/screening\/?$/);
  await page.getByText("Cheating", { exact: false }).first().click();
  const run = async () => {
    await page.getByRole("button", { name: "Screen these facts" }).click();
    await expect(page.getByTestId("hearing-prep")).toBeVisible();
  };
  await run();
  const rows = page.getByTestId("hearing-citation");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Invented v. Sample (2000) 1 SCC 1");
  await expect(rows.first()).toContainText("Found in the text you pasted");
  // another matter's fact replaces one of them: the first matter's citations are not listed beside the new checklist
  const f1 = page.getByRole("textbox", { name: "Fact F1", exact: true });
  const original = await f1.inputValue();
  await f1.fill("My own client's fact about a loan.");
  await run();
  await expect(page.getByTestId("hearing-citation")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Found in the text you pasted");
  // restored: they come back
  await f1.fill(original);
  await run();
  await expect(page.getByTestId("hearing-citation")).toHaveCount(1);
});

test("#297: the engine's 503 intake_timeout reads R1's plain sentence in the status line, never the code", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 503, json: { error: "intake_timeout", detail: "the intake took too long and was stopped; send a shorter text" } })); // the 0.6.16 body: coded_503(INTAKE_TIMEOUT), no Retry-After
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented: a long text that the engine stops reading.");
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("intake-error")).toHaveText("This text took too long to read, so the intake was stopped. Try a shorter text.");
  await expect(page.locator("body")).not.toContainText("intake_timeout");
});

// app#342 (Track C): a refused text (422) is not "try again"; a rate limit (429) shows the seconds the engine asked for; the engine's reason and detail never reach the page.
test("app#342: a 422 refusal shows the refused line, never the engine's reason", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 422, json: { detail: "nothing readable in this text" } }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented: a short text.");
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("intake-error")).toHaveText("Intake could not read this text. Check the text, change it if needed, and run it again.");
  await expect(page.locator("body")).not.toContainText("nothing readable");
  expect(await page.locator("body").innerText()).not.toMatch(/\b422\b|HTTP/);
});

test("app#342: a 429 shows the seconds from Retry-After and none of the engine's detail", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 429, headers: { "retry-after": "30" }, json: { detail: "rate limit exceeded" } }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented: a short text.");
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("intake-error")).toHaveText("Too many requests. Wait the number of seconds shown before trying again. Seconds to wait: 30.");
  await expect(page.locator("body")).not.toContainText("rate limit exceeded");
  expect(await page.locator("body").innerText()).not.toMatch(/\b429\b|HTTP/);
});

test("app#342: a 503 agent_at_capacity keeps the general line (R1: no change), with no code or status on the page", async ({ page }) => {
  await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 503, json: { error: "agent_at_capacity", detail: "the nyaya agent is at capacity; retry shortly" } }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented: a short text.");
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("intake-error")).toHaveText("Intake could not run just now. Try again.");
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("agent_at_capacity");
  expect(text).not.toContain("at capacity");
  expect(text).not.toMatch(/\b503\b|HTTP/);
});

// app#348 (explorer's gap review of deploy 17): at 390 px the Run intake and Screen buttons are phone-size targets (44 px), like the other buttons.
test("app#348: at 390 px the Run intake and Screen the chosen facts buttons are at least 44 px high", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: ANSWER }));
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: ["ipc415_property"], entries: [] } }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill(FACTS.map((f) => f.text).join("\n\n"));
  const run = (await page.getByTestId("intake-run").boundingBox())!;
  expect(run.height, `Run intake ${run.height}px`).toBeGreaterThanOrEqual(44);
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("fact-selector")).toBeVisible();
  const screen = (await page.getByTestId("selector-screen").boundingBox())!;
  expect(screen.height, `Screen ${screen.height}px`).toBeGreaterThanOrEqual(44);
});

// #359 (R1, byte-exact): the limit is said under the paste box; a 422 string_too_long says the text is too long; another 422 keeps the refused line.
test("the limit line sits under the paste box; a too-long refusal says so and any other 422 keeps the refused line", async ({ page }) => {
  let body: unknown = { detail: [{ type: "string_too_long", loc: ["body", "text"], msg: "String should have at most 200000 characters" }] };
  await page.route("**/api/v1/intake", (r) => r.fulfill({ status: 422, json: body }));
  await page.goto("/intake");
  await expect(page.getByTestId("intake-limit-line")).toHaveText("Intake reads up to 200,000 characters.");
  await page.getByLabel("Paste the text").fill("Invented text.\n\nMore invented text.");
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("intake-error")).toHaveText("This text is longer than 200,000 characters, so intake did not read it. Shorten it and run it again.");
  body = { detail: [{ type: "missing", msg: "Field required" }] };
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("intake-error")).toHaveText("Intake could not read this text. Check the text, change it if needed, and run it again.");
});

// #358: the engine looked these citations up, so none of them reads "Not checked."; only a status this build does not know does.
test("each citation status has its own line: CONFLICT and MALFORMED are not shown as Not checked", async ({ page }) => {
  const statuses = ["CONFLICT", "MALFORMED", "IN_INDEX", "NOT_IN_INDEX", "SOMETHING_NEW"];
  const answer = { ...ANSWER, bundle: { ...ANSWER.bundle, citations: statuses.map((st, i) => ({ text: `Invented v. Sample (200${i}) 1 SCC 1`, verifier_status: st, fact_ids: ["F1"] })) } };
  await page.route("**/api/v1/intake", (r) => r.fulfill({ json: answer }));
  await page.goto("/intake");
  await page.getByLabel("Paste the text").fill("Invented text.\n\nMore invented text.");
  await page.getByTestId("intake-run").click();
  await expect(page.getByTestId("citation-line")).toHaveText([
    "Could not match one case", "Not looked up", "Found in our index", "Not found in our index: this does not show whether the citation is real", "Not checked.",
  ]);
});
