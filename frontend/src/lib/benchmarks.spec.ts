import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  BANNED_WORDS,
  BLOCK_IDS,
  BLOCK_TITLE,
  FIXED_LABEL,
  FOOTER_TEXT,
  HOW_WE_TEST,
  KIND_CHIP,
  NO_FIGURE_TEXT,
  PAGE_SUBTITLE,
  PENDING_TEXT,
  STATUS_LABEL,
  bannedIn,
  chartAlt,
  parseBenchmarkResults,
  titleFor,
} from "./benchmarks";

// Invented numbers, for the contract's checks only: they are test data, not results, and nothing here reaches the page.
const ROW = { arm: "A", group: "overall", n: 100, correct: 50, accuracy: 0.5, ci95: [0.4, 0.6] as [number, number], invalid: 0 };
const REVIEWED = (id: "bbl" | "citation" | "legalbench" | "sealed_court", over: Record<string, unknown> = {}) => ({
  id,
  status: "reviewed",
  reviewer_clear: { reviewer: "R1", head_sha: "abc1234", date: "2026-10-07" },
  kind_chip: KIND_CHIP[id],
  data_chip: "Public benchmark",
  what_it_is: "A test item set.",
  what_it_is_not: "Not a claim about real matters.",
  limits: "Test data only.",
  run: { model_ids: ["m"], revisions: ["r1"], dataset_revision: "d1", scorer_sha256: "a".repeat(64), date: "2026-10-06" },
  tables: [{ title: "T", columns: ["arm", "group"], rows: [ROW], chance: 0.25 }],
  paired: [{ pair: "A vs B", only_first_correct: 3, only_second_correct: 2, p: 0.8, label: "no separation" }],
  leaderboard: null,
  ...over,
});
const FILE = (blocks: unknown[]) => ({ generated_at: "2026-10-06", page_version: "t", blocks });
const view = (blocks: unknown[], id: string) => parseBenchmarkResults(FILE(blocks)).blocks.find((b) => b.id === id)!;

test("a file with no blocks, or no file, gives four pending blocks in the page order and no figure", () => {
  for (const raw of [null, undefined, 5, [], {}, FILE([])]) {
    const p = parseBenchmarkResults(raw);
    assert.deepEqual(p.blocks.map((b) => b.id), [...BLOCK_IDS]);
    for (const b of p.blocks) {
      assert.equal(b.figures, null);
      assert.equal(b.status, "pending");
      assert.equal(b.statusLabel, PENDING_TEXT);
    }
  }
});

test("the shipped data file is all pending, with no figure", () => {
  const raw = JSON.parse(readFileSync(join(__dirname, "..", "..", "public", "benchmark_results.json"), "utf8"));
  const p = parseBenchmarkResults(raw);
  assert.deepEqual(p.problems, []);
  assert.ok(p.blocks.every((b) => b.figures === null && b.status === "pending"));
  assert.doesNotMatch(JSON.stringify(raw), /accuracy|ci95|correct/);
});

test("a reviewed block that passes every check carries its figures", () => {
  const v = view([REVIEWED("bbl")], "bbl");
  assert.equal(v.status, "reviewed");
  assert.equal(v.refusal, null);
  assert.equal(v.figures?.tables[0].rows[0].n, 100);
  assert.equal(v.fixedLabel, FIXED_LABEL.bbl);
});

test("a block that is not reviewed shows no figure, even if the file carries them", () => {
  for (const status of ["pending", "inconclusive", "dropped", "something-else"]) {
    const p = parseBenchmarkResults(FILE([{ ...REVIEWED("citation"), status }]));
    const v = p.blocks.find((b) => b.id === "citation")!;
    assert.equal(v.figures, null, status);
    assert.ok(p.problems.some((m) => m.includes("citation")), status);
  }
  assert.equal(view([{ id: "citation", status: "inconclusive" }], "citation").status, "inconclusive");
  assert.match(titleFor(view([{ id: "citation", status: "inconclusive" }], "citation")), /\(Inconclusive\)$/);
  assert.match(titleFor(view([{ id: "citation", status: "dropped" }], "citation")), /\(Dropped\)$/);
  assert.equal(titleFor(view([], "bbl")), BLOCK_TITLE.bbl);
});

test("a number without its n or its 95% interval is refused: the block is pending, with no figure", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["no n", { ...ROW, n: undefined }],
    ["zero n", { ...ROW, n: 0 }],
    ["no interval", { ...ROW, ci95: undefined }],
    ["interval of one", { ...ROW, ci95: [0.4] }],
    ["interval reversed", { ...ROW, ci95: [0.6, 0.4] }],
    ["interval past 1", { ...ROW, ci95: [0.4, 1.2] }],
    ["accuracy outside its interval", { ...ROW, accuracy: 0.9 }],
    ["accuracy not correct over n", { ...ROW, correct: 10 }],
    ["more correct than n", { ...ROW, correct: 150, accuracy: 1.5 }],
    ["no invalid count", { ...ROW, invalid: undefined }],
  ];
  for (const [name, row] of cases) {
    const v = view([REVIEWED("bbl", { tables: [{ title: "T", columns: [], rows: [row] }] })], "bbl");
    assert.equal(v.figures, null, name);
    assert.equal(v.status, "pending", name);
    assert.ok(v.refusal, name);
  }
});

test("a reviewed block must carry its clearance, its fixed chip, its what-it-is-not line and a complete run record", () => {
  const bad: Array<[string, Record<string, unknown>]> = [
    ["no clearance", { reviewer_clear: undefined }],
    ["clearance without a head sha", { reviewer_clear: { reviewer: "R1", date: "2026-10-07" } }],
    ["another block's chip", { kind_chip: KIND_CHIP.citation }],
    ["a chip outside the vocabulary", { kind_chip: "Better than the rest" }],
    ["a data chip outside the vocabulary", { data_chip: "Invented" }],
    ["no what_it_is_not", { what_it_is_not: "" }],
    ["no limits", { limits: undefined }],
    ["no scorer sha", { run: { model_ids: ["m"], revisions: ["r"], dataset_revision: "d", scorer_sha256: "short", date: "2026-10-06" } }],
    ["no tables", { tables: [] }],
    ["chance out of range", { tables: [{ title: "T", columns: [], rows: [ROW], chance: 1.5 }] }],
  ];
  for (const [name, over] of bad) assert.equal(view([REVIEWED("bbl", over)], "bbl").figures, null, name);
});

test("a paired comparison states a direction only when p < 0.05: the label must agree with p", () => {
  const ok = (p: number, label: string) => view([REVIEWED("bbl", { paired: [{ pair: "A vs B", only_first_correct: 9, only_second_correct: 1, p, label }] })], "bbl").figures !== null;
  assert.equal(ok(0.8, "no separation"), true);
  assert.equal(ok(0.01, "separated"), true);
  assert.equal(ok(0.05, "no separation"), true);
  assert.equal(ok(0.8, "separated"), false, "p >= 0.05 cannot be called separated");
  assert.equal(ok(0.01, "no separation"), false);
  assert.equal(ok(0.01, "A is better"), false);
  assert.equal(ok(1.5, "no separation"), false);
});

test("a leaderboard row needs its link, date and submitter, and is null unless the placement is on the leaderboard's page", () => {
  const lb = { name: "Board", url: "https://example.org/board", rank: 3, as_of: "2026-10-06", submitted_by: "AxisMeru" };
  assert.equal(view([REVIEWED("bbl", { leaderboard: lb })], "bbl").figures?.leaderboard?.rank, 3);
  assert.equal(view([REVIEWED("bbl", { leaderboard: { ...lb, url: "http://example.org" } })], "bbl").figures, null);
  assert.equal(view([REVIEWED("bbl", { leaderboard: { ...lb, as_of: "yesterday" } })], "bbl").figures, null);
  assert.equal(view([REVIEWED("bbl", { leaderboard: { name: "Board", rank: 3 } })], "bbl").figures, null);
});

test("banned wording anywhere in a reviewed block refuses it", () => {
  for (const w of BANNED_WORDS) {
    const v = view([REVIEWED("bbl", { what_it_is: `A test that ${w} others.` })], "bbl");
    assert.equal(v.figures, null, w);
    assert.match(v.refusal ?? "", /banned wording/, w);
  }
  assert.equal(view([REVIEWED("bbl", { limits: "State-of-the-art is not claimed." })], "bbl").figures, null);
  assert.deepEqual(bannedIn("A plain sentence about interbest rates and validation."), []);
});

test("an unknown or repeated block id is ignored; the first of a repeated block is read", () => {
  const p = parseBenchmarkResults(FILE([REVIEWED("bbl"), REVIEWED("bbl", { limits: "second" }), { id: "other", status: "reviewed" }]));
  assert.equal(p.blocks.length, 4);
  assert.equal(p.blocks[0].figures?.limits, "Test data only.");
  assert.equal(p.problems.length, 2);
});

test("the fixed text of the page uses none of the banned words, and no page string carries a number", () => {
  const fixed = [PAGE_SUBTITLE, FOOTER_TEXT, NO_FIGURE_TEXT, ...HOW_WE_TEST, ...Object.values(BLOCK_TITLE), ...Object.values(KIND_CHIP), ...Object.values(FIXED_LABEL), ...Object.values(STATUS_LABEL)];
  for (const s of fixed) {
    assert.deepEqual(bannedIn(s ?? ""), [], s);
    assert.doesNotMatch(s ?? "", /\d/, `a figure in fixed text: ${s}`);
  }
});

test("page source files use none of the banned words outside the list that defines them", () => {
  for (const f of [join("..", "app", "benchmarks", "page.tsx"), join("..", "components", "benchmarks", "ResultTableView.tsx")]) {
    const src = readFileSync(join(__dirname, f), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    assert.deepEqual(bannedIn(src), [], f);
  }
});

test("a chart's text alternative lists every row with its interval and n, in the order given", () => {
  const alt = chartAlt({ title: "T", columns: [], chance: 0.25, rows: [{ ...ROW, arm: "second" }, { ...ROW, arm: "first", accuracy: 0.9, correct: 90, ci95: [0.8, 0.95] }] });
  assert.ok(alt.indexOf("second") < alt.indexOf("first"), "rows are never sorted by value");
  assert.match(alt, /50\.0%, 95% interval 40\.0% to 60\.0%, n 100/);
  assert.match(alt, /Chance level 25\.0%/);
});
