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

test("the guide's own words carry no wording-audit hit: no proof, established or verbatim on the house path; the frontier sentence is imported, not written here", () => {
  assert.deepEqual(scanSource("src/lib/guide/copy.ts", copySource), []);
  assert.deepEqual(scanSource("src/app/guide/page.tsx", readFileSync(join(root, "src", "app", "guide", "page.tsx"), "utf8")), []);
});

test("every string the page shows, rendered from the copy, is free of the banned words except the imported frontier sentence", () => {
  const allowed = GUIDE_LIMITS.filter((l) => /frontier route, the/.test(l));
  assert.equal(allowed.length, 1);
  const shown = [...GUIDE_STEPS.flatMap((s) => [s.heading, s.text, s.image?.alt ?? ""]), ...GUIDE_STATUSES.flatMap((s) => [s.label, s.meaning]), ...GUIDE_LIMITS.filter((l) => !allowed.includes(l))];
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

test("the guide states each limit it was asked to: not legal advice, the citation check not served in the hosted deployment, the frontier route opt-in and exact-text, and the cold start", () => {
  const text = GUIDE_LIMITS.join(" ");
  assert.match(text, /not legal advice/);
  assert.match(text, /dev stack only; it is not served in the hosted deployment/);
  assert.match(text, /opt-in/);
  assert.match(text, /exact-text/);
  assert.doesNotMatch(copySource, /much faster/, "no signed source for 'much'");
  assert.doesNotMatch(copySource, /\b(145|177|180)\b|9\.9 ?s|about 3 minutes|100 seconds/, "no production timing figure (n=1) in the app");
  assert.match(GUIDE_COLD_START, /^The first analysis after idle can take a few minutes while the judges start; a later one can be faster\. The time varies; the page counts it, says so if it is slow, and you can cancel at any point\.$/);
  assert.match(GUIDE_STEPS.find((s) => s.id === "run")!.text, /^Choose Screen these facts\. The first analysis after idle can take a few minutes while the judges start \(see If it seems slow\)\. The page counts the time and says so if it is slow; you can cancel at any point\.$/);
});

test("the warm-up note on Screening and Matters is figure-free and the same sentence in both pages (R2, 12 Oct)", async () => {
  const { WARM_UP_NOTE } = await import("../surfaceCopy");
  assert.equal(WARM_UP_NOTE, "Warming up the judge and Lean checker — a first run after idle can take a few minutes while the judges start.");
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
