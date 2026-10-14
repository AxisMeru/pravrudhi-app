import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { BANNED, scanSource } from "../wordingAudit";
import { ABOUT_LINE, PRODUCT_LINE } from "../productCopy";
import { DEFENCE_HEADING, DEFENCE_PROMPT_NOTE, EXPORT_LABELS } from "../screening/copy";
import { OFFENCES, offenceLabel } from "../screening/offences";
import { GUIDE_ABOUT, GUIDE_COLD_START, GUIDE_COVERED, GUIDE_COVERED_NOTE, GUIDE_GLOSSARY, GUIDE_IMAGES, GUIDE_INTRO, GUIDE_LIMITS, GUIDE_STATUSES, GUIDE_STEPS } from "./copy";

const root = join(__dirname, "..", "..", "..");
const copySource = readFileSync(join(__dirname, "copy.ts"), "utf8");

test("the guide's own words carry no wording-audit hit: no proof, established or verbatim on the house path; the stale frontier sentences are gone (the frontier reader was removed in #129)", () => {
  assert.deepEqual(scanSource("src/lib/guide/copy.ts", copySource), []);
  assert.deepEqual(scanSource("src/app/guide/page.tsx", readFileSync(join(root, "src", "app", "guide", "page.tsx"), "utf8")), []);
});

test("every string the page shows, rendered from the copy, is free of the banned words", () => {
  const shown = [...GUIDE_STEPS.flatMap((s) => [s.heading, s.text, s.image?.alt ?? ""]), ...GUIDE_STATUSES.flatMap((s) => [s.label, s.meaning]), ...GUIDE_LIMITS];
  for (const t of shown) assert.doesNotMatch(t, BANNED, t);
});

test("the six screenshots are the files the guide names, each with plain alt text, and the files exist with invented-matter names only", () => {
  const files = Object.values(GUIDE_IMAGES).map((i) => i.file);
  assert.equal(new Set(files).size, 6);
  for (const i of Object.values(GUIDE_IMAGES)) {
    assert.match(i.file, /^0[1-6]-[a-z-]+\.png$/);
    assert.ok(i.alt.length > 30 && !BANNED.test(i.alt), i.alt);
    assert.ok(existsSync(join(root, "public", "guide", i.file)), `public/guide/${i.file} is missing`);
  }
  const extra = readdirSync(join(root, "public", "guide")).filter((f) => !files.includes(f) && !f.startsWith("."));
  assert.deepEqual(extra, [], "unlisted files in public/guide");
});

test("the guide states each limit it was asked to: not legal advice, the citation check not served in the hosted deployment, and the cold start; the frontier route is no longer described", () => {
  const text = GUIDE_LIMITS.join(" ");
  assert.match(text, /not legal advice/);
  assert.match(text, /dev stack only; it is not served in the hosted deployment/);
  assert.doesNotMatch(text, /frontier/i, "the frontier reader was removed in #129; the guide no longer describes it");
  assert.doesNotMatch(copySource, /much faster/, "no signed source for 'much'");
  assert.doesNotMatch(copySource, /\b(145|177|180)\b|9\.9 ?s|about 3 minutes|100 seconds/, "no production timing figure (n=1) in the app");
  assert.equal(GUIDE_COLD_START, "The first screening after a quiet period can take a few minutes to start; a later one can be faster. The time varies; the page counts it, says so if it is slow, and you can cancel at any point.");
  assert.equal(GUIDE_STEPS.find((s) => s.id === "run")!.text, "Choose Screen these facts. The first screening after a quiet period can take a few minutes to start (see If it seems slow). If it takes longer than usual, the page says so and, for a screening without the assistant, tries once more. You can cancel at any point.");
});

test("the warm-up note on Screening and Matters is figure-free and the same sentence in both pages (R2, 12 Oct)", async () => {
  const { WARM_UP_NOTE } = await import("../surfaceCopy");
  assert.equal(WARM_UP_NOTE, "Warming up the screening and Lean checker — a first run after idle can take a few minutes while the models start.");
  assert.doesNotMatch(WARM_UP_NOTE, /\b(145|177|180)\b|9\.9 ?s|about 3 minutes|100 seconds/);
  for (const page of ["screening", "matters"]) {
    const src = readFileSync(join(root, "src", "app", page, "page.tsx"), "utf8");
    assert.match(src, /\{WARM_UP_NOTE\}/, page);
    assert.doesNotMatch(src, /\b(145|177|180)\b|9\.9 ?s|about 3 minutes|100 seconds/, `${page} states no production timing figure`);
  }
});

test("R1's conditions on the images: the citations shot carries the dev-stack caption and its alt says it too; the checklist alt names the marks, never a count", () => {
  const sentence = "Dev stack only: the citation check is not yet served in the hosted deployment.";
  assert.equal(GUIDE_IMAGES.citations.caption, sentence);
  assert.equal(GUIDE_IMAGES.citedFact.caption, "This row has no cited fact: the screening found no fact in your papers that supports this ingredient, so it asks you to look for one. When an ingredient is supported, its row names the fact it cites and shows that fact from your text.");
  assert.ok(GUIDE_IMAGES.citations.alt.endsWith(sentence));
  assert.match(GUIDE_IMAGES.checklist.alt, /run on a public court order .*2025:KHC:12773.*three ingredient rows under the heading To look for in your papers, each marked No fact cited/);
  assert.doesNotMatch(GUIDE_IMAGES.checklist.alt, /\b\d+ of \d+\b/);
});

test("the guide for firm users: R1's two lines, the covered offences (the validated ones only, with 'others are referred'), no bare 'defeater', the glossary entry exactly", () => {
  assert.equal(GUIDE_INTRO, PRODUCT_LINE);
  assert.equal(GUIDE_ABOUT, ABOUT_LINE);
  assert.deepEqual(GUIDE_COVERED, OFFENCES.filter((o) => !o.notValidated).map(offenceLabel));
  assert.equal(GUIDE_COVERED.length, 8);
  assert.ok(!GUIDE_COVERED.some((c) => /cheque|s\.316/i.test(c)), "the two not-validated offences are not listed as covered");
  assert.equal(GUIDE_COVERED_NOTE, "Offences not on this list are referred back to you.");
  const all = JSON.stringify([GUIDE_STEPS, GUIDE_STATUSES, GUIDE_GLOSSARY, GUIDE_LIMITS, GUIDE_COVERED]);
  assert.doesNotMatch(all, /defeater/i);
  const g = GUIDE_GLOSSARY.find((x) => x.term === DEFENCE_HEADING)!;
  assert.equal(`${g.term}: ${g.meaning}`, "A fact that may defeat the claim: a fact in your papers that, if it holds, answers the claim (for example a defence); the screening shows it for your review and does not decide it.");
});

test("the guide names the three export buttons with the exact text the screening page shows (R1, 13 Oct)", () => {
  assert.deepEqual({ ...EXPORT_LABELS }, { memo: "Markdown (.md)", print: "PDF", runRecord: "Download run record (.json)" });
  const page = readFileSync(join(root, "src", "app", "screening", "page.tsx"), "utf8");
  for (const k of ["memo", "print", "runRecord"]) assert.ok(page.includes(`{EXPORT_LABELS.${k}}`), `the page renders EXPORT_LABELS.${k}`);
  for (const label of Object.values(EXPORT_LABELS)) assert.ok(GUIDE_IMAGES.memo.alt.includes(label), `the guide names "${label}"`);
});

test("the guide's export step says what the run record holds (the facts you entered, the result, the versions)", () => {
  const s = GUIDE_STEPS.find((x) => x.id === "export")!;
  assert.match(s.text, /includes the facts you entered/);
  assert.doesNotMatch(s.text, /records what was sent/);
});

test("R1 (#283): the guide's defence glossary entry and the defence line under 'Reading the checklist' carry the unmeasured note; no other entry does", () => {
  assert.equal(GUIDE_GLOSSARY.find((g) => g.term === DEFENCE_HEADING)!.note, DEFENCE_PROMPT_NOTE);
  assert.equal(GUIDE_STATUSES.find((s) => s.label === DEFENCE_HEADING)!.note, DEFENCE_PROMPT_NOTE);
  assert.equal(GUIDE_GLOSSARY.filter((g) => g.note).length, 1);
  assert.equal(GUIDE_STATUSES.filter((s) => s.note).length, 1);
});

test("R1's screenshot note (14 Oct): development stack, which frames are invented and which show a public court order; no engine version", async () => {
  const { GUIDE_SCREENSHOT_NOTE } = await import("./copy");
  assert.equal(GUIDE_SCREENSHOT_NOTE, "These screenshots were captured on a development stack, not on the live service. The screening input, the needs-your-review crop and the memo export use an invented matter; nothing on them is a real person or a real case. The ingredient checklist and the cited-fact row show a run on a public court order, used as an illustrative example; its output is not evidence.");
  assert.doesNotMatch(GUIDE_SCREENSHOT_NOTE, /0\.6\.\d/);
});

// P16 (R1, 14 Oct): his given strings verbatim; the rest are my proposals pending his read (the pins move with his edits).
test("P16: R1's four-marks sentence, the No fact cited description, the banner description and the export sentence are exact", async () => {
  const c = await import("./copy");
  const text = GUIDE_STEPS.map((s) => s.text).join(" ");
  assert.ok(text.includes("Each ingredient shows one of four marks: Supported by a fact, Suggested by the screening judge; check it, Needs your review, or No fact cited."));
  assert.ok(GUIDE_STATUSES.some((s) => s.label === "No fact cited" && s.meaning === "No fact cited means the screening found no fact in your papers that supports this ingredient. It is a prompt to look for one, not a finding about your matter."));
  assert.ok(c.GUIDE_BANNER_TEXT.startsWith("On a result where no ingredient has a cited fact, a review agenda is shown first: what each ingredient needs, and which facts to look for. Nothing there is a finding about your matter."));
  assert.ok(text.includes("You can download the memo as Markdown, as PDF or as a Word (.docx) file"));
  assert.doesNotMatch(c.GUIDE_BANNER_TEXT + text, /\b\d+ of \d+\b|0 of 3/);
});
