import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DECLARATION_TEXT, isDeclarationRefusal, showDeclarationMissing, withDeclaration } from "./sensitiveDeclaration";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

test("R1's declaration words are hers, by hash (A4_DECLARATION_V4 e21f8c55df95)", () => {
  assert.equal(h(DECLARATION_TEXT.legend), "c4bae9869113db7e");
  assert.equal(h(DECLARATION_TEXT.none), "5051546da630e84b");
  assert.equal(h(DECLARATION_TEXT.sensitive), "e20ce4dc6cfe7d95");
  assert.equal(h(DECLARATION_TEXT.missing), "4c30a82379c58f15");
  assert.doesNotMatch(Object.values(DECLARATION_TEXT).join(" "), /we check|checked|screened|automatic|protected|\ball\b/i);
});

test("flag OFF: the body is exactly what it was (no field, a missing body stays missing)", () => {
  const b = { consent: true, kind: "bail" };
  assert.equal(withDeclaration(b, "", false), b);
  assert.equal(withDeclaration(b, "none", false), b);
  assert.equal(withDeclaration(null, "none", false), null);
});

test("flag ON: no body until a choice is made; the choice is sent exactly as made; a missing base body stays missing", () => {
  const b = { consent: true, kind: "bail" };
  assert.equal(withDeclaration(b, "", true), null);
  assert.deepEqual(withDeclaration(b, "none", true), { consent: true, kind: "bail", sensitive_declaration: "none" });
  assert.deepEqual(withDeclaration(b, "sensitive", true), { consent: true, kind: "bail", sensitive_declaration: "sensitive" });
  assert.equal(withDeclaration(null, "none", true), null);
});

test("the engine's coded refusal is recognised only as 422 + sensitive_declaration_required", () => {
  assert.equal(isDeclarationRefusal(422, { error: "sensitive_declaration_required", detail: "x" }), true);
  assert.equal(isDeclarationRefusal(422, { error: "other" }), false);
  assert.equal(isDeclarationRefusal(409, { error: "sensitive_declaration_required" }), false);
  assert.equal(isDeclarationRefusal(422, null), false);
});

test("the 'say whether' line shows only with the flag on, nothing chosen and the rest of the form ready", () => {
  assert.equal(showDeclarationMissing(true, "", true), true);
  assert.equal(showDeclarationMissing(true, "none", true), false);
  assert.equal(showDeclarationMissing(true, "sensitive", true), false);
  assert.equal(showDeclarationMissing(true, "", false), false);
  assert.equal(showDeclarationMissing(false, "", true), false);
});

// R2's condition (19 Oct): "none" is an explicit choice every time, never a default, never a remembered value.
test("no preselected answer and no remembered value: the choice state starts empty, nothing is stored in the browser, no radio is checked by default", () => {
  const root = join(__dirname, "..", "..");
  const card = readFileSync(join(root, "src", "components", "preview", "Drafting.tsx"), "utf8");
  const lib = readFileSync(join(root, "src", "lib", "sensitiveDeclaration.ts"), "utf8");
  assert.equal((card.match(/useState<Declaration>\(""\)/g) ?? []).length, 2, "both cards start with the empty choice");
  assert.equal((card.match(/setDeclared\(""\)/g) ?? []).length, 2, "both cards clear it after every draft request");
  for (const src of [card, lib]) assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|defaultChecked|defaultValue/, "nothing is remembered or prefilled");
  assert.doesNotMatch(card, /useState<Declaration>\("(none|sensitive)"\)/);
});
