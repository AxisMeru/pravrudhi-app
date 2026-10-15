import assert from "node:assert/strict";
import test from "node:test";

import { STEPS } from "./demo/steps";
import { elementStatusPresentation } from "./elementStatus";
import { bindingLegText, quoteCheckPresentation } from "./reasonText";
import { CAVEATS } from "./surfaceCopy";

// Pins for the O8 lib/ rewrites (#84): each changed string is held EXACTLY, so a mutant that restores the old word or drops a clause fails.
// Toy values only.

test("demo step 3 title and body, exactly (the Screening flow: the three chips and the cited fact)", () => {
  const s = STEPS.find((x) => x.title.startsWith("See which ingredients your facts support"));
  assert.ok(s);
  assert.equal(s.title, "See which ingredients your facts support");
  assert.equal(
    s.body,
    "Each ingredient is marked Supported by a fact, No fact cited, or Needs your review, with the reason. A supported ingredient shows the fact of yours it cites, as you wrote it; nothing is filled in to look complete.",
  );
});

test("the element chips read 'supported by a fact' and 'not supported by these facts'", () => {
  assert.equal(elementStatusPresentation("established").label, "supported by a fact");
  assert.equal(elementStatusPresentation("not_established").label, "not supported by these facts");
  assert.equal(elementStatusPresentation("established").verdict, "established"); // the code value is unchanged: only the words moved
});

test("the binding-leg lines and the unknown quote-check fallback, exactly", () => {
  assert.equal(bindingLegText("primary"), "The first check was not confident enough that your facts support this ingredient.");
  assert.equal(bindingLegText("second"), "The second check was not confident enough that your facts support this ingredient.");
  assert.equal(bindingLegText(null), null);
  const u = quoteCheckPresentation("brand_new");
  assert.equal(u?.text, 'The check of the cited text gave a result this app does not recognise yet ("brand_new").');
  assert.equal(u?.unknown, true);
});

test("the how-to-read stack sentence cites facts and never quotes them", () => {
  const t = CAVEATS.find((c) => c.id === "stack")?.text;
  assert.equal(
    t,
    "Each offence is screened ingredient by ingredient: models read your facts and cite the facts they rely on, and a separate structure check confirms the right ingredients were covered. The structure check does not read your facts.",
  );
});

test("R1's agenda wording (14 Oct): the banner, group heading, alternate-limb note, unscreened note and validated-list note, exactly", async () => {
  const c = await import("./screening/copy");
  assert.equal(c.AGENDA_BANNER_TEXT, "Review agenda: what each ingredient needs, and which facts to look for. Nothing here is a finding about your matter.");
  assert.equal(c.NO_FACT_GROUP_HEADING, "To look for in your papers");
  assert.equal(c.CHIP_LABEL.not_supported, "No fact cited");
  assert.equal(c.ALTERNATE_LIMB_NOTE, "This is another way the same offence can be made out. Each way is screened separately.");
  assert.equal(c.NO_CHECK_NOTE, "This ingredient is not screened yet; a lawyer should read the facts for it.");
  assert.equal(c.NOT_VALIDATED_OFFENCE_NOTE, "Not on the validated list: for this offence the screening does not give a result; a lawyer decides.");
  assert.doesNotMatch(c.AGENDA_BANNER_TEXT, /\d|failed|no result|nothing found/i);
});

test("R1's block titles (#134): never the contract id; every way of every multi-way offence has its own title, and every way after the first carries the note", async () => {
  const o = await import("./screening/offences");
  assert.equal(o.blockTitle("ipc415_property"), "Cheating · BNS 318 · IPC 415: by delivery of property");
  assert.equal(o.blockTitle("ipc415_damaging_act"), "Cheating · BNS 318 · IPC 415: by an act or omission causing damage or harm");
  assert.equal(o.blockTitle("ipc405_misappropriation"), "Criminal breach of trust · BNS 316 · IPC 405: by misappropriation or conversion of the property");
  assert.equal(o.blockTitle("ipc405_use_or_disposal"), "Criminal breach of trust · BNS 316 · IPC 405: by using or disposing of the property against a legal direction or a contract");
  assert.equal(o.blockTitle("ipc405_wilfully_suffers"), "Criminal breach of trust · BNS 316 · IPC 405: by wilfully allowing another person to do either");
  assert.equal(o.blockTitle("ipc182_misdirected_act"), "False information to a public servant · BNS 217 · IPC 182: by false information given intending, or knowing it likely, that the public servant will do or omit something they ought not to, if the true facts were known");
  assert.equal(o.blockTitle("ipc182_abuse_of_power"), "False information to a public servant · BNS 217 · IPC 182: by false information given intending, or knowing it likely, that the public servant will use their lawful power to the injury or annoyance of any person");
  assert.equal(o.blockTitle("bns46_instigation"), "Abetment · BNS 45, 46 · IPC 107, 108: by instigation");
  assert.equal(o.blockTitle("bns46_conspiracy"), "Abetment · BNS 45, 46 · IPC 107, 108: by conspiracy");
  assert.equal(o.blockTitle("bns46_intentional_aid"), "Abetment · BNS 45, 46 · IPC 107, 108: by intentionally aiding the doing of the thing");
  // the alternate note follows the order inside each family (second and later limbs), never a hard-coded id list
  for (const fam of o.OFFENCES.filter((x) => x.contracts.length > 1)) {
    fam.contracts.forEach((id, i) => assert.equal(o.isAlternateLimb(id), i > 0, id));
  }
  // every contract of every multi-contract offence has a title of its own, so no two blocks of one offence read alike
  for (const fam of o.OFFENCES.filter((x) => x.contracts.length > 1)) {
    assert.equal(new Set(fam.contracts.map((id) => o.blockTitle(id))).size, fam.contracts.length, fam.id);
  }
  assert.equal(o.blockTitle("not_a_contract"), "Offence");
  assert.equal(o.isAlternateLimb("ipc415_property"), false);
  assert.equal(o.isAlternateLimb("ipc415_damaging_act"), true);
  assert.equal(o.isAlternateLimb("ipc405_use_or_disposal"), true);
});
