import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { REGISTRY, REGISTRY_DRAFTING, REGISTRY_LOOKUP, registryEntries, REGISTRY_FALLBACK_ON, REGISTRY_MACHINE, REGISTRY_WORDS, DRAFTING_WORKFLOW_KEYS, parseStatusWorkflows, readMap, registryAvailable, registryHref, toolsOffLineShown, type WorkflowsRead } from "./workflowRegistry";

const root = join(__dirname, "..", "..");
const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

// R1's words (WORKFLOW_REGISTRY_WORDS_DRAFT_R1_2026-10-20.md sha12 bda372ae9d62): title / one line, sha256[:16].
const PINS: Record<string, [string, string]> = {
  wf_a2_span_index: ["1ec1a29ecd3f03f9", "1d7c4c538386d571"],
  wf_a3_chronology: ["c96cad0be677f0b8", "b6fdf8f2e4cd746f"],
  wf_a5_ingredient_agenda: ["998b578bcf6d0cb2", "23fce3f5bc49c806"],
  wf_s1_matter_citation_sweep: ["a43b0c3543c11808", "93c987008a0b5b6e"],
  wf_b2_quashing_agenda: ["9ad16331df1763d0", "e3fb596532aaa23f"],
  wf_a6_cheque_case_check: ["d73f98d51a9f2765", "e8188623a6b4296d"],
  wf_a7_matter_hearing_pack: ["c30f3734394fd70d", "e3990fe0ed316c81"],
  wf_b3_s138_checklist: ["c7ba09d8299c6f2c", "3277342a0ffb5328"],
};

test("the registry is the eight engine workflows of 0.6.23 (a2, a3, a5, s1, b2, a6, a7, b3 on; a4, a8 not listed), keyed by their wf_* ids, Papers for a matter first", () => {
  assert.deepEqual([...REGISTRY.map((e) => e.key)].sort(), Object.keys(PINS).sort());
  assert.equal(REGISTRY[0].key, "wf_a2_span_index");
  assert.equal(REGISTRY[0].startHere, true);
  assert.equal(REGISTRY.filter((e) => e.startHere).length, 1);
  for (const k of REGISTRY.map((e) => e.key)) assert.doesNotMatch(k, /a4|a8|b1|ocr/i, "A4, A8, B1 and OCR are not cards");
  assert.deepEqual([...REGISTRY_FALLBACK_ON].sort(), Object.keys(PINS).sort());
});

test("every title and line is R1's by hash, at most 90 characters, and says nothing the rules bar", () => {
  for (const e of REGISTRY) {
    assert.deepEqual([h16(e.title), h16(e.line)], PINS[e.key], e.key);
    assert.ok(e.line.length <= 90, `${e.key}: ${e.line.length} chars`);
    assert.doesNotMatch(`${e.title} ${e.line}`.replace(/section 138/gi, ""), /preview|accura|model|\d/i, e.key); // no count or figure; "section 138" is the statute's name
  }
  assert.deepEqual(REGISTRY.filter((e) => e.usesPapers).map((e) => e.key).sort(), REGISTRY.filter((e) => e.key !== "wf_b3_s138_checklist").map((e) => e.key).sort(), "every card except the section 138 checklist uses the matter's papers");
  assert.equal(h16(REGISTRY_WORDS.tagUsesPapers), "e00835a96f841381");
  assert.equal(h16(REGISTRY_WORDS.chipAvailable), "e674447337e83c13");
  assert.equal(h16(REGISTRY_WORDS.chipComing), "6ae8acc62a5344f4");
  assert.equal(h16(REGISTRY_WORDS.startHere), "2adc964c084749b1");
});

test("availability: the engine's status field decides when present; the 0.6.23 set is the fallback; a failed read never hides a card", () => {
  for (const fb of [registryAvailable(undefined), registryAvailable(null)]) {
    assert.ok(REGISTRY.every((e) => fb[e.key]), "the eight are on in the fallback");
    assert.equal(fb.wf_a4_bail_drafting, false, "a build that does not list A4/A8 reports them off (they are not rows there)");
    assert.equal(fb.wf_a8_synopsis_list_of_dates, false);
  }
  const some = registryAvailable({ wf_a3_chronology: true, wf_b3_s138_checklist: false });
  assert.equal(some.wf_a3_chronology, true);
  assert.equal(some.wf_b3_s138_checklist, false);
  assert.equal(some.wf_a5_ingredient_agenda, false, "a key the status omits is not on");
  assert.equal(registryAvailable({ wf_a3_chronology: "true" }).wf_a3_chronology, false, "only a real true counts");
});

test("every card opens a tool card that exists on the matter-tools page, and no card names a preview", () => {
  const page = readFileSync(join(root, "src", "app", "matter-tools", "page.tsx"), "utf8");
  for (const e of REGISTRY) {
    assert.match(registryHref(e), /^\/matter-tools#pv-[a-z0-9]+$/);
    if (e.anchor === "pv-matter") assert.match(page, /id="pv-matter"/);
    else assert.match(page, new RegExp(`<Card id="${e.anchor.slice(3)}"`), e.key);
  }
});

test("the machine-readable list (workflowRegistry.json) equals the registry: id, status, route, verb", () => {
  const file = JSON.parse(readFileSync(join(root, "src", "lib", "workflowRegistry.json"), "utf8"));
  assert.deepEqual(file, REGISTRY_MACHINE);
  for (const m of REGISTRY_MACHINE) { assert.match(m.route, /^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/); assert.equal(m.verb, "POST"); assert.equal(m.status, "Available"); }
});

const ALL8: Record<string, boolean> = Object.fromEntries(REGISTRY.map((e) => [e.key, true]));
const ALL10: Record<string, boolean> = { ...ALL8, wf_a4_bail_drafting: true, wf_a8_synopsis_list_of_dates: true };
const map = (m: Record<string, boolean>): WorkflowsRead => ({ kind: "map", map: m });

test("R1's rule for the 'some tools are not switched on' line (#475): shown only when a tool the page shows is reported off in a present map; hidden when the status is unreadable or loading; the pinned fallback shows it only while the A4/A8 cards are on", () => {
  assert.deepEqual([...DRAFTING_WORKFLOW_KEYS], ["wf_a4_bail_drafting", "wf_a8_synopsis_list_of_dates"]);
  // all on -> hidden (cards on and cards off)
  assert.equal(toolsOffLineShown(map(ALL10), true), false, "all ten on, cards on");
  assert.equal(toolsOffLineShown(map(ALL8), false), false, "all eight on, cards off (A4/A8 are not shown, so their state is not the page's)");
  // one registry key off -> shown
  assert.equal(toolsOffLineShown(map({ ...ALL10, wf_a3_chronology: false }), true), true);
  assert.equal(toolsOffLineShown(map({ ...ALL8, wf_a3_chronology: false }), false), true);
  // A4 / A8 off -> shown while their cards are on, not when the cards are off
  assert.equal(toolsOffLineShown(map({ ...ALL10, wf_a4_bail_drafting: false }), true), true, "a4 off, cards on");
  assert.equal(toolsOffLineShown(map({ ...ALL10, wf_a8_synopsis_list_of_dates: false }), true), true, "a8 off, cards on");
  assert.equal(toolsOffLineShown(map({ ...ALL8, wf_a4_bail_drafting: false, wf_a8_synopsis_list_of_dates: false }), false), false, "a4/a8 off but their cards are not shown");
  // a key missing from a map that exists counts as off
  const missing = { ...ALL10 }; delete missing.wf_a5_ingredient_agenda;
  assert.equal(toolsOffLineShown(map(missing), true), true, "registry key missing from a present map");
  const noA8 = { ...ALL10 }; delete noA8.wf_a8_synopsis_list_of_dates;
  assert.equal(toolsOffLineShown(map(noA8), true), true, "a8 missing from a present map, cards on");
  // unreadable or loading -> hidden (never claim a tool is off on a guess)
  assert.equal(toolsOffLineShown({ kind: "unreadable" }, true), false);
  assert.equal(toolsOffLineShown({ kind: "unreadable" }, false), false);
  assert.equal(toolsOffLineShown({ kind: "loading" }, true), false);
  // readable status, no map: the fallback is the shipped engine config (the eight + A4/A8 on), so nothing the page shows is off there: the line is hidden on both builds
  assert.equal(toolsOffLineShown({ kind: "none" }, true), false, "fallback with the A4/A8 cards on: all on, line hidden (Lead-2, 21 Oct)");
  assert.equal(toolsOffLineShown({ kind: "none" }, false), false, "fallback with the A4/A8 cards off: all eight on");
  const page = readFileSync(join(root, "src", "app", "matter-tools", "page.tsx"), "utf8");
  assert.match(page, /\{toolsOffLineShown\(engineWorkflows, DRAFTING_CARDS\) && <p[^>]*pv-tools-off-line/);
  assert.equal(readMap(map(ALL8)), ALL8);
  assert.equal(readMap({ kind: "none" }), null);
  assert.equal(readMap({ kind: "unreadable" }), null);
});

test("the status workflows field is read as booleans only; absent or malformed means the fallback; a key the engine says is off is off", () => {
  assert.equal(parseStatusWorkflows(undefined), null);
  assert.equal(parseStatusWorkflows(null), null);
  assert.equal(parseStatusWorkflows([true]), null);
  assert.equal(parseStatusWorkflows("on"), null);
  assert.deepEqual(parseStatusWorkflows({ wf_a3_chronology: true, wf_a5_ingredient_agenda: false, wf_b3_s138_checklist: "true", wf_x: 1 }), { wf_a3_chronology: true, wf_a5_ingredient_agenda: false });
  const all = Object.fromEntries(REGISTRY.map((e) => [e.key, true]));
  const a = registryAvailable(parseStatusWorkflows({ ...all, wf_a3_chronology: false }));
  assert.equal(a.wf_a3_chronology, false);
  assert.equal(a.wf_a5_ingredient_agenda, true);
  assert.equal(parseStatusWorkflows({}), null, "an object with no boolean is no map");
  assert.equal(parseStatusWorkflows({ a: "x", b: 1 }), null);
  const fbk = registryAvailable(parseStatusWorkflows(undefined));
  assert.deepEqual(REGISTRY.every((e) => fbk[e.key]), true, "no field: the 0.6.23 fallback (the eight)");
});

// #502 (Lead-2: what is built must show in production): the two drafting rows, R1's words (REGISTRY_A4_A8_ROWS_R1_2026-10-21.md sha12 8e64dfe094a2) pinned by hash. Listed only on a build with the drafting cards.
test("the A4 and A8 rows: R1's titles, lines and the declaration line by hash, order after the eight, anchors that exist on the page, one tag only on A8, no model claim", () => {
  assert.deepEqual(REGISTRY_DRAFTING.map((e) => e.key), ["wf_a4_bail_drafting", "wf_a8_synopsis_list_of_dates"]);
  const [a4, a8] = REGISTRY_DRAFTING;
  assert.deepEqual([h16(a4.title), h16(a4.line), h16(a4.note ?? "")], ["4abe4799041c98ab", "dfebbbbdc67e4aa2", "d01a5f640a2e2d8f"]);
  assert.deepEqual([h16(a8.title), h16(a8.line), h16(a8.note ?? "")], ["243e6b516834025d", "f124ae97efc3e705", "d01a5f640a2e2d8f"]);
  assert.ok(a4.line.length <= 90 && a8.line.length <= 90 && (a4.note ?? "").length <= 90);
  assert.equal(a4.usesPapers, false);
  assert.equal(a8.usesPapers, true);
  assert.doesNotMatch(`${a4.title} ${a4.line} ${a4.note} ${a8.title} ${a8.line} ${a8.note}`, /\bmodel\b|AI\b|template|fixed|preview|accura/i, "R1: no model claim on the rows");
  assert.deepEqual(registryEntries(false).map((e) => e.key), REGISTRY.map((e) => e.key), "no drafting cards on the build: the eight only");
  assert.deepEqual(registryEntries(true).map((e) => e.key), [...REGISTRY.map((e) => e.key), ...REGISTRY_DRAFTING.map((e) => e.key)], "the two follow Cheque case check");
  const draft = readFileSync(join(root, "src", "components", "preview", "Drafting.tsx"), "utf8");
  assert.match(draft, /<section className=\{BOX\} id=\{`pv-\$\{id\}`\}/, "the boxes carry the id the rows link to");
  assert.match(draft, /<Box id="bail"/);
  assert.match(draft, /<Box id="synopsis"/);
  for (const e of REGISTRY_DRAFTING) assert.match(registryHref(e), /^\/matter-tools#pv-(bail|synopsis)$/);
  const cards = readFileSync(join(root, "src", "components", "WorkflowCards.tsx"), "utf8");
  assert.match(cards, /registryEntries\(DRAFTING_CARDS(, SECTION_LOOKUP)?\)/);
  assert.match(cards, /data-testid="workflow-card-note"/);
  const fb = registryAvailable(undefined);
  assert.equal(fb.wf_a4_bail_drafting, false);
  assert.deepEqual(registryAvailable({ wf_a4_bail_drafting: true, wf_a8_synopsis_list_of_dates: true }).wf_a8_synopsis_list_of_dates, true);
  assert.equal(REGISTRY_MACHINE.length, 10);
  assert.equal(REGISTRY_MACHINE.filter((m) => m.status === "Available").length, 10);
  assert.deepEqual(REGISTRY_MACHINE.slice(8), [{ id: "wf_a4_bail_drafting", status: "Available", route: "/bail-draft", verb: "POST" }, { id: "wf_a8_synopsis_list_of_dates", status: "Available", route: "/synopsis-dates", verb: "POST" }]);
});

// The 11th row, section look-up (R1's REGISTRY_B1_ROW_R1_2026-10-21.md sha12 ce7f2fb654ea): listed only with NEXT_PUBLIC_SECTION_LOOKUP, never Available unless the engine's status map says so, not in the always-on machine list.
test("the section look-up row: R1's title and line by hash, last of eleven, only with the look-up flag, Available only when the engine map says wf_b1_section_lookup is true", () => {
  assert.equal(REGISTRY_LOOKUP.key, "wf_b1_section_lookup");
  assert.deepEqual([h16(REGISTRY_LOOKUP.title), h16(REGISTRY_LOOKUP.line)], ["6d86b06c3a340542", "ea40e5b9dd6801ac"]);
  assert.ok(REGISTRY_LOOKUP.line.length <= 90);
  assert.equal(REGISTRY_LOOKUP.note, undefined);
  assert.equal(REGISTRY_LOOKUP.usesPapers, false, "R1: no tag, it works from a typed number");
  assert.doesNotMatch(`${REGISTRY_LOOKUP.title} ${REGISTRY_LOOKUP.line}`, /equivalent|replaces|converted|updated law|\bmodel\b|preview|accura|\d/i);
  assert.equal(REGISTRY_LOOKUP.anchor, "pv-sl");
  assert.equal(registryHref(REGISTRY_LOOKUP), "/matter-tools#pv-sl");
  assert.deepEqual(registryEntries(true, true).map((e) => e.key).slice(-3), ["wf_a4_bail_drafting", "wf_a8_synopsis_list_of_dates", "wf_b1_section_lookup"]);
  assert.equal(registryEntries(true, true).length, 11);
  assert.equal(registryEntries(true, false).length, 10, "no look-up flag: ten");
  assert.equal(registryEntries(false, false).length, 8);
  assert.ok(!registryEntries(true, false).some((e) => e.key === "wf_b1_section_lookup"));
  assert.equal(registryAvailable(undefined).wf_b1_section_lookup, true, "the fallback has the look-up on (Lead-2, 22 Oct); a build without the look-up card does not list the row at all");
  assert.equal(registryAvailable({ ...Object.fromEntries(REGISTRY.map((e) => [e.key, true])) }).wf_b1_section_lookup, false, "a map that omits it: off");
  assert.equal(registryAvailable({ wf_b1_section_lookup: false }).wf_b1_section_lookup, false);
  assert.equal(registryAvailable({ wf_b1_section_lookup: true }).wf_b1_section_lookup, true);
  assert.ok(!REGISTRY_MACHINE.some((m) => m.id === "wf_b1_section_lookup"), "the always-on machine list (the gate's ten) does not carry it");
  const cards = readFileSync(join(root, "src", "components", "WorkflowCards.tsx"), "utf8");
  assert.match(cards, /registryEntries\(DRAFTING_CARDS, SECTION_LOOKUP\)/);
  const sl = readFileSync(join(root, "src", "components", "preview", "SectionLookup.tsx"), "utf8");
  assert.match(sl, /id="pv-sl"/, "the look-up card carries the id the row links to");
  // R2 (#503 follow-up): the look-up flag is read in ONE place, lib/sectionLookup.ts (=== "1"); the row takes it from there, no second env read
  assert.match(cards, /import \{ SECTION_LOOKUP \} from "@\/lib\/sectionLookup";/);
  assert.doesNotMatch(cards, /process\.env/);
  assert.doesNotMatch(readFileSync(join(root, "src", "lib", "workflowRegistry.ts"), "utf8"), /process\.env/);
});

// Lead-2 (21 Oct, decision b): the anonymous / unreadable-status fallback follows the shipped engine config: on a drafting build A4 and A8 are Available WITH links when the status map cannot be read; the section look-up row WAS never Available in the fallback (R1); Lead-2 changed that on 22 Oct after the live transient read: it is Available there now
// (a build that lists it shows its link); a readable map still decides everything (an omitted key is off).
test("fallback by build: eight only / drafting build adds A4 and A8 / the look-up is Available in it (22 Oct); a readable map decides; no map and unreadable status are the same fallback", () => {
  const eight = Object.fromEntries(REGISTRY.map((e) => [e.key, true]));
  for (const noMap of [undefined, null]) {
    const plain = registryAvailable(noMap, {});
    assert.deepEqual(REGISTRY.map((e) => plain[e.key]), REGISTRY.map(() => true));
    assert.equal(plain.wf_a4_bail_drafting, false); assert.equal(plain.wf_a8_synopsis_list_of_dates, false); assert.equal(plain.wf_b1_section_lookup, true);
    const draft = registryAvailable(noMap, { drafting: true });
    assert.equal(draft.wf_a4_bail_drafting, true); assert.equal(draft.wf_a8_synopsis_list_of_dates, true); assert.equal(draft.wf_b1_section_lookup, true, "the look-up row is on in the fallback on every build");
    // Lead-2 (22 Oct): the look-up row is Available in the fallback on any build (the card works; a slow or failed map read must not say Coming)
    for (const b of [{}, { drafting: true }]) assert.equal(registryAvailable(noMap, b).wf_b1_section_lookup, true);
  }
  // a readable map decides on every build: an omitted key is off (even with the build flags), a true key is on
  for (const b of [{}, { drafting: true }]) {
    const m = registryAvailable(eight, b);
    assert.deepEqual([m.wf_a4_bail_drafting, m.wf_a8_synopsis_list_of_dates, m.wf_b1_section_lookup], [false, false, false], "a map without them: off");
    const on = registryAvailable({ ...eight, wf_a4_bail_drafting: true, wf_a8_synopsis_list_of_dates: false, wf_b1_section_lookup: true }, b);
    assert.deepEqual([on.wf_a4_bail_drafting, on.wf_a8_synopsis_list_of_dates, on.wf_b1_section_lookup], [true, false, true]);
  }
  // an unusable object (no boolean) is no map: parseStatusWorkflows -> null -> the fallback
  assert.equal(registryAvailable(parseStatusWorkflows({ a: "x" }), { drafting: true }).wf_a4_bail_drafting, true);
  const cards = readFileSync(join(root, "src", "components", "WorkflowCards.tsx"), "utf8");
  assert.match(cards, /registryAvailable\(statusWorkflows, \{ drafting: DRAFTING_CARDS \}\)/);
});
