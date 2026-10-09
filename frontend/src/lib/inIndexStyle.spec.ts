import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CitationCheckResult } from "../components/citations/CitationCheck";
import { IN_INDEX_ENGINE_LABEL, verifyView } from "./citationCheck";
import type { CitationCheckState } from "./citationCheckRun";

// R1 (8 Oct): an existence-only answer (IN_INDEX) never takes the style, icon or colour of a verified result, has no tick and no "cite this" affordance, and its
// note slot may repeat the engine's sentence but adds no second positive word.
const NOTE = IN_INDEX_ENGINE_LABEL; // the engine's note for IN_INDEX is the same sentence
const html = (result: string, note: string): string => {
  const view = verifyView({ result, note, status: result === "IN_INDEX" ? "in_index" : "verified", label: result === "IN_INDEX" ? IN_INDEX_ENGINE_LABEL : "Verified: ...", preview: true, verified: result === "VERIFIED" }, true);
  const state: CitationCheckState = { phase: "result", view };
  // the RESULT region only: the "Check this citation" button above it is the control, not an answer
  return renderToStaticMarkup(createElement(CitationCheckResult, { state }));
};

test("IN_INDEX is rendered like every other status: no icon, no tick, no cite affordance, and the same neutral classes as VERIFIED", () => {
  const inIndex = html("IN_INDEX", NOTE);
  const verified = html("VERIFIED", "The citation resolves to an indexed case and the quote appears in its text.");
  for (const markup of [inIndex]) {
    assert.doesNotMatch(markup, /<svg|<img|<i[ >]|✓|✔|☑|✅|&#10003;|&#10004;|\bcheck-?(circle|mark)\b/i, "an icon or a tick");
    assert.doesNotMatch(markup, /\bcite (this|it)\b|use this|copy citation|<button[^>]*>[^<]*(cite|use)/i, "a cite-this affordance");
    assert.doesNotMatch(markup, /emerald|green|text-success|bg-success/i, "the colour of a verified result");
  }
  const classes = (m: string): string[] => [...m.matchAll(/class="([^"]*)"/g)].map((x) => x[1]);
  assert.ok(!classes(verified).some((c) => /emerald|green/.test(c)), "no verified result carries a verified colour either: all statuses share one neutral style");
  assert.deepEqual(new Set(classes(inIndex).filter((c) => /result|status/.test(c))), new Set(classes(verified).filter((c) => /result|status/.test(c))));
});

test("the IN_INDEX note adds no second positive word beyond the engine's own denial", () => {
  assert.doesNotMatch(NOTE.replace("this is not a verification", ""), /\b(verif\w*|confirm\w*|authentic\w*|genuine|valid|correct|accurate|real|resolves?|appears)\b/i);
});
