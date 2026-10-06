import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { BLOCK_IDS, BLOCK_TITLE, chartAlt, fixedPageStrings, pairNames, parseBenchmarkResults, titleFor } from "./benchmarks";

// The page's runtime contract (lib/benchmarks.ts) and the CI gate (the vendored validator and copy-lint) are tested together on one
// fixture of INVENTED numbers (fixtures/benchmarkExample.json: test data, never results): the fixture must satisfy the real validator, and
// each planted violation must fail it.
const FIXTURES = join(__dirname, "fixtures");
const SCRIPTS = join(__dirname, "..", "..", "..", "scripts", "benchmarks");
const PUBLIC = join(__dirname, "..", "..", "public", "benchmark_results.json");
const example = (): Record<string, unknown> => JSON.parse(readFileSync(join(FIXTURES, "benchmarkExample.json"), "utf8"));
type Block = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const blockOf = (doc: Record<string, unknown>, id: string): Block => (doc.blocks as Block[]).find((b) => b.id === id)!;

function validate(doc: unknown, root = FIXTURES): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "bench-"));
  cpSync(join(FIXTURES, "benchmarkExample.numbers.json"), join(dir, "benchmarkExample.numbers.json"));
  const file = join(dir, "benchmark_results.json");
  writeFileSync(file, JSON.stringify(doc));
  void root;
  const r = spawnSync("python3", [join(SCRIPTS, "validate_page_data.py"), file, "--root", dir], { encoding: "utf8" });
  assert.notEqual(r.status, null, `python3 failed to run: ${r.stderr}`);
  return { code: r.status as number, out: r.stdout + r.stderr };
}

test("the fixture of invented numbers satisfies the REAL validator, and the shipped data file does too", () => {
  assert.equal(validate(example()).code, 0, validate(example()).out);
  const r = spawnSync("python3", [join(SCRIPTS, "validate_page_data.py"), PUBLIC], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("the vendored tools' own 27 tests pass", () => {
  const r = spawnSync("python3", ["-m", "unittest"], { cwd: SCRIPTS, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /Ran 27 tests/);
});

test("planted violations FAIL the validator (the CI gate): unreviewed numbers, one reviewer, a wrong interval, a wrong label, a banned word, a tampered sentence", () => {
  const plant = (mutate: (d: Record<string, unknown>) => void): { code: number; out: string } => {
    const d = example();
    mutate(d);
    return validate(d);
  };
  const cases: Array<[string, (d: Record<string, unknown>) => void, RegExp]> = [
    ["numbers on a pending block", (d) => { Object.assign(blockOf(d, "legalbench"), { tables: blockOf(d, "bbl").tables }); }, /pending block carries numbers/],
    ["only R1 reviewed", (d) => { blockOf(d, "bbl").reviews = blockOf(d, "bbl").reviews.slice(0, 1); }, /both R1 and R2/],
    ["a wrong interval", (d) => { blockOf(d, "bbl").tables[0].rows[0].ci95 = [0.1, 0.9]; }, /does not match the exact interval/],
    ["a label that contradicts p", (d) => { blockOf(d, "bbl").paired[0].label = "separated"; }, /disagrees with p/],
    ["a banned word", (d) => { blockOf(d, "bbl").what_it_is = "Our model outperforms the base."; }, /banned term/],
    ["a tampered result sentence", (d) => { blockOf(d, "bbl").sentences[0].text = "Arm A is much better."; }, /not produced by its template|missing generated result sentence/],
    ["a recomputed hash that differs", (d) => { blockOf(d, "bbl").numbers_sha256 = "b".repeat(64); }, /numbers_sha256 does not match/],
    ["an unreviewed block with an outcome", (d) => { blockOf(d, "legalbench").outcome = "bar_met"; }, /no outcome yet/],
  ];
  for (const [name, mutate, want] of cases) {
    const r = plant(mutate);
    assert.equal(r.code, 1, name);
    assert.match(r.out, want, name);
  }
});

test("the page's fixed strings (titles, labels, chips, how-we-test, footer) pass the vendored copy lint", () => {
  const dir = mkdtempSync(join(tmpdir(), "bench-"));
  const file = join(dir, "items.json");
  writeFileSync(file, JSON.stringify(fixedPageStrings()));
  const r = spawnSync("python3", [join(SCRIPTS, "lint_copy.py"), file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fixedPageStrings().length > 30);
  // and the lint does catch a planted phrase, so the check above means something
  writeFileSync(file, JSON.stringify([...fixedPageStrings(), { id: "planted", text: "Our models are better than the rest." }]));
  assert.equal(spawnSync("python3", [join(SCRIPTS, "lint_copy.py"), file], { encoding: "utf8" }).status, 1);
});

test("no page string or fixed text carries a digit (no figure lives in the page)", () => {
  for (const s of fixedPageStrings()) assert.doesNotMatch(s.text, /\d/, s.text);
});

test("a file with no blocks, or no file, gives four pending blocks in the page order and no figure", () => {
  for (const raw of [null, undefined, 5, [], {}, { generated_at: "2026-10-06", page_version: "t", blocks: [] }]) {
    const p = parseBenchmarkResults(raw);
    assert.deepEqual(p.blocks.map((b) => b.id), [...BLOCK_IDS]);
    for (const b of p.blocks) {
      assert.equal(b.figures, null);
      assert.equal(b.status, "pending");
      assert.equal(b.statusLabel, "Result pending");
      assert.equal(b.outcomeLabel, null);
    }
  }
});

test("the shipped data file is all pending, with no figure and no number", () => {
  const raw = JSON.parse(readFileSync(PUBLIC, "utf8"));
  const p = parseBenchmarkResults(raw);
  assert.deepEqual(p.problems, []);
  assert.ok(p.blocks.every((b) => b.figures === null && b.status === "pending" && b.dataChip !== null));
  assert.doesNotMatch(JSON.stringify(raw), /accuracy|ci95|correct|"n":/);
});

test("a reviewed block that passes shows its figures and its outcome; an inconclusive result says so in its title; the others stay pending", () => {
  const p = parseBenchmarkResults(example());
  const bbl = p.blocks.find((b) => b.id === "bbl")!;
  assert.equal(bbl.status, "reviewed");
  assert.equal(bbl.outcomeLabel, "Descriptive");
  assert.equal(bbl.figures?.tables[0].rows[0].n, 100);
  assert.equal(bbl.fixedLabel?.startsWith("Model legal knowledge (multiple choice)"), true);
  const cit = p.blocks.find((b) => b.id === "citation")!;
  assert.equal(cit.outcomeLabel, "Inconclusive");
  assert.equal(titleFor(cit), `${BLOCK_TITLE.citation} (Inconclusive)`);
  assert.equal(titleFor(bbl), BLOCK_TITLE.bbl);
  for (const id of ["legalbench", "sealed_court"]) assert.equal(p.blocks.find((b) => b.id === id)!.figures, null);
  assert.deepEqual(p.problems, []);
});

test("a block that is pending shows no figure even if the file carries them", () => {
  const d = example();
  blockOf(d, "legalbench").tables = blockOf(d, "bbl").tables;
  const v = parseBenchmarkResults(d).blocks.find((b) => b.id === "legalbench")!;
  assert.equal(v.figures, null);
  assert.equal(v.refusal, "figures on a block that is not reviewed");
});

test("runtime refusals: a reviewed block loses its figures when anything the contract needs is missing", () => {
  const bad: Array<[string, (b: Block) => void]> = [
    ["one reviewer only", (b) => { b.reviews = b.reviews.slice(0, 1); }],
    ["a review without a GitHub review link", (b) => { b.reviews[0].ref = "https://example.org/x"; }],
    ["no numbers hash", (b) => { delete b.numbers_sha256; }],
    ["outcome n/a on a reviewed block", (b) => { b.outcome = "n/a"; }],
    ["another block's kind chip", (b) => { b.kind_chip = "Sealed Indian court test, reviewed result"; }],
    ["a data chip outside the vocabulary", (b) => { b.data_chip = "Invented"; }],
    ["no what_it_is_not line", (b) => { b.what_it_is_not = ""; }],
    ["an incomplete run record", (b) => { b.run.scorer_sha256 = "short"; }],
    ["a row without n", (b) => { delete b.tables[0].rows[0].n; }],
    ["a row without its interval", (b) => { delete b.tables[0].rows[0].ci95; }],
    ["accuracy outside its interval", (b) => { b.tables[0].rows[0].accuracy = 0.9; }],
    ["accuracy not correct over n", (b) => { b.tables[0].rows[0].correct = 10; }],
    ["a label that contradicts p", (b) => { b.paired[0].label = "separated"; }],
    ["a paired test without its family", (b) => { delete b.paired[0].family; }],
    ["a figure without its generated sentence", (b) => { b.sentences = b.sentences.slice(1); }],
    ["chance out of range", (b) => { b.tables[0].chance = 1.5; }],
    ["a leaderboard that is not the Space's own page", (b) => { b.leaderboard = { name: "Board", url: "https://example.org/x", rank: 3, as_of: "2026-10-06", submitted_by: "AxisMeru" }; }],
  ];
  for (const [name, mutate] of bad) {
    const d = example();
    mutate(blockOf(d, "bbl"));
    const v = parseBenchmarkResults(d).blocks.find((b) => b.id === "bbl")!;
    assert.equal(v.figures, null, name);
    assert.equal(v.status, "pending", name);
    assert.ok(v.refusal, name);
  }
});

test("a Holm-adjusted p decides the label when a family is named", () => {
  const d = example();
  const b = blockOf(d, "bbl");
  Object.assign(b.paired[0], { p: 0.01, holm_adjusted_p: 0.2, family: "named family", label: "no separation" });
  assert.notEqual(parseBenchmarkResults(d).blocks[0].figures, null);
  b.paired[0].label = "separated";
  assert.equal(parseBenchmarkResults(d).blocks[0].figures, null);
});

test("a repeated or unknown block id is ignored; the first of a repeated block is read", () => {
  const d = example();
  (d.blocks as Block[]).push({ ...blockOf(d, "bbl"), limits: "second" }, { id: "other", review_status: "reviewed" });
  const p = parseBenchmarkResults(d);
  assert.equal(p.blocks.length, 4);
  assert.notEqual(p.blocks[0].figures?.limits, "second");
  assert.equal(p.problems.length, 2);
});

test("a chart's text alternative lists every row with its interval and n in the order given; pair names come from 'A vs B'", () => {
  const rows = [
    { arm: "second", group: "g", n: 100, correct: 50, accuracy: 0.5, ci95: [0.4, 0.6] as [number, number], invalid: 0 },
    { arm: "first", group: "g", n: 100, correct: 90, accuracy: 0.9, ci95: [0.8, 0.95] as [number, number], invalid: 0 },
  ];
  const alt = chartAlt({ title: "T", columns: [], chance: 0.25, rows });
  assert.ok(alt.indexOf("second") < alt.indexOf("first"), "rows are never sorted by value");
  assert.match(alt, /50\.0%, 95% interval 40\.0% to 60\.0%, n 100/);
  assert.match(alt, /Chance level 25\.0%/);
  assert.deepEqual(pairNames("arm A vs arm B"), ["arm A", "arm B"]);
  assert.deepEqual(pairNames("single"), ["single", "second arm"]);
});
