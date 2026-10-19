// Labels of the bail-drafting and synopsis cards. `R1` keys are R1's words (A4_BAIL_DRAFTING_STRINGS 2026-10-17, A4_PASS2 and A8_SYNOPSIS), pinned by previewDraftingCopy.spec.ts.
// `DRAFT` keys are form labels not yet worded by R1 (goal-context/web-find/PREVIEW_DRAFTING_STRINGS_DRAFT.txt); the spec lists them so R1's final file replaces them one by one.
// The engine's own sentences (label, framing lines, unconfirmed line, referral text, notes, fallback and dates lines) are shown as sent.
export const DRAFTING_R1 = {
  notesHeading: "Notes for the lawyer",
  fillInsHeading: "Details to fill in",
  moreNotesHeading: "More notes",
  templateOnly: "The draft grounds could not be made, so this shows your facts and the notes only.",
  bailTickWarning: "Tick only facts that are on the applicant's side. A fact in the court's, the prosecution's or the complainant's voice, or a prior conviction, may not belong in the applicant's grounds.",
  synopsisTickWarning: "Tick only the facts and dates you want in the synopsis. A fact in the court's or the other side's voice, or a prior conviction, may not belong in it.",
} as const;

export const DRAFTING_DRAFT = {
  bailName: "Bail application grounds",
  bailLine: "Writes a first draft of the grounds from the facts you enter, for a lawyer to rewrite. It is not advice on how the application will go.",
  synopsisName: "Synopsis and list of dates",
  synopsisLine: "Writes a first draft of a synopsis and a list of dates from the papers you added and the facts you enter, for a lawyer to rewrite.",
  consent: "I am a lawyer and I will read and rewrite this draft. The facts I enter are sent to an outside AI model service to write the draft.",
  consentSynopsis: "I am a lawyer and I will read and rewrite this draft. The facts I enter, and the sentences from my papers that hold the dates, are sent to an outside AI model service to write the draft.",
  kind: "Kind of application",
  kindBail: "Bail",
  kindAnticipatory: "Anticipatory bail",
  forum: "Court",
  forumTrial: "Trial court",
  forumSessions: "Sessions court or High Court",
  offenceDate: "Date of the offence",
  firDate: "Date of the FIR",
  factsHeading: "Facts",
  factText: "Fact",
  factApplicant: "On the applicant's side",
  groundsHeading: "Grounds this fact goes to (optional)",
  addFact: "Add a fact",
  tagsHeading: "Mark any that apply. No draft is made for a sensitive case.",
  sections: "Sections charged (optional, separated by commas)",
  documentLabel: "Name of the document (optional)",
  runBail: "Draft the grounds",
  runSynopsis: "Draft the synopsis and list of dates",
  needMatter: "Add papers to the matter above first.",
  factsSetAside: "Facts not marked as the applicant's side, left out:",
  keepRows: "Keep this row",
  updateRows: "Update with the rows kept",
  copy: "Copy the draft",
} as const;

export const GROUND_LABELS: Record<string, string> = { accusation_nature: "Nature of the accusation", custody_period: "Time in custody", antecedents: "Antecedents", flight: "Risk of flight", tampering: "Tampering with evidence", co_accused: "Co-accused" };
export const TAG_LABELS: Record<string, string> = { pocso: "POCSO Act", minor_involved: "A minor is involved", sexual_offence: "Sexual offence", marked_sensitive: "Marked sensitive", trafficking: "Trafficking" };
