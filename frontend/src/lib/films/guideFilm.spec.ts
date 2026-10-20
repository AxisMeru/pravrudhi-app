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
