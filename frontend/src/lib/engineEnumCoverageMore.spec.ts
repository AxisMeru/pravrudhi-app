import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { VERIFY_STATUSES } from "./citationCheck";
import { ELEMENT_STATUSES } from "./elementStatus";
import { NON_REFER_REASON_TEXT, QUOTE_CHECK_TEXT } from "./reasonText";

// app#425 (tests only; follow-up to #424, Track B gaps G1-G3): the pinned contract's remaining enums, the VerifyCitationResponse.result description list, and the non-referral reason text keys.
// A value a later contract adds fails here instead of falling to a blank or raw path.
type Prop = { enum?: string[]; anyOf?: { enum?: string[] }[]; description?: string };
const spec = JSON.parse(readFileSync(join(__dirname, "fixtures", "engineOpenapiV1.json"), "utf8")) as { components: { schemas: Record<string, { properties: Record<string, Prop> }> } };
const S = spec.components.schemas;
const enumOf = (schema: string, prop: string): string[] => {
  const p = S[schema].properties[prop];
  const e = p.enum ?? p.anyOf?.find((a) => a.enum)?.enum;
  assert.ok(e, `${schema}.${prop} has no enum in the pinned contract`);
  return e;
};
const sorted = (a: readonly string[]) => [...a].sort();

const NON_REFERRAL_REASONS = ["all_elements_established", "denial_established", "missing_element", "no_training_statute_text", "judge_error", "assembly_lean_mismatch"];

const srcFiles: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "fixtures") walk(p); } else if (/\.(ts|tsx)$/.test(f) && !/\.spec\.ts$/.test(f)) srcFiles.push(p); } };
walk(join(__dirname, ".."));
const appSource = () => srcFiles.map((f) => readFileSync(f, "utf8")).join("\n");

test("G1: ElementResultOut.status equals the app's ELEMENT_STATUSES (five)", () => {
  const values = enumOf("ElementResultOut", "status");
  assert.equal(values.length, 5);
  assert.deepEqual(sorted(values), sorted(ELEMENT_STATUSES));
});

test("G1: ElementResultOut.quote_check equals the keys of QUOTE_CHECK_TEXT (eight)", () => {
  const values = enumOf("ElementResultOut", "quote_check");
  assert.equal(values.length, 8);
  assert.deepEqual(sorted(values), sorted(Object.keys(QUOTE_CHECK_TEXT)));
});

test("G1: ContractResultOut.outcome and lean_outcome are the same four values, each handled by the Matters page", () => {
  const outcome = enumOf("ContractResultOut", "outcome");
  assert.deepEqual(sorted(outcome), ["ABSTAIN", "DENIAL", "PROOF", "REFER_TO_LAWYER"]);
  assert.deepEqual(sorted(enumOf("ContractResultOut", "lean_outcome")), sorted(outcome));
  const page = readFileSync(join(__dirname, "..", "app", "matters", "page.tsx"), "utf8");
  for (const o of outcome) assert.match(page, new RegExp(`\\b${o}\\b`), `${o} has no entry on the Matters page`);
});

test("G1: JudgeStateOut.state is the four states the app's service status type names", () => {
  const values = enumOf("JudgeStateOut", "state");
  assert.deepEqual(sorted(values), ["ready", "unavailable", "unknown", "warming"]);
  const src = readFileSync(join(__dirname, "serviceStatus.ts"), "utf8");
  for (const v of values) assert.ok(src.includes(`"${v}"`), `serviceStatus.ts does not name judge state ${v}`);
});

test("G1: JobOut.status and AnalyseFactsRequest.proceeding_posture are classified, and the app has no consumer of either value list", () => {
  assert.deepEqual(enumOf("JobOut", "status"), ["pending", "running", "done", "failed"]);
  assert.deepEqual(enumOf("AnalyseFactsRequest", "proceeding_posture"), ["quash", "discharge", "trial", "appeal"]);
  const all = appSource();
  // the decide-standard response field of the same name (standardLine.ts) is a different, free-text field; only the request values and the job type are tested here
  assert.ok(!/\bJobOut\b/.test(all), "a screen started reading JobOut: give each status a signed word and a test first");
  assert.ok(!/["'`](quash|discharge)["'`]/.test(all), "a screen started using the proceeding_posture values: give each a signed word and a test first");
});

test("G2: the statuses named in the VerifyCitationResponse.result description equal VERIFY_STATUSES (the field is a string, not an enum)", () => {
  assert.equal(S.VerifyCitationResponse.properties.result.enum, undefined);
  const description = S.VerifyCitationResponse.properties.result.description ?? "";
  const named = [...new Set(description.match(/\b[A-Z][A-Z_]{3,}\b/g) ?? [])];
  assert.deepEqual(sorted(named), sorted(VERIFY_STATUSES), "the engine's description list and the app's VERIFY_STATUSES disagree");
});

test("G3: every non-referral reason of the contract has a sentence in NON_REFER_REASON_TEXT, and no other key is there", () => {
  const reasons = enumOf("ContractResultOut", "reason");
  assert.deepEqual(sorted(Object.keys(NON_REFER_REASON_TEXT)), sorted(NON_REFERRAL_REASONS));
  for (const r of NON_REFERRAL_REASONS) {
    assert.ok(reasons.includes(r), `${r} is not in the pinned contract`);
    assert.ok(NON_REFER_REASON_TEXT[r].length > 20, r);
  }
});
