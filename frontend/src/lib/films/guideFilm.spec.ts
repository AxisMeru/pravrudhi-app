import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FILM_IDS } from "./copy";
import { GUIDE_FILM_ID, GUIDE_FILM_MANIFEST } from "./guideFilm";

const root = join(__dirname, "..", "..", "..");

test("the /guide film slot names a registered film whose five files exist, whose manifest is the one the page passes, and the page renders it from that one constant", () => {
  assert.ok((FILM_IDS as readonly string[]).includes(GUIDE_FILM_ID));
  const dir = join(root, "public", "films", GUIDE_FILM_ID);
  for (const f of ["film.mp4", "poster.png", "captions.vtt", "manifest.json"]) assert.ok(existsSync(join(dir, f)), `${GUIDE_FILM_ID}/${f}`);
  assert.deepEqual(GUIDE_FILM_MANIFEST, JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")));
  const page = readFileSync(join(root, "src", "app", "guide", "page.tsx"), "utf8");
  assert.match(page, /<FilmPlayer id=\{GUIDE_FILM_ID\} manifest=\{GUIDE_FILM_MANIFEST\} \/>/);
  assert.doesNotMatch(page, /<FilmPlayer id="client"/, "the id lives in the slot file only");
});

test("nothing is deleted when the guide film is replaced: every registered film still has its folder in public/films", () => {
  const folders = new Set(readdirSync(join(root, "public", "films")));
  for (const id of FILM_IDS) assert.ok(folders.has(id), `${id} folder is kept`);
});

// guide-v2 (Studio, 21 Oct, prabhasa-nyaya#1025/#1026): registered, files kept, captions pinned by hash (the files R1 read), every line of the film is in the vendored strings, and the embed is gated by NEXT_PUBLIC_GUIDE_FILM_V2 (OFF keeps the earlier film) until app #480 is live in production.
import { createHash } from "node:crypto";
import { GUIDE_FILM_V2, GUIDE_V2 } from "./guideFilm";
import { WEBM_FILMS } from "./films";

const V2_CAPTIONS_SHA256 = {
  "guide-v2": "86b936f32d0fa3e20e09961e1ba236c0dd74f79f7f383315a4db7b56f64a42cb",
  "guide-v2-silent": "7cc4b4c7149a0971a3ddfd114d6628f605bcb533833e9ab2baff0a3bf35222ef",
} as const;

test("guide-v2 and guide-v2-silent are registered, have their five files, and their manifests are the ones the slot passes; audio only on the narrated cut", () => {
  for (const id of ["guide-v2", "guide-v2-silent"] as const) {
    assert.ok((FILM_IDS as readonly string[]).includes(id), id);
    assert.ok(WEBM_FILMS.has(id), `${id} has a webm`);
    const dir = join(root, "public", "films", id);
    assert.deepEqual(readdirSync(dir).sort(), ["captions.vtt", "film.mp4", "film.webm", "manifest.json", "poster.png"], id);
    for (const n of ["captions.vtt", "manifest.json"]) assert.doesNotMatch(readFileSync(join(dir, n), "utf8"), /\/home\/|\/tmp\//, `${id}/${n}`);
    assert.equal(createHash("sha256").update(readFileSync(join(dir, "captions.vtt"))).digest("hex"), V2_CAPTIONS_SHA256[id], `${id} captions are the file Studio delivered`);
    assert.ok(readFileSync(join(dir, "captions.vtt"), "utf8").startsWith("WEBVTT"));
  }
  assert.deepEqual(GUIDE_V2.narrated, JSON.parse(readFileSync(join(root, "public", "films", "guide-v2", "manifest.json"), "utf8")));
  assert.deepEqual(GUIDE_V2.silent, JSON.parse(readFileSync(join(root, "public", "films", "guide-v2-silent", "manifest.json"), "utf8")));
  assert.equal(GUIDE_V2.narrated.audio, true);
  assert.equal(GUIDE_V2.silent.audio, false);
  assert.equal(GUIDE_V2.narrated.scenes.length, GUIDE_V2.silent.scenes.length);
});

test("the vendored guide strings are GUIDE_STRINGS_v2 (sha256 b4c8036de535...), 49 lines", () => {
  const s = JSON.parse(readFileSync(join(root, "e2e", "fixtures", "guideFilmStrings.json"), "utf8")) as { sourceSha256: string; strings: { text: string }[] };
  assert.match(s.sourceSha256, /^b4c8036de535/);
  assert.equal(s.strings.length, 49);
});

test("the silent cut's cues are strings of GUIDE_STRINGS_v2 or the manifest's own scene names", () => {
  const s = JSON.parse(readFileSync(join(root, "e2e", "fixtures", "guideFilmStrings.json"), "utf8")) as { strings: { text: string }[] };
  const norm = (t: string) => t.replace(/\s+/g, " ").trim();
  const ok = new Set<string>(s.strings.map((x) => norm(x.text)));
  for (const sc of GUIDE_V2.silent.scenes) ok.add(norm(sc.name));
  const vtt = readFileSync(join(root, "public", "films", "guide-v2-silent", "captions.vtt"), "utf8");
  const cues = vtt.split(/\n\n+/).slice(1).map((b) => norm(b.split("\n").filter((l) => !/-->/.test(l) && !/^\d+$/.test(l)).join(" "))).filter(Boolean);
  assert.ok(cues.length > 5);
  const all = [...ok];
  const longestFirst = all.filter(Boolean).sort((x, y) => y.length - x.length);
  // a cue is a vendored string, a sentence of one, or two or more of them on one caption line
  for (const c of cues) {
    let rest = c;
    for (const o of longestFirst) rest = rest.split(o).join(" ");
    assert.ok(ok.has(c) || all.some((o) => o.includes(c)) || rest.trim() === "", `cue is made of vendored strings: ${c.slice(0, 60)}`);
  }
});

test("the embed is built in only with NEXT_PUBLIC_GUIDE_FILM_V2=1 (app #480 live first); the page keeps the earlier film otherwise", () => {
  const slot = readFileSync(join(root, "src", "lib", "films", "guideFilm.ts"), "utf8");
  assert.match(slot, /GUIDE_FILM_V2 = process\.env\.NEXT_PUBLIC_GUIDE_FILM_V2 === "1"/);
  assert.equal(GUIDE_FILM_V2, process.env.NEXT_PUBLIC_GUIDE_FILM_V2 === "1");
  const page = readFileSync(join(root, "src", "app", "guide", "page.tsx"), "utf8");
  assert.match(page, /GUIDE_FILM_V2 \? <NarratedDefaultFilm/);
});

// Studio's manifest fix (21 Oct, deliver/SHA256SUMS cc23327b8ccb, R1 cleared diff-only): the nine scene names are R1's cleared labels and each scene's text is that beat's signed strings verbatim, newline-separated.
const V2_MANIFEST_SHA256 = {
  "guide-v2": "e2c090603f0eb5b7a84d799b100eacaedecf6e76a5f8a18c839773ed9fd91e29",
  "guide-v2-silent": "7ad8c844f491c4306c51f4ea9afffc873c2fec89297fe9aceb04c7875822e3e2",
} as const;
test("the guide-v2 manifests are the files Studio re-delivered (by hash); each scene's text holds only lines of GUIDE_STRINGS_v2 (2, 2, 12, 11, 4, 3, 3, 2, 1 lines per scene), the same in both cuts", () => {
  for (const id of ["guide-v2", "guide-v2-silent"] as const) assert.equal(createHash("sha256").update(readFileSync(join(root, "public", "films", id, "manifest.json"))).digest("hex"), V2_MANIFEST_SHA256[id], `${id} manifest`);
  const s = JSON.parse(readFileSync(join(root, "e2e", "fixtures", "guideFilmStrings.json"), "utf8")) as { strings: { text: string }[] };
  const known = new Set(s.strings.map((x) => x.text));
  for (const m of [GUIDE_V2.narrated, GUIDE_V2.silent]) {
    assert.deepEqual(m.scenes.map((sc) => sc.text.split("\n").length), [2, 2, 12, 11, 4, 3, 3, 2, 1]);
    for (const sc of m.scenes) for (const line of sc.text.split("\n")) assert.ok(known.has(line) || known.has(line.trim()), `scene "${sc.name.slice(0, 40)}": a line is not in GUIDE_STRINGS_v2: ${line.slice(0, 60)}`);
  }
  assert.deepEqual(GUIDE_V2.narrated.scenes.map((sc) => sc.name), GUIDE_V2.silent.scenes.map((sc) => sc.name), "both cuts carry the same cleared scene names");
});
