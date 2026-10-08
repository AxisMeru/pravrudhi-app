import assert from "node:assert/strict";
import test from "node:test";

import { OFFENCES, offenceOf } from "./offences";

// R2 (8 Oct): the BNS/IPC pair strings are pinned exactly. R1 read all eight pairs as correct and R2 checked them against the corpus; a changed digit fails here.
test("the eight offence titles, their BNS/IPC pair lines and contracts are exactly the ones R1 and R2 checked", () => {
  assert.deepEqual(
    OFFENCES.map((o) => [o.id, o.title, o.sections, [...o.contracts], o.ipcChecked]),
    [
      ["breach-of-trust", "Criminal breach of trust", "BNS 316 · IPC 405", ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers"], "405"],
      ["cheating", "Cheating", "BNS 318 · IPC 415", ["ipc415_property", "ipc415_damaging_act"], "415"],
      ["cheating-personation", "Cheating by personation", "BNS 319 · IPC 416", ["ipc416"], "416"],
      ["false-information", "False information to a public servant", "BNS 217 · IPC 182", ["ipc182_misdirected_act", "ipc182_abuse_of_power"], "182"],
      ["promise-to-marry", "Sexual intercourse by deceitful means or a false promise to marry", "BNS 69 · no IPC counterpart", ["bns69"], null],
      ["cruelty", "Cruelty by the husband or his relatives", "BNS 85, 86 · IPC 498A", ["bns85"], null],
      ["abetment", "Abetment", "BNS 45, 46 · IPC 107, 108", ["bns46_instigation", "bns46_conspiracy", "bns46_intentional_aid"], null],
      ["abetment-outside-india", "Abetment in India of an offence outside India", "BNS 47 · IPC 108A", ["bns47"], null],
    ],
  );
});

test("offenceOf finds the offence of a contract, and nothing for an id outside the table", () => {
  assert.equal(offenceOf("ipc415_damaging_act")?.id, "cheating");
  assert.equal(offenceOf("bns47")?.sections, "BNS 47 · IPC 108A");
  assert.equal(offenceOf("not_a_contract"), null);
  assert.equal(offenceOf(""), null);
});
