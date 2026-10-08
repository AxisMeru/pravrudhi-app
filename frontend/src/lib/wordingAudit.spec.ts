import { strict as assert } from "node:assert";
import test from "node:test";

import { scanSource, violations } from "./wordingAudit";

test("a user-visible string with a banned word is a hit; comments, imports, class names and ids are not", () => {
  const src = [
    '// the quote check passes here',
    'import { quote } from "./quote";',
    'const a = "The judge found the offence established in your facts";',
    '<div className="quote-box" data-testid="verbatim-cell">Word for word from your facts</div>',
    "const id = 'quote_check';",
    '<p>Cites your fact F3 in full</p>',
    "const b = `A quote that passed`;",
  ].join("\n");
  const hits = scanSource("src/x.tsx", src);
  assert.deepEqual(hits.map((h) => h.line), [3, 4, 7]);
});

test("the banned words are matched as words, in any case: proof, established, verbatim, word-for-word, passage, quote", () => {
  for (const s of ["Proof of the claim", "It is ESTABLISHED", "verbatim text", "a word-for-word copy", "the passage", "this quote", "quoted words"]) {
    assert.equal(scanSource("src/x.ts", `const s = "${s} here";`).length, 1, s);
  }
  for (const s of ["Cites your fact F3 in full", "Needs your review", "Supported by a fact", "proofread"]) {
    assert.equal(scanSource("src/x.ts", `const s = "${s} ok";`).length, 0, s);
  }
});

test("a frontier file may say quote; any other file may not unless the allow-list names the exact string", () => {
  const frontier = scanSource("src/components/screening/FrontierQuote.tsx", 'const s = "passed the quote check";');
  const house = scanSource("src/app/screening/page.tsx", 'const s = "passed the quote check";');
  assert.equal(frontier.length, 1);
  assert.equal(violations(frontier).length, 0);
  assert.equal(violations(house).length, 1);
  assert.equal(violations(house, new Set([`src/app/screening/page.tsx:passed the quote check`])).length, 0);
});

test("identifiers inside a template literal are not words; a single-word label property is", () => {
  assert.equal(scanSource("src/x.ts", 'const a = `| ${cell(e.quote)} | ${quote} |`;').length, 0);
  assert.equal(scanSource("src/x.ts", '  PROOF: { label: "established", tone: "x" },').length, 1);
  assert.equal(scanSource("src/x.ts", '  const same = el.status === "established";').length, 0);
});
