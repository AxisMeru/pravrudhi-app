import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { BANNED, scanSource } from "../wordingAudit";
import { GUIDE_IMAGES, GUIDE_LIMITS, GUIDE_STATUSES, GUIDE_STEPS } from "./copy";

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
  assert.match(copySource, /first analysis after the service has been idle can take a few minutes while the judges start/);
});
