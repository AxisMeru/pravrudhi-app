// "How it was built", the data section after step 1 (app#431): R1's worded note HOW_BUILT_DATA_NOTE_R1_WORDED_v1g_2026-10-17.md (sha12 13e629837479), keys cleared to ship only, each pinned by sha256[:16] in howItWasBuiltData.spec.ts.
// NOT built (not cleared): r4_published, r6_source_quote.
// r3_published is built from the app's own STATUTE_NOTICE so the quoted sentence is the app's, byte for byte. The hidden-set sentence np3 is the one constant NS_HIDDEN_SPLIT (R1, 1502d9c1b8e3fdf1).
import { NS_HIDDEN_SPLIT } from "./nyayasiddhiSubmit";
import { STATUTE_NOTICE } from "./statuteNotice";

export const DATA_NOTE_TEXT: Readonly<Record<string, string>> = {
  heading: "More on step 1: the data sets",
  intro: "Step 1 says we gathered public judgments. These are the data sets behind it: where each came from, how it is licensed, what we used it for, and what we publish.",
  r1_name: "High Court judgments",
  r1_source: "The Indian High Court Judgments data set on AWS Open Data, managed by Dattam Labs, taken from the eCourts website.",
  r1_licence: "CC BY 4.0, as the registry page for the data set states.",
  r1_used: "Real-text training material, our evaluation sets, and the items in NyayaSiddhi.",
  r1_published: "We do not publish the judgments as a collection. The NyayaSiddhi items built from them are public (see NyayaSiddhi below).",
  r1_caveat_cov: "Coverage is what the data set holds.",
  r1_caveat_attr: "Attribution: Indian High Court Judgments dataset, published by Dattam Labs, sourced from the eCourts judgments portal (judgments.ecourts.gov.in), licensed under CC BY 4.0. https://github.com/vanga/indian-high-court-judgments. Also listed at https://registry.opendata.aws/indian-high-court-judgments",
  r2_name: "Supreme Court judgments",
  r2_source: "Public Supreme Court judgments. We have not confirmed the source or licence of our copy. Comparing titles and dates, part of it matches judgments in a public collection licensed CC BY 4.0; we do not rely on that licence for our copy.",
  r3_name: "Statute text",
  r3_source: "Official-source PDFs of the Acts, fetched from India Code and other official sites: the BNS, the BNSS, the Digital Personal Data Protection Act, the Negotiable Instruments Act (the cheque-dishonour sections), the Specific Relief Act and the IPC.",
  r3_licence_fallback: "Official government publications. Terms of use are not set out here.",
  r3_used: "The ingredient lists and the review agendas.",
  r3_published: `Not republished. The app says "${STATUTE_NOTICE}"`,
  r3_caveat: "The Negotiable Instruments Act was rebuilt section by section because its PDF has no text layer.",
  r4_name: "Constructed cases",
  r4_source: "Written by us and labelled as constructed wherever they are shown.",
  r4_licence: "Ours.",
  r4_caveat: "They are not court findings.",
  r5_name: "The labels",
  r5_source: "Two model readers worked separately, each quoting the court's words. A mechanical checker kept a row only if both readers agreed and the quoted words were found in the judgment.",
  r5_published: "Only inside NyayaSiddhi (see below).",
  r5_caveat: "The labels are model-extracted and not human-checked. There is no human-checked subset.",
  r6_name: "NyayaSiddhi v0.2",
  r6_source: "Built from High Court judgments (AWS Open Data, CC BY 4.0) by pinned scripts. By the source field, every released item is a High Court judgment; Supreme Court items were dropped before release. Items naming a minor or a protected victim are dropped, and adult names are kept as in the source. Short items and duplicates are dropped.",
  r6_licence: "Our annotations, metadata and scorer are CC BY 4.0. The source text is court-derived; the dataset card gives the basis.",
  r6_used: "A public development benchmark with two released sets. The first was used to design fixes. Both released sets were seen by us and by the models we used. The dataset card gives the counts.",
  r6_published: "https://huggingface.co/datasets/AxisMeru/nyayasiddhi (README, the two data files, the scorer and the schemas).",
  r6_caveat: "There is no hidden set yet. The mechanism for one is being built. The organisers would hold it; there is no independent custodian yet. The labels are model-extracted and not human-checked.",
  r7_name: "Training and held-out sets for our judges",
  r7_source: "Built from the sources above.",
  r7_published: "Not on Hugging Face. The sealed evaluation sets stay private so a future test cannot be learned in advance.",
  r7_caveat: "Judgments were assigned to training, held-out or evaluation by a fixed rule on identity, and checked for overlap by identity and by text. Some pairs share text, for example a judgment that reproduces the one under appeal.",
  r7_sc: "Some training examples come from Supreme Court judgments, from a copy whose source and licence we have not yet confirmed.",
  r8_name: "Public research sets used in earlier work",
  r8_casehold: "CaseHOLD: part of the training data of our 7B fine-tune, prabhasa-nyaya-7b-sft, derives from the CaseHOLD validation split. CaseHOLD's code repository is Apache-2.0; its dataset card has no licence field, so we state none for the data.",
  r8_legalbench: "LegalBench: the hearsay and personal_jurisdiction tasks, CC BY 4.0, used only as held-out checks and never as training data. We do not use its non-commercial tasks.",
  r8_published: "These sets belong to their owners; we do not republish them.",
  r9_name: "Models on Hugging Face",
  r9_32b: "nyaya-element-judge-32b-v0: a LoRA adapter on Qwen/Qwen2.5-32B, licence Apache-2.0, as its card states.",
  r9_7b: "prabhasa-nyaya-7b-sft: a full fine-tune of Qwen2.5-7B, licence listed as \"other\" on its card; the card names part of its training data as derived from CaseHOLD.",
  r9_other: "Our other model repositories are not described here yet.",
  r10_name: "The citation index",
  r10_source: "Built from the court text we hold. It records which citations exist, not what a case held.",
  r10_published: "Not on Hugging Face.",
  r10_caveat: "It looks up Supreme Court citations written in the (year) volume SCC page form. Any other form comes back \"not found in our index\", which is no evidence either way.",
  np_heading: "What we do not publish, and why",
  np1: "The training sets: not on Hugging Face.",
  np2: "The sealed and held-out evaluation sets: private so a future test cannot be learned in advance.",
  np3: NS_HIDDEN_SPLIT,
  np4: "The citation index and the statute text: not republished; the official text stays with its owner.",
  np5: "You can re-run the NyayaSiddhi scorer on the released sets, score your own predictions with it on your own machine, and fetch the public judgment collections from their owners to read the court text. You cannot rebuild our training sets or our labels from what we publish.",
  cv_heading: "Limits",
  cv1: "The labels are model-extracted. No human has checked them, and there is no human-checked subset.",
  cv2: "Our own figures on the released sets are development figures on material we have seen.",
  cv3: "Overlap between training and evaluation was checked by identity and by text. Some pairs share text.",
  cv4: "Coverage is the offences in the screening's picker, and the courts and years our sources hold.",
  cv5: "The court texts are public orders and carry real names. The NyayaSiddhi release was screened for minors and protected victims.",
  cv6: "The terms of the court-order portals behind the AWS data sets are not ours to restate.",
};

/** Each data set: its name (a heading) then its lines in R1's order. Keys refer to DATA_NOTE_TEXT. */
export const DATA_SETS: readonly { id: string; name: string; lines: readonly string[] }[] = [
  { id: "r1", name: "r1_name", lines: ["r1_source", "r1_licence", "r1_used", "r1_published", "r1_caveat_cov", "r1_caveat_attr"] },
  { id: "r2", name: "r2_name", lines: ["r2_source"] },
  { id: "r3", name: "r3_name", lines: ["r3_source", "r3_licence_fallback", "r3_used", "r3_published", "r3_caveat"] },
  { id: "r4", name: "r4_name", lines: ["r4_source", "r4_licence", "r4_caveat"] },
  { id: "r5", name: "r5_name", lines: ["r5_source", "r5_published", "r5_caveat"] },
  { id: "r6", name: "r6_name", lines: ["r6_source", "r6_licence", "r6_used", "r6_published", "r6_caveat"] },
  { id: "r7", name: "r7_name", lines: ["r7_source", "r7_published", "r7_caveat", "r7_sc"] },
  { id: "r8", name: "r8_name", lines: ["r8_casehold", "r8_legalbench", "r8_published"] },
  { id: "r9", name: "r9_name", lines: ["r9_32b", "r9_7b", "r9_other"] },
  { id: "r10", name: "r10_name", lines: ["r10_source", "r10_published", "r10_caveat"] },
];

export const DATA_NOT_PUBLISHED: readonly string[] = ["np1", "np2", "np3", "np4", "np5"];
export const DATA_LIMITS: readonly string[] = ["cv1", "cv2", "cv3", "cv4", "cv5", "cv6"];

/** R1's five lead-ins (17 Oct), in this order; each is shown only where a data set has that kind of line, and several caveat lines share one "Note". They are not part of any line's hash. */
export const DATA_LEAD_INS = { source: "Source", licence: "Licence", used: "Used for", published: "Published", note: "Note" } as const;
export type DataLeadIn = keyof typeof DATA_LEAD_INS;

/** The lead-in of a line by its key: source, licence, used, published and caveat lines get theirs; the lines of the older-research and model rows (r8_casehold, r8_legalbench, r9_*) name their own subject and get none. */
export function leadInOf(key: string): DataLeadIn | null {
  const part = key.replace(/^r\d+_/, "");
  if (part === "source" || part === "source_fallback") return "source";
  if (part === "licence" || part === "licence_fallback") return "licence";
  if (part === "used") return "used";
  if (part === "published") return "published";
  if (part.startsWith("caveat") || part === "sc") return "note";
  return null;
}

/** A set's lines grouped under their lead-ins, in order: consecutive lines with the same lead-in share one label. */
export function groupLines(lines: readonly string[]): { leadIn: DataLeadIn | null; keys: string[] }[] {
  const out: { leadIn: DataLeadIn | null; keys: string[] }[] = [];
  for (const k of lines) {
    const l = leadInOf(k);
    const last = out[out.length - 1];
    if (last && l !== null && last.leadIn === l) last.keys.push(k);
    else out.push({ leadIn: l, keys: [k] });
  }
  return out;
}
