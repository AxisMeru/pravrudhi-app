import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { BANNED, scanSource } from "../wordingAudit";
import { ABOUT_LINE, PRODUCT_LINE } from "../productCopy";
import { DEFENCE_HEADING, DEFENCE_PROMPT_NOTE, EXPORT_LABELS } from "../screening/copy";
import { OFFENCES, offenceLabel } from "../screening/offences";
import { CITATIONS_PANEL_ENABLED } from "../citationNav";
import { GUIDE_ABOUT, GUIDE_CITATIONS_OFF_TEXT, GUIDE_CITATIONS_ON_TEXT, GUIDE_COLD_START, GUIDE_COVERED, GUIDE_COVERED_NOTE, GUIDE_GLOSSARY, GUIDE_IMAGES, GUIDE_INTRO, GUIDE_LIMITS, GUIDE_LIMIT_CITATIONS_ON, GUIDE_LIMIT_CITATIONS_OFF, GUIDE_STATUSES, GUIDE_STEPS } from "./copy";

const root = join(__dirname, "..", "..", "..");
const copySource = readFileSync(join(__dirname, "copy.ts"), "utf8");

// R1 (15 Oct) signed lines that say the check "will not look at quotes" (negated, about the citation check, not the house path's judging): these exact lines, and only these, are exempt from the audit.
const QUOTES_LINES = [GUIDE_CITATIONS_OFF_TEXT, GUIDE_CITATIONS_ON_TEXT, GUIDE_LIMIT_CITATIONS_ON, GUIDE_IMAGES.citations.alt];

// The audit reads the source literal (a non-ASCII character is written as a \\uXXXX escape there) and cuts a hit at 160 characters, so an exempt line is matched by EXACT equality with that cut of
// its source form, never by a shared start; the full text of each is pinned in full elsewhere in this file. Exactly four hits may be exempt.
const asSource = (t: string): string => t.replace(/[^\x00-\x7f]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).slice(0, 160);
const EXEMPT_HITS = new Set(QUOTES_LINES.map(asSource));

test("the guide's own words carry no wording-audit hit: no proof, established or verbatim on the house path; the stale frontier sentences are gone (the frontier reader was removed in #129)", () => {
  // R1 (15 Oct) signed four lines (three guide sentences and the frame-05 alt) that say the check "will not look at quotes": the word is negated and about the citation check, not the house path's judging.
  const hits = scanSource("src/lib/guide/copy.ts", copySource);
  assert.equal(hits.filter((h) => EXEMPT_HITS.has(h.text)).length, 4, "exactly the four R1-signed lines are exempt");
  assert.deepEqual(hits.filter((h) => !EXEMPT_HITS.has(h.text)), []);
  assert.deepEqual(scanSource("src/app/guide/page.tsx", readFileSync(join(root, "src", "app", "guide", "page.tsx"), "utf8")), []);
});

test("every string the page shows, rendered from the copy, is free of the banned words", () => {
  const shown = [...GUIDE_STEPS.flatMap((s) => [s.heading, s.text, s.image?.alt ?? ""]), ...GUIDE_STATUSES.flatMap((s) => [s.label, s.meaning]), ...GUIDE_LIMITS];
  for (const t of shown) if (!QUOTES_LINES.includes(t)) assert.doesNotMatch(t, BANNED, t); // the R1-signed lines above say the check will not look at quotes
});

test("the six screenshots are the files the guide names, each with plain alt text, and the files exist with invented-matter names only", () => {
  const files = Object.values(GUIDE_IMAGES).map((i) => i.file);
  assert.equal(new Set(files).size, 6);
  for (const i of Object.values(GUIDE_IMAGES)) {
    assert.match(i.file, /^0[1-6]-[a-z-]+\.png$/);
    assert.ok(i.alt.length > 30 && (QUOTES_LINES.includes(i.alt) || !BANNED.test(i.alt)), i.alt); // the one R1-signed alt that says quotes are not checked is exempt
    assert.ok(existsSync(join(root, "public", "guide", i.file)), `public/guide/${i.file} is missing`);
  }
  const extra = readdirSync(join(root, "public", "guide")).filter((f) => !files.includes(f) && !f.startsWith("."));
  assert.deepEqual(extra, [], "unlisted files in public/guide");
});

test("the guide states each limit it was asked to: not legal advice, the citation check not served in the hosted deployment, and the cold start; the frontier route is no longer described", () => {
  const text = GUIDE_LIMITS.join(" ");
  assert.match(text, /not legal advice/);
  // R1, 15 Oct: both arms in R1's exact words. A build with no citations panel says the check is not offered; a build with it (CITATIONS=1) describes the panel. Neither says "dev stack only" or "not served".
  assert.equal(GUIDE_LIMIT_CITATIONS_OFF, "The citation check is not offered in this version of the app. When it is offered, \u201cFound in our index\u201d will mean existence only, not that the case says what you cite it for, and \u201cNot found in our index\u201d will not show that a citation is not real.");
  assert.equal(GUIDE_LIMIT_CITATIONS_ON, "The citation check looks the case up in our index from the citation alone and does not look at quotes. \u201cFound in our index\u201d is existence only, not a verification; \u201cNot found in our index\u201d does not show whether the citation is real, because the index does not hold every judgment.");
  assert.equal(GUIDE_CITATIONS_ON_TEXT, "The citations panel below the checklist looks up the case citations that you enter, one per line, in our index. For each one it tells you whether we can match the citation to exactly one case in the index. It does not look at quotes, and it does not tell you whether a citation is real, because the index does not hold every judgment. The panel is labelled preview: existence check only.");
  assert.equal(GUIDE_CITATIONS_OFF_TEXT, "A citation check is not offered in this version of the app. When it is offered, it will tell you whether we can match a citation to exactly one case in our index; it will not look at quotes, and it will not tell you whether a citation is real.");
  for (const t of [GUIDE_LIMIT_CITATIONS_ON, GUIDE_LIMIT_CITATIONS_OFF, GUIDE_CITATIONS_ON_TEXT, GUIDE_CITATIONS_OFF_TEXT]) assert.doesNotMatch(t, /dev stack only|not (yet )?served/i, t);
  // the arm this build carries is the one shown
  assert.equal(GUIDE_LIMITS[2], CITATIONS_PANEL_ENABLED ? GUIDE_LIMIT_CITATIONS_ON : GUIDE_LIMIT_CITATIONS_OFF);
  const step6 = GUIDE_STEPS.find((s) => s.id === "citations")!;
  assert.equal(step6.text, CITATIONS_PANEL_ENABLED ? GUIDE_CITATIONS_ON_TEXT : GUIDE_CITATIONS_OFF_TEXT);
  // frame 05 is shown only on the build with the panel (retaken on such a build); a build without it shows no image and no caption (R1: never the old hosted-build frame)
  assert.equal(step6.image, CITATIONS_PANEL_ENABLED ? GUIDE_IMAGES.citations : undefined);
  assert.equal(GUIDE_IMAGES.citations.file, "05-citations-panel.png");
  // R1 (15 Oct): frame 06 as retaken by Track A at main f8738cf7 (528x64, sha256 0a019ee3...c9d2) and its exact alt
  assert.equal(statSync(join(root, "public", "guide", "06-memo-export.png")).size, 11320, "frame 06 retaken with the Download the memo menu opened (M2b, Web, sha256 3b8cb057e1cb)");
  assert.equal(GUIDE_IMAGES.memo.alt, "The memo export controls on the Matter workspace page once a result is shown: the button \u201cDownload the memo\u201d, opened to show Word (.docx) and Markdown (.md), then, set apart, the button Print / save as PDF; on the next line, the button Download run record (.json).");
  assert.equal(statSync(join(root, "public", "guide", "05-citations-panel.png")).size, 28522, "the frame retaken from the citations-ON build at the D9 batch (Web, 15 Oct, sha256 d2ee473d9e12…)");
  assert.doesNotMatch(JSON.stringify([GUIDE_STEPS, GUIDE_LIMITS]), /dev stack only/i);
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

test("R1 conditions on the images: the citations shot (arm ON, retaken frame only) has the preview caption and alt; the checklist alt names the marks, never a count", () => {
  assert.equal(GUIDE_IMAGES.citations.caption, "Preview: existence check only."); // shown only with the retaken frame 05 (arm ON)
  assert.equal(GUIDE_IMAGES.citedFact.caption, "This row has no cited fact: the screening found no fact in your papers that supports this ingredient, so it asks you to look for one. When an ingredient is supported, its row names the fact it cites and shows that fact from your text.");
  assert.equal(GUIDE_IMAGES.citations.alt, "The Case citations panel: a preview label, a label saying Citations, one per line, a line saying that each line takes one citation, at most 5 at a time, and that quotes are not checked, an empty box with an example citation as its placeholder, a note that the index covers Supreme Court citations in the form (year) volume SCC page and that other citation forms come back as not found, and a Check citations button.");
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
  assert.deepEqual({ ...EXPORT_LABELS }, { memo: "Markdown (.md)", print: "Print / save as PDF", runRecord: "Download run record (.json)" });
  const page = readFileSync(join(root, "src", "app", "screening", "page.tsx"), "utf8");
  const menu = readFileSync(join(root, "src", "components", "screening", "MemoMenu.tsx"), "utf8"); // the Markdown item lives in the "Download the memo" menu (M2b)
  for (const k of ["print", "runRecord"]) assert.ok(page.includes(`{EXPORT_LABELS.${k}}`), `the page renders EXPORT_LABELS.${k}`);
  assert.ok(menu.includes("{EXPORT_LABELS.memo}"), "the menu renders EXPORT_LABELS.memo");
  for (const label of Object.values(EXPORT_LABELS)) assert.ok(GUIDE_IMAGES.memo.alt.includes(label), `the guide names "${label}"`);
});

test("the guide's export step says what the run record holds (the facts you entered, the result, the versions)", () => {
  const s = GUIDE_STEPS.find((x) => x.id === "export")!;
  assert.match(s.text, /includes the facts you entered/);
  assert.match(s.text, /the full result that came back, the engine version and the checker version/);
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
  assert.equal(GUIDE_SCREENSHOT_NOTE, "These screenshots were captured on a development stack, not on the live service. The screening input and the memo export use an invented matter; nothing on them is a real person or a real case. The ingredient checklist, the cited-fact row and the needs-your-review crop show a run on a public court order, used as an illustrative example; its output is not evidence.");
  assert.doesNotMatch(GUIDE_SCREENSHOT_NOTE, /0\.6\.\d/);
});

// P16 (R1, 14 Oct): his given strings verbatim; the rest are my proposals pending his read (the pins move with his edits).
test("P16: R1's four-marks sentence, the No fact cited description, the banner description and the export sentence are exact", async () => {
  const c = await import("./copy");
  const text = GUIDE_STEPS.map((s) => s.text).join(" ");
  assert.ok(text.includes("Each ingredient shows one of four marks: Supported by a fact, Suggested by the screening judge; check it, Needs your review, or No fact cited."));
  assert.ok(GUIDE_STATUSES.some((s) => s.label === "No fact cited" && s.meaning === "No fact cited means the screening found no fact in your papers that supports this ingredient. It is a prompt to look for one, not a finding about your matter."));
  assert.ok(c.GUIDE_BANNER_TEXT.startsWith("On a result where no ingredient has a cited fact, a review agenda is shown first: what each ingredient needs, and which facts to look for. Nothing there is a finding about your matter."));
  assert.ok(GUIDE_STEPS.find((x) => x.id === "export")!.text.startsWith("Once a screening result is shown, the menu Download the memo holds Word (.docx) and Markdown (.md); Print / save as PDF opens your browser's print window; Download run record (.json) is a separate button. The memo carries the run, the versions and the standing line that this is a screening aid."));
  assert.ok(GUIDE_STEPS.find((x) => x.id === "export")!.text.endsWith("Both are built in your browser and are saved to your device when you download them, so keep them as you would the matter file."));
  assert.doesNotMatch(c.GUIDE_BANNER_TEXT + text, /\b\d+ of \d+\b|0 of 3/);
});

// #257: the "5" in frame 05's alt (a literal in the source, so the wording audit can match R1's exact line) must equal the panel's cap constant.
test("frame 05 alt: the batch size is the cap constant", async () => {
  const { MAX_CITATIONS_EXISTENCE } = await import("./../citationsPanel");
  assert.match(GUIDE_IMAGES.citations.alt, new RegExp(`at most ${MAX_CITATIONS_EXISTENCE} at a time`));
});

// R1 (#261, 15 Oct): the guide names the Matter workspace. Step 1's first sentence is candidate B, byte-exact; frame 01 is Studio's retake from the live Matter workspace (1180x900, 157,730 bytes, sha256 f370fed2798a…)
// with R1's exact alt; no step-count claim in the guide text (Hearing preparation is build-gated).
test("#261: guide step 1 and frame 01 describe the Matter workspace, as R1 worded them", () => {
  const step1 = GUIDE_STEPS.find((s) => s.id === "paste")!;
  assert.ok(step1.text.startsWith("Open Matter in the menu. In the Facts step, paste the FIR, complaint or narrative and choose Split into numbered facts. Each fact becomes F1"));
  assert.doesNotMatch(step1.text, /Screening page/);
  assert.equal(statSync(join(root, "public", "guide", "01-screening-input.png")).size, 157730, "Studio's retake from the live Matter workspace (sha256 f370fed2798a…)");
  assert.equal(GUIDE_IMAGES.input.alt, "The top of the Matter workspace with an invented plot-sale matter: the four steps (Facts done, Screen available, Memo and Hearing preparation not yet), the standing not-legal-advice line, the caveat strip, the closed About this screening fold, the example entry naming two public court orders, the retention note, and the box with the matter pasted in.");
  assert.doesNotMatch(GUIDE_STEPS.map((x) => `${x.heading} ${x.text}`).join(" "), /four steps|step bar/i, "no step-count claim in the guide text (R1); the picture's alt may name the steps");
});
