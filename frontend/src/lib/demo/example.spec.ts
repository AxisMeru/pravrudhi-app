import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { EXAMPLE_CONTRACTS, EXAMPLE_FACTS, EXAMPLE_FACTS_SHA256, EXAMPLE_FACTS_TEXT, EXAMPLE_ID, EXAMPLE_LABEL, EXAMPLE_NOT_FOUND_LINK, EXAMPLE_NOT_FOUND_TEXT } from "./example";
import { DO_NOT_CLAIM } from "../surfaceCopy";

test("the example text is exactly the text that was identifier-checked (its sha256 is pinned)", () => {
  const sha = createHash("sha256").update(EXAMPLE_FACTS.join("\n") + "\n", "utf8").digest("hex");
  assert.equal(sha, EXAMPLE_FACTS_SHA256);
  assert.equal(EXAMPLE_FACTS_TEXT, EXAMPLE_FACTS.join("\n"));
});

test("the sample is INVENTED: five short facts, no decision or outcome words, no real-looking identifier, no court or order", () => {
  const text = EXAMPLE_FACTS_TEXT.toLowerCase();
  for (const word of ["dismissed", "quash", "this court", "petitioner", "accused", "complainant", "high court", "order of", "cr.no", "crl"]) assert.ok(!text.includes(word), word);
  assert.equal(EXAMPLE_FACTS.length, 5);
  for (const p of EXAMPLE_FACTS) assert.ok(p.length > 20 && p.length <= 200);
  assert.deepEqual(EXAMPLE_FACTS.map((f) => f.split(" ")[0]), ["Ravi", "Meena", "Ravi", "No", "Ravi"]);
});

test("the label says what the example is and is not, and carries no claim on the do-not-claim list", () => {
  assert.match(EXAMPLE_LABEL, /^An invented sample, example only: the people, places, amounts and dates are made up\. /);
  assert.match(EXAMPLE_LABEL, /illustrative, not evidence/);
  assert.doesNotMatch(EXAMPLE_LABEL + EXAMPLE_ID, /court|judgment|order of|\bNo\.\s*\d|\d+ of \d{4}/i, "no court, order or case reference");
  for (const re of DO_NOT_CLAIM) assert.doesNotMatch(EXAMPLE_LABEL, re);
  assert.equal(EXAMPLE_ID, "toy-lorry-sample");
  assert.equal(EXAMPLE_NOT_FOUND_TEXT, "That example is not available.");
  assert.equal(EXAMPLE_NOT_FOUND_LINK, "Try the sample instead");
});

test("the example selects the cheating contract", () => {
  assert.deepEqual([...EXAMPLE_CONTRACTS], ["ipc415_property"]);
});

import { STEPS } from "./steps";

test("the demo steps walk the Screening flow and do not say every ingredient has a cited fact: only supported ones do", () => {
  const text = STEPS.map((x) => `${x.title}. ${x.body}`).join(" ");
  assert.doesNotMatch(text, /for every element/i);
  assert.match(text, /A supported ingredient shows the fact of yours it cites, as you wrote it/);
  assert.match(text, /Not supported by these facts, or Needs your review, with the reason/);
  assert.equal(STEPS.length, 6);
});

// The facts text carries no case or crime number, no dotted date, no CNR and no "No. N" / "N of YYYY" form.
test("the example facts carry no case identifier or dotted date", () => {
  for (const re of [/Cr\.?\s?No/i, /\b\d{1,2}\.\d{1,2}\.\d{4}\b/, /CNR|HCMA/, /\bNo\.\s*\d|\d+ of \d{4}/]) {
    assert.doesNotMatch(EXAMPLE_FACTS_TEXT, re, String(re));
  }
});

// Lead-2 14 Oct: the earlier example (a real public order) is removed from everything reachable: no source, test, fixture, doc or served text names its id, its court or its facts.
test("the retired example is nowhere in the app's source, tests or docs", () => {
  const root = join(__dirname, "..", "..", "..");
  const banned = new RegExp(["madras", "public-order", "42,00,000", "unauthori[sz]ed chit"].join("|"), "i");
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", "out", ".next", ".git", "test-results"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|json|md|txt|mjs|yml|yaml)$/.test(name)) readFileSync(p, "utf8").split("\n").forEach((l, i) => { if (banned.test(l) && !p.endsWith("example.spec.ts") && !p.endsWith("citationsPanel.spec.ts")) hits.push(`${relative(root, p)}:${i + 1}`); });
    }
  };
  for (const d of ["src", "e2e", "public"]) walk(join(root, d));
  assert.deepEqual(hits, []);
});
