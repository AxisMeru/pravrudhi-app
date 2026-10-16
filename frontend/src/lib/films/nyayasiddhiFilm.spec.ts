import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { FILM_MANIFESTS, filmFile } from "./films";
import { EXAMPLES } from "../demo/example";
import contractElements from "../fixtures/contractElements.json";
import { CHIP_LABEL } from "../screening/copy";
import { NYAYASIDDHI_STRINGS } from "../nyayasiddhi";
import { FILM_IDS, FILM_SILENT_NOTE, NYAYASIDDHI_FILM_SUBTITLE, NYAYASIDDHI_VOICE_HEADINGS, NYAYASIDDHI_VOICE_PREVIEW_LABEL } from "./copy";

// The NyayaSiddhi film (#948): an UNLISTED review route first (/benchmarks-film-preview), then placement under /benchmarks after deploy 21. Silent-first, captions on, no figure in the first cut (Interim lead, 16 Oct).
const root = join(__dirname, "..", "..", "..");
const manifest = FILM_MANIFESTS.nyayasiddhi as typeof FILM_MANIFESTS.nyayasiddhi & { placeholder?: boolean };

test("the film id is registered, its files are named like the other films', and the review route is noindex", () => {
  assert.ok((FILM_IDS as readonly string[]).includes("nyayasiddhi"));
  assert.match(filmFile("nyayasiddhi", "captions.vtt"), /\/films\/nyayasiddhi\/captions\.vtt$/);
  assert.equal(manifest.audio, false, "silent-first");
  const layout = readFileSync(join(root, "src", "app", "benchmarks-film-preview", "layout.tsx"), "utf8");
  assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  const page = readFileSync(join(root, "src", "app", "benchmarks-film-preview", "page.tsx"), "utf8");
  assert.match(page, /<FilmPlayer id=\{id\} autoplayMuted captionsOn \/>/);
  assert.match(page, /\["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm"\]/);
  assert.match(page, /const VOICE = \["nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"\]/);
  assert.doesNotMatch(page, /preview-narrated|\.aac|Kokoro/i, "only the two narrated folders served from public/films, by id; no source-folder path, no engine name");
  assert.match(FILM_SILENT_NOTE, /silent/);
  assert.doesNotMatch(NYAYASIDDHI_FILM_SUBTITLE + FILM_SILENT_NOTE, /verified|prove|accura|best|better|beat|rank/i);
});

test("public/films holds only the film's five cuts (three silent, two narrated previews for the voice review): four files each, no script or log, no host path (R2)", () => {
  const films = readdirSync(join(root, "public", "films")).filter((n) => n.startsWith("nyayasiddhi")).sort();
  assert.deepEqual(films, ["nyayasiddhi", "nyayasiddhi-firm", "nyayasiddhi-firm-narrated", "nyayasiddhi-loop", "nyayasiddhi-narrated"]);
  for (const f of films) assert.deepEqual(readdirSync(join(root, "public", "films", f)).sort(), ["captions.vtt", "film.mp4", "manifest.json", "poster.png"], f);
  for (const f of films) for (const n of ["captions.vtt", "manifest.json"]) assert.doesNotMatch(readFileSync(join(root, "public", "films", f, n), "utf8"), /\/home\/|\/tmp\//, `${f}/${n}`);
});

test("the narrated previews are labelled on the route page by one byte-exact line each (the label is a page string, not in the films)", () => {
  assert.equal(NYAYASIDDHI_VOICE_PREVIEW_LABEL, "Preview for voice review");
  assert.deepEqual(NYAYASIDDHI_VOICE_HEADINGS, { "nyayasiddhi-narrated": "Cut A, narrated", "nyayasiddhi-firm-narrated": "Cut C, narrated" });
  const page = readFileSync(join(root, "src", "app", "benchmarks-film-preview", "page.tsx"), "utf8");
  assert.match(page, /\{NYAYASIDDHI_VOICE_PREVIEW_LABEL\}/);
});

test("the review route is linked from nowhere: only the surface route list and a comment in the film copy name it", () => {
  const SKIP = new Set(["node_modules", ".next", "out", "test-results"]);
  const hits: string[] = [];
  (function walk(d: string): void {
    for (const n of readdirSync(d)) {
      if (SKIP.has(n)) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|json|md)$/.test(n) || /\.spec\.ts$/.test(n)) continue;
      if (readFileSync(p, "utf8").includes("benchmarks-film-preview")) hits.push(relative(root, p).replace(/\\/g, "/"));
    }
  })(join(root, "src"));
  assert.deepEqual(hits.sort(), ["src/lib/demoPath.ts", "src/lib/films/copy.ts"], "only the route allow-list and a copy comment name the route; no nav, link, sitemap or page does");
});

// captions.vtt is pinned once Studio's render exists (the placeholder manifest has none). R1 (16 Oct): captions may carry digits ("order of 12 June 2024", "BNS 316 \u00b7 IPC 405"), so the pin is (1) WEBVTT, cues in order inside the manifest duration; (2) every cue text EQUALS a string of STRINGS_948_v4 (the stronger pin: sha256 65282a5a..., vendored as e2e/fixtures/nyayasiddhiFilmStrings.json (a test fixture, not under src: nothing is bundled)); (3) no barred word, whole words, case-insensitive; (4) no count word in the no-fact-cited scene.
const strings = JSON.parse(readFileSync(join(root, "e2e", "fixtures", "nyayasiddhiFilmStrings.json"), "utf8")) as { sourceSha256: string; refusalStrings: string[]; strings: string[] };
const BARRED = /\b(accuracy|accurate|verified|verify|proved|proves|proof|best|beats?|outperform|caught|stopped|protects|saved|prevented)\b|state of the art/i;
const COUNT_WORD = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozens?|many|several|few|most|all)\b/i;

test("the vendored film strings are STRINGS_948_v4 (sha256 65282a5a...), carry no barred word, and the refusal strings carry no count word", () => {
  assert.match(strings.sourceSha256, /^65282a5af3d2f41c43d561f1dbbd768418c6fa8c6ab83b3b3ef04b381f7417fa$/);
  assert.ok(strings.strings.length > 20 && strings.refusalStrings.length > 0);
  for (const t of strings.strings) {
    assert.doesNotMatch(t, BARRED, t);
    // "found" only inside a signed string: any such string is one of the app's signed strings (the list is closed, so a new one needs this test and R1)
    if (/\bfound\b/i.test(t)) assert.match(t, /^Found in our index$|^Not found in our index/, `a found-word string that is not a signed one: ${t}`);
  }
  // the no-fact-cited scene shows the refusal wording and its sources by name; no count word in the lines the film adds (the court citation and the offence heading keep their own digits)
  const added = strings.refusalStrings.filter((t) => !/Madras High Court|BNS 316|A public court order/.test(t));
  for (const t of added) assert.doesNotMatch(t, COUNT_WORD, t);
});

const NARRATED_CAPTIONS_SHA256 = { "nyayasiddhi-narrated": "c35ef3d5c85767e9dbe0a050d64d49be788d7408a911df64603d9addcb4be374", "nyayasiddhi-firm-narrated": "a1333fb2af9ca0db16069a7670ebb4d1f95fb6414fdbd368a9f99ce14b97a879" } as const;
const FILMS = ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm", "nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"] as const;
const norm = (x: string): string => x.replace(/\s+/g, " ").trim();
const sentences = (x: string): string[] => x.split(/(?<=[.!?])\s+/).map(norm).filter(Boolean);
// the cue set: the film's own strings (v4) and each of their sentences (a long string is captioned sentence by sentence), plus text the film takes unchanged from the APP's signed sources: the example order's allegation paragraphs (lib/demo/example.ts), the chip labels (lib/screening/copy.ts), the contracts' element wording (fixtures/contractElements.json), the page's stack labels (lib/nyayasiddhi.ts) and a row's system name + version and run date as the page prints them (rows.json)
const rows = (JSON.parse(readFileSync(join(root, "src", "data", "nyayasiddhi", "rows.json"), "utf8")) as { rows: { system_name: string; system_version: string; run_date: string }[] }).rows;
const allowed = new Set([...strings.strings.flatMap((x) => [norm(x), ...sentences(x)]), ...EXAMPLES.flatMap((e) => [...e.facts].map(norm)), ...Object.values(CHIP_LABEL).map(norm), ...Object.values((contractElements as { contracts: Record<string, { elements: string[]; denials: string[] }> }).contracts).flatMap((c) => [...c.elements, ...c.denials].map(norm)), ...Object.values(NYAYASIDDHI_STRINGS.stackLabel).filter((x): x is string => typeof x === "string").map(norm), ...rows.flatMap((r) => [norm(`${r.system_name} ${r.system_version}`), r.run_date])]);

for (const id of FILMS) {
  const dir = join(root, "public", "films", id);
  const man = FILM_MANIFESTS[id] as typeof FILM_MANIFESTS.nyayasiddhi & { placeholder?: boolean };
  const rendered = existsSync(join(dir, "captions.vtt")) && man.placeholder !== true;
  test(`${id}: captions.vtt is WEBVTT, every cue ends inside the duration, every cue is a STRINGS_948_v4 string (or the app's own signed text), no barred word; the files exist; silent`, { skip: !rendered }, () => {
    const vtt = readFileSync(join(dir, "captions.vtt"), "utf8");
    assert.match(vtt, /^WEBVTT/);
    const t = (x: string): number => { const [h, m, sec] = x.split(":"); return Number(h) * 3600 + Number(m) * 60 + Number(sec); };
    const narrated = id.endsWith("narrated");
    let cues = 0;
    for (const m of vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})[^\n]*\n([\s\S]*?)(?:\n\n|$)/g)) {
      // cues may overlap and need not be listed by start (a caption can stack under the one before it); each must start before it ends and end inside the film
      assert.ok(t(m[1]) >= 0 && t(m[2]) > t(m[1]) && t(m[2]) <= man.durationS + 0.5, `cue ${m[1]}`);
      const text = norm(m[3]);
      // the silent cuts: every cue is a v4 string (or the app's own signed text). The narrated previews' captions are the narration script (v4 strings joined into spoken sentences and split at spoken pauses), so they are pinned by R1's confirmed HASH below instead
      if (!narrated) assert.ok(allowed.has(text), `${id}: a cue that is not a STRINGS_948_v4 string: ${text}`);
      assert.doesNotMatch(text, BARRED, text);
      cues += 1;
    }
    assert.ok(cues > 0);
    assert.ok(existsSync(join(dir, "film.mp4")) && existsSync(join(dir, "poster.png")));
    assert.equal(man.audio, narrated, narrated ? "the narrated preview carries audio" : "the three public cuts are silent");
    if (narrated) assert.equal(createHash("sha256").update(readFileSync(join(dir, "captions.vtt"))).digest("hex"), NARRATED_CAPTIONS_SHA256[id as keyof typeof NARRATED_CAPTIONS_SHA256], "the narrated captions are the file R1 read, by hash");
    // the narrated previews open with the synthetic-voice line as their first cue (R1's rule: a synthetic-voice line)
    if (narrated) assert.match(vtt, /\n1\n[^\n]*-->[^\n]*\nThe narration is a synthetic voice\.\n/, "the synthetic-voice line is the first cue");
  });
}
