// The offences the Screening view offers, grouped by what the user is screening for, with the BNS section and its IPC equivalent on one line.
// Only the contracts the engine's registry marks validated are offered in v1 (refer-first); the user picks, nothing is suggested. The section
// pairs are authored here for R1/R2 to check (offences.spec.ts pins the table exactly; model.spec.ts pins its contracts against the contract sources in fixtures/contractElements.json).
export interface Offence {
  id: string;
  title: string;
  bns: string | null;
  ipc: string | null;
  /** One line shown with the title: the BNS section and its IPC counterpart. */
  sections: string;
  contracts: readonly string[];
  /** The IPC section the engine actually judges against, set only where the BNS counterpart is not validated (the four IPC-family offences). */
  ipcChecked: string | null;
  /** True where the engine's contracts for this offence are not on the validated list: the registry marks them, and the engine refers rather than answers (#99). */
  notValidated?: true;
}

const sections = (bns: string | null, ipc: string | null): string =>
  [bns ? `BNS ${bns}` : null, ipc ? `IPC ${ipc}` : "no IPC counterpart"].filter(Boolean).join(" · ");

/** R1 (15 Oct, #302): ONE label rule for every offence list (/matters, the guide, the memo's block title): "<title> · <sections>" from the offence's own row (an offence with no sections shows its title alone). */
export const offenceLabel = (o: { title: string; sections: string }): string => (o.sections ? `${o.title} · ${o.sections}` : o.title);

export const OFFENCES: readonly Offence[] = [
  { id: "breach-of-trust", title: "Criminal breach of trust", bns: "316", ipc: "405", sections: sections("316", "405"), contracts: ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers"], ipcChecked: "405" },
  { id: "cheating", title: "Cheating", bns: "318", ipc: "415", sections: sections("318", "415"), contracts: ["ipc415_property", "ipc415_damaging_act"], ipcChecked: "415" },
  { id: "cheating-personation", title: "Cheating by personation", bns: "319", ipc: "416", sections: sections("319", "416"), contracts: ["ipc416"], ipcChecked: "416" },
  { id: "false-information", title: "False information to a public servant", bns: "217", ipc: "182", sections: sections("217", "182"), contracts: ["ipc182_misdirected_act", "ipc182_abuse_of_power"], ipcChecked: "182" },
  { id: "bns-69", title: "BNS 69", bns: "69", ipc: null, sections: "", contracts: ["bns69"], ipcChecked: null }, // shown by its reference only (reference.ts; operator 13 Oct: the MVP app does not spell out explicit offences). R1 proposed naming it in lists (#302): HELD for the operator rule, see the PR.
  { id: "cruelty", title: "Cruelty by the husband or his relatives", bns: "85", ipc: "498A", sections: sections("85, 86", "498A"), contracts: ["bns85"], ipcChecked: null },
  { id: "abetment", title: "Abetment", bns: "45, 46", ipc: "107, 108", sections: sections("45, 46", "107, 108"), contracts: ["bns46_instigation", "bns46_conspiracy", "bns46_intentional_aid"], ipcChecked: null },
  { id: "abetment-outside-india", title: "Abetment in India of an offence outside India", bns: "47", ipc: "108A", sections: sections("47", "108A"), contracts: ["bns47"], ipcChecked: null },
  // Offered so a user can see the screening refer on it (#99); the registry marks this contract "not validated, verify" and the answer is a referral. One row per offence (#128 D7): the BNS 316 contracts are shown under "Criminal breach of trust" above, not as a second row.
  { id: "dishonoured-cheque", title: "Dishonour of a cheque", bns: null, ipc: null, sections: "Negotiable Instruments Act s.138", contracts: ["ni138"], ipcChecked: null, notValidated: true },
];

/**
 * R1, 14 Oct (#134, extended to every multi-contract family): the block title shown for a contract that is one of an offence's several ways of being made out. Never the contract id. A contract with no entry here
 * shows only the offence name.
 */
export const CONTRACT_BLOCK_TITLES: Readonly<Record<string, string>> = {
  ipc405_misappropriation: "Criminal breach of trust · BNS 316 · IPC 405: by misappropriation or conversion of the property",
  ipc405_use_or_disposal: "Criminal breach of trust · BNS 316 · IPC 405: by using or disposing of the property against a legal direction or a contract",
  ipc405_wilfully_suffers: "Criminal breach of trust · BNS 316 · IPC 405: by wilfully allowing another person to do either",
  ipc415_property: "Cheating · BNS 318 · IPC 415: by delivery of property",
  ipc415_damaging_act: "Cheating · BNS 318 · IPC 415: by an act or omission causing damage or harm",
  ipc182_misdirected_act:
    "False information to a public servant · BNS 217 · IPC 182: by false information given intending, or knowing it likely, that the public servant will do or omit something they ought not to, if the true facts were known",
  ipc182_abuse_of_power:
    "False information to a public servant · BNS 217 · IPC 182: by false information given intending, or knowing it likely, that the public servant will use their lawful power to the injury or annoyance of any person",
  bns46_instigation: "Abetment · BNS 45, 46 · IPC 107, 108: by instigation",
  bns46_conspiracy: "Abetment · BNS 45, 46 · IPC 107, 108: by conspiracy",
  bns46_intentional_aid: "Abetment · BNS 45, 46 · IPC 107, 108: by intentionally aiding the doing of the thing",
};

/** The title above a result block: the contract's own title when it has one, else the offence name, else the neutral "Offence" (never the contract id). */
export function blockTitle(contractId: string): string {
  return CONTRACT_BLOCK_TITLES[contractId] ?? offenceOf(contractId)?.title ?? "Offence";
}

/** The registry ids this app can name: the ones with a block title or an offence of their own. Offered in the Offence rules picker only (Screening's rule), so no two rows read alike and none reads "Offence" (#233, R2). */
export function offerableContracts(ids: readonly string[]): string[] {
  return ids.filter((id) => CONTRACT_BLOCK_TITLES[id] !== undefined || offenceOf(id) !== null);
}

/** True for the second (or later) way of an offence that has a block title of its own: it carries the alternate-limb note. */
export function isAlternateLimb(contractId: string): boolean {
  const o = offenceOf(contractId);
  return !!o && !!CONTRACT_BLOCK_TITLES[contractId] && o.contracts.indexOf(contractId) > 0;
}

export function offenceOf(contractId: string): Offence | null {
  return OFFENCES.find((o) => o.contracts.includes(contractId)) ?? null;
}

/** The accessible name of an offence's checkbox (R7, 15 Oct): the title, a separator, then the sections ("Criminal breach of trust \u2014 BNS 316 \u00b7 IPC 405"), never the two run together. */
export function offenceCheckboxName(o: { title: string; sections: string }): string {
  return o.sections ? `${o.title} \u2014 ${o.sections}` : o.title;
}

/** The ids of the notes under an offence's checkbox that describe it (read after the name, not joined into it). */
export function offenceNoteIds(o: { id: string; notValidated?: true; ipcChecked: string | null }): string[] {
  return [...(o.notValidated ? [`offence-${o.id}-not-validated`] : []), ...(o.ipcChecked ? [`offence-${o.id}-ipc`] : [])];
}

/** The list label of one contract (R1, #302): the block title when the contract has its own way-of-being-made-out title, else the offence's own "<title> · <sections>" (the same rule everywhere). */
export function contractListLabel(contractId: string): string {
  const off = offenceOf(contractId);
  return CONTRACT_BLOCK_TITLES[contractId] ?? (off ? offenceLabel(off) : blockTitle(contractId));
}
