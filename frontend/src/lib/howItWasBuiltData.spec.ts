import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { DATA_LEAD_INS, DATA_LIMITS, DATA_NOT_PUBLISHED, DATA_NOTE_TEXT, DATA_SETS, groupLines, leadInOf } from "./howItWasBuiltData";
import { NS_HIDDEN_SPLIT } from "./nyayasiddhiSubmit";
import { STATUTE_NOTICE } from "./statuteNotice";

// R1's worded data note (HOW_BUILT_DATA_NOTE_R1_WORDED_v1h_2026-10-17.md, sha12 ab10210c43c4 (v1h; r6_source is still the v1b/v1c neutral row until the Interim lead confirms the High Court wording)): every SHIP key pinned by sha256[:16]; the HELD keys are not built.
const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Readonly<Record<string, string>> = {
  heading: "c621772b57075c5d",
  intro: "43d9661255e3de26",
  r1_name: "bb94f1beefe14d49",
  r1_source: "d6e92ea1c0726e70",
  r1_licence: "7a20a4b7b079dba0",
  r1_used: "b0587a3b9cbb3b97",
  r1_published: "a76689b13870c76d",
  r1_caveat_cov: "1a33c97339fcc38f",
  r1_caveat_attr: "70a07b6765f9dcc8",
  r2_name: "91e95fa53295a428",
  r2_source: "2760089b9194ca9d",
  r3_name: "0002dc7760e15464",
  r3_source: "08db8d4bcbe81563",
  r3_licence_fallback: "34b560058012e8bc",
  r3_used: "23785039b5e44619",
  r3_published: "45cd57eda5376c43",
  r3_caveat: "f7175985fdc2c7da",
  r4_name: "d8a63070658dbe2b",
  r4_source: "9326cb371b9f4467",
  r4_licence: "cfa4c4e4a3951ca1",
  r4_caveat: "7d75b21654362c1e",
  r5_name: "1c53a0f0a1e5040b",
  r5_source: "e35e0499bfebc4fb",
  r5_published: "a8df789192e72303",
  r5_caveat: "e94bea476a5f9ffa",
  r6_name: "a7042792ed22203f",
  r6_source: "fb2c4631c9fb9926",
  r6_source_quote: "1e780be39dedcbb4",
  r6_licence: "c02de90f9d01cc59",
  r6_used: "c5ee9155ddb646a7",
  r6_published: "0650c4a5036b77c9",
  r6_caveat: "2eb08cd810fb29af",
  r7_name: "ea7ff81a02a0e0c9",
  r7_source: "01f96b657b0128f3",
  r7_published: "bf0c3281716627d6",
  r7_caveat: "b063a1e0aca5c40a",
  r7_sc: "599961da34bf3282",
  r8_name: "54683b82d98c7133",
  r8_casehold: "d14d49a0ab7610ec",
  r8_legalbench: "abb01bb3facc1d76",
  r8_published: "c08d9e1ad519088a",
  r9_name: "abdf6a60cf28485e",
  r9_32b: "cefbf4600631bd99",
  r9_7b: "3c62ff36feb29f23",
  r9_other: "88fa6430db0e9d9c",
  r10_name: "4da81d2d92b3d99b",
  r10_source: "66eb311e05ff8a3c",
  r10_published: "7f7fdd817e453526",
  r10_caveat: "0191cf6628395c07",
  np_heading: "a368c51b0c4e6c8c",
  np1: "9355382258cdb8fa",
  np2: "6da219455dce2700",
  np3: "1502d9c1b8e3fdf1",
  np4: "665d870b61799247",
  np5: "ed90fbab9023fffc",
  cv_heading: "dffb64dc70011ecf",
  cv1: "2e4290e789b09aa6",
  cv2: "5a45f8b6ff77e50a",
  cv3: "99f39322affbcef3",
  cv4: "b5163f591e463040",
  cv5: "0bc039ef1be5f61f",
  cv6: "5c36a07ecec56f6a",
};
const HELD = ["r4_published"];

test("every shipped data-note sentence is exactly R1's, by hash, and no HELD key is built", () => {
  assert.deepEqual(Object.keys(DATA_NOTE_TEXT).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h(DATA_NOTE_TEXT[k]), hash, k);
  for (const k of HELD) assert.equal(Object.hasOwn(DATA_NOTE_TEXT, k), false, k);
});

test("the structure names only built keys, each once, in R1's order: sets, what is not published, limits", () => {
  const used = [...DATA_SETS.flatMap((s) => [s.name, ...s.lines]), ...DATA_NOT_PUBLISHED, ...DATA_LIMITS];
  for (const k of used) assert.ok(Object.hasOwn(DATA_NOTE_TEXT, k), k);
  assert.equal(new Set(used).size, used.length, "a key is used twice");
  for (const k of ["heading", "intro", "np_heading", "cv_heading"]) assert.ok(Object.hasOwn(DATA_NOTE_TEXT, k), k);
  assert.deepEqual(DATA_SETS.map((s) => s.id), ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"]);
});

test("r3_published quotes the app's own statute notice byte for byte, and the hidden-set line is the one constant", () => {
  assert.equal(DATA_NOTE_TEXT.r3_published, `Not republished. The app says "${STATUTE_NOTICE}"`);
  assert.equal(DATA_NOTE_TEXT.np3, NS_HIDDEN_SPLIT);
  assert.equal(h(DATA_NOTE_TEXT.np3), "1502d9c1b8e3fdf1");
});

test("own digit rule: no count anywhere; digits only in 'step 1', licence names and versions, and the two model names", () => {
  const ALLOWED = [/step 1/gi, /CC BY 4\.0/g, /Apache-2\.0/g, /v0\.2/g, /nyaya-element-judge-32b-v0/g, /Qwen\/Qwen2\.5-32B/g, /prabhasa-nyaya-7b-sft/g, /Qwen2\.5-7B/g, /our 7B fine-tune/g];
  for (const [k, t] of Object.entries(DATA_NOTE_TEXT)) {
    let rest = t;
    for (const re of ALLOWED) rest = rest.replace(re, "");
    assert.doesNotMatch(rest, /\d/, `${k}: a digit outside the allowed names`);
    assert.doesNotMatch(t, /sha256|BULK_RECORD|source map|INTERNAL/i, k);
  }
});

test("links in the note go only to the public AxisMeru dataset", () => {
  for (const [k, t] of Object.entries(DATA_NOTE_TEXT)) for (const u of t.match(/https?:\/\/\S+/g) ?? []) assert.match(u, /^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi$|^https:\/\/registry\.opendata\.aws\/|^https:\/\/github\.com\/vanga\/indian-high-court-judgments/, `${k}: ${u}`);
});

test("R1's five lead-ins are exact and in order, by hash", () => {
  assert.deepEqual(Object.values(DATA_LEAD_INS), ["Source", "Licence", "Used for", "Published", "Note"]);
  assert.deepEqual(Object.values(DATA_LEAD_INS).map(h), ["0e570ca6fabe24f9", "f3ec8e880a46c8a6", "9cd881a5aac2fa5d", "2ef42ec21d9300dd", "d8da2c49df39d91d"]);
});

test("lines get their lead-in by kind; several caveat lines share one Note; a set shows a lead-in only where it has that line", () => {
  assert.equal(leadInOf("r1_caveat_cov"), "note");
  assert.equal(leadInOf("r1_caveat_attr"), "note");
  assert.equal(leadInOf("r3_licence_fallback"), "licence");
  assert.equal(leadInOf("r2_source_fallback"), "source");
  assert.equal(leadInOf("r9_32b"), null);
  assert.equal(leadInOf("r7_sc"), "note");
  assert.equal(leadInOf("r6_source_quote"), "source");
  assert.deepEqual(groupLines(DATA_SETS.find((s) => s.id === "r6")!.lines)[0].keys, ["r6_source", "r6_source_quote"]);
  assert.deepEqual(groupLines(DATA_SETS.find((s) => s.id === "r7")!.lines).at(-1)?.keys, ["r7_caveat", "r7_sc"]);
  const r1 = DATA_SETS.find((s) => s.id === "r1")!;
  const g = groupLines(r1.lines);
  assert.deepEqual(g.map((x) => x.leadIn), ["source", "licence", "used", "published", "note"]);
  assert.deepEqual(g[4].keys, ["r1_caveat_cov", "r1_caveat_attr"]);
  const r4 = groupLines(DATA_SETS.find((s) => s.id === "r4")!.lines);
  assert.ok(!r4.some((x) => x.leadIn === "used" || x.leadIn === "published"), "r4 has no used/published line, so no such label");
});
