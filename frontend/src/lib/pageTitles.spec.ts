import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PAGE_TITLES, pageTitle } from "./pageTitles";
import { statusNeedsKey } from "./serviceStatus";
import { SCREENING_FILE_NOTE, FILE_NOTE } from "./surfaceCopy";

// R1 (15 Oct, D4): the page titles, exactly, "{page} \u00b7 Pravrudhi-Nyaya".
test("the page titles are R1's, one per page, each the page name then the product name", () => {
  assert.deepEqual(PAGE_TITLES, {
    signin: "Sign in", screening: "Matter workspace", demo: "How it works", workflows: "Workflows", dataHandling: "Data handling", guide: "User guide",
    howBuilt: "How it was built", settings: "Settings", partnerKeys: "API access", citations: "Case citations", technicalFilm: "Technical film", benchmarksFilmPreview: "NyayaSiddhi film: review copy", matters: "Offence rules",
    safety: "Safety record", benchmarks: "Benchmarks", benchmarksSubmit: "Submit a system", preview: "Preview workflows", intake: "Intake",
  });
  assert.equal(pageTitle("guide"), "User guide \u00b7 Pravrudhi-Nyaya");
  assert.equal(new Set(Object.values(PAGE_TITLES)).size, Object.keys(PAGE_TITLES).length, "no two pages share a title");
});

test("each titled page's layout.tsx names its own key, and the keys cover the table", () => {
  const dirs: Record<string, string> = { benchmarksSubmit: "benchmarks/submit", preview: "preview", benchmarksFilmPreview: "benchmarks-film-preview", signin: "signin", screening: "screening", demo: "demo", workflows: "workflows", dataHandling: "data-handling", guide: "guide", howBuilt: "how-it-was-built", settings: "settings", partnerKeys: "partner-keys", citations: "citations", matters: "matters", safety: "safety", benchmarks: "benchmarks", intake: "intake", technicalFilm: "technical-film" };
  for (const [key, dir] of Object.entries(dirs)) {
    const src = readFileSync(join(__dirname, "..", "app", dir, "layout.tsx"), "utf8");
    assert.match(src, new RegExp(`title: pageTitle\\("${key}"\\)`), dir);
  }
  assert.deepEqual(Object.keys(dirs).sort(), Object.keys(PAGE_TITLES).sort());
});

// R1 (15 Oct, D5): the Screening file note names the button the page has; Matters keeps its own.
test("the Screening file note says Screen these facts; the Matters note still says Analyse", () => {
  assert.equal(SCREENING_FILE_NOTE, "The file itself is not uploaded; the text read from it, like any text you type, is sent to the engine when you press Screen these facts. Review and edit it first.");
  assert.match(FILE_NOTE, /when you press Analyse\. Review and edit it first\./);
});

// Lead-2 (15 Oct): the keyed /api/v1/status is not asked for an anonymous visitor of a hosted engine.
test("statusNeedsKey: only an anonymous visitor of a hosted engine skips the keyed status", () => {
  assert.equal(statusNeedsKey(true, false), false);
  assert.equal(statusNeedsKey(true, true), true);
  assert.equal(statusNeedsKey(false, false), true);
  assert.equal(statusNeedsKey(false, true), true);
});
