import assert from "node:assert/strict";
import test from "node:test";

import { CONTRACT_BLOCK_TITLES, OFFENCES, blockTitle, offenceOf } from "./offences";

// R2 (8 Oct): the BNS/IPC pair strings are pinned exactly. R1 read all eight pairs as correct and R2 checked them against the corpus; a changed digit fails here.
test("the nine offence titles (eight validated, one not), their BNS/IPC pair lines and contracts are exactly the ones R1 and R2 checked", () => {
  assert.deepEqual(
    OFFENCES.map((o) => [o.id, o.title, o.sections, [...o.contracts], o.ipcChecked]),
    [
      ["breach-of-trust", "Criminal breach of trust", "BNS 316 · IPC 405", ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers"], "405"],
      ["cheating", "Cheating", "BNS 318 · IPC 415", ["ipc415_property", "ipc415_damaging_act"], "415"],
      ["cheating-personation", "Cheating by personation", "BNS 319 · IPC 416", ["ipc416"], "416"],
      ["false-information", "False information to a public servant", "BNS 217 · IPC 182", ["ipc182_misdirected_act", "ipc182_abuse_of_power"], "182"],
      ["bns-69", "BNS 69", "", ["bns69"], null],
      ["cruelty", "Cruelty by the husband or his relatives", "BNS 85, 86 · IPC 498A", ["bns85"], null],
      ["abetment", "Abetment", "BNS 45, 46 · IPC 107, 108", ["bns46_instigation", "bns46_conspiracy", "bns46_intentional_aid"], null],
      ["abetment-outside-india", "Abetment in India of an offence outside India", "BNS 47 · IPC 108A", ["bns47"], null],
      // not on the validated list; offered so the referral can be seen (#99). One row per offence (#128 D7): there is no second "Criminal breach of trust (BNS s.316)" row.
      ["dishonoured-cheque", "Dishonour of a cheque", "Negotiable Instruments Act s.138", ["ni138"], null],
    ],
  );
});

test("offenceOf finds the offence of a contract, and nothing for an id outside the table", () => {
  assert.equal(offenceOf("ipc415_damaging_act")?.id, "cheating");
  assert.equal(offenceOf("bns47")?.sections, "BNS 47 · IPC 108A");
  assert.equal(offenceOf("not_a_contract"), null);
  assert.equal(offenceOf(""), null);
});

// Explorer, 15 Oct (gap review of the cc1cbb41 build; deploy-2 P1 "limb subtitles"): the block titles are checked as a family, not only as a list of strings.
test("every way of every multi-way offence has a title of its own, built on that offence's own name and BNS/IPC line, and no title is an orphan", () => {
  const multi = OFFENCES.filter((o) => o.contracts.length > 1);
  assert.deepEqual(multi.map((o) => o.id), ["breach-of-trust", "cheating", "false-information", "abetment"]);
  for (const o of multi) {
    for (const id of o.contracts) {
      // an entry exists for the contract itself (not the offence-name fallback of blockTitle)
      assert.ok(Object.prototype.hasOwnProperty.call(CONTRACT_BLOCK_TITLES, id), `${id} has no block title`);
      // the title starts with the offence's own title and sections, so a title cannot drift to another offence or another section number
      assert.ok(blockTitle(id).startsWith(`${o.title} \u00b7 ${o.sections}: `), `${id}: title does not start with "${o.title} \u00b7 ${o.sections}: "`);
      // a way is named after the colon, and it is neither empty nor the contract id
      const way = blockTitle(id).slice(`${o.title} \u00b7 ${o.sections}: `.length);
      assert.ok(way.trim().length >= 6 && !way.includes(id) && !/ipc\d|bns\d/.test(way), `${id}: the way named is "${way}"`);
    }
  }
  // no entry belongs to a contract that is not a way of a multi-way offence (a renamed contract id would leave an orphan title behind)
  const ways = new Set(multi.flatMap((o) => [...o.contracts]));
  for (const id of Object.keys(CONTRACT_BLOCK_TITLES)) assert.ok(ways.has(id), `${id} is a block title for a contract that is not a way of a multi-way offence`);
  // single-way offences keep the plain offence name
  for (const o of OFFENCES.filter((x) => x.contracts.length === 1)) assert.equal(blockTitle(o.contracts[0]), o.title);
});
