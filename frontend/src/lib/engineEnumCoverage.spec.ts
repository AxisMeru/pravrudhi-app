import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { REFER_REASONS, UNKNOWN_REASON_TEXT, referReasonPresentation } from "./referReason";

// app#366 (Interim lead, 17 Oct): the live engine already answers the newer enum values, so every value of the pinned contract's enums is either handled with a signed sentence or explicitly classified here; a value added by a later contract fails this test instead of falling to a blank path.
const spec = JSON.parse(readFileSync(join(__dirname, "fixtures", "engineOpenapiV1.json"), "utf8")) as { components: { schemas: Record<string, { properties: Record<string, { enum?: string[] }> }> }; paths: Record<string, unknown> };
const S = spec.components.schemas;

// Reasons that are NOT referrals: they come with a PROOF / ABSTAIN / DENIAL outcome and the page words them through the outcome and the checklist, never through the "For a lawyer to review" sentence.
const NON_REFERRAL_REASONS = ["all_elements_established", "denial_established", "missing_element", "no_training_statute_text", "judge_error", "assembly_lean_mismatch"];

test("every ContractResultOut.reason of the pinned contract is a signed referral sentence or an explicit non-referral reason", () => {
  const reasons = S.ContractResultOut.properties.reason.enum!;
  assert.equal(reasons.length, 17);
  assert.deepEqual([...reasons].sort(), [...REFER_REASONS, ...NON_REFERRAL_REASONS].sort(), "a new engine reason must be classified here (and get R1's sentence if it is a referral)");
});

test("each referral reason renders a signed sentence (known, not the unknown fallback); a reason this build does not know reads R1's one fallback sentence", () => {
  for (const r of REFER_REASONS) {
    const p = referReasonPresentation(r);
    assert.equal(p.unknown, false, r);
    assert.ok(p.message.length > 20 && p.message !== UNKNOWN_REASON_TEXT, r);
    assert.doesNotMatch(p.message, /second_judge|gate1|_/, `${r}: no engine code in the sentence`);
  }
  const unknown = referReasonPresentation("a_reason_from_a_later_engine");
  assert.equal(unknown.unknown, true);
  assert.equal(unknown.message, UNKNOWN_REASON_TEXT);
  assert.equal(referReasonPresentation(null).message.length > 0, true);
});

test("AuditRowOut.mode (six values in the pinned contract) has no consumer in the app: the engine's /api/v1/audit rows are not read or shown here", () => {
  assert.deepEqual(S.AuditRowOut.properties.mode.enum, ["sync", "job", "verify", "assist", "intake", "intake_assist"]);
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "fixtures") walk(p); } else if (/\.(ts|tsx)$/.test(f) && !/\.spec\.ts$/.test(f)) files.push(p); } };
  walk(join(__dirname, ".."));
  const users = files.filter((f) => /\/api\/v1\/audit\b|AuditRowOut|audit_rows/.test(readFileSync(f, "utf8")));
  assert.deepEqual(users, [], "if a screen starts reading /api/v1/audit rows, it needs a signed word for each mode (assist, intake, intake_assist) first");
});
