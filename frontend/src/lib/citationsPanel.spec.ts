import { strict as assert } from "node:assert";
import test from "node:test";

import { ApiError } from "./api";
import { COVERAGE_NOT_REPORTED, MAX_CITATIONS, VERIFIED_WITHOUT_QUOTE_TEXT, checkCitations, coverageLine, parseCitationLines } from "./citationsPanel";

// Invented citations and quotes only.

test("one citation per line; an optional quote after a bar; blank lines are ignored; line numbers are the typed ones", () => {
  const { items, skipped } = parseCitationLines("(2020) 3 SCC 456 | the sum shall be paid\n\n  (1999) 1 SCC 10  \r\n(2001) 2 SCC 5 |   ");
  assert.equal(skipped, 0);
  assert.deepEqual(items, [
    { line: 1, citation: "(2020) 3 SCC 456", quote: "the sum shall be paid" },
    { line: 3, citation: "(1999) 1 SCC 10", quote: null },
    { line: 4, citation: "(2001) 2 SCC 5", quote: null },
  ]);
});

test("at most ten are taken; the rest are counted as skipped, never checked", () => {
  const text = Array.from({ length: 13 }, (_, i) => `(2000) ${i + 1} SCC 1 | q`).join("\n");
  const { items, skipped } = parseCitationLines(text);
  assert.equal(items.length, MAX_CITATIONS);
  assert.equal(skipped, 3);
});

test("the checks run one at a time, in order, and a line with no quote is SENT with a null quote (existence only)", async () => {
  const log: string[] = [];
  let active = 0;
  let maxActive = 0;
  const quotes: (string | null)[] = [];
  const verify = async (c: string, q: string | null) => {
    quotes.push(q);
    active += 1;
    maxActive = Math.max(maxActive, active);
    log.push(c);
    await new Promise((r) => setTimeout(r, 2));
    active -= 1;
    return { result: q === null ? "IN_INDEX" : "VERIFIED", note: "n" };
  };
  const { items } = parseCitationLines("A | qa\nB\nC | qc");
  const seen: number[] = [];
  const rows = await checkCitations(verify, items, undefined, (r) => seen.push(r.length));
  assert.deepEqual(log, ["A", "B", "C"]);
  assert.deepEqual(quotes, ["qa", null, "qc"]);
  assert.equal(maxActive, 1);
  assert.equal(rows[0].state.phase, "result");
  assert.equal(rows[1].state.phase, "result");
  assert.equal(rows[2].state.phase, "result");
  assert.ok(seen.length >= 3);
});

test("a refusal on one line does not stop the others, and index_unavailable stays an honest not-checked state", async () => {
  let n = 0;
  const verify = async () => {
    n += 1;
    if (n === 1) throw new ApiError(503, "/x", { code: "citation_index_unavailable" });
    return { result: "NOT_IN_INDEX", note: "n" };
  };
  const rows = await checkCitations(verify, parseCitationLines("A | q\nB | q").items);
  assert.equal(rows[0].state.phase, "error");
  assert.equal(rows[0].state.phase === "error" && rows[0].state.kind, "index_unavailable");
  assert.equal(rows[1].state.phase === "result" && rows[1].state.view.status, "NOT_IN_INDEX");
});

test("an aborted run stops before the next line", async () => {
  const ac = new AbortController();
  let calls = 0;
  const verify = async () => {
    calls += 1;
    ac.abort();
    return { result: "VERIFIED", note: "n" };
  };
  const rows = await checkCitations(verify, parseCitationLines("A | q\nB | q\nC | q").items, ac.signal);
  assert.equal(calls, 1);
  assert.equal(rows[1].state.phase, "idle");
});

test("coverage is read from the engine's field, never typed in: a string as sent, an object worded from its parts, anything else the fallback", () => {
  assert.equal(coverageLine("Supreme Court judgments only."), "Supreme Court judgments only.");
  assert.match(coverageLine({ courts: ["Supreme Court"], resolvable_cases: 1234, year_min: 1950, year_max: 2024 }), /^Citations resolve for 1,234 Supreme Court judgments \(1950 to 2024\); other courts answer not in index, which is no evidence either way\.$/);
  assert.match(coverageLine({ courts: ["Supreme Court"], resolvable_cases: 12 }), /^Citations resolve for 12 Supreme Court judgments; other courts answer not in index/);
  for (const bad of [undefined, null, "", "  ", 3, {}, { courts: [], resolvable_cases: 1 }, { courts: ["SC"], resolvable_cases: -1 }, { courts: ["SC"], resolvable_cases: "1" }]) {
    assert.equal(coverageLine(bad), COVERAGE_NOT_REPORTED);
  }
  assert.doesNotMatch(COVERAGE_NOT_REPORTED + coverageLine(undefined), /Supreme|SC /);
});

test("the coverage the engine sent with a result is kept on that row", async () => {
  const verify = async () => ({ result: "NOT_IN_INDEX", note: "n", coverage: "Supreme Court judgments only." });
  const [row] = await checkCitations(verify, parseCitationLines("A | q").items);
  assert.equal(row.state.phase === "result" && row.state.coverage, "Supreme Court judgments only.");
});

test("an over-long citation or quote is NEVER cut: it reaches the length check and is refused, not checked as a prefix", async () => {
  const calls: string[] = [];
  const verify = async (c: string, q: string | null) => {
    calls.push(`${c.length}/${(q ?? "").length}`);
    return { result: "VERIFIED", note: "n" };
  };
  const longCitation = "C".repeat(501);
  const longQuote = "q".repeat(4001);
  const parsed = parseCitationLines(`${longCitation} | fine\nshort | ${longQuote}\nok | ${"q".repeat(4000)}\n${"C".repeat(500)} | fine`);
  assert.equal(parsed.items[0].citation.length, 501);
  assert.equal(parsed.items[1].quote?.length, 4001);
  const rows = await checkCitations(verify, parsed.items);
  assert.equal(rows[0].state.phase, "invalid");
  assert.match(rows[0].state.phase === "invalid" ? rows[0].state.message : "", /citation is longer than 500 characters/);
  assert.equal(rows[1].state.phase, "invalid");
  assert.match(rows[1].state.phase === "invalid" ? rows[1].state.message : "", /quote is longer than 4000 characters/);
  assert.equal(rows[2].state.phase, "result"); // exactly 4000 is allowed
  assert.equal(rows[3].state.phase, "result"); // exactly 500 is allowed
  assert.deepEqual(calls, ["2/4000", "500/4"]);
});

test("the FIRST bar splits a line: later bars belong to the quote", () => {
  const { items } = parseCitationLines("(2020) 3 SCC 456 | the sum | shall be paid | in full");
  assert.deepEqual(items[0], { line: 1, citation: "(2020) 3 SCC 456", quote: "the sum | shall be paid | in full" });
});

test("a coverage object carrying BOTH counts prints the resolvable one and never the index total; the index total alone is the fallback", () => {
  const both = coverageLine({ courts: ["Supreme Court"], resolvable_cases: 3984, judgments_in_index: 38657, year_min: 1950, year_max: 2024 });
  assert.match(both, /^Citations resolve for 3,984 Supreme Court judgments \(1950 to 2024\)/);
  assert.doesNotMatch(both, /38,657|38657/);
  assert.equal(coverageLine({ courts: ["Supreme Court"], judgments_in_index: 38657 }), COVERAGE_NOT_REPORTED);
  assert.equal(coverageLine({ courts: ["Supreme Court"], judgments: 38657 }), COVERAGE_NOT_REPORTED);
});

test("a line sent without a quote shows the engine's answer, and a VERIFIED answer to it is fail-closed: never shown as verified", async () => {
  const stray = await checkCitations(async () => ({ result: "VERIFIED", note: "n" }), parseCitationLines("(2020) 3 SCC 456").items);
  assert.equal(stray[0].state.phase, "error");
  assert.equal(stray[0].state.phase === "error" && stray[0].state.message, VERIFIED_WITHOUT_QUOTE_TEXT);
  const product = await checkCitations(async () => ({ result: "IN_INDEX", note: "n", status: "verified", label: "Verified", verified: true }), parseCitationLines("(2020) 3 SCC 456").items);
  assert.equal(product[0].state.phase === "result" && product[0].state.view.status === "IN_INDEX" && product[0].state.view.product === null, true); // product wording is off: the stray flag cannot show
  const inIndex = await checkCitations(async () => ({ result: "IN_INDEX", note: "The citation is in the index; no quote was checked." }), parseCitationLines("(2020) 3 SCC 456").items);
  assert.equal(inIndex[0].state.phase === "result" && inIndex[0].state.view.status, "IN_INDEX");
  // the same VERIFIED answer WITH a quote is a normal result
  const withQuote = await checkCitations(async () => ({ result: "VERIFIED", note: "n" }), parseCitationLines("(2020) 3 SCC 456 | the words").items);
  assert.equal(withQuote[0].state.phase === "result" && withQuote[0].state.view.status, "VERIFIED");
});

test("the coverage the engine sends, in its final shape, is worded from courts + resolvable_cases + the year range and prints no other count", () => {
  const real = { courts: ["Supreme Court"], resolvable_cases: 3984, judgments_in_index: 38657, year_min: 1950, year_max: 2024 };
  assert.equal(coverageLine(real), "Citations resolve for 3,984 Supreme Court judgments (1950 to 2024); other courts answer not in index, which is no evidence either way.");
});
