import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import test from "node:test";

import type { AnalyseFactsContract, AnalyseFactsResult } from "../api";
import contractElements from "../fixtures/contractElements.json";
import { AGENDA_BANNER_TEXT, BANNER_STANDING_LINE, NO_FACT_GROUP_HEADING } from "./copy";
import { buildScreeningMemo, buildScreeningMemoDocx, memoBlockHeading } from "./memo";
import { agendaContractId } from "./model";

// #206 R12 (R1, 15 Oct): the memo mirrors the screen. The standing line once under the disclaimer; the review agenda once, under the first block with no supported ingredient (the screen's own agendaContractId); per block the screen's grouping.
const OPTS = { engineVersion: "0.6.11", generatedAt: "2026-10-15T00:00:00Z" };
const els = (id: string): string[] => (contractElements.contracts as Record<string, { elements: string[] }>)[id].elements;
const FACTS = [{ id: "F1", text: "A fact.", sha256: "b".repeat(64) }];
/** status per element index; "established" with a fact_id is a supported row, "not_established" is No fact cited, "not_confirmed" is a review row. */
const block = (id: string, statuses: string[]): AnalyseFactsContract =>
  ({ contract_id: id, outcome: "ABSTAIN", reason: "missing_element", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [],
    elements: els(id).map((e, i) => ({ element: e, is_denial: false, status: statuses[i] ?? "not_established", claimed: true, p_established: 0.5, fact_id: statuses[i] === "established" ? "F1" : null, quote: null })) }) as unknown as AnalyseFactsContract;
const result = (contracts: AnalyseFactsContract[]): AnalyseFactsResult => ({ run_id: "shape", judge: "j", score_sha256: "a".repeat(64), provenance: "p", facts: FACTS, contracts }) as unknown as AnalyseFactsResult;

const docxText = (r: AnalyseFactsResult): string => {
  const zip = Buffer.from(buildScreeningMemoDocx(r, OPTS));
  const parts: string[] = [];
  for (let at = 0; at + 30 < zip.length && zip.readUInt32LE(at) === 0x04034b50; ) {
    const method = zip.readUInt16LE(at + 8), csize = zip.readUInt32LE(at + 18), nlen = zip.readUInt16LE(at + 26), xlen = zip.readUInt16LE(at + 28);
    const start = at + 30 + nlen + xlen;
    const data = zip.subarray(start, start + csize);
    parts.push(method === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8"));
    at = start + csize;
  }
  return parts.join("\n");
};
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;

const NONE = ["not_established", "not_established", "not_established"]; // nothing supported
const SOME = ["established", "not_established", "not_confirmed"]; // one supported, one no-fact, one review

test("\"A lawyer decides.\" appears exactly once in the memo, in the signed disclaimer, and the screen's standing line is not repeated under it (.md and .docx text; R1, #262)", () => {
  for (const r of [result([block("ipc415_property", SOME)]), result(["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers", "ipc415_property", "ipc415_damaging_act"].map((id) => block(id, SOME))), result([block("ipc415_property", NONE)])]) {
    const md = buildScreeningMemo(r, OPTS);
    assert.equal(count(md, "A lawyer decides."), 1, "md: exactly once");
    assert.equal(count(md, BANNER_STANDING_LINE), 0, "md: the standing line is not repeated");
    assert.equal(md.split("\n")[2].startsWith("> This memo is a screening aid, not legal advice. A lawyer decides."), true, "the memo opens with the disclaimer");
    assert.equal(count(docxText(r), "A lawyer decides."), 1, "docx: exactly once");
    assert.equal(count(docxText(r), BANNER_STANDING_LINE), 0, "docx: the standing line is not repeated");
  }
});

test("grouping per block: not-'No fact cited' rows first under Ingredients (supported, suggested, review in the engine's order), then the No-fact rows under the screen's own heading with their What to check", () => {
  const md = buildScreeningMemo(result([block("ipc415_property", SOME)]), OPTS);
  const i = md.indexOf("### Ingredients"), j = md.indexOf(`### ${NO_FACT_GROUP_HEADING}`);
  assert.ok(i > 0 && j > i);
  const first = md.slice(i, j), second = md.slice(j);
  assert.match(first, /\*\*Supported by a fact\*\*/);
  assert.match(first, /\*\*Needs your review\*\*/);
  assert.ok(first.indexOf("Supported by a fact") < first.indexOf("Needs your review"), "engine order");
  assert.doesNotMatch(first, /No fact cited/);
  assert.match(second, /\*\*No fact cited\*\*/);
  assert.match(second, /What to check/);
  assert.doesNotMatch(second, /Supported by a fact|Needs your review/);
  const d = docxText(result([block("ipc415_property", SOME)]));
  assert.ok(d.includes(NO_FACT_GROUP_HEADING) && d.indexOf("Ingredients") < d.indexOf(NO_FACT_GROUP_HEADING));
});

test("an empty group is left out: no No-fact heading when every row is cited, no Ingredients heading when none is", () => {
  const allCited = buildScreeningMemo(result([block("ipc415_property", ["established", "established", "not_confirmed"])]), OPTS);
  assert.ok(allCited.includes("### Ingredients") && !allCited.includes(`### ${NO_FACT_GROUP_HEADING}`));
  const allNone = buildScreeningMemo(result([block("ipc415_property", NONE)]), OPTS);
  assert.ok(!allNone.includes("### Ingredients") && allNone.includes(`### ${NO_FACT_GROUP_HEADING}`));
});

test("the review agenda is the screen's constant, once, under the heading of the first block with no supported ingredient (agendaContractId): all-none, mixed, all-supported", () => {
  const agendaAt = (md: string): string[] => md.split("\n").flatMap((l, i, a) => (l === AGENDA_BANNER_TEXT ? [a.slice(0, i).filter((x) => x.startsWith("## ")).pop() ?? ""] : []));
  // all none: under the first block
  const none = result([block("ipc415_property", NONE), block("ipc415_damaging_act", NONE)]);
  assert.deepEqual(agendaAt(buildScreeningMemo(none, OPTS)), [`## ${memoBlockHeading("ipc415_property")}`]);
  // mixed: block 1 has a supported ingredient, block 2 has none: the agenda is under block 2, and only there (the screen shows it on block 2)
  const mixed = result([block("ipc415_property", SOME), block("ipc415_damaging_act", NONE)]);
  assert.equal(agendaContractId(mixed.contracts, mixed.facts), "ipc415_damaging_act");
  assert.deepEqual(agendaAt(buildScreeningMemo(mixed, OPTS)), [`## ${memoBlockHeading("ipc415_damaging_act")}`]);
  // all supported somewhere in every block: no agenda
  const cited = result([block("ipc415_property", SOME), block("ipc415_damaging_act", SOME)]);
  assert.equal(agendaContractId(cited.contracts, cited.facts), null);
  assert.deepEqual(agendaAt(buildScreeningMemo(cited, OPTS)), []);
  // the agenda sentence is in the Word memo too, once
  assert.equal(count(docxText(none), AGENDA_BANNER_TEXT), 1);
  assert.equal(count(docxText(cited), AGENDA_BANNER_TEXT), 0);
});

test("memo and screen agree: for every mix of three blocks the memo's agenda sits under exactly the block agendaContractId names", () => {
  const ids = ["ipc415_property", "ipc415_damaging_act", "ipc405_misappropriation"];
  for (let mask = 0; mask < 8; mask++) {
    const r = result(ids.map((id, k) => block(id, mask & (1 << k) ? SOME : NONE)));
    const want = agendaContractId(r.contracts, r.facts);
    const md = buildScreeningMemo(r, OPTS);
    assert.equal(count(md, AGENDA_BANNER_TEXT), want === null ? 0 : 1, `mask ${mask}`);
    if (want !== null) {
      const at = md.indexOf(AGENDA_BANNER_TEXT);
      assert.equal(md.slice(0, at).split("\n").filter((l) => l.startsWith("## ")).pop(), `## ${memoBlockHeading(want)}`, `mask ${mask}`);
    }
  }
});
