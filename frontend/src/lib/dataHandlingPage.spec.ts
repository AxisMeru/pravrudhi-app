import assert from "node:assert/strict";
import test from "node:test";

import { firstSentence, splitSentences } from "./dataHandling";
import { BANNED } from "./wordingAudit";
import { promiseHits } from "../../e2e/support/noTrainingPromise";
import {
  DH_ASSIST_CONSENT, DH_ASSIST_DELETE, DH_GLANCE_ASSIST_AFTER, DH_GLANCE_ASSIST_BEFORE, DH_WHERE_FALLBACK, DH_ASSIST_INTRO, DH_ASSIST_SIGNIN, DH_GLANCE_HEADING, DH_GLANCE_LINE, DH_GLANCE_LINK, DH_NOASSIST, DH_ROUTE_A_LABEL, DH_ROUTE_B_LABEL,
  dataHandlingPage, dataHandlingSections,
} from "./dataHandling";

// P10 (R1, 14 Oct): "At a glance" + the two routes. Signed text only; three flag states: assistant off, on, on with the delete sentence.
const OFF = dataHandlingPage(false, false);
const ON = dataHandlingPage(true, false);
const ON_DELETE = dataHandlingPage(true, true);

test("the glance: R1's heading, line and link label exactly; three blocks = the first signed paragraph of sent / where / kept, verbatim, each linking to its section", () => {
  assert.equal(DH_GLANCE_HEADING, "At a glance");
  assert.equal(DH_GLANCE_LINE, "A short version of the sections below; the sections hold the full text.");
  assert.equal(DH_GLANCE_LINK, "See the full section");
  assert.deepEqual(OFF.glance.blocks.map((b) => b.id), ["sent", "where", "kept"]);
  const secs = dataHandlingSections(false, false);
  for (const b of OFF.glance.blocks) {
    const s = secs.find((x) => x.id === b.id)!;
    assert.equal(b.heading, s.heading);
    assert.equal(b.href, `#dh-${b.id}`);
    for (const t of b.texts) assert.ok(t.length > 0);
  }
  // R1 (15 Oct, #300): the three glance texts, exactly (each is sentences of the section's own text; the full sections stay as they are)
  const [sent, where, kept] = OFF.glance.blocks;
  assert.deepEqual(sent.texts, ["When you press Screen these facts, the facts you enter and the offences you select are sent to the Pravrudhi engine."]);
  assert.deepEqual(where.texts, [
    "The screening runs on the Pravrudhi engine, hosted on RunPod (serverless, in an EU data centre). Parts of the screening run in EU data centres; for some parts the region is not fixed.",
    "If our EU processing is unavailable, part of the screening may instead run in a North American data centre for that request, and your facts are sent there.",
  ]);
  assert.ok(!where.texts.join(" ").includes("described above"), "the fallback's tail would point above at the wrong block");
  assert.deepEqual(kept.texts, ["Run records are kept for up to 7 days. A run record can include the text of facts the screening marked as supported, so do not enter real names or case details unless your firm's setup allows it."]);
  const full = (id: string) => secs.find((x) => x.id === id)!.paragraphs.join(" ");
  for (const [id, b] of [["sent", sent], ["where", where], ["kept", kept]] as const) for (const t of b.texts) for (const sentence of splitSentences(t)) assert.ok(full(id).includes(sentence) || DH_WHERE_FALLBACK.includes(sentence), `${id}: every glance sentence is the section's own words`);
  assert.match(OFF.glance.blocks[0].texts[0], /^When you press Screen these facts, the facts you enter and the offences you select are sent to the Pravrudhi engine\./);
  assert.match(OFF.glance.blocks[1].texts[0], /^The screening runs on the Pravrudhi engine, hosted on RunPod/);
  assert.match(OFF.glance.blocks[2].texts[0], /^Run records are kept for up to 7 days\./);
});

test("the glance covers the standard route only and adds no sentence of its own beyond the signed label lines", () => {
  for (const p of [OFF, ON, ON_DELETE]) {
    assert.deepEqual(p.glance.blocks.map((b) => b.texts), OFF.glance.blocks.map((b) => b.texts), "the three blocks are identical whatever the assistant flags");
    assert.doesNotMatch(p.glance.blocks.flatMap((b) => b.texts).join(" "), /Anthropic|assistant/i);
    assert.doesNotMatch(JSON.stringify(p.glance), /Anthropic/, "no mention of Anthropic anywhere in the glance");
  }
  const mine = [DH_GLANCE_HEADING, DH_GLANCE_LINE, DH_GLANCE_LINK, DH_ROUTE_A_LABEL, DH_ROUTE_B_LABEL].join(" ");
  assert.deepEqual(promiseHits(mine), []);
  for (const s of [DH_GLANCE_HEADING, DH_GLANCE_LINE, DH_GLANCE_LINK, DH_ROUTE_A_LABEL, DH_ROUTE_B_LABEL]) assert.doesNotMatch(s, BANNED, s);
});

test("every glance link points at a section that is on the page", () => {
  for (const p of [OFF, ON]) for (const b of p.glance.blocks) assert.ok(p.standard.some((s) => `#dh-${s.id}` === b.href), b.href);
});

test("assistant flag OFF: route A only. No assistant section, no group label, nothing about Anthropic anywhere on the page", () => {
  assert.equal(OFF.assistant, undefined);
  assert.ok(!JSON.stringify(OFF).includes("Anthropic"));
  assert.ok(!JSON.stringify(OFF).includes(DH_ROUTE_A_LABEL) && !JSON.stringify(OFF).includes(DH_ROUTE_B_LABEL));
  assert.deepEqual(OFF.standard.map((s) => s.id), ["sent", "citations", "kept", "where", "browser", "documents"], "the standard sections are unchanged, in their order");
});

test("assistant flag ON: the two groups carry R1's exact labels and only already-signed lines; route A is the one signed 'Without the assistant' line", () => {
  const a = ON.assistant!;
  assert.deepEqual(a.groups.map((g) => g.label), ["Without the assistant", "With the assistant (only when you tick the consent box)"]);
  assert.deepEqual(a.groups[0].paragraphs, [DH_NOASSIST]);
  assert.ok(a.groups[1].paragraphs.includes(DH_ASSIST_INTRO) && a.groups[1].paragraphs.includes(DH_ASSIST_CONSENT) && a.groups[1].paragraphs.includes(DH_ASSIST_SIGNIN));
  assert.ok(!a.groups[1].paragraphs.includes(DH_NOASSIST));
  assert.deepEqual([...a.groups[0].paragraphs, ...a.groups[1].paragraphs].sort(), [...a.section.paragraphs].sort(), "nothing added, nothing dropped");
  assert.equal(a.section.heading, "Screening with the assistant (optional)", "the heading the 'where' sentence names is kept");
  assert.ok(ON.standard.every((s) => s.id !== "assistant"), "the groups sit below the standard sections, which do not include the assistant");
});

test("the delete sentence is in route B only when its own flag is on", () => {
  assert.ok(!ON.assistant!.groups[1].paragraphs.includes(DH_ASSIST_DELETE));
  assert.ok(ON_DELETE.assistant!.groups[1].paragraphs.includes(DH_ASSIST_DELETE));
  assert.ok(!ON_DELETE.assistant!.groups[0].paragraphs.includes(DH_ASSIST_DELETE));
});

test("DH_NOASSIST's 'described above' is true: the groups are rendered below the standard sections (page order pinned in the e2e)", () => {
  assert.match(DH_NOASSIST, /described above/);
  assert.ok(ON.standard.length > 0 && ON.assistant);
});

test("R1: the 'where' glance block shows the first signed paragraph AND the fallback-region sentence, each verbatim as its own paragraph; the other two blocks show one", () => {
  for (const p of [OFF, ON]) {
    const where = p.glance.blocks.find((b) => b.id === "where")!;
    assert.equal(where.texts.length, 2);
    assert.ok(where.texts[0].startsWith("The screening runs on the Pravrudhi engine, hosted on RunPod (serverless, in an EU data centre)."));
    assert.equal(where.texts[1], firstSentence(DH_WHERE_FALLBACK));
    assert.match(where.texts[1], /North American data centre for that request, and your facts are sent there/);
    assert.deepEqual(p.glance.blocks.filter((b) => b.id !== "where").map((b) => b.texts.length), [1, 1]);
  }
});

test("R1: with the assistant ON the glance has ONE line after the three blocks pointing at route B (exact words, link label = the quoted group title); OFF it is absent", () => {
  assert.equal(OFF.glance.assistantLine, undefined);
  for (const p of [ON, ON_DELETE]) {
    const l = p.glance.assistantLine!;
    assert.equal(`${l.before}${l.link}${l.after}`, "The optional assistant changes this: see “With the assistant (only when you tick the consent box)” below.");
    assert.equal(l.link, DH_ROUTE_B_LABEL);
    assert.equal(l.href, "#dh-assistant");
    assert.ok(l.before === DH_GLANCE_ASSIST_BEFORE && l.after === DH_GLANCE_ASSIST_AFTER);
    assert.doesNotMatch(`${l.before}${l.link}${l.after}`, /Anthropic/);
  }
});
