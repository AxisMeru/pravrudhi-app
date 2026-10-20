import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { REGISTRY, REGISTRY_FALLBACK_ON, REGISTRY_MACHINE, REGISTRY_WORDS, registryAvailable, registryHref, someRegistryToolOff } from "./workflowRegistry";

const root = join(__dirname, "..", "..");
const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

// R1's words (WORKFLOW_REGISTRY_WORDS_DRAFT_R1_2026-10-20.md sha12 bda372ae9d62): title / one line, sha256[:16].
const PINS: Record<string, [string, string]> = {
  wf_a2_span_index: ["1ec1a29ecd3f03f9", "25c519a8b94feacf"],
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
  assert.ok(Object.values(registryAvailable(undefined)).every(Boolean));
  assert.ok(Object.values(registryAvailable(null)).every(Boolean));
  const some = registryAvailable({ wf_a3_chronology: true, wf_b3_s138_checklist: false });
  assert.equal(some.wf_a3_chronology, true);
  assert.equal(some.wf_b3_s138_checklist, false);
  assert.equal(some.wf_a5_ingredient_agenda, false, "a key the status omits is not on");
  assert.equal(registryAvailable({ wf_a3_chronology: "true" }).wf_a3_chronology, false, "only a real true counts");
});

test("every card opens a tool card that exists on the matter-tools page, and no card names a preview", () => {
  const page = readFileSync(join(root, "src", "app", "preview", "page.tsx"), "utf8");
  for (const e of REGISTRY) {
    assert.match(registryHref(e), /^\/preview#pv-[a-z0-9]+$/);
    if (e.anchor === "pv-matter") assert.match(page, /id="pv-matter"/);
    else assert.match(page, new RegExp(`<Card id="${e.anchor.slice(3)}"`), e.key);
  }
});

test("the machine-readable list (workflowRegistry.json) equals the registry: id, status, route, verb", () => {
  const file = JSON.parse(readFileSync(join(root, "src", "lib", "workflowRegistry.json"), "utf8"));
  assert.deepEqual(file, REGISTRY_MACHINE);
  for (const m of REGISTRY_MACHINE) { assert.match(m.route, /^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/); assert.equal(m.verb, "POST"); assert.equal(m.status, "Available"); }
});

test("R1's 'some tools are not switched on' line: hidden while all eight are on, shown when a registry tool is off", () => {
  assert.equal(someRegistryToolOff(null), false, "all eight on (the 0.6.23 set): the line would be untrue");
  assert.equal(someRegistryToolOff(undefined), false);
  assert.equal(someRegistryToolOff(Object.fromEntries(REGISTRY.map((e) => [e.key, true]))), false);
  assert.equal(someRegistryToolOff({ ...Object.fromEntries(REGISTRY.map((e) => [e.key, true])), wf_a3_chronology: false }), true, "one off: the line is true");
  const page = readFileSync(join(root, "src", "app", "preview", "page.tsx"), "utf8");
  assert.match(page, /\{someRegistryToolOff\(null\) && <p[^>]*pv-tools-off-line/, "the page shows the line only through the check");
});
