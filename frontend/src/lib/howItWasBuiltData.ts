// "How it was built", the data section after step 1 (app#431): R1's worded note HOW_BUILT_DATA_NOTE_R1_WORDED_v1b_2026-10-17.md (sha12 5885ee683fec (v1b)), SHIP keys only, each pinned by sha256[:16] in howItWasBuiltData.spec.ts.
// NOT built (HELD by R1): r1_caveat_attr, r4_published and the whole r8 block (r8_name, r8_casehold, r8_legalbench, r8_published); r2 shows only its fallback source line, r3 only its licence fallback.
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
  r2_name: "Supreme Court judgments",
  r2_source_fallback: "Public Supreme Court judgments. We have not yet confirmed the source and licence of our copy, so this page does not state them.",
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
  r6_source: "Built from court judgments by pinned scripts. The court's own finding quote is removed from each item so the label is not given away. Items are screened for minors and protected victims; short items and duplicates are dropped.",
  r6_licence: "Our annotations, metadata and scorer are CC BY 4.0. The source text is court-derived; the dataset card gives the basis.",
  r6_used: "A public development benchmark with two released sets. The first was used to design fixes. The second was read by a model we used earlier. The dataset card gives the counts.",
  r6_published: "https://huggingface.co/datasets/AxisMeru/nyayasiddhi (README, the two data files, the scorer and the schemas).",
  r6_caveat: "There is no hidden set yet. The mechanism for one is being built. The organisers would hold it; there is no independent custodian yet. Both released sets were seen by us. The labels are model-extracted and not human-checked.",
  r7_name: "Training and held-out sets for our judges",
  r7_source: "Built from the sources above.",
  r7_published: "Not on Hugging Face. The sealed evaluation sets stay private so a future test cannot be learned in advance.",
  r7_caveat: "Judgments were assigned to training, held-out or evaluation by a fixed rule on identity, and checked for overlap by identity and by text. Some pairs share text, for example a judgment that reproduces the one under appeal.",
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
  { id: "r1", name: "r1_name", lines: ["r1_source", "r1_licence", "r1_used", "r1_published", "r1_caveat_cov"] },
  { id: "r2", name: "r2_name", lines: ["r2_source_fallback"] },
  { id: "r3", name: "r3_name", lines: ["r3_source", "r3_licence_fallback", "r3_used", "r3_published", "r3_caveat"] },
  { id: "r4", name: "r4_name", lines: ["r4_source", "r4_licence", "r4_caveat"] },
  { id: "r5", name: "r5_name", lines: ["r5_source", "r5_published", "r5_caveat"] },
  { id: "r6", name: "r6_name", lines: ["r6_source", "r6_licence", "r6_used", "r6_published", "r6_caveat"] },
  { id: "r7", name: "r7_name", lines: ["r7_source", "r7_published", "r7_caveat"] },
  { id: "r9", name: "r9_name", lines: ["r9_32b", "r9_7b", "r9_other"] },
  { id: "r10", name: "r10_name", lines: ["r10_source", "r10_published", "r10_caveat"] },
];

export const DATA_NOT_PUBLISHED: readonly string[] = ["np1", "np2", "np3", "np4", "np5"];
export const DATA_LIMITS: readonly string[] = ["cv1", "cv2", "cv3", "cv4", "cv5", "cv6"];
