import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DECIDE_ATTESTATION_KEYS, DECIDE_CITATION_KEYS, DECIDE_CONTRACT_KEYS, DECIDE_ELEMENT_KEYS, DECIDE_STANDARD_KEYS, DECIDE_TOP_KEYS } from "./api";

// The decide-result field lists (lib/api.ts) are the engine schema's own field names. This fails when the pinned engine schema gains a field that nobody decided on.
const schemas = (JSON.parse(readFileSync(join(__dirname, "fixtures", "engineOpenapiV1.json"), "utf8")) as { components: { schemas: Record<string, { properties: Record<string, unknown> }> } }).components.schemas;
const names = (n: string) => Object.keys(schemas[n].properties).sort();
const same = (list: readonly string[], schema: string, notListed: string[] = []) => assert.deepEqual([...list].sort(), names(schema).filter((k) => !notListed.includes(k)), schema);

test("the decide-result lists match the pinned engine schema, with the deliberate exclusions named", () => {
  // retention_notice: the app states retention itself and never reads the engine's text. The two set-version fields: the app reads neither.
  same(DECIDE_TOP_KEYS, "AnalyseFactsResponse", ["retention_notice", "contract_set_version", "validated_set_version"]);
  same(DECIDE_CONTRACT_KEYS, "ContractResultOut");
  same(DECIDE_ELEMENT_KEYS, "ElementResultOut");
  same(DECIDE_STANDARD_KEYS, "StandardOut");
  same(DECIDE_CITATION_KEYS, "CitationOut");
  assert.deepEqual([...DECIDE_ATTESTATION_KEYS], ["binary_sha256", "wire_sha256", "verdict"]);
});
