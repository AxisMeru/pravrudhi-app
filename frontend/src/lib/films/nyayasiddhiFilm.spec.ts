// The film (re-rendered 20 Oct, STRINGS_430_v3) carries the hidden-set sentence as R1 ruled it ("is planned"); the page constant is the same wording.
const FILM_HIDDEN_SET_LINE = "There is no hidden set yet. The mechanism for one is planned. The organisers would hold it; there is no independent custodian yet.";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FilmPlayer, sceneNameLine } from "../../components/films/FilmPlayer";
import { WEBM_FILMS, filmFile, type FilmManifest } from "./films";
import { EXAMPLES } from "../demo/example";
import contractElements from "../fixtures/contractElements.json";
import { CHIP_LABEL } from "../screening/copy";
import { NYAYASIDDHI_STRINGS } from "../nyayasiddhi";
import { BENCHMARKS_FILM_HEADING, BENCHMARKS_FILM_POSTER_ALT, FILM_CAPTIONS_SHOW, FILM_DOWNLOAD_NARRATED, FILM_IDS, FILM_MUTE, FILM_MUTE_ARIA, FILM_NARRATED_NOTE, FILM_SILENT_NOTE, FILM_SYNTHETIC_VOICE, FILM_UNMUTE, FILM_UNMUTE_ARIA } from "./copy";

// The NyayaSiddhi film (#948): an UNLISTED review route first (/benchmarks-film-preview), then placement under /benchmarks after deploy 21. Silent-first, captions on, no figure in the first cut (Interim lead, 16 Oct).
const root = join(__dirname, "..", "..", "..");
const readManifest = (id: string): FilmManifest & { placeholder?: boolean } => JSON.parse(readFileSync(join(root, "public", "films", id, "manifest.json"), "utf8"));
const manifest = readManifest("nyayasiddhi");

test("the film id is registered, its files are named like the other films', and the old review route is only an edge 308 redirect to /benchmarks (no preview page exists: operator, 19 Oct)", () => {
  assert.ok((FILM_IDS as readonly string[]).includes("nyayasiddhi"));
  assert.match(filmFile("nyayasiddhi", "captions.vtt"), /\/films\/nyayasiddhi\/captions\.vtt$/);
  assert.equal(manifest.audio, false, "silent-first");
  assert.equal(existsSync(join(root, "src", "app", "benchmarks-film-preview")), false, "no page, no layout, no title: no preview page exists");
  const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { redirects?: { source: string; destination: string; statusCode?: number }[] };
  const rule = (vercel.redirects ?? []).filter((r) => r.source.startsWith("/benchmarks-film-preview"));
  assert.deepEqual(rule, [{ source: "/benchmarks-film-preview/:path*", destination: "/benchmarks", statusCode: 308 }], "the old review route is an edge 308 to /benchmarks (the bare and the slash form), not a page");
  assert.equal(FILM_SILENT_NOTE, "The film is silent; the captions name each scene, and the list below sums up each scene.");
});

test("public/films holds only the film's cuts (three silent, two narrated previews for the voice review, the explainer and its silent cut): five files each (mp4, webm, poster, captions, manifest), no script or log, no host path (R2)", () => {
  const films = readdirSync(join(root, "public", "films")).filter((n) => n.startsWith("nyayasiddhi")).sort();
  assert.deepEqual(films, ["nyayasiddhi", "nyayasiddhi-explainer", "nyayasiddhi-explainer-silent", "nyayasiddhi-firm", "nyayasiddhi-firm-narrated", "nyayasiddhi-loop", "nyayasiddhi-narrated"]);
  for (const f of films) assert.deepEqual(readdirSync(join(root, "public", "films", f)).sort(), ["captions.vtt", "film.mp4", "film.webm", "manifest.json", "poster.png"], f);
  for (const f of films) for (const n of ["captions.vtt", "manifest.json"]) assert.doesNotMatch(readFileSync(join(root, "public", "films", f, n), "utf8"), /\/home\/|\/tmp\//, `${f}/${n}`);
});

test("the old review route is named nowhere in src: no page, nav, link, sitemap or route list", () => {
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
  assert.deepEqual(hits.sort(), [], "nothing under src names the route (vercel.json redirects it to /benchmarks)");
});

// captions.vtt is pinned once Studio's render exists (the placeholder manifest has none). R1 (16 Oct): captions may carry digits ("order of 12 June 2024", "BNS 316 \u00b7 IPC 405"), so the pin is (1) WEBVTT, cues in order inside the manifest duration; (2) every cue text EQUALS a string of STRINGS_948_v5 (the stronger pin: sha256 65282a5a..., vendored as e2e/fixtures/nyayasiddhiFilmStrings.json (a test fixture, not under src: nothing is bundled)); (3) no barred word, whole words, case-insensitive; (4) no count word in the no-fact-cited scene.
const strings = JSON.parse(readFileSync(join(root, "e2e", "fixtures", "nyayasiddhiFilmStrings.json"), "utf8")) as { sourceSha256: string; refusalStrings: string[]; strings: string[] };
const BARRED = /\b(accuracy|accurate|verified|verify|proved|proves|proof|best|beats?|outperform|caught|stopped|protects|saved|prevented)\b|state of the art/i;
const COUNT_WORD = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozens?|many|several|few|most|all)\b/i;

test("the vendored film strings are STRINGS_948_v5 (sha256 d6cfcfca...), carry no barred word, and the refusal strings carry no count word", () => {
  assert.match(strings.sourceSha256, /^d6cfcfca02b1e0a74baa4cbb3e1848e2231e885bb785c4a63a8d72195d4055a1$/);
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

const NARRATED_CAPTIONS_SHA256 = { "nyayasiddhi-narrated": "25d4a538082aa556d0278b52aa76326c1c9bba68837e29bec868f76e21fb3d26", "nyayasiddhi-firm-narrated": "f9e50fa65f20a5a4823345d58ac2ba636ceee980e414a549621b406f873f3ce5" } as const;
const FILMS = ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm", "nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"] as const;
const norm = (x: string): string => x.replace(/\s+/g, " ").trim();
const sentences = (x: string): string[] => x.split(/(?<=[.!?])\s+/).map(norm).filter(Boolean);
// the cue set: the film's own strings (v4) and each of their sentences (a long string is captioned sentence by sentence), plus text the film takes unchanged from the APP's signed sources: the example order's allegation paragraphs (lib/demo/example.ts), the chip labels (lib/screening/copy.ts), the contracts' element wording (fixtures/contractElements.json), the page's stack labels (lib/nyayasiddhi.ts) and a row's system name + version and run date as the page prints them (rows.json)
const rows = (JSON.parse(readFileSync(join(root, "src", "data", "nyayasiddhi", "rows.json"), "utf8")) as { rows: { system_name: string; system_version: string; run_date: string }[] }).rows;
const allowed = new Set([...strings.strings.flatMap((x) => [norm(x), ...sentences(x)]), ...EXAMPLES.flatMap((e) => [...e.facts].map(norm)), ...Object.values(CHIP_LABEL).map(norm), ...Object.values((contractElements as { contracts: Record<string, { elements: string[]; denials: string[] }> }).contracts).flatMap((c) => [...c.elements, ...c.denials].map(norm)), ...Object.values(NYAYASIDDHI_STRINGS.stackLabel).filter((x): x is string => typeof x === "string").map(norm), ...rows.flatMap((r) => [norm(`${r.system_name} ${r.system_version}`), r.run_date])]);

for (const id of FILMS) {
  const dir = join(root, "public", "films", id);
  const man = readManifest(id);
  const rendered = existsSync(join(dir, "captions.vtt")) && man.placeholder !== true;
  test(`${id}: captions.vtt is WEBVTT, every cue ends inside the duration, every cue is a STRINGS_948_v5 string (or the app's own signed text), no barred word; the files exist; silent`, { skip: !rendered }, () => {
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
      // out_v8: a silent cut's cue is its scene name (one cue per scene; R1 reads those names as strings), which is the manifest's own scene name, or still a v4 string / signed app text
      if (!narrated) assert.ok(allowed.has(text) || man.scenes.some((sc) => norm(sc.name) === text), `${id}: a cue that is neither a STRINGS_948_v5 string nor one of the film's own scene names: ${text}`);
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

// Track B's P3s on the review route (16 Oct): the film manifests are loaded by DYNAMIC import on the route only, and /films/nyayasiddhi* is served with X-Robots-Tag: noindex, nofollow from the repo's vercel.json.
test("the NyayaSiddhi manifests are imported by one module, dynamically; no other source file imports them (their scene text stays off other pages' chunks)", () => {
  const SKIP = new Set(["node_modules", ".next", "out", "test-results"]);
  const importers: string[] = [];
  (function walk(d: string): void {
    for (const n of readdirSync(d)) {
      if (SKIP.has(n)) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(n) || /\.spec\.ts$/.test(n)) continue;
      if (/films\/nyayasiddhi[a-z-]*\/manifest\.json/.test(readFileSync(p, "utf8"))) importers.push(relative(root, p).replace(/\\/g, "/"));
    }
  })(join(root, "src"));
  assert.deepEqual(importers, ["src/lib/films/nyayasiddhiFilms.ts"]);
  const src = readFileSync(join(root, "src", "lib", "films", "nyayasiddhiFilms.ts"), "utf8");
  assert.equal((src.match(/import\("\.\.\/\.\.\/\.\.\/public\/films\/nyayasiddhi[a-z-]*\/manifest\.json"\)/g) ?? []).length, 7, "seven dynamic imports");
  assert.doesNotMatch(src, /^import .* from ".*manifest\.json"/m, "no static import of a manifest");
});

test("vercel.json: /films/nyayasiddhi* gets X-Robots-Tag noindex, nofollow, and the site-wide headers are unchanged (repo code, not a project setting)", () => {
  const cfg = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const all = cfg.headers.find((h) => h.source === "/(.*)");
  assert.deepEqual(all?.headers.map((h) => h.key), ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options"]);
  const robots = cfg.headers.filter((h) => h.headers.some((x) => x.key === "X-Robots-Tag"));
  assert.equal(robots.length, 1);
  assert.deepEqual(robots[0].headers, [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
  const re = new RegExp(`^${robots[0].source}$`);
  for (const p of ["/films/nyayasiddhi/film.mp4", "/films/nyayasiddhi-loop/poster.png", "/films/nyayasiddhi-firm/captions.vtt", "/films/nyayasiddhi-narrated/film.mp4", "/films/nyayasiddhi-firm-narrated/manifest.json"]) assert.match(p, re, p);
  for (const p of ["/films/client/film.mp4", "/films/technical/film.mp4", "/benchmarks", "/"]) assert.doesNotMatch(p, re, p);
});

// The operator's report (16 Oct): the sound button on a SILENT cut does nothing (the film has no audio track); captions must be off until asked; one click turns the voice on.
const SILENT_MANIFEST: FilmManifest = { title: "T", durationS: 10, width: 1280, height: 720, audio: false, scenes: [] };
const VOICE_MANIFEST: FilmManifest = { ...SILENT_MANIFEST, audio: true };
const html = (id: Parameters<typeof FilmPlayer>[0]["id"], manifest: FilmManifest, extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(FilmPlayer, { id, manifest, ...extra }));

test("a silent film has NO sound button; a narrated one has it; captions start off with the Show captions button and no default track", () => {
  const silent = html("nyayasiddhi", SILENT_MANIFEST);
  assert.ok(!silent.includes('data-testid="film-sound"'), "no sound button on a film with no audio track");
  const voice = html("nyayasiddhi-narrated", VOICE_MANIFEST);
  assert.ok(voice.includes('data-testid="film-sound"') && voice.includes("Turn on sound"));
  for (const h of [silent, voice]) {
    assert.ok(h.includes(`>${FILM_CAPTIONS_SHOW}<`), "captions off until asked: the button offers Show captions");
    assert.doesNotMatch(h, /<track[^>]*\sdefault/, "the captions track is never `default`");
  }
});

test("the WebM source comes first (VP9, with Opus for a narrated film) for every film that ships a film.webm; the mp4 follows; a film without one lists only the mp4", () => {
  const n = html("nyayasiddhi-narrated", VOICE_MANIFEST);
  assert.ok(n.indexOf("film.webm") > 0 && n.indexOf("film.webm") < n.indexOf("film.mp4"), "webm before mp4");
  assert.ok(n.includes("vp9, opus"));
  const sil = html("nyayasiddhi", SILENT_MANIFEST);
  assert.ok(sil.includes("film.webm") && sil.includes("vp9") && !sil.includes("opus"), "a silent film's webm is VP9 only");
  assert.ok(!html("client", VOICE_MANIFEST).includes("film.webm"), "the client film has no webm: mp4 only");
  assert.match(filmFile("nyayasiddhi", "film.webm"), /\/films\/nyayasiddhi\/film\.webm$/);
  // the set the player uses is exactly the folders that hold a film.webm
  const withWebm = readdirSync(join(root, "public", "films")).filter((d) => existsSync(join(root, "public", "films", d, "film.webm"))).sort();
  assert.deepEqual([...WEBM_FILMS].sort(), withWebm);
});

test("a posterFirst film is its poster and a Play the film button: no <video>, no film.webm in the markup (the download link to the mp4 stays), no autoplay (16 Oct, no ~8.6 MB at load)", () => {
  const h = html("nyayasiddhi", SILENT_MANIFEST, { posterFirst: true });
  assert.ok(h.includes('data-testid="film-poster"') && h.includes('data-testid="film-play"'));
  assert.doesNotMatch(h, /<video|film\.webm|autoplay/i);
});

test("the video's preload attribute is pinned: none for every film (nothing is fetched before the visitor asks), also after Play (app#394)", () => {
  for (const [id, m] of [["nyayasiddhi", SILENT_MANIFEST], ["nyayasiddhi-narrated", VOICE_MANIFEST]] as const) {
    assert.match(html(id, m), /<video[^>]*\spreload="none"/, `${id}: preload none`);
  }
  const player = readFileSync(join(root, "src", "components", "films", "FilmPlayer.tsx"), "utf8");
  assert.match(player, /preload="none"/);
  assert.doesNotMatch(player, /preload=\{/, "preload is not computed: it is always none");
});

// The film on /benchmarks (operator, 16 Oct; R1's strings hash 9f41ebf6cbd5): the three new strings are pinned, the signed rows file is byte-for-byte the one that was signed, and the page passes it unchanged.
test("the /benchmarks film: R1's three strings, the rows.json sha256 is the published-rows file (d35: the 8 published organiser rows, Track A rows_merged_proposal d50527be584f), the page keeps feeding the signed rows to the results view and puts the film above it", () => {
  assert.equal(BENCHMARKS_FILM_HEADING, "NyayaSiddhi film");
  assert.equal(FILM_DOWNLOAD_NARRATED, "Download the narrated film");
  assert.equal(BENCHMARKS_FILM_POSTER_ALT, "Poster of the NyayaSiddhi film");
  assert.equal(createHash("sha256").update(readFileSync(join(root, "src", "data", "nyayasiddhi", "rows.json"))).digest("hex"), "d50527be584f1355ec589488b53d963102b8709cbfa2359012fa8af5e2a318a8");
  const page = readFileSync(join(root, "src", "app", "benchmarks", "page.tsx"), "utf8");
  assert.match(page, /parseRows\(rowsFile\)/);
  assert.match(page, /<NyayaSiddhiResults rows=\{NYAYASIDDHI_ROWS\}( links=\{NYAYASIDDHI_LINKS\})? \/>/);
  assert.ok(page.indexOf("<NarratedDefaultFilm") > 0 && page.indexOf("<NarratedDefaultFilm") < page.indexOf("<NyayaSiddhiResults"), "the film player is above the results view");
  assert.match(page, /loadNyayasiddhiManifest\("nyayasiddhi-explainer"\)/, "the narrated cut is the default");
  assert.match(page, /loadNyayasiddhiManifest\("nyayasiddhi-explainer-silent"\)/, "the silent cut is the fallback");
  const wrapper = readFileSync(join(root, "src", "components", "films", "NarratedDefaultFilm.tsx"), "utf8");
  assert.match(wrapper, /posterFirst/);
  assert.match(wrapper, /if \(reduced \|\| failed\)/, "silent cut for reduced motion or a playback error");
  assert.match(wrapper, /key=\{silentId\}/, "each cut keeps its own player state");
  assert.match(wrapper, /silentId = "nyayasiddhi-explainer-silent"/, "the benchmarks default silent cut");
  assert.doesNotMatch(page, /autoPlay|autoplay/i);
  assert.doesNotMatch(page, /benchmarks-film-preview/, "no anchor to the review route");
  assert.doesNotMatch(page, /NYAYASIDDHI_VOICE_PREVIEW_LABEL|voice review/i, "the voice gate passed: the public card does not say it is a preview");
});

// ---- the explainer film #430 (nyayasiddhi-explainer narrated, nyayasiddhi-explainer-silent): Studio's film430 deliver folder; strings STRINGS_430_v3 (vendored below); R1 reads the strings; the allowance list is R2's.
const ex = JSON.parse(readFileSync(join(root, "e2e", "fixtures", "nyayasiddhiExplainerStrings.json"), "utf8")) as { sourceSha256: string; strings: string[]; ruleBException: string[] };
// the four strings the Rule B exception list v2 (a021853e5598, R2) allows to carry a word the word test bars
const exException = new Set(ex.ruleBException.flatMap((x) => [norm(x), ...sentences(x)]));
const EXPLAINER_CAPTIONS_SHA256 = { "nyayasiddhi-explainer": "d8e2979c61f449b08e76ffb894c19f87603d7d29b5a5534f72ed7a0277d2ffcb", "nyayasiddhi-explainer-silent": "5a872c5450a666a210833330ed39a3a01cef1b9078ccb97648946610f39fbe71" } as const;
const exAllowed = new Set(ex.strings.flatMap((x) => [norm(x), ...sentences(x)]));

test("the explainer film's vendored strings are STRINGS_430_v3 (sha256 de4d9e6e6784...), carry no barred word", () => {
  assert.match(ex.sourceSha256, /^de4d9e6e6784/);
  assert.ok(ex.strings.length >= 50);
  for (const t of ex.strings) if (!exException.has(norm(t))) assert.doesNotMatch(t, BARRED, t);
});

for (const id of ["nyayasiddhi-explainer", "nyayasiddhi-explainer-silent"] as const) {
  test(`${id}: captions are WEBVTT and pinned by hash, every cue ends inside the duration, no barred word, the files exist; audio only on the narrated cut`, () => {
    const dir = join(root, "public", "films", id);
    const man = readManifest(id);
    const vtt = readFileSync(join(dir, "captions.vtt"), "utf8");
    assert.match(vtt, /^WEBVTT/);
    assert.equal(createHash("sha256").update(readFileSync(join(dir, "captions.vtt"))).digest("hex"), EXPLAINER_CAPTIONS_SHA256[id], "the captions are the file Studio delivered (R1 reads its strings)");
    const t = (x: string): number => { const [h, m, sec] = x.split(":"); return Number(h) * 3600 + Number(m) * 60 + Number(sec); };
    let cues = 0;
    for (const m of vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})[^\n]*\n([\s\S]*?)(?:\n\n|$)/g)) {
      assert.ok(t(m[1]) >= 0 && t(m[2]) > t(m[1]) && t(m[2]) <= man.durationS + 0.5, `cue ${m[1]}`);
      const text = norm(m[3]);
      // the silent cut: every cue is a STRINGS_430_v3 string (or a sentence of one) or the manifest's own scene name; the narrated cut's captions are the narration script (pinned by hash above)
      const okText = (x: string): boolean => exAllowed.has(x) || man.scenes.some((sc) => norm(sc.name) === x);
      // a cue may stack two of the film's strings on separate lines (the title over its question)
      if (id.endsWith("silent")) assert.ok(okText(text) || m[3].split("\n").map(norm).filter(Boolean).every(okText), `${id}: a cue that is not a STRINGS_430_v3 string: ${text}`);
      if (!exException.has(text)) assert.doesNotMatch(text, BARRED, text);
      cues += 1;
    }
    assert.ok(cues > 0);
    for (const f of ["film.mp4", "film.webm", "poster.png"]) assert.ok(existsSync(join(dir, f)), `${id}/${f}`);
    assert.equal(man.audio, !id.endsWith("silent"));
    if (!id.endsWith("silent")) assert.match(vtt, /\n1\n[^\n]*-->[^\n]*\nThe narration is a synthetic voice\.\n/, "the synthetic-voice line is the first cue");
  });

  test(`${id}: the hidden-set scene shows the re-rendered sentence ("is planned", R1)`, { skip: !id.endsWith("silent") }, () => {
    const vtt = norm(readFileSync(join(root, "public", "films", id, "captions.vtt"), "utf8").replace(/\n\d+\n\d\d:[^\n]*/g, " "));
    assert.ok(vtt.includes(norm(FILM_HIDDEN_SET_LINE)), "the film's S9 text is the re-rendered sentence");
  });
}

// R1 (20 Oct, FILM_MUTE_WORDS_R1_2026-10-20.md sha12 7ed782e9f2b3): the mute control's words and the two voice statements, by hash.
const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);
test("the narrated-default card's words are R1's by hash: Mute / Unmute, their aria-labels, the narrated note and the synthetic-voice line", () => {
  assert.equal(h16(FILM_MUTE), "8dd6857baf026850");
  assert.equal(h16(FILM_UNMUTE), "ce4ee4efc5e324fc");
  assert.equal(h16(FILM_MUTE_ARIA), "5b0b68a73edae4bc");
  assert.equal(h16(FILM_UNMUTE_ARIA), "613af7f9bba2b603");
  assert.equal(h16(FILM_NARRATED_NOTE), "4f2583bc5977cd17");
  assert.equal(h16(FILM_SYNTHETIC_VOICE), "65c3d3f5e5dab7df");
});

test("soundOnPlay: the narrated film has a Mute button (not Turn on sound), starts unmuted only after Play, and keeps the narrated note and the synthetic-voice line; a silent film still has none", () => {
  const voice = renderToStaticMarkup(createElement(FilmPlayer, { id: "nyayasiddhi-narrated", manifest: VOICE_MANIFEST, soundOnPlay: true }));
  assert.doesNotMatch(voice, /<video[^>]*\smuted/, "no muted attribute: sound starts at Play (the video only exists after Play on a posterFirst film)");
  const posterFirst = renderToStaticMarkup(createElement(FilmPlayer, { id: "nyayasiddhi-narrated", manifest: VOICE_MANIFEST, soundOnPlay: true, posterFirst: true }));
  assert.doesNotMatch(posterFirst, /<video/, "poster first: no video before Play");
  assert.match(posterFirst, new RegExp(FILM_SYNTHETIC_VOICE));
  assert.match(voice, /data-testid="film-mute"/);
  assert.match(voice, new RegExp(`aria-label="${FILM_MUTE_ARIA}"`));
  assert.doesNotMatch(voice, /Turn on sound|Turn off sound/);
  const other = renderToStaticMarkup(createElement(FilmPlayer, { id: "nyayasiddhi-narrated", manifest: VOICE_MANIFEST }));
  assert.match(other, /Turn on sound/, "the other narrated films keep Turn on sound");
  assert.doesNotMatch(other, /film-mute/);
});

test("a scene line ends in one full stop whether or not the manifest's scene name already does (no doubled stop on the film cards)", () => {
  assert.equal(sceneNameLine("Built"), "Built.");
  assert.equal(sceneNameLine("Same script. Same ranges."), "Same script. Same ranges.");
  assert.equal(sceneNameLine("No outside entry yet. Entry is a pull request on the dataset page."), "No outside entry yet. Entry is a pull request on the dataset page.");
  for (const id of ["nyayasiddhi-explainer", "nyayasiddhi-explainer-silent"] as const) {
    const m = readManifest(id);
    const markup = renderToStaticMarkup(createElement(FilmPlayer, { id, manifest: m, posterFirst: true }));
    assert.doesNotMatch(markup, /\.\.\s*<\/span>/, `${id}: no doubled stop after a scene name`);
    for (const s of m.scenes) assert.ok(markup.includes(`>${sceneNameLine(s.name).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}</span>`) || sceneNameLine(s.name).match(/["&<>']/), `${id}: ${s.name}`);
  }
});
