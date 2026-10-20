import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DRAFTING_CARDS } from "./draftingCards";

const root = join(__dirname, "..", "..");

test("the drafting cards flag is OFF unless NEXT_PUBLIC_DRAFTING_CARDS is exactly 1, and /matter-tools shows both A4 and A8 cards only behind it", () => {
  assert.equal(DRAFTING_CARDS, process.env.NEXT_PUBLIC_DRAFTING_CARDS === "1");
  const src = readFileSync(join(root, "src", "lib", "draftingCards.ts"), "utf8");
  assert.match(src, /NEXT_PUBLIC_DRAFTING_CARDS === "1"/);
  const page = readFileSync(join(root, "src", "app", "matter-tools", "page.tsx"), "utf8");
  assert.match(page, /\{DRAFTING_CARDS && <BailCard \/>\}/);
  assert.match(page, /\{DRAFTING_CARDS && <SynopsisCard /);
  assert.doesNotMatch(page, /^\s*<(BailCard|SynopsisCard)\b/m, "no unconditional A4/A8 card");
});
