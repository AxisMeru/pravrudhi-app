// The offences the Screening view offers, grouped by what the user is screening for, with the BNS section and its IPC equivalent on one line.
// Only the contracts the engine's registry marks validated are offered in v1 (refer-first); the user picks, nothing is suggested. The section
// pairs are authored here for R1/R2 to check (offences.spec.ts pins them against the contract sources in fixtures/contractElements.json).
export interface Offence {
  id: string;
  title: string;
  bns: string | null;
  ipc: string | null;
  /** One line shown with the title: the BNS section and its IPC equivalent. */
  sections: string;
  contracts: readonly string[];
  /** The IPC section the engine actually judges against, set only where the BNS counterpart is not validated (the four IPC-family offences). */
  ipcChecked: string | null;
}

const sections = (bns: string | null, ipc: string | null): string =>
  [bns ? `BNS ${bns}` : null, ipc ? `IPC ${ipc}` : "no IPC equivalent"].filter(Boolean).join(" · ");

export const OFFENCES: readonly Offence[] = [
  { id: "breach-of-trust", title: "Criminal breach of trust", bns: "316", ipc: "405", sections: sections("316", "405"), contracts: ["ipc405_misappropriation", "ipc405_use_or_disposal", "ipc405_wilfully_suffers"], ipcChecked: "405" },
  { id: "cheating", title: "Cheating", bns: "318", ipc: "415", sections: sections("318", "415"), contracts: ["ipc415_property", "ipc415_damaging_act"], ipcChecked: "415" },
  { id: "cheating-personation", title: "Cheating by personation", bns: "319", ipc: "416", sections: sections("319", "416"), contracts: ["ipc416"], ipcChecked: "416" },
  { id: "false-information", title: "False information to a public servant", bns: "217", ipc: "182", sections: sections("217", "182"), contracts: ["ipc182_misdirected_act", "ipc182_abuse_of_power"], ipcChecked: "182" },
  { id: "promise-to-marry", title: "Sexual intercourse by deceitful means or a false promise to marry", bns: "69", ipc: null, sections: sections("69", null), contracts: ["bns69"], ipcChecked: null },
  { id: "cruelty", title: "Cruelty by the husband or his relatives", bns: "85", ipc: "498A", sections: sections("85, 86", "498A"), contracts: ["bns85"], ipcChecked: null },
  { id: "abetment", title: "Abetment", bns: "45, 46", ipc: "107, 108", sections: sections("45, 46", "107, 108"), contracts: ["bns46_instigation", "bns46_conspiracy", "bns46_intentional_aid"], ipcChecked: null },
  { id: "abetment-outside-india", title: "Abetment in India of an offence outside India", bns: "47", ipc: "108A", sections: sections("47", "108A"), contracts: ["bns47"], ipcChecked: null },
];

export function offenceOf(contractId: string): Offence | null {
  return OFFENCES.find((o) => o.contracts.includes(contractId)) ?? null;
}
