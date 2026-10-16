import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { FILM_MANIFESTS, filmFile } from "./films";
import { FILM_IDS, FILM_SILENT_NOTE, NYAYASIDDHI_FILM_SUBTITLE } from "./copy";

// The NyayaSiddhi film (#948): an UNLISTED review route first (/benchmarks-film-preview), then placement under /benchmarks after deploy 21. Silent-first, captions on, no figure in the first cut (Interim lead, 16 Oct).
const root = join(__dirname, "..", "..", "..");
const DIR = join(root, "public", "films", "nyayasiddhi");
const manifest = FILM_MANIFESTS.nyayasiddhi as typeof FILM_MANIFESTS.nyayasiddhi & { placeholder?: boolean };

test("the film id is registered, its files are named like the other films', and the review route is noindex", () => {
  assert.ok((FILM_IDS as readonly string[]).includes("nyayasiddhi"));
  assert.match(filmFile("nyayasiddhi", "captions.vtt"), /\/films\/nyayasiddhi\/captions\.vtt$/);
  assert.equal(manifest.audio, false, "silent-first");
  const layout = readFileSync(join(root, "src", "app", "benchmarks-film-preview", "layout.tsx"), "utf8");
  assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  const page = readFileSync(join(root, "src", "app", "benchmarks-film-preview", "page.tsx"), "utf8");
  assert.match(page, /<FilmPlayer id="nyayasiddhi" autoplayMuted captionsOn \/>/);
  assert.match(FILM_SILENT_NOTE, /silent/);
  assert.doesNotMatch(NYAYASIDDHI_FILM_SUBTITLE + FILM_SILENT_NOTE, /verified|prove|accura|best|better|beat|rank/i);
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

// captions.vtt is pinned once Studio's render exists (the placeholder manifest has none). R1 (16 Oct): captions may carry digits ("order of 12 June 2024", "BNS 316 \u00b7 IPC 405"), so the pin is (1) WEBVTT, cues in order inside the manifest duration; (2) every cue text EQUALS a string of STRINGS_948_v2 (the stronger pin: sha256 e1e1330d..., vendored as nyayasiddhiStrings.json); (3) no barred word, whole words, case-insensitive; (4) no count word in the refusal scene.
const strings = JSON.parse(readFileSync(join(__dirname, "nyayasiddhiStrings.json"), "utf8")) as { sourceSha256: string; refusalStrings: string[]; strings: string[] };
const BARRED = /\b(accuracy|accurate|verified|verify|proved|proves|proof|best|beats?|outperform|caught|stopped|protects|saved|prevented)\b|state of the art/i;
const COUNT_WORD = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozens?|many|several|few|most|all)\b/i;

test("the vendored film strings are STRINGS_948_v2 (sha256 e1e1330d...), carry no barred word, and the refusal strings carry no count word", () => {
  assert.match(strings.sourceSha256, /^e1e1330dd09c183a/);
  assert.ok(strings.strings.length > 20 && strings.refusalStrings.length > 0);
  for (const t of strings.strings) {
    assert.doesNotMatch(t, BARRED, t);
    // "found" only inside a signed string: any such string is one of the app's signed strings (the list is closed, so a new one needs this test and R1)
    if (/\bfound\b/i.test(t)) assert.match(t, /^Found in our index$|^Not found in our index/, `a found-word string that is not a signed one: ${t}`);
  }
  // the refusal scene shows the refusal wording and its sources by name; no count word in the lines the film adds (the court citation and the offence heading keep their own digits)
  const added = strings.refusalStrings.filter((t) => !/Madras High Court|BNS 316|A public court order/.test(t));
  for (const t of added) assert.doesNotMatch(t, COUNT_WORD, t);
});

const rendered = existsSync(join(DIR, "captions.vtt")) && manifest.placeholder !== true;
test("captions.vtt: WEBVTT, ordered cues inside the duration, every cue is a STRINGS_948_v2 string, no barred word", { skip: !rendered }, () => {
  const vtt = readFileSync(join(DIR, "captions.vtt"), "utf8");
  assert.match(vtt, /^WEBVTT/);
  const t = (s: string): number => { const [h, m, sec] = s.split(":"); return Number(h) * 3600 + Number(m) * 60 + Number(sec); };
  const norm = (x: string): string => x.replace(/\s+/g, " ").trim();
  const allowed = new Set(strings.strings.map(norm));
  let last = 0; let cues = 0;
  for (const m of vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})[^\n]*\n([\s\S]*?)(?:\n\n|$)/g)) {
    const a = t(m[1]), b = t(m[2]);
    assert.ok(a >= last - 1e-6 && b > a && b <= manifest.durationS + 0.5, `cue ${m[1]}`);
    const text = norm(m[3]);
    assert.ok(allowed.has(text), `a cue that is not a STRINGS_948_v2 string: ${text}`);
    assert.doesNotMatch(text, BARRED, text);
    last = b; cues += 1;
  }
  assert.ok(cues > 0);
  assert.ok(existsSync(join(DIR, "film.mp4")) && existsSync(join(DIR, "poster.png")));
});
