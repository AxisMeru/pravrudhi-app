import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { B3_MODES, PREVIEW_MORE } from "./previewMoreCopy";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  a5Name: "998b578bcf6d0cb2",
  a5Line: "04db76a18b03b7d9",
  a5Run: "8ae2fb77eb19e442",
  a3Name: "c96cad0be677f0b8",
  a3Line: "2f663aecfbd0f7ea",
  a3Run: "8e9bfb6c3dac96b2",
  s1Name: "a43b0c3543c11808",
  s1Line: "2902f402a18e2e76",
  s1Run: "f9c9a933cdeb8b18",
  a1Name: "a86238f99f5d6aa7",
  a1Line: "5c014e1559492ca6",
  a1Label: "064ea07b0e24a932",
  a1Run: "a0bc7cb2db5621a9",
  b3Name: "c7ba09d8299c6f2c",
  b3Line: "ea3888ee14f95f7e",
  b3Run: "a90a32d61f2b025a",
  b3Cheque: "340e5a32e0f61926",
  b3Presentation: "3c60776090965341",
  b3Memo: "336a9f2df118713c",
  b3Information: "7424992637adb0c8",
  b3Notice: "ef03507ead307f83",
  b3Receipt: "aeb163a8567ea29b",
  b3Validity: "11833dd38b918fe2",
  b3Mode: "2e3fa263a515a618",
  b3ModeNone: "068109fd3f73fbbb",
  citation_not_checked: "b9db1d688c280ef4",
  confirm_date: "4ab7b37213731da6",
};
const MODE_PINS: Record<string, string> = {
  registered_post: "9840894234e5ae72",
  speed_post: "a6bee84ae9864c9a",
  courier: "bbc5df524d41b1e3",
  email: "969ccbd3cf6300ec",
  fax: "00d84ab46e6345e1",
  hand_delivery: "573ad1256497438c",
  other: "f97e9da0e3b879f0",
};

test("every label of the other preview workflows is exactly R1's, by hash", () => {
  assert.deepEqual(Object.keys(PREVIEW_MORE).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((PREVIEW_MORE as Record<string, string>)[k]), hash, k);
  assert.deepEqual(B3_MODES.map((m) => m.value).sort(), Object.keys(MODE_PINS).sort());
  for (const m of B3_MODES) assert.equal(h(m.label), MODE_PINS[m.value], m.value);
});
