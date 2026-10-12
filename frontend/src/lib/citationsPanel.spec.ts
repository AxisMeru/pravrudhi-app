import { strict as assert } from "node:assert";
import test from "node:test";

import { ApiError } from "./api";
import { COVERAGE_NOT_REPORTED, DEV_STACK_ONLY_TEXT, MAX_CITATIONS, VERIFIED_WITHOUT_QUOTE_TEXT, checkCitations, coverageLine, parseCitationLines } from "./citationsPanel";

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


// The engine's served coverage shape (pravrudhi #376, application/verify.py index_coverage), as the demo pack's captures/citations.json carried it.
const SERVED_COURTS_RESOLVABLE: Record<string, number> = {
  "Supreme Court": 2952, "Delhi High Court": 156, "Gujarat High Court": 128, "Punjab-Haryana High Court": 90, "Madras High Court": 70, "Allahabad High Court": 68,
  "Madhya Pradesh High Court": 64, "Kerala High Court": 64, "Supreme Court of India": 60, "Bombay High Court": 57, "Rajasthan High Court": 53, "Delhi District Court": 49,
  "Patna High Court": 47, "Calcutta High Court": 22, "Andhra High Court": 22, "Karnataka High Court": 16, "Orissa High Court": 11, "Himachal Pradesh High Court": 11,
  "Jharkhand High Court": 9, "Jammu & Kashmir High Court": 8, "Income Tax Appellate Tribunal": 7, "Gauhati High Court": 7, "Chattisgarh High Court": 6,
  "Uttarakhand High Court": 5, "High Court of Meghalaya": 1, "Customs, Excise and Gold Tribunal": 1,
};
const SERVED_COVERAGE = {
  judgments_held: 38657, courts_held: { "Supreme Court": 26687, "Delhi High Court": 799 }, courts: Object.keys(SERVED_COURTS_RESOLVABLE).sort(),
  courts_resolvable: SERVED_COURTS_RESOLVABLE, resolvable_cases: 3984, resolvable_citation_strings: 9597, year_min: 1970, year_max: 2025, held_year_min: 1950, held_year_max: 2025,
  note: "Only SCC-family citations resolve today; a citation to any court or reporter not listed under courts_resolvable is answered not_in_index, which is no evidence either way.",
};

const R1_SENTENCE =
  "Citations resolve for 3,984 judgments from 26 court labels (Supreme Court 3,012 under two labels; other courts 972), with years 1970 to 2025 (the index's year field); SCC-family citations only. A citation to any other court or reporter answers not in index, which is no evidence either way.";

test("the served coverage object is worded exactly as R1 signed it, from resolvable_cases + courts_resolvable + the resolvable years + the note; the index total and held figures never print", () => {
  assert.equal(coverageLine(SERVED_COVERAGE), R1_SENTENCE);
  const line = coverageLine(SERVED_COVERAGE);
  for (const never of ["38,657", "38657", "26,687", "1950", "9,597", "Allahabad"]) assert.ok(!line.includes(never), never);
});

test("outside the hosted app the sentence carries the dev-stack-only line; inside it does not", () => {
  assert.equal(coverageLine(SERVED_COVERAGE, { devStack: true }), `${R1_SENTENCE} ${DEV_STACK_ONLY_TEXT}`);
  assert.equal(DEV_STACK_ONLY_TEXT, "Dev stack only; not served in the hosted deployment.");
  assert.ok(!coverageLine(SERVED_COVERAGE).includes("Dev stack"));
});

test("one court, one label, no SC label, and a missing SCC-family note are worded from the data, not from a template", () => {
  const one = coverageLine({ resolvable_cases: 12, courts_resolvable: { "Delhi High Court": 12 }, year_min: 1990, year_max: 2001, note: "x" });
  assert.equal(one, "Citations resolve for 12 judgments from 1 court label, with years 1990 to 2001 (the index's year field). A citation to any other court or reporter answers not in index, which is no evidence either way.");
  const sc = coverageLine({ resolvable_cases: 10, courts_resolvable: { "Supreme Court": 10 }, year_min: 1990, year_max: 2001, note: "SCC-family only" });
  assert.match(sc, /^Citations resolve for 10 judgments from 1 court label \(Supreme Court 10; other courts 0\), with years 1990 to 2001/);
  assert.match(sc, /; SCC-family citations only\./);
});

test("coverage that is missing, malformed or does not add up gives the plain fallback, never a partial claim", () => {
  const base = { resolvable_cases: 3984, courts_resolvable: SERVED_COURTS_RESOLVABLE, year_min: 1970, year_max: 2025, note: "SCC-family" };
  const bad: unknown[] = [
    undefined, null, "", "Supreme Court judgments only.", 3, {}, { ...base, resolvable_cases: 3985 }, { ...base, resolvable_cases: "3984" }, { ...base, courts_resolvable: {} },
    { ...base, courts_resolvable: [] }, { ...base, courts_resolvable: { "Supreme Court": -1 } }, { ...base, courts_resolvable: { " ": 3984 } }, { ...base, year_min: undefined },
    { ...base, year_max: "2025" }, { resolvable_cases: 3984, courts: ["Supreme Court"], year_min: 1970, year_max: 2025 }, { courts: ["Supreme Court"], judgments_in_index: 38657 },
  ];
  for (const b of bad) assert.equal(coverageLine(b), COVERAGE_NOT_REPORTED, JSON.stringify(b)?.slice(0, 60));
  assert.doesNotMatch(COVERAGE_NOT_REPORTED, /Supreme|SC /);
});
