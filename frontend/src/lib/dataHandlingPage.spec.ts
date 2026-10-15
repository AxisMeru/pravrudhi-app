import assert from "node:assert/strict";
import test from "node:test";

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
  assert.equal(DH_GLANCE_LINE, "These are the first lines of the sections below; read the full section for the rest.");
  assert.equal(DH_GLANCE_LINK, "See the full section");
  assert.deepEqual(OFF.glance.blocks.map((b) => b.id), ["sent", "where", "kept"]);
  const secs = dataHandlingSections(false, false);
  for (const b of OFF.glance.blocks) {
    const s = secs.find((x) => x.id === b.id)!;
    assert.equal(b.texts[0], s.paragraphs[0], `${b.id}: the first paragraph, verbatim`);
    assert.equal(b.heading, s.heading);
    assert.equal(b.href, `#dh-${b.id}`);
  }
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
    assert.equal(where.texts[0], dataHandlingSections(false, false).find((s) => s.id === "where")!.paragraphs[0]);
    assert.equal(where.texts[1], DH_WHERE_FALLBACK);
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
